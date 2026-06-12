import { useState, useEffect } from 'react'
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, serverTimestamp, where, getCountFromServer,
} from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, BookOpen, Trash2, Calendar, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type { MasterClassCatalogItem } from '../../types'

const schema = z.object({
  title: z.string().min(5, 'Ingresa el nombre de la Master Class'),
  date:  z.string().min(1, 'Selecciona la fecha'),
})
type FormData = z.infer<typeof schema>

export default function MasterClassPage() {
  const [items, setItems]       = useState<MasterClassCatalogItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [counts, setCounts]     = useState<Record<string, number>>({})

  const load = async () => {
    const snap = await getDocs(
      query(collection(db, 'masterClasses'), where('schoolId', '==', 'sistemas-loja'), orderBy('date', 'desc'))
    )
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MasterClassCatalogItem))
    setItems(list)

    // Count certificates per master class using aggregate (no document downloads)
    const countMap: Record<string, number> = {}
    await Promise.all(list.map(async item => {
      const snap = await getCountFromServer(
        query(collection(db, 'milestones'), where('type', '==', 'master_class'), where('title', '==', item.title))
      )
      countMap[item.id] = snap.data().count
    }))
    setCounts(countMap)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta Master Class del catálogo?')) return
    await deleteDoc(doc(db, 'masterClasses', id))
    toast.success('Eliminada del catálogo')
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Catálogo Master Class</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Gestiona las Master Classes disponibles para los estudiantes.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
        >
          <Plus size={16} /> Nueva Master Class
        </button>
      </div>

      {showForm && (
        <MasterClassForm
          onCreated={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 mt-6">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400 mt-4">
          <BookOpen size={32} className="text-gray-300" />
          <p className="text-sm">No hay Master Classes en el catálogo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <CatalogCard
              key={item.id}
              item={item}
              count={counts[item.id] ?? 0}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function MasterClassForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      await addDoc(collection(db, 'masterClasses'), {
        title:    data.title,
        date:     new Date(data.date + 'T12:00:00'),
        schoolId: 'sistemas-loja',
        createdAt: serverTimestamp(),
      })
      toast.success('Master Class agregada al catálogo')
      onCreated()
    } catch {
      toast.error('Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <h2 className="font-semibold text-gray-700 mb-4">Nueva Master Class</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Ej. Inteligencia Artificial Aplicada"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            {...register('title')}
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
            {...register('date')}
          />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-60"
          >
            <Plus size={15} /> {saving ? 'Guardando...' : 'Agregar'}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Catalog card ─────────────────────────────────────────────────────────────

function CatalogCard({ item, count, onDelete }: {
  item: MasterClassCatalogItem
  count: number
  onDelete: () => void
}) {
  const date = item.date instanceof Date
    ? item.date
    : (item.date as unknown as { toDate?: () => Date }).toDate?.() ?? new Date(item.date as unknown as string)

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{item.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={11} />
              {date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users size={11} /> {count} certificado{count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="flex-shrink-0 text-gray-300 hover:text-red-400 transition"
        title="Eliminar"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
