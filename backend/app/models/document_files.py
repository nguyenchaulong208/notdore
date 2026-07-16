from sqlalchemy import Column, Integer, Text, BigInteger, TIMESTAMP, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from backend.app.database import Base

class DocumentFile(Base):
    __tablename__ = "document_files"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    drive_type = Column(Text, CheckConstraint("drive_type IN ('google', 'onedrive')"))
    drive_file_id = Column(Text, nullable=False)
    drive_view_url = Column(Text)
    drive_download_url = Column(Text)
    mime_type = Column(Text)
    size = Column(BigInteger)
    uploaded_at = Column(TIMESTAMP, server_default=func.now())
