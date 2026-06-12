import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Users, CheckCircle, Settings, BookOpen, UserPlus, LayoutDashboard, Clock, MapPin, TrendingUp, Globe, AlertTriangle, Building2 } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import Layout from '../../components/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import CreateUserPage from './CreateUserPage'
import StudentsPage from './StudentsPage'
import CohortsPage from './CohortsPage'
import MasterClassPage from './MasterClassPage'
import { ProgresoPage, HorasAdminPage, VisitasAdminPage } from './PracticasAdminPage'
import CatalogoPage from './CatalogoPage'
import MallasPage from './MallasPage'
import EmpresasPage from './EmpresasPage'

const navItems = [
  { label: 'Panel Principal', to: '/admin',                icon: <LayoutDashboard size={16} /> },
  { label: 'Estudiantes',     to: '/admin/estudiantes',    icon: <Users size={16} /> },
  { label: 'Crear Usuario',   to: '/admin/crear-usuario',  icon: <UserPlus size={16} /> },
  { label: 'Cohortes',        to: '/admin/cohortes',       icon: <BookOpen size={16} /> },
  { label: 'Master Classes',  to: '/admin/master-classes', icon: <BookOpen size={16} /> },
  // ── Prácticas ──
  { label: 'Progreso',        to: '/admin/practicas/progreso', icon: <TrendingUp size={16} />, section: 'Prácticas' },
  { label: 'Horas',           to: '/admin/practicas/horas',    icon: <Clock size={16} /> },
  { label: 'Visitas',         to: '/admin/practicas/visitas',  icon: <MapPin size={16} /> },
  { label: 'Empresas',        to: '/admin/practicas/empresas', icon: <Building2 size={16} /> },
  // ── Configuración ──
  { label: 'Catálogo Skills', to: '/admin/catalogo',       icon: <Settings size={16} />, section: 'Configuración' },
  { label: 'Mallas',          to: '/admin/mallas',         icon: <BookOpen size={16} /> },
]

export default function AdminDashboard() {
  return (
    <Layout navItems={navItems}>
      <Routes>
        <Route path="/" element={<AdminHome />} />
        <Route path="/crear-usuario" element={<CreateUserPage />} />
        <Route path="/estudiantes/:uid?" element={<StudentsPage />} />
        <Route path="/cohortes" element={<CohortsPage />} />
        <Route path="/master-classes" element={<MasterClassPage />} />
        <Route path="/practicas/progreso" element={<ProgresoPage />} />
        <Route path="/practicas/horas"    element={<HorasAdminPage />} />
        <Route path="/practicas/visitas"  element={<VisitasAdminPage />} />
        <Route path="/practicas/empresas" element={<EmpresasPage />} />
        <Route path="/catalogo"           element={<CatalogoPage />} />
        <Route path="/mallas"             element={<MallasPage />} />
      </Routes>
    </Layout>
  )
}

