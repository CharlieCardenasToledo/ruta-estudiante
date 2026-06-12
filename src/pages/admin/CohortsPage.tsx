import { useState, useEffect } from 'react'
import {
  collection, addDoc, getDocs, doc, getDoc, query, where,
  serverTimestamp, orderBy, updateDoc, deleteDoc,
} from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus, BookOpen, Users, Clock, ChevronDown, ChevronUp, GraduationCap,
  Download, Zap, Code2, Star, Trash2, Settings, Edit3, Save, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type {
  Cohort, CohortRequirement, MallaConfig, SkillCatalogItem,
  MasterClassCatalogItem, RequirementType,
} from '../../types'

const SCHOOL_ID = 'sistemas-loja'
const CICLO_OPTIONS = ['1','2','3','4','5','6','7','8','9','10']
const MALLAS = ['ITIL_MALLA 2019', 'ITIL_MALLA 2023', 'SINL_MALLA 2025']

const REQ_TABS: { type: RequirementType; label: string; icon: React.ReactNode }[] = [
  { type: 'advanced_skill',         label: 'Advanced Skills',   icon: <Zap size={13} /> },
  { type: 'programmer_certificate', label: 'Cert. Programador', icon: <Code2 size={13} /> },
  { type: 'master_class',           label: 'Master Classes',    icon: <Star size={13} /> },
]

const schema = z.object({
  name:                     z.string().min(3, 'Ingresa un nombre para la cohorte'),
  malla:                    z.string().min(1, 'Selecciona una malla'),
  startDate:                z.string().min(1, 'Ingresa la fecha de inicio del período'),
  endDate:                  z.string().min(1, 'Ingresa la fecha de fin del período'),
  graduationDate:           z.string().optional(),
  internshipHoursRequired:  z.coerce.number().min(1, 'Ingresa las horas requeridas'),
  internshipPeriods:        z.coerce.number().min(1, 'Ingresa el número de períodos'),
}).refine(d => d.endDate > d.startDate, {
  message: 'La fecha de fin debe ser posterior a la de inicio',
  path: ['endDate'],
}).refine(d => !d.graduationDate || d.graduationDate >= d.endDate, {
  message: 'La fecha de graduación debe ser posterior al fin del período',
  path: ['graduationDate'],
})

type FormData = z.infer<typeof schema>

function toDate(raw: unknown): Date {
  if (raw instanceof Date) return raw
  const ts = raw as { toDate?: () => Date }
  return ts.toDate?.() ?? new Date(raw as string)
}

const fmt = (d: Date) =>
  d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })

