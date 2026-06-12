import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs,
  serverTimestamp, orderBy, doc, getDoc, writeBatch, increment,
} from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Clock, CheckCircle, XCircle, Plus, Briefcase,
  AlertCircle, ChevronDown, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import type { Internship, HoursLog, Cohort } from '../../types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  date:     z.string().min(1, 'Selecciona la fecha'),
  hours:    z.coerce.number().min(1, 'Mínimo 1 hora').max(12, 'Máximo 12 horas por día'),
  activity: z.string().min(10, 'Describe la actividad (mín. 10 caracteres)'),
})
type FormData = z.infer<typeof schema>

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PracticasPage() {
  const { appUser } = useAuth()
  const [internship, setInternship]   = useState<Internship | null>(null)
  const [cohort, setCohort]           = useState<Cohort | null>(null)
  const [logs, setLogs]               = useState<HoursLog[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [noInternship, setNoInternship] = useState(false)

  const load = useCallback(async () => {
    if (!appUser) return
    setLoading(true)

    // Find active internship for this student
    const iSnap = await getDocs(
      query(collection(db, 'internships'), where('studentId', '==', appUser.uid))
    )

    if (iSnap.empty) {
      setNoInternship(true)
      setLoading(false)
      return
    }

    const iDoc  = iSnap.docs[0]
    const iData = { id: iDoc.id, ...iDoc.data() } as Internship
    setInternship(iData)

    // Load cohort info
    if (iData.cohortId) {
      const cDoc = await getDoc(doc(db, 'cohorts', iData.cohortId))
      if (cDoc.exists()) setCohort({ id: cDoc.id, ...cDoc.data() } as Cohort)
    }

    // Load hours logs
    const lSnap = await getDocs(
      query(
        collection(db, 'hoursLogs'),
        where('internshipId', '==', iData.id),
        orderBy('date', 'desc'),
      )
    )
    setLogs(lSnap.docs.map(d => ({ id: d.id, ...d.data() } as HoursLog)))
    setLoading(false)
  }, [appUser])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Cargando prácticas...
      </div>
    )
  }

  if (noInternship) {
    return (
      <div className="p-8 max-w-lg">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-amber-400" />
          <div>
            <p className="font-semibold text-gray-800">No tienes una práctica registrada</p>
            <p className="text-sm text-gray-500 mt-1">
              El administrador debe registrar tu práctica pre-profesional. Comunícate con la coordinación.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const hoursRequired  = cohort?.internshipHoursRequired ?? 0
  const hoursApproved  = internship?.totalHoursApproved  ?? 0
  const hoursDeclared  = internship?.totalHoursDeclared  ?? 0
  const pct            = hoursRequired > 0 ? Math.min(100, Math.round((hoursApproved / hoursRequired) * 100)) : 0

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Prácticas Pre-profesionales</h1>
          <p className="text-gray-500 text-sm mt-1">
            {cohort?.name ?? 'Cohorte sin asignar'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
        >
          <Plus size={15} />
          Declarar horas
        </button>
      </div>

      {/* Progress card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Briefcase size={16} className="text-primary" />
            Progreso de horas
          </div>
          <span className="text-sm font-bold text-primary">{pct}%</span>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
          <div
            className="bg-primary h-2.5 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Aprobadas" value={`${hoursApproved} h`} color="text-green-600" />
          <Stat label="Pendientes" value={`${hoursDeclared - hoursApproved} h`} color="text-amber-500" />
          <Stat label="Requeridas" value={`${hoursRequired} h`} color="text-gray-600" />
        </div>
      </div>

      {/* Declare form */}
      {showForm && (
        <DeclareForm
          internshipId={internship!.id}
          studentId={appUser!.uid}
          onSaved={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Logs */}
      <h2 className="font-semibold text-gray-700 mb-3 text-sm">Historial de registros</h2>
      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-36 gap-2 text-gray-400">
          <Clock size={28} className="text-gray-300" />
          <p className="text-sm">No has declarado horas aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(l => <LogRow key={l.id} log={l} />)}
        </div>
      )}
    </div>
  )
}

// ─── Stat ─────────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}


// ─── Declare form ─────────────────────────────────────────────────────────────

function DeclareForm({
  internshipId, studentId, onSaved, onCancel,
}: {
  internshipId: string
  studentId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof schema>, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { hours: 8 },
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      const logRef = doc(collection(db, 'hoursLogs'))
      batch.set(logRef, {
        internshipId,
        studentId,
        date:      new Date(data.date + 'T12:00:00'),
        hours:     data.hours,
        activity:  data.activity,
        status:    'pending',
        createdAt: serverTimestamp(),
      })
      batch.update(doc(db, 'internships', internshipId), {
        totalHoursDeclared: increment(data.hours),
      })
      await batch.commit()
      toast.success('Horas declaradas — pendiente de aprobación')
      onSaved()
    } catch {
      toast.error('Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700">Declarar horas</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
              {...register('date')}
            />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horas <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                {...register('hours')}
              />
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.hours && <p className="mt-1 text-xs text-red-500">{errors.hours.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actividad realizada <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Describe las actividades realizadas durante la jornada..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            {...register('activity')}
          />
          {errors.activity && <p className="mt-1 text-xs text-red-500">{errors.activity.message}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-60"
          >
            <Plus size={15} />
            {saving ? 'Guardando...' : 'Guardar horas'}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: HoursLog }) {
  const date = log.date instanceof Date
    ? log.date
    : (log.date as unknown as { toDate?: () => Date }).toDate?.() ?? new Date()

  const badge = {
    pending:  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock size={10} /> Pendiente</span>,
    approved: <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Aprobado</span>,
    rejected: <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={10} /> Rechazado</span>,
  }[log.status]

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{log.activity}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700">{log.hours} h</span>
        {badge}
      </div>
    </div>
  )
}
