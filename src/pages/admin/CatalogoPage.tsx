import { useState, useEffect } from 'react'
import {
  collection, addDoc, getDocs, query, where,
  orderBy, deleteDoc, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Code2, Zap, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type { SkillCatalogItem, SkillType } from '../../types'

const SCHOOL_ID = 'sistemas-loja'

const TABS: { type: SkillType; label: string; icon: React.ReactNode }[] = [
  { type: 'advanced_skill',          label: 'Advanced Skills',            icon: <Zap size={14} /> },
  { type: 'programmer_certificate',  label: 'Certificados de Programador', icon: <Code2 size={14} /> },
]

const schema = z.object({
  name: z.string().min(2, 'Ingresa al menos 2 caracteres'),
})
type FormData = z.infer<typeof schema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogoPage() {
  const [activeType, setActiveType] = useState<SkillType>('advanced_skill')
  const [items, setItems]           = useState<SkillCatalogItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<SkillCatalogItem | null>(null)

  const load = async (type: SkillType) => {
    setLoading(true)
    const snap = await getDocs(
      query(
        collection(db, 'skillsCatalog'),
        where('schoolId', '==', SCHOOL_ID),
        where('type', '==', type),
        orderBy('name'),
      )
    )
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as SkillCatalogItem)))
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowForm(false)
    setEditing(null)
    void load(activeType)
  }, [activeType])

  const handleDelete = async (item: SkillCatalogItem) => {
    if (!confirm(`¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`)) return
    await deleteDoc(doc(db, 'skillsCatalog', item.id))
    toast.success('Eliminado')
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const startEdit = (item: SkillCatalogItem) => {
    setEditing(item)
    setShowForm(false)
  }

  const activeTab = TABS.find(t => t.type === activeType)!

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Catálogo de Skills</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Define las habilidades y certificados que podrán asignarse en las mallas.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditing(null) }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {TABS.map(tab => (
          <button
            key={tab.type}
            onClick={() => setActiveType(tab.type)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeType === tab.type
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <SkillForm
          type={activeType}
          label={activeTab.label}
          onSaved={item => {
            setItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 mt-4">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : items.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-44 gap-2 text-gray-400">
          {activeTab.icon}
          <p className="text-sm">No hay {activeTab.label.toLowerCase()} registradas aún.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-primary text-sm font-medium hover:underline"
          >
            Agregar la primera
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            editing?.id === item.id ? (
              <InlineEdit
                key={item.id}
                item={item}
                onSaved={updated => {
                  setItems(prev =>
                    prev.map(i => i.id === updated.id ? updated : i)
                      .sort((a, b) => a.name.localeCompare(b.name))
                  )
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <SkillRow
                key={item.id}
                item={item}
                onEdit={() => startEdit(item)}
                onDelete={() => handleDelete(item)}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skill row ────────────────────────────────────────────────────────────────

function SkillRow({
  item, onEdit, onDelete,
}: {
  item: SkillCatalogItem
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = item.type === 'advanced_skill' ? Zap : Code2

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon size={14} className="text-primary" />
      </div>
      <p className="flex-1 text-sm font-medium text-gray-800">{item.name}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function SkillForm({
  type, label, onSaved, onCancel,
}: {
  type: SkillType
  label: string
  onSaved: (item: SkillCatalogItem) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'skillsCatalog'), {
        name:      data.name.trim(),
        type,
        schoolId:  SCHOOL_ID,
        createdAt: serverTimestamp(),
      })
      toast.success('Agregado al catálogo')
      reset()
      onSaved({ id: ref.id, name: data.name.trim(), type, schoolId: SCHOOL_ID, createdAt: new Date() })
    } catch {
      toast.error('Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-primary/20 px-4 py-3 mb-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Nuevo — {label}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            type="text"
            placeholder={`Ej. ${type === 'advanced_skill' ? 'Cloud Computing' : 'Python Avanzado'}`}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            {...register('name')}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition disabled:opacity-60 flex-shrink-0"
        >
          <Plus size={14} /> {saving ? '...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
        >
          <X size={16} />
        </button>
      </form>
    </div>
  )
}

// ─── Inline edit ──────────────────────────────────────────────────────────────

function InlineEdit({
  item, onSaved, onCancel,
}: {
  item: SkillCatalogItem
  onSaved: (updated: SkillCatalogItem) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: item.name },
  })

  const onSubmit = async (data: FormData) => {
    if (data.name.trim() === item.name) { onCancel(); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'skillsCatalog', item.id), { name: data.name.trim() })
      toast.success('Actualizado')
      onSaved({ ...item, name: data.name.trim() })
    } catch {
      toast.error('Error al actualizar')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-primary/30 px-4 py-3">
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            type="text"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            {...register('name')}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-2 rounded-lg text-sm transition disabled:opacity-60 flex-shrink-0"
        >
          <Check size={14} /> {saving ? '...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
        >
          <X size={16} />
        </button>
      </form>
    </div>
  )
}
