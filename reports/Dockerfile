FROM python:3.12-slim-bookworm AS base

RUN groupadd --gid 1001 reportgroup && \
    useradd --uid 1001 --gid reportgroup --no-create-home --shell /bin/false reportuser

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM base AS production
COPY --from=builder /root/.local /home/reportuser/.local
COPY --chown=reportuser:reportgroup . .

RUN mkdir -p /app/output && chown reportuser:reportgroup /app/output

USER reportuser

ENV PATH=/home/reportuser/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8010/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
