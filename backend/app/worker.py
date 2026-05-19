from celery import Celery
from app.core.config import get_settings

settings = get_settings()
celery = Celery("secplatform", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.task_routes = {"app.tasks.*": {"queue": "default"}}
