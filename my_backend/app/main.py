from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, EmailStr
import uvicorn, json, logging, pdfkit, smtplib
from fastapi.middleware.cors import CORSMiddleware
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from email.message import EmailMessage
from io import BytesIO
from fastapi.responses import StreamingResponse

# ─────────────────────────────────────────────  Configuration / Paths
BASE_DIR      = Path(__file__).resolve().parent
STORAGE_DIR   = BASE_DIR / "storage"     # JSON-файлы пользователей
TEMPLATES_DIR = BASE_DIR / "templates"   # HTML-шаблоны для PDF
LOGS_DIR      = BASE_DIR / "logs"
REGISTRY_FILE = BASE_DIR / "ssn_registry.json"  # список файлов

for p in (STORAGE_DIR, TEMPLATES_DIR, LOGS_DIR):
    p.mkdir(exist_ok=True)

# ─────────────────────────────────────────────  Jinja2 Setup
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"])
)

# ─────────────────────────────────────────────  Logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("backend")

fail2ban_handler = TimedRotatingFileHandler(
    LOGS_DIR / "fail2ban.log", when="midnight", backupCount=7, encoding="utf-8"
)
fail2ban_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
)
logging.getLogger("fail2ban").addHandler(fail2ban_handler)

# ─────────────────────────────────────────────  FastAPI App
app = FastAPI(title="SSN backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

# ─────────────────────────────────────────────  Models
class UserData(BaseModel):
    ssn: str
    bday: str
    param: str | None = None

# ─────────────────────────────────────────────  Helpers
def file_name_for(ssn: str, bday: str, param: str | None) -> str:
    return f"{ssn}_{bday}_{param or 'default'}.json"

def load_json(path: Path) -> any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)

def save_json(path: Path, data: any):
    path.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")

# Initialize registry as list
if not REGISTRY_FILE.exists():
    save_json(REGISTRY_FILE, [])
    logger.info("Создан пустой ssn_registry.json")

# Deep merge utility for additional_data
def deep_merge(dst: dict, src: dict) -> dict:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            dst[k] = deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst

# Prune empty values
def prune_empty(o):
    if isinstance(o, dict):
        return {k: prune_empty(v) for k, v in o.items() if prune_empty(v) not in ("", None, {}, [])}
    if isinstance(o, list):
        return [prune_empty(i) for i in o if prune_empty(i) not in ("", None, {}, [])]
    return o

# Always exact lookup <ssn>_<bday>_<param>.json
def resolve_file(ssn: str, bday: str, param: str) -> Path:
    fname = file_name_for(ssn, bday, param)
    fp = STORAGE_DIR / fname
    if fp.exists():
        return fp
    raise FileNotFoundError(f"File {fname} not found")

# ─────────────────────────────────────────────  Endpoints
@app.get("/", summary="Heartbeat")
async def root():
    return {"status": "ok"}

@app.post("/api/check-ssn")
async def check_ssn(data: UserData):
    registry: list[str] = load_json(REGISTRY_FILE)
    fname = file_name_for(data.ssn, data.bday, data.param)
    logger.debug(f"/check-ssn → looking for {fname} in registry")
    if fname in registry:
        logger.info("Комбинация уже зарегистрирована, доступ разрешён")
        return {"message": "Access approved"}
    registry.append(fname)
    save_json(REGISTRY_FILE, registry)
    logger.info("Новая комбинация добавлена, доступ разрешён")
    return {"message": "New combination stored, Access approved"}

