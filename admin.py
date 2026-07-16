from fastapi import FastAPI
from fastapi.responses import FileResponse
import uvicorn

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

if __name__ == "__main__":
    uvicorn.run("admin:app", host="127.0.0.1", port=8000, reload=True)
