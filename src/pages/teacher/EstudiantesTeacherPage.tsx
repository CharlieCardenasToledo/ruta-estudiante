import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs, addDoc,
  serverTimestamp, doc, getDoc,
} from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Plus, X, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import type { Internship, Cohort } from '../../types'

interface StudentInternship {
  uid: string
  displayName: string
  email: string
  ciclo?: string
  internship: Internship
  cohort?: Cohort
}

const visitSchema = z.object({
  date:             z.string().min(1, 'Selecciona la fecha'),
  observations:     z.string().min(10, 'Mínimo 10 caracteres'),
  performanceLevel: z.enum(['deficiente', 'regular', 'bueno', 'excelente']),
})
type VisitForm = z.infer<typeof visitSchema>

export default function EstudiantesTeacherPage() {
  const { appUser }  = useAuth()
  const [students, setStudents] = useState<StudentInternship[]>([])
  const [loading, setLoading]   = useState(true)
  const [visitTarget, setVisitTarget] = useState<StudentInternship | null>(null)

  useEffect(() => {
    if (!appUser) return
    ;(async () => {
      // Students whose internship tutorId == teacher uid
      const iSnap = await getDocs(
        query(collection(db, 'internships'), where('tutorId', '==', appUser.uid))
      )

      const list: StudentInternship[] = []
      await Promise.all(iSnap.docs.map(async iDoc => {
        const internship = { id: iDoc.id, ...iDoc.data() } as Internship
        const [uDoc, cDoc] = await Promise.all([
          getDoc(doc(db, 'users', internship.studentId)),
          internship.cohortId ? getDoc(doc(db, 'cohorts', internship.cohortId)) : Promise.resolve(null),
        ])
        if (!uDoc.exists()) return
        list.push({
          uid:         internship.studentId,
          displayName: uDoc.data().displayName ?? '',
          email:       uDoc.data().email ?? '',
          ciclo:       uDoc.data().ciclo,
          internship,
          cohort: cDoc?.exists() ? ({ id: cDoc.id, ...cDoc.data() } as Cohort) : undefined,
        })
      }))

      setStudents(list.sort((a, b) => a.displayName.localeCompare(b.displayName)))
      setLoading(false)
    })()
  }, [appUser])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mis Estudiantes</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Estudiantes asignados a tu tutoría · {students.length} en total
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
          <p className="text-sm">No tienes estudiantes asignados aún.</p>
          <p className="text-xs text-gray-300">El administrador asigna tutores desde el perfil del estudiante.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(s => (
            <StudentCard key={s.uid} student={s} onVisit={() => setVisitTarget(s)} />
          ))}
        </div>
      )}

      {visitTarget && (
        <VisitModal
          student={visitTarget}
          teacherId={appUser!.uid}
          onSaved={() => setVisitTarget(null)}
          onClose={() => setVisitTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Student card ─────────────────────────────────────────────────────────────

function StudentCard({ student, onVisit }: { student: StudentInternship; onVisit: () => void }) {
  const { internship, cohort } = student
  const required  = cohort?.internshipHoursRequired ?? 0
  const approved  = internship.totalHoursApproved ?? 0
  const pct       = required > 0 ? Math.min(100, Math.round((approved / required) * 100)) : 0
  const initials  = student.displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{student.displayName}</p>
            <p className="text-xs text-gray-400 truncate">{student.email}</p>
            {student.ciclo && (
              <span className="inline-block mt-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {student.ciclo} ciclo
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onVisit}
          className="flex items-center gap-1.5 flex-shrink-0 text-xs font-medium text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition"
        >
          <MapPin size={13} /> Registrar visita
        </button>
      </div>

      {/* Hours progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Horas aprobadas</span>
          <span>{approved} / {required} h · {pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{cohort?.name ?? 'Sin cohorte'}</p>
      </div>
    </div>
  )
}

// ─── Visit modal ──────────────────────────────────────────────────────────────

function VisitModal({
  student, teacherId, onSaved, onClose,
}: {
  student: StudentInternship
  teacherId: string
  onSaved: () => void
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<VisitForm>({
    resolver: zodResolver(visitSchema),
    defaultValues: { performanceLevel: 'bueno' },
  })

  const onSubmit = async (data: VisitForm) => {
    setSaving(true)
    try {
      await addDoc(collection(db, 'visitLogs'), {
        internshipId:     student.internship.id,
        tutorId:          teacherId,
        studentId:        student.uid,
        date:             new Date(data.date + 'T12:00:00'),
        observations:     data.observations,
        performanceLevel: data.performanceLevel,
        createdAt:        serverTimestamp(),
      })
      toast.success('Visita registrada')
      onSaved()
    } catch {
      toast.error('Error al registrar la visita')
      setSaving(false)
    }
  }

  const levels: { value: VisitForm['performanceLevel']; label: string }[] = [
    { value: 'deficiente', label: 'Deficiente' },
    { value: 'regular',    label: 'Regular'    },
    { value: 'bueno',      label: 'Bueno'      },
    { value: 'excelente',  label: 'Excelente'  },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-800">Registrar visita</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Estudiante: <span className="font-medium text-gray-700">{student.displayName}</span>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de visita <span className="text-red-500">*</span>
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
              Nivel de desempeño <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                {...register('performanceLevel')}
              >
                {levels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Describe el desempeño del estudiante y las actividades observadas..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              {...register('observations')}
            />
            {errors.observations && <p className="mt-1 text-xs text-red-500">{errors.observations.message}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-60"
            >
              <Plus size={15} />
              {saving ? 'Guardando...' : 'Guardar visita'}
            </button>
            <button type="button" onClick={onClose} className="px-4 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
