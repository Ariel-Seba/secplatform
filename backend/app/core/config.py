from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    redis_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7
    module_secret: str
    environment: str = "production"

    module_pentest_url: str = "http://module-pentest:8001"
    module_discovery_url: str = "http://module-discovery:8002"
    module_compliance_url: str = "http://module-compliance:8003"
    report_engine_url: str = "http://report-engine:8010"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
