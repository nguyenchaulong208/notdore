from sqlalchemy import Column, Integer, Text, Date, TIMESTAMP
from sqlalchemy.sql import func
from backend.app.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)

    # Thông tin cơ bản của văn bản
    title = Column(Text, nullable=False)          # Tiêu đề văn bản
    code = Column(Text)                           # Số hiệu: 123/2020/NĐ-CP
    category = Column(Text)                       # Thuế / Kế toán / BHXH / Lao động...
    issued_by = Column(Text)                      # Cơ quan ban hành
    issued_date = Column(Date)                    # Ngày ban hành

    # Mô tả ngắn để hiển thị nhanh
    description = Column(Text)

    # Thời gian tạo
    created_at = Column(TIMESTAMP, server_default=func.now())
