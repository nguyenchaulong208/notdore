from sqlalchemy import Column, Integer, Text, ForeignKey
from backend.app.database import Base

class DocumentTag(Base):
    __tablename__ = "document_tags"

    id = Column(Integer, primary_key=True, index=True)

    # Liên kết với bảng documents
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)

    # Tên tag (ví dụ: Thuế TNCN, Hóa đơn, BHXH, Lao động…)
    tag = Column(Text, nullable=False)
