from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uuid, redis, json, os, asyncio, socket
import httpx
import dns.resolver
import dns.exception

app = FastAPI(title="SecPlatform Module — Discovery")
security = HTTPBearer()

redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/1"))
MODULE_SECRET = os.getenv("MODULE_SECRET", "dev-secret")
MODULE_PORT   = int(os.getenv("MODULE_PORT", "8002"))

COMMON_SUBDOMAINS = [
    "www", "mail", "smtp", "pop", "imap", "ftp", "sftp",
    "api", "api2", "apiv2", "rest", "graphql", "grpc",
    "admin", "portal", "panel", "dashboard", "console", "cpanel", "webmail",
    "dev", "development", "staging", "test", "qa", "uat", "sandbox",
    "prod", "production", "app", "apps", "web", "mobile",
    "cdn", "static", "assets", "media", "img", "images", "files",
    "docs", "wiki", "help", "support", "kb", "blog",
    "vpn", "remote", "gateway", "proxy", "relay",
    "auth", "login", "sso", "iam", "oauth",
    "db", "database", "mysql", "postgres", "redis", "mongo",
    "git", "gitlab", "github", "bitbucket", "svn",
    "ci", "jenkins", "travis", "drone", "build",
    "monitor", "grafana", "prometheus", "kibana", "elastic",
    "smtp", "mx", "ns", "ns1", "ns2", "dns",
    "shop", "store", "pay", "payment", "checkout", "billing",
    "internal", "intranet", "corp", "private",
    "status", "health", "ping",
    "m", "mobile", "wap", "touch",
    "old", "legacy", "v1", "v2", "v3",
    "beta", "alpha", "demo",
    "secure", "ssl", "https",
    "backup", "bak",
    "vpn", "owa", "exchange",
]

COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587,
                993, 995, 1433, 1521, 2222, 3000, 3306, 3389, 5432,
                5900, 6379, 8000, 8080, 8443, 8888, 9200, 9300, 27017]


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != MODULE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid module token")


class ScanRequest(BaseModel):
    target: str
    options: dict = {}


class ScanResponse(BaseModel):
    job_id: str
    status: str = "pending"


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    result: dict | None = None


# ── CONTRACT ENDPOINTS ───────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "tools": ["dns", "httpx", "portscan"]}


@app.get("/info")
async def info():
    with open("module.json") as f:
        return json.load(f)


@app.post("/scan", response_model=ScanResponse)
async def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_token),
):
    job_id = str(uuid.uuid4())
    redis_client.setex(f"job:{job_id}", 3600, json.dumps({
        "job_id": job_id, "status": "pending", "progress": 0, "result": None
    }))
    background_tasks.add_task(run_scan, job_id, request.target, request.options)
    return ScanResponse(job_id=job_id)


@app.get("/scan/{job_id}", response_model=JobStatus)
async def get_scan(job_id: str, _: None = Depends(verify_token)):
    raw = redis_client.get(f"job:{job_id}")
    if not raw:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(**json.loads(raw))


@app.post("/report/{job_id}")
async def get_report(job_id: str, _: None = Depends(verify_token)):
    raw = redis_client.get(f"job:{job_id}")
    if not raw:
        raise HTTPException(status_code=404, detail="Job not found")
    data = json.loads(raw)
    if data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job not completed")
    return {"job_id": job_id, "data": data["result"]}


# ── DISCOVERY ENGINE ──────────────────────────────────────────────────────────

async def resolve_host(host: str) -> list[str]:
    loop = asyncio.get_event_loop()
    try:
        infos = await loop.getaddrinfo(host, None)
        return list({info[4][0] for info in infos})
    except Exception:
        return []


async def dns_records(domain: str) -> dict:
    records: dict = {}
    resolver = dns.resolver.Resolver()
    resolver.lifetime = 5.0
    for rtype in ["A", "AAAA", "MX", "NS", "TXT", "CNAME"]:
        try:
            ans = await asyncio.get_event_loop().run_in_executor(
                None, lambda rt=rtype: resolver.resolve(domain, rt)
            )
            records[rtype] = [str(r) for r in ans]
        except Exception:
            pass
    return records


async def probe_subdomain(subdomain: str, domain: str, client: httpx.AsyncClient) -> dict | None:
    host = f"{subdomain}.{domain}"
    ips = await resolve_host(host)
    if not ips:
        return None
    entry: dict = {"host": host, "ips": ips, "http_services": [], "status": "alive"}
    for scheme in ["https", "http"]:
        url = f"{scheme}://{host}"
        try:
            resp = await client.head(url, timeout=5, follow_redirects=True)
            entry["http_services"].append({
                "url": url,
                "status_code": resp.status_code,
                "server": resp.headers.get("server", ""),
                "content_type": resp.headers.get("content-type", ""),
                "redirect_url": str(resp.url) if resp.url else None,
            })
        except Exception:
            pass
    return entry


async def scan_port(ip: str, port: int) -> bool:
    loop = asyncio.get_event_loop()
    try:
        fut = loop.run_in_executor(None, _tcp_connect, ip, port)
        return await asyncio.wait_for(fut, timeout=1.5)
    except Exception:
        return False


