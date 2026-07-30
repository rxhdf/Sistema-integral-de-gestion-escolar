from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.session import engine

app = FastAPI()


@app.get("/health")
def health() -> JSONResponse:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "db": "unreachable", "detail": str(exc)},
        )
    return JSONResponse(status_code=200, content={"status": "ok", "db": "connected"})
