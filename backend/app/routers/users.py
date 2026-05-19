from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User, Group, UserRole
from app.auth.jwt import hash_password
from app.auth.dependencies import require_role

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str | None = None
    group_ids: list[int] = []


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    group_ids: list[int] | None = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str | None
    is_active: bool
    role: str
    allowed_modules: list[str]

    class Config:
        from_attributes = True


@router.get("/", dependencies=[Depends(require_role(UserRole.admin, UserRole.superadmin))])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [
        {
            "id": u.id, "username": u.username, "email": u.email,
            "full_name": u.full_name, "is_active": u.is_active,
            "role": u.role, "allowed_modules": u.allowed_modules,
        }
        for u in users
    ]


@router.post("/", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_role(UserRole.admin, UserRole.superadmin))])
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    groups = []
    if body.group_ids:
        result = await db.execute(select(Group).where(Group.id.in_(body.group_ids)))
        groups = result.scalars().all()

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        groups=groups,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "username": user.username, "email": user.email}


@router.put("/{user_id}", dependencies=[Depends(require_role(UserRole.admin, UserRole.superadmin))])
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.group_ids is not None:
        result = await db.execute(select(Group).where(Group.id.in_(body.group_ids)))
        user.groups = result.scalars().all()

    await db.commit()
    return {"ok": True}


@router.delete("/{user_id}", dependencies=[Depends(require_role(UserRole.superadmin))])
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"ok": True}
