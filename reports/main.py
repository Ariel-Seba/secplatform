from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from pydantic import BaseModel
from engine.generator import generate_pdf
import os

app = FastAPI(title="SecPlatform Report Engine")
security = HTTPBearer()
MODULE_SECRET = os.getenv("MODULE_SECRET", "dev-secret")
OUTPUT_DIR = "/app/output"


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != MODULE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")


class GenerateRequest(BaseModel):
    report_id: str
    template: str
    title: str
    client_name: str | None = None
    job_ids: list[str]
    analyst: str
    metadata: dict = {}
    findings_by_severity: dict = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    top_findings: list[dict] = []
    scan_targets: list[str] = []


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/generate")
async def generate(body: GenerateRequest, _: None = Depends(verify_token)):
    output_path = f"{OUTPUT_DIR}/{body.report_id}.pdf"
    try:
        pdf_path = await generate_pdf(
            template_name=body.template,
            data={
                "report": {
                    "id": body.report_id,
                    "title": body.title,
                    "client": body.client_name or "Confidencial",
                    "analyst": body.analyst,
                    "date": __import__("datetime").datetime.now().strftime("%d de %B de %Y"),
                },
                "job_ids": body.job_ids,
                "metadata": body.metadata,
                "findings_by_severity": body.findings_by_severity,
                "top_findings": body.top_findings,
                "scan_targets": body.scan_targets,
            },
            output_path=output_path,
        )
        return {"pdf_path": pdf_path, "report_id": body.report_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{report_id}")
async def download(report_id: str, _: None = Depends(verify_token)):
    path = f"{OUTPUT_DIR}/{report_id}.pdf"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(path, media_type="application/pdf", filename=f"report-{report_id}.pdf")
