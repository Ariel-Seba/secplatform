from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uuid, redis, json, os, asyncio

app = FastAPI(title="SecPlatform Module — _template")
security = HTTPBearer()

redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/1"))
MODULE_SECRET = os.getenv("MODULE_SECRET", "dev-secret")
MODULE_PORT   = int(os.getenv("MODULE_PORT", "8099"))


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
    return {"status": "ok", "version": "1.0.0", "tools": []}


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


# ── INTERNAL TASK ─────────────────────────────────────────────────────────────

async def run_scan(job_id: str, target: str, options: dict):
    def update(status: str, progress: int, result=None):
        redis_client.setex(f"job:{job_id}", 3600, json.dumps({
            "job_id": job_id, "status": status, "progress": progress, "result": result
        }))

    try:
        update("running", 10)
        # TODO: implement actual scan logic here
        await asyncio.sleep(2)
        update("running", 50)
        await asyncio.sleep(2)
        result = {"target": target, "findings": [], "summary": "Scan completed"}
        update("completed", 100, result)
    except Exception as e:
        update("failed", 0, {"error": str(e)})
