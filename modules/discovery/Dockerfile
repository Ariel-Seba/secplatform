FROM python:3.12-slim-bookworm AS base

RUN groupadd --gid 1001 modulegroup && \
    useradd --uid 1001 --gid modulegroup --no-create-home --shell /bin/false moduleuser

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM base AS production
COPY --from=builder /root/.local /home/moduleuser/.local
COPY --chown=moduleuser:modulegroup . .

USER moduleuser

ENV PATH=/home/moduleuser/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
