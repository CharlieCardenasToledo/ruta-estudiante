import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, orderBy,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import {
  CheckCircle, Clock, XCircle, Upload, Award,
  GraduationCap, BookOpen, Star, Globe, Code, Medal, X, FileUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db, storage } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import type { Milestone, MilestoneType, MasterClassCatalogItem } from '../../types'

// ─── Config ───────────────────────────────────────────────────────────────────

interface MilestoneConfig {
  type: MilestoneType
  label: string
  description: string
  icon: React.ReactNode
  multi: boolean
  adminOnly: boolean
}

const MILESTONE_CONFIG: MilestoneConfig[] = [
  {
    type: 'gec',
    label: 'GEC',
    description: 'Puntaje de Evaluación de Competencias (0–100)',
    icon: <Award size={20} />,
    multi: false,
    adminOnly: true,
  },
  {
    type: 'english_level',
    label: 'Nivel de Inglés',
    description: 'Asignado por el administrador según los niveles aprobados en la UIDE.',
    icon: <Globe size={20} />,
    multi: false,
    adminOnly: true,
  },
  {
    type: 'advanced_skill',
    label: 'Advanced Skills',
    description: 'Certificaciones técnicas adicionales',
    icon: <Star size={20} />,
    multi: true,
    adminOnly: false,
  },
  {
    type: 'programmer_certificate',
    label: 'Certificado de Programador',
    description: 'Certificación en programación',
    icon: <Code size={20} />,
    multi: false,
    adminOnly: false,
  },
  {
    type: 'master_class',
    label: 'Master Classes',
    description: 'Asistencia a master classes del programa',
    icon: <BookOpen size={20} />,
    multi: true,
    adminOnly: false,
  },
  {
    type: 'malla_academica',
    label: 'Malla Académica',
    description: 'Cumplimiento de la malla curricular',
    icon: <GraduationCap size={20} />,
    multi: false,
    adminOnly: false,
  },
  {
    type: 'mejor_promedio',
    label: 'Mejor Promedio',
    description: 'Reconocimiento por mejor promedio del ciclo',
    icon: <Medal size={20} />,
    multi: false,
    adminOnly: true,
  },
  {
    type: 'recognition',
    label: 'Reconocimiento',
    description: 'Reconocimientos y distinciones académicas',
    icon: <Star size={20} />,
    multi: false,
    adminOnly: false,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MiRutaPage() {
  const { appUser } = useAuth()
  const [milestones, setMilestones]     = useState<Milestone[]>([])
  const [catalog, setCatalog]           = useState<MasterClassCatalogItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [uploadTarget, setUploadTarget] = useState<MilestoneConfig | null>(null)

  const fetchMilestones = async () => {
    if (!appUser) return
    const [msSnap, catSnap] = await Promise.all([
      getDocs(query(collection(db, 'milestones'), where('studentId', '==', appUser.uid))),
      getDocs(query(collection(db, 'masterClasses'), where('schoolId', '==', 'sistemas-loja'), orderBy('date', 'desc'))),
    ])
    setMilestones(msSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)))
    setCatalog(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterClassCatalogItem)))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchMilestones() }, [appUser?.uid])

  if (!appUser) return null

  const gec = milestones.find(m => m.type === 'gec')
  const approved = milestones.filter(m => m.status === 'approved').length
  const pending = milestones.filter(m => m.status === 'pending').length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Mi Ruta Académica</h1>
        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
          <span>{appUser.displayName}</span>
          {appUser.malla && <><span>·</span><span>{appUser.malla}</span></>}
          {appUser.ciclo && <><span>·</span><span>Ciclo: <strong>{appUser.ciclo}</strong></span></>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="GEC"
          value={gec?.score !== undefined ? String(gec.score) : '—'}
          sub="de 100 pts"
          color="primary"
          icon={<Award size={20} />}
        />
        <StatCard
          label="Aprobados"
          value={String(approved)}
          sub="hitos"
          color="green"
          icon={<CheckCircle size={20} />}
        />
        <StatCard
          label="En revisión"
          value={String(pending)}
          sub="pendientes"
          color="yellow"
          icon={<Clock size={20} />}
        />
        <StatCard
          label="Ciclo"
          value={appUser.ciclo ?? '—'}
          sub="actual"
          color="accent"
          icon={<GraduationCap size={20} />}
        />
      </div>

      {/* Milestones */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando hitos...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {MILESTONE_CONFIG.map(config => (
            <MilestoneCard
              key={config.type}
              config={config}
              milestones={milestones.filter(m => m.type === config.type)}
              onUpload={() => setUploadTarget(config)}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {uploadTarget && (
        <UploadModal
          config={uploadTarget}
          studentId={appUser.uid}
          catalog={catalog}
          onClose={() => setUploadTarget(null)}
          onSuccess={() => { setUploadTarget(null); fetchMilestones() }}
        />
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string
  color: 'primary' | 'green' | 'yellow' | 'accent'
  icon: React.ReactNode
}) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    accent: 'text-accent bg-accent/10',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  )
}

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({ config, milestones, onUpload }: {
  config: MilestoneConfig
  milestones: Milestone[]
  onUpload: () => void
}) {
  const hasAny = milestones.length > 0
  const lastStatus = milestones[milestones.length - 1]?.status
  const gec = milestones[0]

  const statusBadge = () => {
    if (!hasAny) return <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={12} /> Pendiente</span>
    if (lastStatus === 'approved') return <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={12} /> Aprobado</span>
    if (lastStatus === 'rejected') return <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><XCircle size={12} /> Rechazado</span>
    return <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium"><Clock size={12} /> En revisión</span>
  }

  const borderColor = !hasAny ? 'border-gray-200'
    : lastStatus === 'approved' ? 'border-green-200'
    : lastStatus === 'rejected' ? 'border-red-200'
    : 'border-yellow-200'

  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            {config.icon}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{config.label}</p>
            {config.multi && hasAny && (
              <p className="text-xs text-gray-400">{milestones.length} registrado{milestones.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        {statusBadge()}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{config.description}</p>

      {/* GEC score display */}
      {config.type === 'gec' && gec?.score !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${gec.score}%` }} />
          </div>
          <span className="text-sm font-bold text-primary">{gec.score}/100</span>
        </div>
      )}

      {/* Rejected reason */}
      {lastStatus === 'rejected' && milestones[milestones.length - 1]?.rejectionReason && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {milestones[milestones.length - 1].rejectionReason}
        </p>
      )}

      {/* Multi: list of items */}
      {config.multi && milestones.length > 0 && (
        <div className="space-y-1">
          {milestones.slice(-3).map(m => (
            <div key={m.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 truncate">{m.title}</span>
              <span className={m.status === 'approved' ? 'text-green-600' : m.status === 'rejected' ? 'text-red-500' : 'text-yellow-600'}>
                {m.status === 'approved' ? '✓' : m.status === 'rejected' ? '✗' : '…'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action button */}
      {!config.adminOnly && (
        <button
          onClick={onUpload}
          className={`mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition
            ${lastStatus === 'pending'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
          disabled={lastStatus === 'pending'}
        >
          <Upload size={13} />
          {!hasAny ? 'Subir certificado'
            : lastStatus === 'rejected' ? 'Volver a subir'
            : lastStatus === 'pending' ? 'En revisión...'
            : config.multi ? 'Agregar otro' : 'Subir certificado'}
        </button>
      )}
    </div>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ config, studentId, catalog, onClose, onSuccess }: {
  config: MilestoneConfig
  studentId: string
  catalog: MasterClassCatalogItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const isMasterClass = config.type === 'master_class'
  const [title, setTitle]       = useState('')
  const [file, setFile]         = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_MB = 10
  const handleSubmit = async () => {
    if (!file) { toast.error('Selecciona un archivo'); return }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`El archivo no puede superar ${MAX_FILE_MB} MB`); return }
    if (config.multi && !title.trim()) { toast.error('Selecciona o escribe el nombre del certificado'); return }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `certificates/${studentId}/${config.type}/${Date.now()}.${ext}`
      const storageRef = ref(storage, path)
      const task = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        )
      })

      const fileUrl = await getDownloadURL(task.snapshot.ref)

      await addDoc(collection(db, 'milestones'), {
        studentId,
        type: config.type,
        title: config.multi ? title.trim() : config.label,
        status: 'pending',
        fileUrl,
        issuedByAdmin: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast.success('Certificado enviado. Quedará en revisión.')
      onSuccess()
    } catch {
      toast.error('Error al subir el archivo. Intenta de nuevo.')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {config.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-800">Subir certificado</p>
              <p className="text-xs text-gray-400">{config.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {config.multi && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isMasterClass ? 'Master Class' : 'Nombre del certificado'} <span className="text-red-500">*</span>
              </label>
              {isMasterClass && catalog.length > 0 ? (
                <select
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
                >
                  <option value="">Selecciona una Master Class...</option>
                  {catalog.map(c => {
                    const d = (c.date instanceof Date ? c.date : (c.date as unknown as { toDate?: () => Date }).toDate?.() ?? new Date())
                    return (
                      <option key={c.id} value={c.title}>
                        {c.title} — {d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </option>
                    )
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={isMasterClass ? 'Nombre de la Master Class' : 'Ej. AWS Cloud Practitioner'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition
                ${file ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}`}
            >
              <FileUp size={24} className={file ? 'text-primary' : 'text-gray-400'} />
              <p className="text-sm text-center">
                {file
                  ? <span className="font-medium text-primary">{file.name}</span>
                  : <span className="text-gray-500">Haz clic para seleccionar <span className="font-medium">PDF, JPG o PNG</span></span>
                }
              </p>
              {file && <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Subiendo...</span><span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSubmit}
              disabled={uploading || !file}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-60"
            >
              <Upload size={15} />
              {uploading ? 'Subiendo...' : 'Enviar para revisión'}
            </button>
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