@app.post("/api/create-or-update-json")
async def create_or_update_json(payload: dict):
    ssn   = payload.get("ssn")
    bday  = payload.get("bday")
    param = payload.get("param", "default")
    if not ssn or not bday:
        raise HTTPException(400, "ssn & bday required")

    # 1) Обновляем registry
    registry: list[str] = load_json(REGISTRY_FILE)
    fname = file_name_for(ssn, bday, param)
    if fname not in registry:
        registry.append(fname)
        save_json(REGISTRY_FILE, registry)
        logger.debug(f"ssn_registry.json обновлён (добавлен {fname})")

    # 2) Работа с файлом данных
    fpath = STORAGE_DIR / fname
    created = not fpath.exists()
    doc = {"ssn": ssn, "bday": bday, "param": param,
           "additional_data": {}, "created": created}

    if fpath.exists():
        existing = load_json(fpath)
        # сохраняем все поля из старого
        doc.update(existing)
        doc["created"] = False

    add_data = payload.get("additional_data") or {}
    doc["additional_data"] = prune_empty(
        deep_merge(doc.get("additional_data", {}), add_data)
    )

    save_json(fpath, doc)
    logger.info(f"Файл {fname} сохранён (created={doc['created']})")
    return {"message": "saved", "file_name": fname, "data": doc}

@app.get("/api/form-data/{component}/{ssn}")
async def get_form_data(
    component: str,
    ssn: str,
    bday:  str  = Query(..., description="YYYY-MM-DD"),
    param: str  = Query("default", description="param or default")
):
    try:
        fp = resolve_file(ssn, bday, param)
        data = load_json(fp)
        return {
            "ssn": data["ssn"],
            "bday": data["bday"],
            "param": data.get("param"),
            "data": data["additional_data"].get(component, {})
        }
    except FileNotFoundError:
        logger.warning("form-data: файл не найден")
        raise HTTPException(404, "form-data not found")

@app.get("/api/history/{ssn}")
async def get_history(
    ssn:   str,
    bday:  str  = Query(...),
    param: str  = Query("default")
):
    try:
        fp = resolve_file(ssn, bday, param)
        return {"file_name": fp.name, "data": load_json(fp)}
    except FileNotFoundError:
        raise HTTPException(404, "history not found")

@app.get("/api/history/{ssn}/pdf")
async def history_pdf(
    ssn: str,
    bday: str = Query(...),
    param: str = Query("default"),
    email: EmailStr | None = Query(None)
):
    logger.info(f"PDF-запрос: ssn={ssn}, bday={bday}, param={param}, email={email}")

    try:
        fp = resolve_file(ssn, bday, param)
        logger.info(f"Файл найден: {fp}")
    except FileNotFoundError:
        logger.error("Файл не найден")
        raise HTTPException(404, "history not found")

    try:
        data = load_json(fp)
        html = jinja_env.get_template("application.html").render(
            data=data["additional_data"], ssn=ssn
        )
    except Exception as e:
        logger.error(f"Ошибка при рендеринге HTML: {e}")
        raise HTTPException(500, "Template error")

    try:
        # 🔧 Укажи свой путь к wkhtmltopdf, особенно на Windows
        config = pdfkit.configuration(wkhtmltopdf="/usr/local/bin/wkhtmltopdf")
        pdf = pdfkit.from_string(html, False, configuration=config)
    except Exception as e:
        logger.error(f"Ошибка при генерации PDF: {e}")
        raise HTTPException(500, "PDF generation failed")

    if email:
        try:
            tmp = STORAGE_DIR / f"{fp.stem}.pdf"
            tmp.write_bytes(pdf)
            _send_pdf(tmp, email, ssn)
            tmp.unlink(missing_ok=True)
            logger.info(f"PDF для {ssn} отправлен на {email}")
            return {"status": "sent", "to": email}
        except Exception as e:
            logger.error(f"Ошибка при отправке email: {e}")
            raise HTTPException(500, "Email sending failed")

    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fp.stem}.pdf"}
    )











def _send_pdf(path: Path, to: str, ssn: str):
    msg = EmailMessage()
    msg["Subject"] = f"PDF for {ssn}"
    msg["From"]    = "noreply@example.com"
    msg["To"]      = to
    msg.set_content("Attached file.")
    msg.add_attachment(
        path.read_bytes(),
        maintype="application", subtype="pdf", filename=path.name
    )
    with smtplib.SMTP("localhost") as srv:
        srv.send_message(msg)

if __name__ == "__main__":
    logger.info("⇢  starting backend on 0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
