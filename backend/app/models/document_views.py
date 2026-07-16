from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from backend.app.database import Base

class DocumentView(Base):
    __tablename__ = "document_views"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    viewed_at = Column(TIMESTAMP, server_default=func.now())
    ip = Column(Text)
