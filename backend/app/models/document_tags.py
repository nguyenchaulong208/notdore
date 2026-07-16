from sqlalchemy import Column, Integer, Text
from backend.app.database import Base

class DocumentTag(Base):
    __tablename__ = "document_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False, unique=True)
