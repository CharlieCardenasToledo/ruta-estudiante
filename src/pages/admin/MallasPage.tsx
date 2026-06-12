import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs,
  doc, setDoc, updateDoc, getDoc,
} from 'firebase/firestore'
import { ChevronDown, ChevronUp, Plus, Trash2, Zap, Code2, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import type {
  SkillCatalogItem, MasterClassCatalogItem,
  MallaConfig, MallaRequirement, RequirementType,
} from '../../types'

const SCHOOL_ID = 'sistemas-loja'

const MALLAS = ['ITIL_MALLA 2019', 'ITIL_MALLA 2023', 'SINL_MALLA 2025'] as const
type Malla = typeof MALLAS[number]

const REQ_TABS: { type: RequirementType; label: string; icon: React.ReactNode }[] = [
  { type: 'advanced_skill',         label: 'Advanced Skills',   icon: <Zap size={13} /> },
  { type: 'programmer_certificate', label: 'Cert. Programador', icon: <Code2 size={13} /> },
  { type: 'master_class',           label: 'Master Classes',    icon: <Star size={13} /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mallaDocId(malla: Malla) {
  return malla.toLowerCase().replace(/[\s_]/g, '-')
}

async function loadOrCreateConfig(malla: Malla): Promise<MallaConfig> {
  const id   = mallaDocId(malla)
  const ref  = doc(db, 'mallaConfig', id)
  const snap = await getDoc(ref)
  if (snap.exists()) return { id, ...snap.data() } as MallaConfig
  const config: Omit<MallaConfig, 'id'> = { malla, schoolId: SCHOOL_ID, requirements: [] }
  await setDoc(ref, config)
  return { id, ...config }
}

async function saveRequirements(id: string, requirements: MallaRequirement[]) {
  await updateDoc(doc(db, 'mallaConfig', id), { requirements })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MallasPage() {
  const [configs, setConfigs]   = useState<Record<Malla, MallaConfig | null>>({
    'ITIL_MALLA 2019': null, 'ITIL_MALLA 2023': null, 'SINL_MALLA 2025': null,
  })
  const [skills, setSkills]             = useState<SkillCatalogItem[]>([])
  const [masterClasses, setMasterClasses] = useState<MasterClassCatalogItem[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    ;(async () => {
      const [skillSnap, mcSnap, ...mallaDocs] = await Promise.all([
        getDocs(query(collection(db, 'skillsCatalog'), where('schoolId', '==', SCHOOL_ID))),
        getDocs(query(collection(db, 'masterClasses'), where('schoolId', '==', SCHOOL_ID))),
        ...MALLAS.map(m => loadOrCreateConfig(m)),
      ])
      setSkills(skillSnap.docs.map(d => ({ id: d.id, ...d.data() } as SkillCatalogItem)))
      setMasterClasses(mcSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterClassCatalogItem)))
      const next = { ...configs }
      MALLAS.forEach((m, i) => { next[m] = mallaDocs[i] as MallaConfig })
      setConfigs(next)
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateConfig = (malla: Malla, updated: MallaConfig) =>
    setConfigs(prev => ({ ...prev, [malla]: updated }))

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Cargando mallas...
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Configuración de Mallas</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Define qué skills, certificados y master classes son obligatorios por malla.
          El ciclo en que deben completarse se configura en cada cohorte.
        </p>
      </div>

      <div className="space-y-4">
        {MALLAS.map(malla => (
          <MallaCard
            key={malla}
            malla={malla}
            config={configs[malla]!}
            skills={skills}
            masterClasses={masterClasses}
            onUpdate={updated => updateConfig(malla, updated)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Malla card ───────────────────────────────────────────────────────────────

function MallaCard({
  malla, config, skills, masterClasses, onUpdate,
}: {
  malla: Malla
  config: MallaConfig
  skills: SkillCatalogItem[]
  masterClasses: MasterClassCatalogItem[]
  onUpdate: (c: MallaConfig) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [activeTab, setActiveTab] = useState<RequirementType>('advanced_skill')
  const [saving, setSaving]       = useState(false)

  const reqs = config.requirements

  const addRequirement = async (req: Omit<MallaRequirement, 'id'>) => {
    const newReq: MallaRequirement = { ...req, id: crypto.randomUUID() }
    const updated: MallaConfig = { ...config, requirements: [...reqs, newReq] }
    setSaving(true)
    try {
      await saveRequirements(config.id, updated.requirements)
      onUpdate(updated)
      toast.success('Requisito añadido')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const removeRequirement = async (reqId: string) => {
    const updated: MallaConfig = { ...config, requirements: reqs.filter(r => r.id !== reqId) }
    setSaving(true)
    try {
      await saveRequirements(config.id, updated.requirements)
      onUpdate(updated)
      toast.success('Eliminado')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const tabReqs    = reqs.filter(r => r.type === activeTab)
  const totalReqs  = reqs.length

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">
              {malla.startsWith('ITIL') ? 'IT' : 'SI'}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{malla}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalReqs === 0
                ? 'Sin requisitos configurados'
                : `${totalReqs} requisito${totalReqs !== 1 ? 's' : ''} · el ciclo se asigna por cohorte`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-700 mb-4">
            Aquí defines <strong>qué</strong> se requiere. El ciclo en que debe completarse
            se configura independientemente en cada cohorte.
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-4">
            {REQ_TABS.map(tab => {
              const count = reqs.filter(r => r.type === tab.type).length
              return (
                <button key={tab.type} onClick={() => setActiveTab(tab.type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    activeTab === tab.type
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                  {count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      activeTab === tab.type ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* List */}
          <div className="space-y-2 mb-3">
            {tabReqs.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Sin requisitos de este tipo aún.</p>
            ) : (
              tabReqs.map(req => (
                <RequirementRow key={req.id} req={req} onDelete={() => removeRequirement(req.id)} saving={saving} />
              ))
            )}
          </div>

          {/* Add form */}
          <AddRequirementForm
            type={activeTab}
            skills={skills.filter(s => s.type === activeTab && !reqs.some(r => r.skillId === s.id))}
            masterClasses={masterClasses.filter(mc => !reqs.some(r => r.skillId === mc.id))}
            saving={saving}
            onAdd={addRequirement}
          />
        </div>
      )}
    </div>
  )
}

// ─── Requirement row ──────────────────────────────────────────────────────────

function RequirementRow({ req, onDelete, saving }: {
  req: MallaRequirement; onDelete: () => void; saving: boolean
}) {
  const Icon = req.type === 'advanced_skill' ? Zap : req.type === 'programmer_certificate' ? Code2 : Star
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
      <Icon size={13} className="text-primary flex-shrink-0" />
      <p className="flex-1 text-sm text-gray-700 truncate">{req.name}</p>
      <button onClick={onDelete} disabled={saving}
        className="p-1 text-gray-300 hover:text-red-500 transition flex-shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddRequirementForm({ type, skills, masterClasses, saving, onAdd }: {
  type: RequirementType
  skills: SkillCatalogItem[]
  masterClasses: MasterClassCatalogItem[]
  saving: boolean
  onAdd: (req: Omit<MallaRequirement, 'id'>) => void
}) {
  const [selectedId, setSelectedId] = useState('')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedId('') }, [type])

  const options = type === 'master_class'
    ? masterClasses.map(mc => ({ id: mc.id, name: mc.title }))
    : skills.map(s => ({ id: s.id, name: s.name }))

  const handleAdd = () => {
    if (!selectedId) return
    const opt = options.find(o => o.id === selectedId)
    if (!opt) return
    onAdd({ type, skillId: selectedId, name: opt.name })
    setSelectedId('')
  }

  return (
    <div className="flex gap-2 items-center pt-2 border-t border-gray-100">
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">{options.length === 0 ? '— todos añadidos —' : 'Seleccionar...'}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <button onClick={handleAdd} disabled={!selectedId || saving}
        className="flex items-center gap-1 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-40 flex-shrink-0">
        <Plus size={13} /> Añadir
      </button>
    </div>
  )
}
