from sqlalchemy import String, Boolean, ForeignKey, Table, Column, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    analyst = "analyst"
    viewer = "viewer"
    module_admin = "module_admin"


UserGroup = Table(
    "user_groups",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    last_login: Mapped[datetime | None]

    groups: Mapped[list["Group"]] = relationship(
        secondary=UserGroup, back_populates="users", lazy="selectin"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user", lazy="select")

    @property
    def role(self) -> UserRole:
        if not self.groups:
            return UserRole.viewer
        roles_priority = [r.value for r in UserRole]
        group_roles = [g.role for g in self.groups]
        return min(group_roles, key=lambda r: roles_priority.index(r.value))

    @property
    def allowed_modules(self) -> list[str]:
        modules = set()
        for group in self.groups:
            modules.update(group.allowed_modules or [])
        return list(modules)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    description: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.analyst)
    allowed_modules: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    users: Mapped[list["User"]] = relationship(
        secondary=UserGroup, back_populates="groups", lazy="selectin"
    )