function AdminHome() {
  const { appUser } = useAuth()
  const [stats, setStats] = useState({ students: 0, pending: 0, cohorts: 0, teachers: 0 })

  useEffect(() => {
    ;(async () => {
      const [sSnap, pSnap, cSnap, tSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(query(collection(db, 'milestones'), where('status', '==', 'pending'))),
        getDocs(collection(db, 'cohorts')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      ])
      setStats({ students: sSnap.size, pending: pSnap.size, cohorts: cSnap.size, teachers: tSnap.size })
    })()
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
        <p className="text-gray-500 mt-1">Bienvenido, {appUser?.displayName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Estudiantes"             value={String(stats.students)} icon={<Users size={22} className="text-primary" />} />
        <StatCard label="Certificados Pendientes" value={String(stats.pending)}  icon={<CheckCircle size={22} className="text-accent" />} />
        <StatCard label="Cohortes"                value={String(stats.cohorts)}  icon={<BookOpen size={22} className="text-primary" />} />
        <StatCard label="Tutores"                 value={String(stats.teachers)} icon={<Users size={22} className="text-accent" />} />
      </div>

      <EnglishStatsSection />
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

// ─── English level stats ────────────────────────────────────────────────────

const CYCLE_ORDER = ['Primero','Segundo','Tercero','Cuarto','Quinto','Sexto','Séptimo','Octavo'] as const
type CicloName = typeof CYCLE_ORDER[number]

// Número de ciclo (usado para calcular el umbral dinámico)
const CYCLE_NUMBER: Record<CicloName, number> = {
  'Primero': 1, 'Segundo': 2, 'Tercero': 3, 'Cuarto': 4,
  'Quinto': 5, 'Sexto': 6, 'Séptimo': 7, 'Octavo': 8,
}

// Umbral dinámico: nivel mínimo para poder alcanzar N6 en Séptimo
// tomando máximo 2 niveles por ciclo restante.
// fórmula: max(0, 6 − (7 − nro_ciclo) × 2)
// Ciclos 1–4 → 0 (siempre alcanzable) · 5 → 2 · 6 → 4 · 7–8 → 6
function cycleThreshold(ciclo: CicloName): number {
  const n = CYCLE_NUMBER[ciclo]
  if (n >= 7) return 6
  return Math.max(0, 6 - (7 - n) * 2)
}

function getPeriodLabel(): string {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  if (m >= 5 && m <= 8)  return `Mayo–Agosto ${y}`
  if (m >= 10)           return `Octubre ${y} – Febrero ${y + 1}`
  if (m <= 2)            return `Octubre ${y - 1} – Febrero ${y}`
  return 'Período de transición'
}

interface AtRiskStudent {
  uid: string
  displayName: string
  cedula?: string
  level: number | null
}

interface CycleRow {
  ciclo: CicloName
  cycleNumber: number
  cohortName: string
  threshold: number
  atRiskStudents: AtRiskStudent[]
}

function EnglishStatsSection() {
  const [rows, setRows]         = useState<CycleRow[]>([])
  const [period, setPeriod]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<CycleRow | null>(null)

  useEffect(() => {
    ;(async () => {
      const [studentsSnap, cohortsSnap, milestonesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'cohorts')),
        getDocs(query(
          collection(db, 'milestones'),
          where('type', '==', 'english_level'),
          where('status', '==', 'approved'),
        )),
      ])

      const today = new Date()
      let activePeriod = getPeriodLabel()
      const cohortNameMap = new Map<string, string>()
      cohortsSnap.forEach(d => {
        const { name, startDate, endDate } = d.data()
        cohortNameMap.set(d.id, name as string)
        const start: Date | undefined = startDate?.toDate?.()
        const end: Date | undefined   = endDate?.toDate?.()
        if (start && end && start <= today && today <= end) activePeriod = name as string
      })
      setPeriod(activePeriod)

      // Max approved level per student
      const levelMap = new Map<string, number>()
      milestonesSnap.forEach(d => {
        const { studentId, title } = d.data()
        const n = parseInt((title as string)?.replace('Nivel ', '') || '0') || 0
        levelMap.set(studentId as string, Math.max(n, levelMap.get(studentId as string) ?? 0))
      })

      // Build at-risk students per ciclo
      type Acc = { cohortName: string; atRiskStudents: AtRiskStudent[] }
      const acc = new Map<CicloName, Acc>()

      studentsSnap.forEach(d => {
        const { ciclo, cohortId, estadoAcademico, displayName, cedula } = d.data()
        if (!ciclo || !(CYCLE_ORDER as readonly string[]).includes(ciclo)) return
        if (estadoAcademico !== 'en_curso') return

        const c         = ciclo as CicloName
        const threshold = cycleThreshold(c)
        const lv        = levelMap.get(d.id) ?? null
        const lvNum     = lv ?? 0
        const isAtRisk  = lvNum < threshold
        if (!isAtRisk) return

        if (!acc.has(c)) acc.set(c, {
          cohortName: cohortId ? (cohortNameMap.get(cohortId as string) ?? '—') : '—',
          atRiskStudents: [],
        })
        acc.get(c)!.atRiskStudents.push({
          uid: d.id,
          displayName: displayName as string,
          cedula: cedula as string | undefined,
          level: lv,
        })
      })

      // Sort students: no-level first, then by level asc, then by name
      acc.forEach(v => {
        v.atRiskStudents.sort((a, b) => {
          if (a.level === null && b.level !== null) return -1
          if (a.level !== null && b.level === null) return 1
          if (a.level !== null && b.level !== null && a.level !== b.level) return a.level - b.level
          return a.displayName.localeCompare(b.displayName)
        })
      })

      setRows(
        (CYCLE_ORDER as readonly CicloName[])
          .filter(c => acc.has(c))
          .map(c => ({ ciclo: c, cycleNumber: CYCLE_NUMBER[c], threshold: cycleThreshold(c), ...acc.get(c)! }))
      )
      setLoading(false)
    })()
  }, [])

  if (loading) return (
    <div className="mt-8 text-sm text-gray-400 animate-pulse">Cargando estadísticas de inglés…</div>
  )

  const totalAtRisk = rows.reduce((s, r) => s + r.atRiskStudents.length, 0)

  return (
    <>
      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            <h2 className="font-semibold text-gray-800 text-sm">Inglés — Estudiantes en riesgo</h2>
          </div>
          <span className="text-xs text-gray-400">{period}</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-green-600 font-medium">
            ✓ Todos los ciclos cumplen el requisito mínimo de inglés
          </div>
        ) : (
          <>
            <div className="px-5 py-2 bg-red-50 border-b border-red-100">
              <span className="text-xs font-medium text-red-700">
                {totalAtRisk} estudiantes en riesgo en {rows.length} ciclo{rows.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {rows.map(row => (
                <div key={row.ciclo} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-sm">{row.ciclo}</span>
                    <span className="text-xs text-gray-400 hidden sm:block">{row.cohortName}</span>
                    <span className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full font-semibold">
                      req. N{row.threshold}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-red-600">
                      {row.atRiskStudents.length}
                      <span className="text-xs font-normal text-gray-400 ml-1">estudiantes</span>
                    </span>
                    <button
                      onClick={() => setSelected(row)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Ver lista →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <AtRiskModal row={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function AtRiskModal({ row, onClose }: { row: CycleRow; onClose: () => void }) {
  // Ciclos restantes hasta Séptimo (después del ciclo actual)
  const remainingSlots = Math.max(0, (7 - row.cycleNumber)) * 2

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">
              Inglés en riesgo — Ciclo {row.ciclo}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {row.cohortName} · Meta: Nivel 6 para Séptimo ·
              {remainingSlots > 0
                ? ` pueden tomar hasta ${remainingSlots} niveles más`
                : ' no quedan ciclos disponibles'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">✕</button>
        </div>

        {/* Tabla */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
              <tr className="text-xs text-gray-400">
                <th className="px-5 py-2.5 text-left font-medium">Estudiante</th>
                <th className="px-5 py-2.5 text-left font-medium">Cédula</th>
                <th className="px-5 py-2.5 text-center font-medium">Nivel actual</th>
                <th className="px-5 py-2.5 text-center font-medium">Mejor caso</th>
                <th className="px-5 py-2.5 text-center font-medium">Déficit</th>
                <th className="px-5 py-2.5 text-center font-medium">Perfil</th>
              </tr>
            </thead>
            <tbody>
              {row.atRiskStudents.map(s => {
                const lvNum       = s.level ?? 0
                const maxReach    = Math.min(6, lvNum + remainingSlots)
                const deficit     = 6 - maxReach          // niveles que le faltarán incluso en el mejor caso
                const severity    = deficit >= 4 ? 'critical' : deficit >= 2 ? 'high' : 'medium'
                return (
                  <tr key={s.uid} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-800">{s.displayName}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">{s.cedula ?? '—'}</td>

                    {/* Nivel actual */}
                    <td className="px-5 py-3 text-center">
                      {s.level !== null ? (
                        <span className="font-bold text-orange-500">N{s.level}</span>
                      ) : (
                        <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                          Sin registrar
                        </span>
                      )}
                    </td>

                    {/* Mejor caso (si toma 2 niveles/ciclo restante) */}
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        maxReach >= 6 ? 'text-green-700 bg-green-50' : 'text-orange-700 bg-orange-50'
                      }`}>
                        hasta N{maxReach}
                      </span>
                    </td>

                    {/* Déficit */}
                    <td className="px-5 py-3 text-center">
                      {deficit <= 0 ? (
                        <span className="text-green-600 font-semibold text-xs">✓</span>
                      ) : (
                        <span className={`font-bold text-sm ${
                          severity === 'critical' ? 'text-red-600' :
                          severity === 'high'     ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                          −{deficit}
                          <span className="text-xs font-normal text-gray-400 ml-1">
                            nivel{deficit > 1 ? 'es' : ''}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Link al perfil */}
                    <td className="px-5 py-3 text-center">
                      <Link
                        to={`/admin/estudiantes/${s.uid}`}
                        onClick={onClose}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-xs text-gray-400">
            {row.atRiskStudents.length} estudiante{row.atRiskStudents.length > 1 ? 's' : ''} en riesgo ·
            <span className="ml-1 text-gray-500">Déficit = niveles que faltan para N6 incluso tomando 2/ciclo</span>
          </span>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
