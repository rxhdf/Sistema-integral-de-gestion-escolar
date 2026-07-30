# SIGE MVP — Brief para Claude Code

## Qué es el sistema

Sistema de gestión escolar para un plantel de educación media superior. El MVP
permite registrar alumnos con su expediente académico básico, organizarlos en
grupos por asignatura, y capturar/consultar sus calificaciones — todo con
control de acceso según el rol de quien usa el sistema.

---

## Los 2 roles del MVP

- **Docente**: solo puede capturar calificaciones de sus propios grupos/
  asignaturas asignadas. Solo ve datos básicos de alumnos, no puede editar
  personal ni estructura académica.
- **Directivo**: puede crear la estructura completa (grupos, asignaturas,
  asignaciones docente↔grupo), dar de alta alumnos, y consultar (no
  necesariamente editar) todas las calificaciones del plantel.
- **Admin**: puede modificar, consultar y verificar cualquier tipo de dato e informacion dentro de todo el sistema. 
  funciona como un usario con privilegios que solo tendra acceso el creador del sistema.

---

## Las 10 entidades del MVP

1. **Plantel** — el plantel (una sola fila en esta fase)
2. **Ciclo_Escolar** — año lectivo
3. **Periodo_Semestral** — mitad de ciclo (A o B)
4. **Personal** — docentes y directivos, con login y rol
5. **Grupo** — conjunto de alumnos de un semestre/período
6. **Asignatura** — catálogo de materias
7. **Grupo_Asignatura** — qué docente da qué materia a qué grupo (punto de
   control clave para calificaciones)
8. **Alumno** — datos básicos del estudiante
9. **Expediente_Academico** — historial/promedios del alumno
10. **Calificacion** — 3 parciales + final, por alumno, por materia, por período

**Nota de simplificación intencional:** los roles (docente/directivo) se
modelan como un solo campo `rol` en `Personal`, no como tablas separadas. Esto
es deuda técnica documentada, no un descuido — se expandirá a tablas
separadas si el sistema crece a más roles (orientador, subdirector, etc.).

---

## Los 5 flujos que el sistema debe soportar (end-to-end)

1. Crear plantel → ciclo escolar → período semestral (setup inicial, una vez).
2. Dar de alta personal (docentes, directivos) con su rol y credenciales de
   acceso (login vía JWT).
3. Crear grupos, asignaturas, y asignar docente a grupo/asignatura
   (`Grupo_Asignatura`).
4. Dar de alta un alumno con su expediente académico básico, e inscribirlo a
   un grupo.
5. Docente captura calificación (3 parciales + final) solo para sus propios
   `Grupo_Asignatura`; directivo consulta calificaciones de todo el plantel.

---

## Requisitos no negociables desde el día 1

- **Control de acceso real, no simulado**: cada endpoint debe verificar el rol
  del usuario autenticado. Un docente nunca debe poder escribir calificaciones
  fuera de sus propios grupos asignados, ni editar estructura académica o
  personal.
- **Row-Level Security en PostgreSQL** como segunda capa de defensa, además de
  la validación en el backend — no confiar solo en la lógica de aplicación.
- **Auditoría append-only** de cada creación/modificación de `Calificacion`
  (quién, qué, cuándo).
- **Integridad referencial completa** entre las 10 entidades (FKs con
  constraints reales, no solo convención de nombres).

---

## Stack

- **Backend**: FastAPI + SQLAlchemy
- **Base de datos**: PostgreSQL (con RLS)
- **Migraciones**: Alembic
- **Auth**: JWT

---

## Estructura de proyecto propuesta

Monolito modular por dominio (no microservicios, no capas horizontales):

```
app/
├── domains/
│   ├── organizacional/   # Plantel, Ciclo_Escolar, Periodo_Semestral
│   ├── personal/         # Personal, auth/roles
│   ├── academico/        # Grupo, Asignatura, Grupo_Asignatura
│   ├── alumnos/          # Alumno, Expediente_Academico
│   └── control_escolar/  # Calificacion, auditoría
├── core/
│   ├── security.py       # JWT, RBAC, inyección de rol a sesión de Postgres
│   ├── audit.py
│   └── config.py
└── db/
    ├── migrations/        # Alembic
    └── session.py
```

Cada dominio contiene: `models.py`, `schemas.py`, `repository.py`,
`service.py`, `router.py`.

---
