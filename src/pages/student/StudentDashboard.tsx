import { Routes, Route } from 'react-router-dom'
import { GraduationCap, Award, Clock, FileText } from 'lucide-react'
import Layout from '../../components/Layout'
import MiRutaPage from './MiRutaPage'
import PracticasPage from './PracticasPage'

const navItems = [
  { label: 'Mi Ruta', to: '/student', icon: <GraduationCap size={16} /> },
  { label: 'Certificados', to: '/student/certificados', icon: <Award size={16} /> },
  { label: 'Prácticas', to: '/student/practicas', icon: <Clock size={16} /> },
  { label: 'Documentos', to: '/student/documentos', icon: <FileText size={16} /> },
]

export default function StudentDashboard() {
  return (
    <Layout navItems={navItems}>
      <Routes>
        <Route path="/" element={<MiRutaPage />} />
        <Route path="/practicas" element={<PracticasPage />} />
      </Routes>
    </Layout>
  )
}
