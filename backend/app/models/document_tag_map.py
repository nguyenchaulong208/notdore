from sqlalchemy import Column, Integer, ForeignKey, PrimaryKeyConstraint
from backend.app.database import Base

class DocumentTagMap(Base):
    __tablename__ = "document_tag_map"

    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("document_tags.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("document_id", "tag_id"),
    )
