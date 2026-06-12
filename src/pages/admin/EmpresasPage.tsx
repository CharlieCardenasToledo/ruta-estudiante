import { useState, useEffect } from 'react'
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, where,
} from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus, Building2, Phone, MapPin, User, Mail,
  Edit3, Trash2, Save, X, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type { Empresa } from '../../types'

const SCHOOL_ID = 'sistemas-loja'

const schema = z.object({
  nombre:        z.string().min(2, 'Ingresa el nombre de la empresa'),
  direccion:     z.string().min(5, 'Ingresa la dirección'),
  telefono:      z.string().min(7, 'Ingresa un teléfono válido'),
  representante: z.string().min(3, 'Ingresa el nombre del representante'),
  email:         z.string().email('Correo inválido').optional().or(z.literal('')),
  sector:        z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function EmpresasPage() {
  const [empresas, setEmpresas]   = useState<Empresa[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Empresa | null>(null)
  const [search, setSearch]       = useState('')

  const load = async () => {
    const snap = await getDocs(
      query(collection(db, 'empresas'), where('schoolId', '==', SCHOOL_ID), orderBy('nombre'))
    )
    setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Empresa)))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  const handleEdit = (e: Empresa) => {
    setEditing(e)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditing(null)
  }

  const filtered = empresas.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.representante.toLowerCase().includes(search.toLowerCase()) ||
    (e.sector ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Empresas</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Empresas donde los estudiantes realizan sus prácticas pre-profesionales.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(v => !v) }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
        >
          {showForm && !editing ? <X size={16} /> : <Plus size={16} />}
          {showForm && !editing ? 'Cancelar' : 'Nueva empresa'}
        </button>
      </div>

      {(showForm || editing) && (
        <EmpresaForm
          empresa={editing ?? undefined}
          onSaved={() => { handleClose(); load() }}
          onCancel={handleClose}
        />
      )}

      {/* Buscador */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, representante o sector..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
          <Building2 size={32} className="text-gray-300" />
          <p className="text-sm">{search ? 'Sin resultados.' : 'No hay empresas registradas aún.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <EmpresaCard
              key={e.id}
              empresa={e}
              onEdit={() => handleEdit(e)}
              onDeleted={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function EmpresaForm({
  empresa, onSaved, onCancel,
}: {
  empresa?: Empresa; onSaved: () => void; onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: empresa ? {
      nombre:        empresa.nombre,
      direccion:     empresa.direccion,
      telefono:      empresa.telefono,
      representante: empresa.representante,
      email:         empresa.email ?? '',
      sector:        empresa.sector ?? '',
    } : {},
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    const payload = {
      nombre:        data.nombre,
      direccion:     data.direccion,
      telefono:      data.telefono,
      representante: data.representante,
      email:         data.email || null,
      sector:        data.sector || null,
      schoolId:      SCHOOL_ID,
      updatedAt:     serverTimestamp(),
    }
    try {
      if (empresa) {
        await updateDoc(doc(db, 'empresas', empresa.id), payload)
        toast.success('Empresa actualizada')
      } else {
        await addDoc(collection(db, 'empresas'), { ...payload, createdAt: serverTimestamp() })
        toast.success('Empresa registrada')
      }
      onSaved()
    } catch {
      toast.error(empresa ? 'Error al actualizar' : 'Error al registrar')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-primary/20 p-6 mb-6 shadow-sm">
      <h2 className="font-semibold text-gray-700 mb-5">{empresa ? 'Editar empresa' : 'Nueva empresa'}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la empresa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Banco del Pichincha"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('nombre')}
            />
            {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Representante / Supervisor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nombre completo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('representante')}
            />
            {errors.representante && <p className="mt-1 text-xs text-red-500">{errors.representante.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              placeholder="07 2123456"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('telefono')}
            />
            {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Calle, número, ciudad"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('direccion')}
            />
            {errors.direccion && <p className="mt-1 text-xs text-red-500">{errors.direccion.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
              <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="email"
              placeholder="contacto@empresa.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sector / Industria
              <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Banca, Salud, Tecnología"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('sector')}
            />
          </div>

        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-60"
          >
            <Save size={15} /> {saving ? 'Guardando...' : empresa ? 'Actualizar' : 'Registrar empresa'}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function EmpresaCard({
  empresa, onEdit, onDeleted,
}: {
  empresa: Empresa; onEdit: () => void; onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${empresa.nombre}"?`)) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'empresas', empresa.id))
      toast.success('Empresa eliminada')
      onDeleted()
    } catch {
      toast.error('Error al eliminar')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Building2 size={18} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-800">{empresa.nombre}</p>
            {empresa.sector && (
              <span className="inline-block text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-0.5">
                {empresa.sector}
              </span>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-2 text-gray-300 hover:text-primary transition"
              title="Editar"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 text-gray-300 hover:text-red-500 transition disabled:opacity-50"
              title="Eliminar"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          <InfoItem icon={<User size={12} />}     text={empresa.representante} />
          <InfoItem icon={<Phone size={12} />}    text={empresa.telefono} />
          <InfoItem icon={<MapPin size={12} />}   text={empresa.direccion} />
          {empresa.email && <InfoItem icon={<Mail size={12} />} text={empresa.email} />}
        </div>
      </div>
    </div>
  )
}

function InfoItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  )
}
