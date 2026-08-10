from pydantic import BaseModel


class DashboardDirectivoOut(BaseModel):
    matricula_total: int
    grupos_activos: int
    personal_activo: int
    asignaturas_configuradas: int


class DashboardDocenteOut(BaseModel):
    numero_grupos_asignados: int
    numero_alumnos_bajo_responsabilidad: int
    calificaciones_pendientes: int
