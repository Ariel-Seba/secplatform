from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.user import Group, UserRole
from app.auth.dependencies import require_role

router = APIRouter()

AVAILABLE_MODULES = ["pentest", "discovery", "compliance", "forensics", "threat-intel", "reports"]


class GroupCreate(BaseModel):
    name: str
    description: str | None = None
    role: UserRole = UserRole.analyst
    allowed_modules: list[str] = []


class GroupUpdate(BaseModel):
    description: str | None = None
    role: UserRole | None = None
    allowed_modules: list[str] | None = None


@router.get("/", dependencies=[Depends(require_role(UserRole.admin, UserRole.superadmin))])
async def list_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group))
    groups = result.scalars().all()
    return [
        {
            "id": g.id, "name": g.name, "description": g.description,
            "role": g.role, "allowed_modules": g.allowed_modules,
            "member_count": len(g.users),
        }
        for g in groups
    ]


@router.post("/", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_role(UserRole.admin, UserRole.superadmin))])
async def create_group(body: GroupCreate, db: AsyncSession = Depends(get_db)):
    invalid = [m for m in body.allowed_modules if m not in AVAILABLE_MODULES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid modules: {invalid}")

    group = Group(**body.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return {"id": group.id, "name": group.name}


@router.put("/{group_id}", dependencies=[Depends(require_role(UserRole.admin, UserRole.superadmin))])
async def update_group(group_id: int, body: GroupUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(group, field, value)

    await db.commit()
    return {"ok": True}


@router.delete("/{group_id}", dependencies=[Depends(require_role(UserRole.superadmin))])
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.delete(group)
    await db.commit()
    return {"ok": True}
