from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
from app.database import engine, Base
from app.routers import auth, users, groups, modules, reports
import app.models  # ensure models are registered


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
    return {"status": "ok", "version": "1.0.0", "service": "secplatform-backend"}
