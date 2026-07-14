from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base

class DocumentFile(Base):
    __tablename__ = "document_files"

    id = Column(Integer, primary_key=True, index=True)

    # Liên kết với bảng documents
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)

    # Thông tin file
    file_url = Column(Text, nullable=False)       # Link file PDF/DOC/DOCX
    file_type = Column(Text, nullable=False)      # pdf, doc, docx, pdf_scan
    file_size = Column(Integer)                   # Dung lượng file (bytes)

    # Thời gian upload
    uploaded_at = Column(TIMESTAMP, server_default=func.now())
