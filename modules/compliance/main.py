from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uuid, redis, json, os, asyncio, shutil, tempfile, subprocess, re

app = FastAPI(title="SecPlatform Module — Compliance")
security = HTTPBearer()

redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/1"))
MODULE_SECRET = os.getenv("MODULE_SECRET", "dev-secret")
MODULE_PORT   = int(os.getenv("MODULE_PORT", "8003"))

SEVERITY_MAP = {
    "CRITICAL": "critical",
    "HIGH":     "high",
    "MEDIUM":   "medium",
    "LOW":      "low",
    "INFO":     "info",
}

FRAMEWORK_LABELS = {
    "dockerfile":     "Dockerfile security (CIS Docker Benchmark)",
    "docker_compose": "Docker Compose security",
    "terraform":      "Terraform IaC security",
    "kubernetes":     "Kubernetes security",
    "github_actions": "GitHub Actions security",
    "secrets":        "Secret detection",
}


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
    checkov_ok = shutil.which("checkov") is not None
    return {"status": "ok", "version": "1.0.0", "tools": ["checkov"], "checkov_available": checkov_ok}


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


# ── COMPLIANCE ENGINE ─────────────────────────────────────────────────────────

def parse_checkov_output(raw: str) -> list[dict]:
    findings = []
    try:
        data = json.loads(raw)
    except Exception:
        return findings

    results = data.get("results", {})
    failed = results.get("failed_checks", [])

    for check in failed:
        sev_raw = check.get("severity") or "MEDIUM"
        findings.append({
            "title": check.get("check_id", "UNKNOWN") + " — " + check.get("check_type", ""),
            "check_id": check.get("check_id", ""),
            "check_name": check.get("check_id", ""),
            "severity": SEVERITY_MAP.get(str(sev_raw).upper(), "medium"),
            "description": check.get("check_id", ""),
            "file": check.get("repo_file_path") or check.get("file_path", ""),
            "resource": check.get("resource", ""),
            "evidence": {
                "code_block": check.get("code_block", []),
                "evaluations": check.get("evaluations"),
                "guideline": check.get("guideline", ""),
            },
            "remediation": check.get("guideline", "See Checkov documentation for remediation steps."),
        })
    return findings


async def run_checkov(scan_dir: str, frameworks: list[str]) -> tuple[list[dict], dict]:
    all_findings: list[dict] = []
    raw_summaries: dict = {}

    framework_arg = ",".join(frameworks) if frameworks else "dockerfile,docker_compose,terraform,kubernetes,github_actions,secrets"

    cmd = [
        "checkov",
        "-d", scan_dir,
        "--framework", framework_arg,
        "--output", "json",
        "--compact",
        "--quiet",
    ]

    loop = asyncio.get_event_loop()

    def _run():
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
        return proc.stdout, proc.returncode

    try:
        stdout, _ = await asyncio.wait_for(loop.run_in_executor(None, _run), timeout=130)
    except asyncio.TimeoutError:
        return all_findings, {"error": "Checkov timed out after 120s"}
    except Exception as e:
        return all_findings, {"error": str(e)}

    # checkov returns one JSON object per framework when multiple are run
    # They may be concatenated or wrapped; split on top-level objects
    decoder = json.JSONDecoder()
    pos = 0
    stdout = stdout.strip()
    while pos < len(stdout):
        try:
            obj, end = decoder.raw_decode(stdout, pos)
            pos = end
            while pos < len(stdout) and stdout[pos] in " \n\r\t":
                pos += 1
            findings = parse_checkov_output(json.dumps(obj))
            all_findings.extend(findings)
            summary = obj.get("summary", {})
            fw = obj.get("check_type", "unknown")
            raw_summaries[fw] = summary
        except json.JSONDecodeError:
            break

    return all_findings, raw_summaries


async def clone_repo(url: str, dest: str) -> bool:
    # Only allow https:// or git@ URLs (no file://, no command injection)
    if not re.match(r'^(https?://|git@)', url):
        return False

    cmd = ["git", "clone", "--depth", "1", "--", url, dest]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        await asyncio.wait_for(proc.communicate(), timeout=60)
        return proc.returncode == 0
    except asyncio.TimeoutError:
        proc.kill()
        return False


async def run_scan(job_id: str, target: str, options: dict):
    def update(status: str, progress: int, result=None):
        redis_client.setex(f"job:{job_id}", 3600, json.dumps({
            "job_id": job_id, "status": status, "progress": progress, "result": result
        }))

    tmpdir = None
    try:
        update("running", 10)
        frameworks = options.get("frameworks", [])

        is_git = bool(re.match(r'^(https?://|git@)', target.strip()))
        tmpdir = tempfile.mkdtemp(prefix="compliance_scan_")

        if is_git:
            update("running", 20)
            ok = await clone_repo(target.strip(), tmpdir)
            if not ok:
                update("failed", 0, {"error": f"Failed to clone repository: {target}"})
                return
            scan_dir = tmpdir
        else:
            # Treat as local path — must be within /app/scans (mounted volume)
            allowed_base = "/app/scans"
            real_path = os.path.realpath(target)
            if not real_path.startswith(allowed_base):
                update("failed", 0, {"error": "Path traversal detected or path not allowed"})
                return
            if not os.path.exists(real_path):
                update("failed", 0, {"error": f"Path not found: {target}"})
                return
            scan_dir = real_path

        update("running", 40)

        findings, summaries = await run_checkov(scan_dir, frameworks)
        update("running", 85)

        findings.sort(key=lambda f: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
                      .get(f["severity"], 5))

        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in findings:
            counts[f["severity"]] = counts.get(f["severity"], 0) + 1

        update("completed", 100, {
            "target": target,
            "scan_type": "git_repo" if is_git else "local_path",
            "findings": findings,
            "summary": {
                "total_findings": len(findings),
                "by_severity": counts,
                "frameworks_scanned": summaries,
                "compliance_score": max(0, 100 - counts["critical"] * 20 - counts["high"] * 10
                                       - counts["medium"] * 3 - counts["low"] * 1),
            },
        })

    except Exception as e:
        update("failed", 0, {"error": str(e)})
    finally:
        if tmpdir and os.path.exists(tmpdir):
            try:
                shutil.rmtree(tmpdir)
            except Exception:
                pass