def _tcp_connect(ip: str, port: int) -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.5)
        r = s.connect_ex((ip, port))
        s.close()
        return r == 0
    except Exception:
        return False


def classify_port_severity(port: int, is_exposed: bool) -> str:
    critical_ports = {21, 23, 3389, 5900}
    high_ports     = {22, 25, 110, 143, 3306, 5432, 1433, 1521, 6379, 27017, 9200}
    if not is_exposed:
        return "info"
    if port in critical_ports:
        return "critical"
    if port in high_ports:
        return "high"
    return "medium"


async def run_scan(job_id: str, target: str, options: dict):
    def update(status: str, progress: int, result=None):
        redis_client.setex(f"job:{job_id}", 3600, json.dumps({
            "job_id": job_id, "status": status, "progress": progress, "result": result
        }))

    try:
        domain = target.strip().lower().removeprefix("http://").removeprefix("https://").split("/")[0]
        update("running", 5)

        findings = []
        summary: dict = {"domain": domain, "subdomains_found": 0, "live_hosts": 0, "open_ports": 0}

        # 1. DNS records for root domain
        update("running", 10)
        root_ips = await resolve_host(domain)
        dns_recs = await dns_records(domain)
        summary["root_ips"] = root_ips
        summary["dns_records"] = dns_recs

        if not root_ips:
            update("completed", 100, {
                "domain": domain, "findings": [],
                "summary": {**summary, "note": "Domain could not be resolved"}
            })
            return

        # 2. Subdomain enumeration
        wordlist = options.get("wordlist", COMMON_SUBDOMAINS)
        if isinstance(wordlist, str):
            wordlist = COMMON_SUBDOMAINS

        update("running", 20)
        live_hosts = []
        batch_size = 20

        async with httpx.AsyncClient(verify=False) as client:
            for i in range(0, len(wordlist), batch_size):
                batch = wordlist[i:i + batch_size]
                tasks = [probe_subdomain(sub, domain, client) for sub in batch]
                results = await asyncio.gather(*tasks)
                for r in results:
                    if r is not None:
                        live_hosts.append(r)
                        if r["http_services"]:
                            findings.append({
                                "title": f"Web service on {r['host']}",
                                "severity": "info",
                                "description": f"Subdomain {r['host']} is alive and serving HTTP/HTTPS",
                                "host": r["host"],
                                "evidence": r["http_services"],
                            })
                        else:
                            findings.append({
                                "title": f"Subdomain found: {r['host']}",
                                "severity": "info",
                                "description": f"Subdomain {r['host']} resolves to {', '.join(r['ips'])}",
                                "host": r["host"],
                                "evidence": {"ips": r["ips"]},
                            })
                progress = 20 + int((i / len(wordlist)) * 40)
                update("running", min(progress, 60))

        summary["subdomains_found"] = len(live_hosts)
        summary["live_hosts"] = len(live_hosts)

        # 3. Port scan on root domain IPs
        update("running", 65)
        ports_to_scan = options.get("ports", COMMON_PORTS[:20])
        open_ports = []
        for ip in root_ips[:3]:
            port_tasks = [scan_port(ip, p) for p in ports_to_scan]
            port_results = await asyncio.gather(*port_tasks)
            for port, is_open in zip(ports_to_scan, port_results):
                if is_open:
                    open_ports.append({"ip": ip, "port": port})
                    severity = classify_port_severity(port, True)
                    findings.append({
                        "title": f"Open port {port} on {ip}",
                        "severity": severity,
                        "description": f"Port {port} is open on {ip}",
                        "host": ip,
                        "port": port,
                        "evidence": {"state": "open"},
                    })

        summary["open_ports"] = len(open_ports)
        update("running", 90)

        # 4. TXT records for SPF/DMARC analysis
        txt_records = dns_recs.get("TXT", [])
        has_spf   = any("v=spf1" in r for r in txt_records)
        has_dmarc = False
        try:
            resolver = dns.resolver.Resolver()
            dmarc_ans = await asyncio.get_event_loop().run_in_executor(
                None, lambda: resolver.resolve(f"_dmarc.{domain}", "TXT")
            )
            has_dmarc = bool(dmarc_ans)
        except Exception:
            pass

        if not has_spf:
            findings.append({
                "title": "Missing SPF record",
                "severity": "medium",
                "description": f"Domain {domain} has no SPF record. This allows email spoofing.",
                "host": domain,
                "evidence": {"txt_records": txt_records},
                "remediation": "Add an SPF TXT record: v=spf1 include:your-provider.com ~all",
            })
        if not has_dmarc:
            findings.append({
                "title": "Missing DMARC record",
                "severity": "medium",
                "description": f"Domain {domain} has no DMARC policy. Email authentication is not enforced.",
                "host": domain,
                "evidence": {},
                "remediation": "Add _dmarc TXT record: v=DMARC1; p=reject; rua=mailto:dmarc@domain",
            })

        findings.sort(key=lambda f: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
                      .get(f["severity"], 5))

        update("completed", 100, {
            "domain": domain,
            "live_hosts": live_hosts,
            "open_ports": open_ports,
            "findings": findings,
            "summary": summary,
        })

    except Exception as e:
        update("failed", 0, {"error": str(e)})
