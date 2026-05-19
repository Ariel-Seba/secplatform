from sqlalchemy import String, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    module: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    target: Mapped[str] = mapped_column(String(512))
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON)
    progress: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True)
    completed_at: Mapped[datetime | None]
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    findings: Mapped[list["Finding"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("scan_jobs.id"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    severity: Mapped[str] = mapped_column(String(16), index=True)
    cvss_score: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str]
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    remediation: Mapped[str | None]
    cve_id: Mapped[str | None] = mapped_column(String(32))
    mitre_technique: Mapped[str | None] = mapped_column(String(32))
    host: Mapped[str | None] = mapped_column(String(255))
    port: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    job: Mapped["ScanJob"] = relationship(back_populates="findings")
