from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base

class DocumentText(Base):
    __tablename__ = "document_texts"

    id = Column(Integer, primary_key=True, index=True)

    # Liên kết với bảng documents
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)

    # Nội dung trích xuất từ file PDF/DOC/DOCX
    text_content = Column(Text)                   # Có thể rất dài

    # Tóm tắt nội dung (tùy chọn, có thể dùng AI để tạo)
    summary = Column(Text)

    # Trạng thái trích xuất: success / failed / pending
    extract_status = Column(Text, default="pending")

    # Thời gian trích xuất
    extracted_at = Column(TIMESTAMP, server_default=func.now())
