import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, orderBy, getDoc, increment,
} from 'firebase/firestore'
import {
  CheckCircle, XCircle, MapPin,
  Briefcase, Users, TrendingUp, Eye,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type { Internship, HoursLog, VisitLog, Cohort } from '../../types'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function toDate(raw: unknown): Date {
  if (raw instanceof Date) return raw
  const ts = raw as { toDate?: () => Date }
  return ts.toDate?.() ?? new Date(raw as string)
}

const PERF_BADGE: Record<string, string> = {
  deficiente: 'bg-red-100 text-red-700',
  regular:    'bg-amber-100 text-amber-700',
  bueno:      'bg-blue-100 text-blue-700',
  excelente:  'bg-green-100 text-green-700',
}
const PERF_LABEL: Record<string, string> = {
  deficiente: 'Deficiente',
  regular:    'Regular',
  bueno:      'Bueno',
  excelente:  'Excelente',
}

// ─── Progreso page ────────────────────────────────────────────────────────────

interface InternshipRow {
  internship: Internship
  studentName: string
  studentEmail: string
  ciclo?: string
  cohort?: Cohort
  tutorName?: string
}

export function ProgresoPage() {
  const [rows, setRows]         = useState<InternshipRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterCohort, setFilterCohort] = useState<string>('all')
  const [cohorts, setCohorts]   = useState<Cohort[]>([])

  useEffect(() => {
    ;(async () => {
      const [iSnap, cSnap] = await Promise.all([
        getDocs(collection(db, 'internships')),
        getDocs(query(collection(db, 'cohorts'), where('schoolId', '==', 'sistemas-loja'))),
      ])

      const cohortMap: Record<string, Cohort> = {}
      const cohortList: Cohort[] = []
      cSnap.docs.forEach(d => {
        const c = { id: d.id, ...d.data() } as Cohort
        cohortMap[d.id] = c
        cohortList.push(c)
      })
      setCohorts(cohortList.sort((a, b) => a.name.localeCompare(b.name)))

      const internships = iSnap.docs.map(d => ({ id: d.id, ...d.data() } as Internship))

      // Batch-load unique students and tutors
      const uids     = [...new Set(internships.map(i => i.studentId))]
      const tutorIds = [...new Set(internships.map(i => i.tutorId).filter(Boolean) as string[])]

      const userDocs = await Promise.all([...uids, ...tutorIds].map(uid =>
        getDoc(doc(db, 'users', uid))
      ))
      const userMap: Record<string, { name: string; email: string; ciclo?: string }> = {}
      userDocs.forEach(d => {
        if (d.exists()) {
          userMap[d.id] = {
            name:  d.data().displayName ?? d.id,
            email: d.data().email ?? '',
            ciclo: d.data().ciclo,
          }
        }
      })

      const result: InternshipRow[] = internships.map(i => ({
        internship:   i,
        studentName:  userMap[i.studentId]?.name  ?? i.studentId,
        studentEmail: userMap[i.studentId]?.email ?? '',
        ciclo:        userMap[i.studentId]?.ciclo,
        cohort:       i.cohortId ? cohortMap[i.cohortId] : undefined,
        tutorName:    i.tutorId  ? userMap[i.tutorId]?.name : undefined,
      }))

      setRows(result.sort((a, b) => a.studentName.localeCompare(b.studentName)))
      setLoading(false)
    })()
  }, [])

  const filtered = filterCohort === 'all'
    ? rows
    : rows.filter(r => r.internship.cohortId === filterCohort)

  const totalApproved = filtered.reduce((s, r) => s + (r.internship.totalHoursApproved ?? 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Progreso de Prácticas</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Vista general de todos los estudiantes en proceso de prácticas.
          </p>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <MiniStat icon={<Users size={16} className="text-primary" />}      label="Estudiantes"      value={String(filtered.length)} />
          <MiniStat icon={<CheckCircle size={16} className="text-green-600" />} label="Horas aprobadas" value={`${totalApproved} h`} />
          <MiniStat icon={<TrendingUp size={16} className="text-blue-500" />}   label="Completos (100%)"
            value={String(filtered.filter(r => {
              const req = r.cohort?.internshipHoursRequired ?? 0
              return req > 0 && (r.internship.totalHoursApproved ?? 0) >= req
            }).length)}
          />
          <MiniStat icon={<Briefcase size={16} className="text-accent" />} label="Cohortes activas" value={String(cohorts.length)} />
        </div>
      )}

      {/* Filter */}
      {cohorts.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterCohort('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterCohort === 'all' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/40'
            }`}
          >
            Todos
          </button>
          {cohorts.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCohort(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCohort === c.id ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/40'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
          <Briefcase size={32} className="text-gray-300" />
          <p className="text-sm">No hay prácticas registradas.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Estudiante</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Cohorte</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Tutor</th>
                <th className="text-left px-4 py-3 font-medium">Progreso</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => {
                const req      = r.cohort?.internshipHoursRequired ?? 0
                const approved = r.internship.totalHoursApproved ?? 0
                const pct      = req > 0 ? Math.min(100, Math.round((approved / req) * 100)) : 0
                const initials = r.studentName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                return (
                  <tr key={r.internship.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-xs">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{r.studentName}</p>
                          <p className="text-xs text-gray-400">{r.ciclo ? `${r.ciclo} ciclo` : r.studentEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-500">{r.cohort?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{r.tutorName ?? <span className="text-gray-300">Sin tutor</span>}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-16 text-right">
                          {approved}/{req} h
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/estudiantes/${r.internship.studentId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition"
                      >
                        <Eye size={12} /> Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Mini stat ─────────────────────────────────────────────────────────────────

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-base font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

// ─── Horas page ───────────────────────────────────────────────────────────────

interface LogWithStudent extends HoursLog {
  studentName: string
  studentEmail: string
}

type HorasFilter = 'pending' | 'approved' | 'rejected'

export function HorasAdminPage() {
  const [logs, setLogs]       = useState<LogWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<HorasFilter>('pending')

  const load = useCallback(async () => {
    setLoading(true)
    const snap = await getDocs(
      query(
        collection(db, 'hoursLogs'),
        where('status', '==', filter),
        orderBy('createdAt', 'desc'),
      )
    )
    const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as HoursLog))

    const uids = [...new Set(raw.map(l => l.studentId))]
    const userMap: Record<string, { name: string; email: string }> = {}
    await Promise.all(uids.map(async uid => {
      const u = await getDoc(doc(db, 'users', uid))
      if (u.exists()) userMap[uid] = { name: u.data().displayName ?? uid, email: u.data().email ?? '' }
    }))

    setLogs(raw.map(l => ({
      ...l,
      studentName:  userMap[l.studentId]?.name  ?? l.studentId,
      studentEmail: userMap[l.studentId]?.email ?? '',
    })))
    setLoading(false)
  }, [filter])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const approve = async (log: LogWithStudent) => {
    try {
      await updateDoc(doc(db, 'hoursLogs', log.id), { status: 'approved', updatedAt: serverTimestamp() })
      await updateDoc(doc(db, 'internships', log.internshipId), {
        totalHoursApproved: increment(log.hours),
        totalHoursDeclared: increment(log.hours),
      })
      toast.success(`${log.hours} horas aprobadas`)
      setLogs(prev => prev.filter(l => l.id !== log.id))
    } catch {
      toast.error('Error al aprobar. Intenta de nuevo.')
    }
  }

  const reject = async (log: LogWithStudent) => {
    try {
      await updateDoc(doc(db, 'hoursLogs', log.id), { status: 'rejected', updatedAt: serverTimestamp() })
      await updateDoc(doc(db, 'internships', log.internshipId), {
        totalHoursDeclared: increment(-log.hours),
      })
      toast.success('Registro rechazado')
      setLogs(prev => prev.filter(l => l.id !== log.id))
    } catch {
      toast.error('Error al rechazar. Intenta de nuevo.')
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Horas de Prácticas</h1>
          {filter === 'pending' && logs.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {logs.length} pendiente{logs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1 text-sm">Aprueba o rechaza horas declaradas por los estudiantes.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(['pending', 'approved', 'rejected'] as HorasFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Rechazados'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-44 gap-2 text-gray-400">
          <CheckCircle size={32} className="text-gray-300" />
          <p className="text-sm">No hay registros en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(l => (
            <HoursCard
              key={l.id}
              log={l}
              showActions={filter === 'pending'}
              onApprove={() => approve(l)}
              onReject={() => reject(l)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HoursCard({
  log, showActions, onApprove, onReject,
}: {
  log: LogWithStudent
  showActions: boolean
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const handle = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const date     = toDate(log.date)
  const initials = log.studentName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-800 text-sm">{log.studentName}</p>
            <span className="text-lg font-bold text-primary flex-shrink-0">{log.hours} h</span>
          </div>
          <p className="text-xs text-gray-400">{log.studentEmail}</p>
          <p className="text-sm text-gray-600 mt-2">{log.activity}</p>
          <p className="text-xs text-gray-400 mt-1">
            {date.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {showActions ? (
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => handle(onReject)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition disabled:opacity-50"
          >
            <XCircle size={13} /> Rechazar
          </button>
          <button
            onClick={() => handle(onApprove)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition disabled:opacity-50"
          >
            <CheckCircle size={13} /> {busy ? '...' : 'Aprobar'}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          {log.status === 'approved'
            ? <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={11}/> Aprobado</span>
            : <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={11}/> Rechazado</span>
          }
        </div>
      )}
    </div>
  )
}

// ─── Visitas page ─────────────────────────────────────────────────────────────

interface VisitRow {
  visit: VisitLog
  studentName: string
  tutorName: string
}

export function VisitasAdminPage() {
  const [rows, setRows]       = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const snap = await getDocs(
        query(collection(db, 'visitLogs'), orderBy('date', 'desc'))
      )
      const visits = snap.docs.map(d => ({ id: d.id, ...d.data() } as VisitLog))

      const uids = [...new Set([
        ...visits.map(v => v.studentId),
        ...visits.map(v => v.tutorId),
      ])]
      const userMap: Record<string, string> = {}
      await Promise.all(uids.map(async uid => {
        const u = await getDoc(doc(db, 'users', uid))
        if (u.exists()) userMap[uid] = u.data().displayName ?? uid
      }))

      setRows(visits.map(v => ({
        visit:       v,
        studentName: userMap[v.studentId] ?? v.studentId,
        tutorName:   userMap[v.tutorId]   ?? v.tutorId,
      })))
      setLoading(false)
    })()
  }, [])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Visitas Tutoriales</h1>
        <p className="text-gray-500 mt-1 text-sm">Historial de visitas registradas por todos los tutores.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
          <MapPin size={32} className="text-gray-300" />
          <p className="text-sm">No hay visitas registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => <VisitCard key={r.visit.id} row={r} />)}
        </div>
      )}
    </div>
  )
}

function VisitCard({ row }: { row: VisitRow }) {
  const date     = toDate(row.visit.date)
  const initials = row.studentName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const perf     = row.visit.performanceLevel

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800 text-sm">{row.studentName}</p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin size={10} /> Tutor: {row.tutorName}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${PERF_BADGE[perf] ?? 'bg-gray-100 text-gray-600'}`}>
                {PERF_LABEL[perf] ?? perf}
              </span>
              <p className="text-xs text-gray-400">
                {date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          {row.visit.observations && (
            <p className="mt-2 text-sm text-gray-600">{row.visit.observations}</p>
          )}
        </div>
      </div>
    </div>
  )
}
