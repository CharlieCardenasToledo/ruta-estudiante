import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Users, Clock, MapPin, LayoutDashboard } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import Layout from '../../components/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import HorasPage from './HorasPage'
import EstudiantesTeacherPage from './EstudiantesTeacherPage'
import VisitasPage from './VisitasPage'

const navItems = [
  { label: 'Panel Principal',  to: '/teacher',             icon: <LayoutDashboard size={16} /> },
  { label: 'Mis Estudiantes',  to: '/teacher/estudiantes', icon: <Users size={16} /> },
  { label: 'Horas Pendientes', to: '/teacher/horas',       icon: <Clock size={16} /> },
  { label: 'Visitas',          to: '/teacher/visitas',     icon: <MapPin size={16} /> },
]

export default function TeacherDashboard() {
  return (
    <Layout navItems={navItems}>
      <Routes>
        <Route path="/"             element={<TeacherHome />} />
        <Route path="/estudiantes"  element={<EstudiantesTeacherPage />} />
        <Route path="/horas"        element={<HorasPage />} />
        <Route path="/visitas"      element={<VisitasPage />} />
      </Routes>
    </Layout>
  )
}

function TeacherHome() {
  const { appUser } = useAuth()
  const [stats, setStats] = useState({ students: 0, pending: 0, visits: 0 })

  useEffect(() => {
    if (!appUser) return
    ;(async () => {
      const [iSnap, hSnap, vSnap] = await Promise.all([
        getDocs(query(collection(db, 'internships'), where('tutorId', '==', appUser.uid))),
        getDocs(query(collection(db, 'hoursLogs'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'visitLogs'), where('tutorId', '==', appUser.uid))),
      ])
      setStats({ students: iSnap.size, pending: hSnap.size, visits: vSnap.size })
    })()
  }, [appUser])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Panel del Tutor</h1>
        <p className="text-gray-500 mt-1">Bienvenido, {appUser?.displayName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Estudiantes Asignados"      value={String(stats.students)} icon={<Users size={22} className="text-primary" />} />
        <StatCard label="Horas Pendientes de Aprobar" value={String(stats.pending)}  icon={<Clock size={22} className="text-accent" />} />
        <StatCard label="Visitas Registradas"         value={String(stats.visits)}   icon={<MapPin size={22} className="text-primary" />} />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}
