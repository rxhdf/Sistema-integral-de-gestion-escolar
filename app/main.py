import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text

from app.core.config import CORS_ALLOWED_ORIGINS
from app.db.session import engine
from app.domains.academico.router import router as academico_router
from app.domains.alumnos.router import router as alumnos_router
from app.domains.asistencia.router import router as asistencia_router
from app.domains.control_escolar.router import router as control_escolar_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.log_acceso.router import router as log_acceso_router
from app.domains.organizacional.router import router as organizacional_router
from app.domains.personal.router import auth_router, router as personal_router
from app.domains.reportes.router import router as reportes_router

logger = logging.getLogger(__name__)

app = FastAPI()


# API pura -- sin HTML propio, por eso el CSP es 'none'/'none' en vez de
# 'self'. Defensa en profundidad: nosniff evita que un navegador reinterprete
# una respuesta JSON como HTML/JS; frame-ancestors/X-Frame-Options bloquean
# que la API se embeba en un iframe ajeno (clickjacking).
@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Localhost siempre permitido (Vite en frontend/); cualquier origin extra
# (túnel de Cloudflare vigente, dominio de producción) viene de
# CORS_ALLOWED_ORIGINS (app/core/config.py) — nunca hardcodeado aquí.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *CORS_ALLOWED_ORIGINS,
        "*"
    ],
    # Set real de verbos/headers que usa la API (GET/POST/PUT, auth Bearer +
    # JSON) -- ampliar aquí si se agrega DELETE/PATCH a algún router.
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)

app.include_router(auth_router, tags=["auth"])
app.include_router(organizacional_router, tags=["organizacional"])
app.include_router(personal_router, tags=["personal"])
app.include_router(academico_router, tags=["academico"])
app.include_router(alumnos_router, tags=["alumnos"])
app.include_router(control_escolar_router, tags=["control_escolar"])
app.include_router(asistencia_router, tags=["asistencia"])
app.include_router(reportes_router, tags=["reportes"])
app.include_router(log_acceso_router, tags=["log_acceso"])
app.include_router(dashboard_router, tags=["dashboard"])


@app.get("/health")
def health() -> JSONResponse:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        # /health es público (sin auth, para monitoreo de infra) -- el
        # detalle de la excepción (hostnames, puertos, driver) va al log del
        # servidor, nunca a la respuesta.
        logger.exception("health check falló: BD inalcanzable")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "db": "unreachable"},
        )
    return JSONResponse(status_code=200, content={"status": "ok", "db": "connected"})
