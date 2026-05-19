"""Seed initial data: superadmin user + default groups."""
import asyncio, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.user import User, Group, UserRole, UserGroup
from app.auth.jwt import hash_password
from app.database import Base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://secplatform:changeme@localhost:5432/secplatform")


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with Session() as db:
        # Default groups
        groups = [
            Group(name="Administrators", role=UserRole.superadmin,
                  allowed_modules=["pentest","discovery","compliance","forensics","threat-intel","reports"],
                  description="Full access"),
            Group(name="Red Team", role=UserRole.analyst,
                  allowed_modules=["pentest","discovery","threat-intel"],
                  description="Offensive security team"),
            Group(name="Blue Team", role=UserRole.analyst,
                  allowed_modules=["compliance","forensics","reports"],
                  description="Defensive security team"),
            Group(name="Viewers", role=UserRole.viewer,
                  allowed_modules=["reports"],
                  description="Read-only access"),
        ]
        for g in groups:
            db.add(g)
        await db.flush()

        # Superadmin user
        admin = User(
            username="admin",
            email="admin@secplatform.local",
            hashed_password=hash_password("Admin1234!"),
            full_name="Administrator",
            is_active=True,
            groups=[groups[0]],
        )
        db.add(admin)
        await db.commit()

    print("✅ Seed completed:")
    print("   User: admin / Admin1234!")
    print("   Groups: Administrators, Red Team, Blue Team, Viewers")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
