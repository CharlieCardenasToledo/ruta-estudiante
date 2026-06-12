import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, orderBy, getDoc, increment,
} from 'firebase/firestore'
import { CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type { HoursLog } from '../../types'

interface LogWithStudent extends HoursLog {
  studentName: string
  studentEmail: string
}

type Filter = 'pending' | 'approved' | 'rejected'

export default function HorasPage() {
  const [logs, setLogs]         = useState<LogWithStudent[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('pending')

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
      await updateDoc(doc(db, 'hoursLogs', log.id), {
        status: 'approved',
        updatedAt: serverTimestamp(),
      })
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
      await updateDoc(doc(db, 'hoursLogs', log.id), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'internships', log.internshipId), {
        totalHoursDeclared: increment(-log.hours),
      })
      toast.success('Registro rechazado')
      setLogs(prev => prev.filter(l => l.id !== log.id))
    } catch {
      toast.error('Error al rechazar. Intenta de nuevo.')
    }
  }

  const pendingCount = filter === 'pending' ? logs.length : null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Horas de Prácticas</h1>
          {pendingCount !== null && pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1 text-sm">Aprueba o rechaza las horas declaradas por los estudiantes.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(['pending', 'approved', 'rejected'] as Filter[]).map(f => (
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

  const handle = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const date = log.date instanceof Date
    ? log.date
    : (log.date as unknown as { toDate?: () => Date }).toDate?.() ?? new Date()

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

      {showActions && (
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
      )}

      {!showActions && (
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
