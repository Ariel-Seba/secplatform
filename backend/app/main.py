from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
from app.database import engine, Base
from app.routers import auth, users, groups, modules, reports
from app.core.config import get_settings
import app.models  # ensure models are registered
import httpx, redis as redis_lib, asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="SecPlatform API",
    version="1.0.0",
    description="Modular Security Operations Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(users.router,   prefix="/api/users",   tags=["users"])
app.include_router(groups.router,  prefix="/api/groups",  tags=["groups"])
app.include_router(modules.router, prefix="/api/modules", tags=["modules"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


@app.get("/health", tags=["system"])
async def health():
    settings = get_settings()
    result: dict = {"status": "ok", "version": "1.0.0", "service": "secplatform-backend"}

    # DB ping
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        result["database"] = "ok"
    except Exception:
        result["database"] = "error"
        result["status"] = "degraded"

    # Redis ping
    try:
        r = redis_lib.from_url(settings.redis_url)
        r.ping()
        result["redis"] = "ok"
    except Exception:
        result["redis"] = "error"
        result["status"] = "degraded"

    # Modules health
    module_urls = {
        "pentest":    settings.module_pentest_url,
        "discovery":  settings.module_discovery_url,
        "compliance": settings.module_compliance_url,
    }
    module_status: dict = {}
    async with httpx.AsyncClient(timeout=3) as client:
        for name, url in module_urls.items():
            try:
                resp = await client.get(f"{url}/health")
                module_status[name] = "ok" if resp.status_code == 200 else "error"
            except Exception:
                module_status[name] = "offline"
    result["modules"] = module_status

    return result
