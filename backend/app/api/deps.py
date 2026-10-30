from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_access_token, hash_password
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that authenticates the user via JWT Bearer token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_user_or_guest(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Authenticates user if Bearer token is provided.
    If no token or invalid token is supplied, falls back to a persistent Guest account
    so users can immediately use virtual try-on without signing in.
    """
    if token:
        payload = decode_access_token(token)
        if payload is not None:
            user_id_str = payload.get("sub")
            if user_id_str is not None:
                try:
                    user_id = int(user_id_str)
                    stmt = select(User).where(User.id == user_id)
                    res = await db.execute(stmt)
                    user = res.scalar_one_or_none()
                    if user:
                        return user
                except (ValueError, TypeError):
                    pass

    # No token or invalid token provided -> find or create persistent guest user
    stmt = select(User).where(User.email == "guest@whearing.com")
    res = await db.execute(stmt)
    guest = res.scalar_one_or_none()
    if not guest:
        guest = User(
            email="guest@whearing.com",
            hashed_password=hash_password("guestpass123"),
            full_name="Guest User",
        )
        db.add(guest)
        await db.commit()
        await db.refresh(guest)

    return guest
