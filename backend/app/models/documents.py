from sqlalchemy import Column, Integer, Text, TIMESTAMP
from sqlalchemy.sql import func
from backend.app.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(Text, nullable=False)
    code = Column(Text)
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
