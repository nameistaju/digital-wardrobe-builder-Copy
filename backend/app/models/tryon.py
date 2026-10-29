from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TryOnRecord(Base):
    """Stores records of AI virtual try-on generations."""

    __tablename__ = "tryon_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    person_image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    garment_image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    garment_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("garments.id", ondelete="SET NULL"), nullable=True)

    result_image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="completed")  # completed, failed

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    user = relationship("User", back_populates="tryon_records")
    garment = relationship("Garment", lazy="joined")
