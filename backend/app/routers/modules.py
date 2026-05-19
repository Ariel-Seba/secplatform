from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import httpx
from app.database import get_db
from app.models.user import User, UserRole
from app.models.scan import ScanJob
from app.auth.dependencies import get_current_user
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

MODULE_URLS = {
    "pentest":    settings.module_pentest_url,
    "discovery":  settings.module_discovery_url,
    "compliance": settings.module_compliance_url,
}


class ScanRequest(BaseModel):
    target: str
    options: dict = {}


async def call_module(module_id: str, path: str, method: str = "GET", body: dict | None = None):
    url = MODULE_URLS.get(module_id)
    if not url:
        raise HTTPException(status_code=404, detail=f"Module not found: {module_id}")
    headers = {"Authorization": f"Bearer {settings.module_secret}"}
    async with httpx.AsyncClient(timeout=30) as client:
        kwargs: dict = {"headers": headers}
        if body is not None:
            kwargs["json"] = body
        resp = await getattr(client, method.lower())(f"{url}{path}", **kwargs)
        resp.raise_for_status()
        return resp.json()


@router.get("")
async def list_modules(user: User = Depends(get_current_user)):
    if user.role in (UserRole.superadmin, UserRole.admin):
        visible = list(MODULE_URLS.keys())
    else:
        visible = [m for m in MODULE_URLS if m in user.allowed_modules]

    modules = []
    for mod_id in visible:
        try:
            info = await call_module(mod_id, "/info")
            info["status"] = "online"
        except Exception:
            info = {"id": mod_id, "status": "offline"}
        modules.append(info)
    return modules


@router.post("/{module_id}/scan")
async def start_scan(
    module_id: str,
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.superadmin, UserRole.admin) and module_id not in user.allowed_modules:
        raise HTTPException(status_code=403, detail=f"No access to module: {module_id}")

    result = await call_module(module_id, "/scan", "POST", {
        "target": body.target, "options": body.options
    })

    # Use the module's own job_id as DB primary key so polling uses the same UUID
    job_id = result.get("job_id")
    if not job_id:
        raise HTTPException(status_code=502, detail="Module did not return a job_id")

    job = ScanJob(
        id=job_id,
        module=module_id,
        target=body.target,
        config=body.options,
        status="pending",
        created_by=user.id,
    )
    db.add(job)
    await db.commit()

    return {"job_id": job.id, "status": "pending"}


@router.get("/{module_id}/scan/{job_id}")
async def get_scan_status(
    module_id: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(ScanJob).where(ScanJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    module_status: dict = {}
    try:
        module_status = await call_module(module_id, f"/scan/{job.id}")
        new_status = module_status.get("status", job.status)
        job.progress = module_status.get("progress", job.progress)
        job.status = new_status
        if new_status in ("completed", "failed"):
            job.result = module_status.get("result")
            job.completed_at = datetime.utcnow()
        await db.commit()
    except Exception:
        pass

    return {
        "job_id": job.id,
        "module": job.module,
        "target": job.target,
        "status": job.status,
        "progress": job.progress,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "result": job.result,
        "logs": module_status.get("logs", []),
    }


@router.get("/jobs")
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
):
    query = select(ScanJob).order_by(ScanJob.created_at.desc()).limit(limit)
    if user.role not in (UserRole.superadmin, UserRole.admin):
        query = query.where(ScanJob.created_by == user.id)

    result = await db.execute(query)
    jobs = result.scalars().all()
    return [
        {
            "job_id": j.id, "module": j.module, "target": j.target,
            "status": j.status, "progress": j.progress,
            "created_at": j.created_at, "completed_at": j.completed_at,
        }
        for j in jobs
    ]
