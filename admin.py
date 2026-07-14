from fastapi import FastAPI, UploadFile, Form
from fastapi.responses import FileResponse
import uvicorn
import os

from backend.app.database import SessionLocal
from backend.app.models.documents import Document
from backend.app.models.document_files import DocumentFile

ADMIN_PASSWORD = "long123"

app = FastAPI()

@app.get("/")
def admin_page():
    return FileResponse("uploads/admin.html")

@app.post("/admin/login")
async def admin_login(data: dict):
    if data.get("password") == ADMIN_PASSWORD:
        return {"success": True}
    return {"success": False}

@app.post("/uploads")
async def upload_file(
    title: str = Form(...),
    code: str = Form(None),
    file: UploadFile = Form(...)
):
    db = SessionLocal()

    doc = Document(title=title, code=code)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    save_path = f"assets/{file.filename}"
    with open(save_path, "wb") as f:
        f.write(await file.read())

    doc_file = DocumentFile(
        document_id=doc.id,
        file_url=save_path,
        file_type=file.filename.split(".")[-1]
    )
    db.add(doc_file)
    db.commit()

    return {"message": "Upload thành công!"}

if __name__ == "__main__":
    uvicorn.run("admin:app", host="127.0.0.1", port=8000, reload=True)
