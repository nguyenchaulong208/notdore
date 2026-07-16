import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal
from backend.app.models.documents import Document
from backend.app.models.document_tags import DocumentTag
from backend.app.models.document_tag_map import DocumentTagMap

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TAG_MAP = {
    "vat": "thue-gtgt",
    "tncn": "thue-tncn",
    "tndn": "thue-tndn",
    "bhxh": "bhxh",
}

CATEGORY_INFO = {
    "vat": {
        "title": "Thuế Giá Trị Gia Tăng", "short": "Thuế VAT",
        "description": "Tổng hợp các văn bản pháp luật về thuế giá trị gia tăng (VAT), bao gồm Luật, Nghị định, Thông tư hướng dẫn và các tài liệu liên quan.",
        "overview": [
            "Thuế giá trị gia tăng (VAT) là thuế tính trên giá trị tăng thêm của hàng hóa, dịch vụ.",
            "Đối tượng chịu thuế: hàng hóa, dịch vụ sản xuất, kinh doanh và nhập khẩu.",
            "Các mức thuế suất: 0%, 5%, 10% (thuế suất cơ bản).",
            "Phương pháp tính: khấu trừ thuế và tính trực tiếp.",
            "Đối tượng không chịu thuế: 26 nhóm hàng hóa, dịch vụ theo quy định.",
            "Văn bản hiện hành: Luật số 13/2008/QH12 và các văn bản sửa đổi, bổ sung."
        ],
        "audience": [
            {"icon": "building", "title": "Doanh nghiệp sản xuất, kinh doanh", "desc": "Áp dụng cho tất cả doanh nghiệp có hoạt động sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế GTGT."},
            {"icon": "user-tie", "title": "Hộ kinh doanh cá thể", "desc": "Hộ kinh doanh có doanh thu từ 100 triệu đồng/năm trở lên phải nộp thuế GTGT."},
            {"icon": "ship", "title": "Tổ chức, cá nhân nhập khẩu", "desc": "Tổ chức, cá nhân nhập khẩu hàng hóa chịu thuế GTGT phải kê khai và nộp thuế GTGT hàng nhập khẩu."}
        ]
    },
    "tncn": {
        "title": "Thuế Thu Nhập Cá Nhân", "short": "Thuế TNCN",
        "description": "Tổng hợp các văn bản pháp luật về thuế thu nhập cá nhân (TNCN), bao gồm Luật, Nghị định, Thông tư và các hướng dẫn liên quan.",
        "overview": [
            "Thuế thu nhập cá nhân là thuế đánh vào thu nhập của cá nhân phát sinh trong kỳ tính thuế.",
            "Đối tượng nộp thuế: cá nhân cư trú và cá nhân không cư trú có thu nhập chịu thuế.",
            "Biểu thuế lũy tiến từng phần: 7 bậc thuế từ 5% đến 35%.",
            "Mức giảm trừ gia cảnh: 11 triệu đồng/tháng đối với người nộp thuế.",
            "Các khoản thu nhập được miễn thuế theo quy định của pháp luật.",
            "Văn bản hiện hành: Luật số 04/2007/QH12 và các văn bản sửa đổi, bổ sung."
        ],
        "audience": [
            {"icon": "user-tie", "title": "Người lao động làm công hưởng lương", "desc": "Thu nhập từ tiền lương, tiền công và các khoản thu nhập tương tự phải kê khai và nộp thuế TNCN."},
            {"icon": "chart-pie", "title": "Cá nhân kinh doanh", "desc": "Cá nhân sản xuất, kinh doanh hàng hóa, dịch vụ thuộc đối tượng nộp thuế TNCN theo quy định."},
            {"icon": "home", "title": "Cá nhân có thu nhập từ đầu tư vốn, chuyển nhượng", "desc": "Thu nhập từ đầu tư vốn, chuyển nhượng bất động sản, chuyển nhượng vốn và các khoản thu nhập khác."}
        ]
    },
    "tndn": {
        "title": "Thuế Thu Nhập Doanh Nghiệp", "short": "Thuế TNDN",
        "description": "Tổng hợp các văn bản pháp luật về thuế thu nhập doanh nghiệp (TNDN), bao gồm Luật, Nghị định, Thông tư và các hướng dẫn liên quan.",
        "overview": [
            "Thuế thu nhập doanh nghiệp là thuế đánh trên thu nhập chịu thuế của doanh nghiệp.",
            "Thu nhập chịu thuế bao gồm thu nhập từ hoạt động sản xuất, kinh doanh và thu nhập khác.",
            "Thuế suất phổ thông: 20% (áp dụng cho hầu hết doanh nghiệp).",
            "Ưu đãi thuế TNDN cho doanh nghiệp trong các lĩnh vực, địa bàn ưu đãi đầu tư.",
            "Các khoản chi phí được trừ và không được trừ khi tính thuế.",
            "Văn bản hiện hành: Luật số 14/2008/QH12 và các văn bản sửa đổi, bổ sung."
        ],
        "audience": [
            {"icon": "building", "title": "Doanh nghiệp trong nước", "desc": "Mọi doanh nghiệp Việt Nam thuộc mọi thành phần kinh tế đều thuộc đối tượng nộp thuế TNDN."},
            {"icon": "globe", "title": "Doanh nghiệp có vốn đầu tư nước ngoài", "desc": "Doanh nghiệp FDI hoạt động tại Việt Nam chịu thuế TNDN theo quy định, bao gồm cả các ưu đãi đầu tư."},
            {"icon": "landmark", "title": "Tổ chức khác có hoạt động sản xuất, kinh doanh", "desc": "Các tổ chức khác ngoài doanh nghiệp có hoạt động sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế TNDN."}
        ]
    },
    "bhxh": {
        "title": "Bảo Hiểm Xã Hội", "short": "BHXH",
        "description": "Tổng hợp các văn bản pháp luật về bảo hiểm xã hội (BHXH), bảo hiểm y tế (BHYT) và bảo hiểm thất nghiệp (BHTN).",
        "overview": [
            "Bảo hiểm xã hội là sự bảo đảm thay thế hoặc bù đắp một phần thu nhập cho người lao động.",
            "Các chế độ BHXH bắt buộc: ốm đau, thai sản, tai nạn lao động, hưu trí, tử tuất.",
            "Mức đóng BHXH bắt buộc: 32% (21.5% từ người sử dụng lao động, 10.5% từ người lao động).",
            "Bảo hiểm y tế: mức đóng 4.5% (3% từ người sử dụng lao động, 1.5% từ người lao động).",
            "Bảo hiểm thất nghiệp: mức đóng 2% (1% từ người sử dụng lao động, 1% từ người lao động).",
            "Văn bản hiện hành: Luật BHXH số 58/2014/QH13 và Luật sửa đổi số 28/2024/QH15."
        ],
        "audience": [
            {"icon": "users", "title": "Người lao động", "desc": "Người lao động làm việc theo hợp đồng lao động từ đủ 01 tháng trở lên thuộc đối tượng tham gia BHXH bắt buộc."},
            {"icon": "building", "title": "Người sử dụng lao động", "desc": "Doanh nghiệp, cơ quan, tổ chức, hợp tác xã, hộ kinh doanh có thuê mướn lao động."},
            {"icon": "hand-holding-heart", "title": "Người tham gia BHXH tự nguyện", "desc": "Công dân Việt Nam từ đủ 15 tuổi trở lên không thuộc đối tượng tham gia BHXH bắt buộc có thể tham gia BHXH tự nguyện."}
        ]
    }
}


def get_docs_by_tag(tag_name: str):
    try:
        db: Session = SessionLocal()
        tag = db.query(DocumentTag).filter(DocumentTag.name == tag_name).first()
        if not tag:
            db.close()
            return []
        rows = (
            db.query(Document)
            .join(DocumentTagMap, DocumentTagMap.document_id == Document.id)
            .filter(DocumentTagMap.tag_id == tag.id)
            .all()
        )
        db.close()
        return [
            {"id": d.id, "code": d.code or "", "title": d.title}
            for d in rows
        ]
    except Exception:
        return None


@app.get("/api/category-info")
def api_category_info(cat: str = Query(...)):
    info = CATEGORY_INFO.get(cat)
    if not info:
        return JSONResponse({"error": "Category not found"}, status_code=404)
    return info


@app.get("/api/documents")
def api_documents(cat: str = Query(...)):
    tag_name = TAG_MAP.get(cat)
    if not tag_name:
        return JSONResponse({"error": "Category not found"}, status_code=404)
    docs = get_docs_by_tag(tag_name)
    if docs is None:
        return JSONResponse({"error": "Database unavailable"}, status_code=503)
    return docs
