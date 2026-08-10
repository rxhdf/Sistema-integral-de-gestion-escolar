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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ciclo-escolar" element={<CicloEscolarListPage />} />
        <Route path="/ciclo-escolar/nuevo" element={<CicloEscolarCreatePage />} />
        <Route path="/periodo-semestral" element={<PeriodoSemestralListPage />} />
        <Route path="/periodo-semestral/nuevo" element={<PeriodoSemestralCreatePage />} />
        <Route path="/personal" element={<PersonalListPage />} />
        <Route path="/personal/nuevo" element={<PersonalCreatePage />} />
        <Route path="/asignatura" element={<AsignaturaListPage />} />
        <Route path="/asignatura/nueva" element={<AsignaturaCreatePage />} />
        <Route path="/grupo" element={<GrupoListPage />} />
        <Route path="/grupo/nuevo" element={<GrupoCreatePage />} />
        <Route path="/grupo-asignatura" element={<GrupoAsignaturaListPage />} />
        <Route path="/grupo-asignatura/nueva" element={<GrupoAsignaturaCreatePage />} />
        <Route path="/calificacion" element={<CalificacionListPage />} />
        <Route path="/calificacion/nueva" element={<CalificacionCreatePage />} />
        <Route path="/calificacion/:idCalificacion/editar" element={<CalificacionCorrectPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
