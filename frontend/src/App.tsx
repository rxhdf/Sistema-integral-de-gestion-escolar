import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CicloEscolarListPage } from '@/pages/CicloEscolarListPage'
import { CicloEscolarCreatePage } from '@/pages/CicloEscolarCreatePage'
import { PeriodoSemestralListPage } from '@/pages/PeriodoSemestralListPage'
import { PeriodoSemestralCreatePage } from '@/pages/PeriodoSemestralCreatePage'
import { PersonalListPage } from '@/pages/PersonalListPage'
import { PersonalCreatePage } from '@/pages/PersonalCreatePage'
import { AsignaturaListPage } from '@/pages/AsignaturaListPage'
import { AsignaturaCreatePage } from '@/pages/AsignaturaCreatePage'
import { GrupoListPage } from '@/pages/GrupoListPage'
import { GrupoCreatePage } from '@/pages/GrupoCreatePage'
import { GrupoAsignaturaListPage } from '@/pages/GrupoAsignaturaListPage'
import { GrupoAsignaturaCreatePage } from '@/pages/GrupoAsignaturaCreatePage'
import { CalificacionListPage } from '@/pages/CalificacionListPage'
import { CalificacionCreatePage } from '@/pages/CalificacionCreatePage'
import { CalificacionCorrectPage } from '@/pages/CalificacionCorrectPage'
import { AlumnoListPage } from '@/pages/AlumnoListPage'
import { AlumnoCreatePage } from '@/pages/AlumnoCreatePage'
import { AlumnoEditPage } from '@/pages/AlumnoEditPage'
import { ExpedienteAcademicoCreatePage } from '@/pages/ExpedienteAcademicoCreatePage'
import { ExpedienteAcademicoDetailPage } from '@/pages/ExpedienteAcademicoDetailPage'
import { ExpedienteAcademicoEditPage } from '@/pages/ExpedienteAcademicoEditPage'
import { PerfilPage } from '@/pages/PerfilPage'
import { PersonalEditPage } from '@/pages/PersonalEditPage'
import { GrupoEditPage } from '@/pages/GrupoEditPage'
import { AsignaturaEditPage } from '@/pages/AsignaturaEditPage'
import { GrupoAsignaturaEditPage } from '@/pages/GrupoAsignaturaEditPage'
import { PlantelPage } from '@/pages/PlantelPage'
import { AsistenciaListPage } from '@/pages/AsistenciaListPage'
import { AsistenciaCapturaPage } from '@/pages/AsistenciaCapturaPage'
import { AsistenciaResumenPage } from '@/pages/AsistenciaResumenPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/plantel" element={<PlantelPage />} />
        <Route path="/ciclo-escolar" element={<CicloEscolarListPage />} />
        <Route path="/ciclo-escolar/nuevo" element={<CicloEscolarCreatePage />} />
        <Route path="/periodo-semestral" element={<PeriodoSemestralListPage />} />
        <Route path="/periodo-semestral/nuevo" element={<PeriodoSemestralCreatePage />} />
        <Route path="/personal" element={<PersonalListPage />} />
        <Route path="/personal/nuevo" element={<PersonalCreatePage />} />
        <Route path="/personal/:idPersonal/editar" element={<PersonalEditPage />} />
        <Route path="/asignatura" element={<AsignaturaListPage />} />
        <Route path="/asignatura/nueva" element={<AsignaturaCreatePage />} />
        <Route path="/asignatura/:idAsignatura/editar" element={<AsignaturaEditPage />} />
        <Route path="/grupo" element={<GrupoListPage />} />
        <Route path="/grupo/nuevo" element={<GrupoCreatePage />} />
        <Route path="/grupo/:idGrupo/editar" element={<GrupoEditPage />} />
        <Route path="/grupo-asignatura" element={<GrupoAsignaturaListPage />} />
        <Route path="/grupo-asignatura/nueva" element={<GrupoAsignaturaCreatePage />} />
        <Route path="/grupo-asignatura/:idGrupoAsig/editar" element={<GrupoAsignaturaEditPage />} />
        <Route path="/calificacion" element={<CalificacionListPage />} />
        <Route path="/calificacion/nueva" element={<CalificacionCreatePage />} />
        <Route path="/calificacion/:idCalificacion/editar" element={<CalificacionCorrectPage />} />
        <Route path="/alumno" element={<AlumnoListPage />} />
        <Route path="/alumno/nuevo" element={<AlumnoCreatePage />} />
        <Route path="/alumno/:idAlumno/editar" element={<AlumnoEditPage />} />
        <Route path="/alumno/:idAlumno/expediente-academico" element={<ExpedienteAcademicoDetailPage />} />
        <Route path="/alumno/:idAlumno/expediente-academico/editar" element={<ExpedienteAcademicoEditPage />} />
        <Route path="/expediente-academico/nuevo" element={<ExpedienteAcademicoCreatePage />} />
        <Route path="/alumno/:idAlumno/asistencia-resumen" element={<AsistenciaResumenPage />} />
        <Route path="/asistencia" element={<AsistenciaListPage />} />
        <Route path="/asistencia/capturar" element={<AsistenciaCapturaPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
