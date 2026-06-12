import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs, orderBy, doc, getDoc,
} from 'firebase/firestore'
import { MapPin, Star } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import type { VisitLog } from '../../types'

interface VisitWithStudent extends VisitLog {
  studentName: string
}

const LEVEL_LABEL: Record<VisitLog['performanceLevel'], string> = {
  deficiente: 'Deficiente',
  regular:    'Regular',
  bueno:      'Bueno',
  excelente:  'Excelente',
}

const LEVEL_CLASS: Record<VisitLog['performanceLevel'], string> = {
  deficiente: 'bg-red-50 text-red-600',
  regular:    'bg-amber-50 text-amber-600',
  bueno:      'bg-blue-50 text-blue-600',
  excelente:  'bg-green-50 text-green-700',
}

export default function VisitasPage() {
  const { appUser }  = useAuth()
  const [visits, setVisits]   = useState<VisitWithStudent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!appUser) return
    ;(async () => {
      const snap = await getDocs(
        query(
          collection(db, 'visitLogs'),
          where('tutorId', '==', appUser.uid),
          orderBy('date', 'desc'),
        )
      )
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as VisitLog))

      const uids = [...new Set(raw.map(v => v.studentId))]
      const nameMap: Record<string, string> = {}
      await Promise.all(uids.map(async uid => {
        const u = await getDoc(doc(db, 'users', uid))
        if (u.exists()) nameMap[uid] = u.data().displayName ?? uid
      }))

      setVisits(raw.map(v => ({ ...v, studentName: nameMap[v.studentId] ?? v.studentId })))
      setLoading(false)
    })()
  }, [appUser])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Visitas Registradas</h1>
        <p className="text-gray-500 mt-1 text-sm">{visits.length} visita{visits.length !== 1 ? 's' : ''} en total</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
          <MapPin size={32} className="text-gray-300" />
          <p className="text-sm">No has registrado visitas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map(v => <VisitCard key={v.id} visit={v} />)}
        </div>
      )}
    </div>
  )
}

function VisitCard({ visit }: { visit: VisitWithStudent }) {
  const date = visit.date instanceof Date
    ? visit.date
    : (visit.date as unknown as { toDate?: () => Date }).toDate?.() ?? new Date()

  const initials = visit.studentName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-800 text-sm">{visit.studentName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${LEVEL_CLASS[visit.performanceLevel]}`}>
              <Star size={10} />
              {LEVEL_LABEL[visit.performanceLevel]}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {date.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{visit.observations}</p>
        </div>
      </div>
    </div>
  )
}