const toInputDate = (d: Date | undefined) => {
  if (!d) return ''
  const date = toDate(d)
  return date.toISOString().split('T')[0]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchCohorts = async () => {
    const snap = await getDocs(
      query(collection(db, 'cohorts'), where('schoolId', '==', SCHOOL_ID), orderBy('name'))
    )
    setCohorts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cohort)))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchCohorts() }, [])

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cohortes</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Registra y gestiona las cohortes académicas del programa.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />} 
          {showForm ? 'Cancelar' : 'Nueva cohorte'}
        </button>
      </div>

      {showForm && (
        <CohortForm
          onSaved={() => { setShowForm(false); fetchCohorts() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 mt-6">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : cohorts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 gap-2 text-gray-400 mt-4">
          <BookOpen size={32} className="text-gray-300" />
          <p className="text-sm">No hay cohortes registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {cohorts.map(c => <CohortCard key={c.id} cohort={c} onUpdated={fetchCohorts} />)}
        </div>
      )}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function CohortForm({ cohort, onSaved, onCancel }: { 
  cohort?: Cohort; onSaved: () => void; onCancel: () => void 
}) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof schema>, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: cohort ? {
      name: cohort.name,
      malla: cohort.malla,
      startDate: toInputDate(cohort.startDate),
      endDate: toInputDate(cohort.endDate),
      graduationDate: toInputDate(cohort.graduationDate),
      internshipHoursRequired: cohort.internshipHoursRequired,
      internshipPeriods: cohort.internshipPeriods,
    } : { internshipPeriods: 8 },
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    const payload = {
      name:                    data.name,
      malla:                   data.malla,
      startDate:               new Date(data.startDate + 'T12:00:00'),
      endDate:                 new Date(data.endDate   + 'T12:00:00'),
      ...(data.graduationDate
        ? { graduationDate: new Date(data.graduationDate + 'T12:00:00') }
        : { graduationDate: null }),
      internshipHoursRequired: data.internshipHoursRequired,
      internshipPeriods:       data.internshipPeriods,
      schoolId:                SCHOOL_ID,
      updatedAt:               serverTimestamp(),
    }

    try {
      if (cohort) {
        await updateDoc(doc(db, 'cohorts', cohort.id), payload)
        toast.success('Cohorte actualizada')
      } else {
        await addDoc(collection(db, 'cohorts'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        toast.success('Cohorte creada')
      }
      onSaved()
    } catch {
      toast.error(cohort ? 'Error al actualizar' : 'Error al crear')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-primary/20 p-6 mb-5 shadow-sm">
      <h2 className="font-semibold text-gray-700 mb-5">{cohort ? 'Editar cohorte' : 'Nueva cohorte'}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Octubre 2025 – Febrero 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Malla <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
              defaultValue=""
              {...register('malla')}
            >
              <option value="" disabled>Seleccionar malla</option>
              {MALLAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {errors.malla && <p className="mt-1 text-xs text-red-500">{errors.malla.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horas de prácticas requeridas <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min={1} placeholder="Ej. 240"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('internshipHoursRequired')}
            />
            {errors.internshipHoursRequired && <p className="mt-1 text-xs text-red-500">{errors.internshipHoursRequired.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de períodos <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min={1} max={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('internshipPeriods')}
            />
            {errors.internshipPeriods && <p className="mt-1 text-xs text-red-500">{errors.internshipPeriods.message}</p>}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Período académico de entrada
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
                {...register('startDate')}
              />
              {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
                {...register('endDate')}
              />
              {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate.message}</p>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Graduación
          </p>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha estimada de graduación
              <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
              {...register('graduationDate')}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-60"
          >
            <Save size={15} /> {saving ? 'Guardando...' : cohort ? 'Actualizar' : 'Crear cohorte'}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Cohort card ──────────────────────────────────────────────────────────────

function CohortCard({ cohort: initialCohort, onUpdated }: { cohort: Cohort; onUpdated: () => void }) {
  const [cohort, setCohort]             = useState(initialCohort)
  const [expanded, setExpanded]         = useState(false)
  const [isEditing, setIsEditing]       = useState(false)
  const [activeTab, setActiveTab]       = useState<'info' | 'requirements'>('info')
  const [studentCount, setStudentCount] = useState<number | null>(null)

  useEffect(() => {
    if (!expanded || studentCount !== null) return
    getDocs(query(collection(db, 'users'), where('cohortId', '==', cohort.id)))
      .then(snap => setStudentCount(snap.size))
  }, [expanded, cohort.id, studentCount])

  const handleDelete = async () => {
    if (studentCount && studentCount > 0) {
      toast.error(`No se puede eliminar: tiene ${studentCount} estudiantes asignados.`)
      return
    }
    if (!confirm('¿Estás seguro de eliminar esta cohorte?')) return
    await deleteDoc(doc(db, 'cohorts', cohort.id))
    toast.success('Cohorte eliminada')
    onUpdated()
  }

  const reqCount = cohort.requirements?.length ?? 0
  const grad     = cohort.graduationDate ? toDate(cohort.graduationDate) : null

  if (isEditing) {
    return (
      <CohortForm 
        cohort={cohort} 
        onSaved={() => { setIsEditing(false); onUpdated() }} 
        onCancel={() => setIsEditing(false)} 
      />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{cohort.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {cohort.malla && <span className="text-xs text-gray-400">{cohort.malla}</span>}
                {grad && (
                  <>
                    {cohort.malla && <span className="text-gray-300 text-xs">·</span>}
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <GraduationCap size={11} /> {fmt(grad)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reqCount > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {reqCount} req.
              </span>
            )}
            {expanded
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />
            }
          </div>
        </button>
        <div className="pr-4 flex gap-1">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-2 text-gray-300 hover:text-primary transition"
            title="Editar datos básicos"
          >
            <Edit3 size={15} />
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 text-gray-300 hover:text-red-500 transition"
            title="Eliminar cohorte"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-5 bg-gray-50/30">
            <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
              Información
            </TabButton>
            <TabButton active={activeTab === 'requirements'} onClick={() => setActiveTab('requirements')}>
              <Settings size={12} className="inline mr-1 -mt-0.5" />
              Requisitos
              {reqCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === 'requirements' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                }`}>{reqCount}</span>
              )}
            </TabButton>
          </div>

          <div className="px-5 py-4">
            {activeTab === 'info' ? (
              <InfoTab cohort={cohort} studentCount={studentCount} />
            ) : (
              <RequirementsTab
                cohort={cohort}
                onUpdate={updated => setCohort(updated)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 px-1 mr-5 text-xs font-medium border-b-2 -mb-px transition flex items-center ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ cohort, studentCount }: { cohort: Cohort; studentCount: number | null }) {
  const start = toDate(cohort.startDate)
  const end   = toDate(cohort.endDate)
  const grad  = cohort.graduationDate ? toDate(cohort.graduationDate) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat icon={<Clock size={14} />}    label="Horas requeridas" value={`${cohort.internshipHoursRequired} h`} />
        <Stat icon={<BookOpen size={14} />} label="Períodos"         value={String(cohort.internshipPeriods)} />
        <Stat icon={<Users size={14} />}    label="Estudiantes"      value={studentCount !== null ? String(studentCount) : '…'} />
        <div>
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-tighter">Período de entrada</p>
          <p className="text-sm font-semibold text-gray-700">
            {fmt(start)} – {fmt(end)}
          </p>
        </div>
      </div>

      {grad && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center gap-2">
          <GraduationCap size={15} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="text-xs text-green-700 font-medium">Fecha estimada de graduación</p>
            <p className="text-sm font-semibold text-green-800">
              {grad.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Requirements tab ─────────────────────────────────────────────────────────

function RequirementsTab({ cohort, onUpdate }: {
  cohort: Cohort
  onUpdate: (updated: Cohort) => void
}) {
  const [reqs, setReqs]                   = useState<CohortRequirement[]>(cohort.requirements ?? [])
  const [activeSubTab, setActiveSubTab]   = useState<RequirementType>('advanced_skill')
  const [skills, setSkills]               = useState<SkillCatalogItem[]>([])
  const [masterClasses, setMasterClasses] = useState<MasterClassCatalogItem[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [importing, setImporting]         = useState(false)

  useEffect(() => {
    if (catalogLoaded) return
    Promise.all([
      getDocs(query(collection(db, 'skillsCatalog'), where('schoolId', '==', SCHOOL_ID))),
      getDocs(query(collection(db, 'masterClasses'), where('schoolId', '==', SCHOOL_ID))),
    ]).then(([skillSnap, mcSnap]) => {
      setSkills(skillSnap.docs.map(d => ({ id: d.id, ...d.data() } as SkillCatalogItem)))
      setMasterClasses(mcSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterClassCatalogItem)))
      setCatalogLoaded(true)
    })
  }, [catalogLoaded])

  const persistReqs = async (updated: CohortRequirement[]) => {
    await updateDoc(doc(db, 'cohorts', cohort.id), { requirements: updated })
    setReqs(updated)
    onUpdate({ ...cohort, requirements: updated })
  }

  const importFromMalla = async () => {
    if (!cohort.malla) { toast.error('Esta cohorte no tiene malla asignada'); return }
    setImporting(true)
    try {
      const mallaId = cohort.malla.toLowerCase().replace(/[\s_]/g, '-')
      const snap = await getDoc(doc(db, 'mallaConfig', mallaId))
      if (!snap.exists()) { toast.error('No se encontró configuración de malla'); setImporting(false); return }
      const mallaReqs = (snap.data() as Omit<MallaConfig, 'id'>).requirements
      const existingIds = new Set(reqs.map(r => r.skillId))
      const toAdd: CohortRequirement[] = mallaReqs
        .filter(r => !existingIds.has(r.skillId))
        .map(r => ({ ...r, id: crypto.randomUUID(), ciclo: '' }))
      if (toAdd.length === 0) { toast('Todos los requisitos ya están añadidos'); setImporting(false); return }
      await persistReqs([...reqs, ...toAdd])
      toast.success(`${toAdd.length} requisito(s) importados desde la malla`)
    } catch { toast.error('Error al importar') }
    setImporting(false)
  }

  const addRequirement = async (req: Omit<CohortRequirement, 'id'>) => {
    setSaving(true)
    try {
      await persistReqs([...reqs, { ...req, id: crypto.randomUUID() }])
      toast.success('Requisito añadido')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const updateCiclo = async (reqId: string, ciclo: string) => {
    try {
      await persistReqs(reqs.map(r => r.id === reqId ? { ...r, ciclo } : r))
    } catch { toast.error('Error al guardar') }
  }

  const removeRequirement = async (reqId: string) => {
    setSaving(true)
    try {
      await persistReqs(reqs.filter(r => r.id !== reqId))
      toast.success('Eliminado')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const tabReqs = reqs.filter(r => r.type === activeSubTab)

  return (
    <div>
      {/* Banner + Import button */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-700">
          Aquí defines <strong>qué</strong> se requiere y en <strong>qué ciclo</strong>.
          Importa desde la malla como punto de partida y ajusta según la cohorte.
        </div>
        {cohort.malla && (
          <button
            onClick={importFromMalla}
            disabled={importing}
            className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-2 rounded-lg transition disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
          >
            <Download size={12} /> {importing ? 'Importando...' : 'Importar malla'}
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-4">
        {REQ_TABS.map(tab => {
          const count = reqs.filter(r => r.type === tab.type).length
          return (
            <button key={tab.type} onClick={() => setActiveSubTab(tab.type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeSubTab === tab.type
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeSubTab === tab.type ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Requirement list */}
      <div className="space-y-2 mb-3">
        {tabReqs.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Sin requisitos de este tipo aún.</p>
        ) : (
          tabReqs.map(req => (
            <CohortRequirementRow
              key={req.id}
              req={req}
              onCicloChange={ciclo => updateCiclo(req.id, ciclo)}
              onDelete={() => removeRequirement(req.id)}
              saving={saving}
            />
          ))
        )}
      </div>

      {/* Add form */}
      <AddCohortRequirementForm
        type={activeSubTab}
        skills={skills.filter(s => s.type === activeSubTab && !reqs.some(r => r.skillId === s.id))}
        masterClasses={masterClasses.filter(mc => !reqs.some(r => r.skillId === mc.id))}
        saving={saving}
        onAdd={addRequirement}
      />
    </div>
  )
}

// ─── Cohort requirement row ───────────────────────────────────────────────────

function CohortRequirementRow({ req, onCicloChange, onDelete, saving }: {
  req: CohortRequirement
  onCicloChange: (ciclo: string) => Promise<void>
  onDelete: () => void
  saving: boolean
}) {
  const Icon = req.type === 'advanced_skill' ? Zap : req.type === 'programmer_certificate' ? Code2 : Star
  const [localCiclo, setLocalCiclo]   = useState(req.ciclo)
  const [cicloSaving, setCicloSaving] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalCiclo(req.ciclo) }, [req.ciclo])

  const handleCicloChange = async (val: string) => {
    setLocalCiclo(val)
    setCicloSaving(true)
    await onCicloChange(val)
    setCicloSaving(false)
  }

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
      <Icon size={13} className="text-primary flex-shrink-0" />
      <p className="flex-1 text-sm text-gray-700 truncate">{req.name}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          value={localCiclo}
          onChange={e => handleCicloChange(e.target.value)}
          disabled={cicloSaving}
          className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Ciclo...</option>
          {CICLO_OPTIONS.map(c => (
            <option key={c} value={c}>Ciclo {c}</option>
          ))}
        </select>
        {cicloSaving && (
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      <button onClick={onDelete} disabled={saving}
        className="p-1 text-gray-300 hover:text-red-500 transition flex-shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── Add cohort requirement form ──────────────────────────────────────────────

function AddCohortRequirementForm({ type, skills, masterClasses, saving, onAdd }: {
  type: RequirementType
  skills: SkillCatalogItem[]
  masterClasses: MasterClassCatalogItem[]
  saving: boolean
  onAdd: (req: Omit<CohortRequirement, 'id'>) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [ciclo, setCiclo]           = useState('')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedId('') }, [type])

  const options = type === 'master_class'
    ? masterClasses.map(mc => ({ id: mc.id, name: mc.title }))
    : skills.map(s => ({ id: s.id, name: s.name }))

  const handleAdd = () => {
    if (!selectedId) return
    const opt = options.find(o => o.id === selectedId)
    if (!opt) return
    onAdd({ type, skillId: selectedId, name: opt.name, ciclo })
    setSelectedId('')
    setCiclo('')
  }

  return (
    <div className="flex gap-2 items-center pt-2 border-t border-gray-100">
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">{options.length === 0 ? '— todos añadidos —' : 'Seleccionar...'}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={ciclo} onChange={e => setCiclo(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary w-24 flex-shrink-0">
        <option value="">Ciclo...</option>
        {CICLO_OPTIONS.map(c => (
          <option key={c} value={c}>Ciclo {c}</option>
        ))}
      </select>
      <button onClick={handleAdd} disabled={!selectedId || saving}
        className="flex items-center gap-1 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-40 flex-shrink-0">
        <Plus size={13} /> Añadir
      </button>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
        {icon} {label}
      </div>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}
