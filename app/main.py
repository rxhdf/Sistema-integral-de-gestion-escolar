from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.session import engine
from app.domains.academico.router import router as academico_router
from app.domains.alumnos.router import router as alumnos_router
from app.domains.control_escolar.router import router as control_escolar_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.organizacional.router import router as organizacional_router
from app.domains.personal.router import auth_router, router as personal_router

app = FastAPI()

# ponytail: origins de dev hardcodeados (Vite en frontend/), sin variable
# de entorno todavía — subir a env var cuando exista un origin de producción.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["auth"])
app.include_router(organizacional_router, tags=["organizacional"])
app.include_router(personal_router, tags=["personal"])
app.include_router(academico_router, tags=["academico"])
app.include_router(alumnos_router, tags=["alumnos"])
app.include_router(control_escolar_router, tags=["control_escolar"])
app.include_router(dashboard_router, tags=["dashboard"])


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
