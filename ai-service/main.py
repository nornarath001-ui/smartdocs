from fastapi import FastAPI, UploadFile, File
from docling.document_converter import DocumentConverter
import tempfile, shutil, os

app = FastAPI(title="SmartDocs AI Service")
converter = DocumentConverter()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/parse")
async def parse(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
    try:
        result = converter.convert(path)
        return {"filename": file.filename,
                "markdown": result.document.export_to_markdown()}
    finally:
        os.remove(path)