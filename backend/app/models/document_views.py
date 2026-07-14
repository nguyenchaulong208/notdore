from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base

class DocumentView(Base):
    __tablename__ = "document_views"

    id = Column(Integer, primary_key=True, index=True)

    # Liên kết với bảng documents
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)

    # IP người xem (tuỳ chọn)
    viewer_ip = Column(Text)

    # Thời gian xem
    viewed_at = Column(TIMESTAMP, server_default=func.now())
