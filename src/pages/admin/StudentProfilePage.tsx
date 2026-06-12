import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs,
  addDoc, deleteDoc, serverTimestamp, orderBy,
} from 'firebase/firestore'
import {
  ArrowLeft, Mail, Hash, BookOpen, GraduationCap,
  Award, CheckCircle, Edit3, Save, X, Trash2,
  UserCheck, Globe, Zap, Code2, Star, Circle, ExternalLink,
  Briefcase, TrendingUp, Plus, Building2, Clock, Calendar,
  MapPin, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import type {
  AppUser, Cohort, Milestone, MilestoneType,
  EstadoAcademico, Internship, CohortRequirement,
  HorarioSemanal, HorarioDia, VisitLog,
} from '../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<EstadoAcademico, string> = {
  en_curso: 'En Curso',
  graduado: 'Graduado',
  no_continua: 'No Continúa',
  cambio_carrera: 'Cambio de Carrera',
}

const ESTADO_CLASS: Record<EstadoAcademico, string> = {
  en_curso: 'bg-green-100 text-green-700',
  graduado: 'bg-blue-100 text-blue-700',
  no_continua: 'bg-red-100 text-red-600',
  cambio_carrera: 'bg-yellow-100 text-yellow-700',
}

const LEVEL_THRESHOLDS = [
  { min: 96, name: 'Graduando', emoji: '🎓', color: 'text-blue-600', bg: 'bg-blue-50' },
  { min: 81, name: 'Experto',   emoji: '🏆', color: 'text-amber-600', bg: 'bg-amber-50' },
  { min: 61, name: 'Destacado', emoji: '🔥', color: 'text-orange-600', bg: 'bg-orange-50' },
  { min: 41, name: 'Avanzando', emoji: '⚡', color: 'text-primary',    bg: 'bg-primary/5' },
  { min: 21, name: 'Aprendiendo',emoji:'📚', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { min: 0,  name: 'Iniciando', emoji: '🌱', color: 'text-gray-500',   bg: 'bg-gray-50' },
]

// ─── XP calculation ───────────────────────────────────────────────────────────

function computeProgress(
  milestones: Milestone[],
  internship: Internship | null,
  cohort: Cohort | null,
) {
  const approved = (type: MilestoneType, name?: string) =>
    milestones.some(m =>
      m.type === type && m.status === 'approved' &&
      (name === undefined || m.title === name)
    )

  // English: 20 pts — needs Nivel 6 approved
  const englishApproved = approved('english_level', 'Nivel 6') ||
    milestones.some(m => m.type === 'english_level' && m.status === 'approved' &&
      parseInt(m.title?.replace('Nivel ', '') ?? '0') >= 6)
  const englishPts = englishApproved ? 20 : 0

  const allReqs = cohort?.requirements ?? []

  // Skills: 25 pts
  const skillReqs  = allReqs.filter(r => r.type === 'advanced_skill')
  const skillsDone = skillReqs.filter(r => approved('advanced_skill', r.name)).length
  const skillPts   = skillReqs.length > 0 ? (skillsDone / skillReqs.length) * 25 : 25

  // Certs: 20 pts
  const certReqs  = allReqs.filter(r => r.type === 'programmer_certificate')
  const certsDone = certReqs.filter(r => approved('programmer_certificate', r.name)).length
  const certPts   = certReqs.length > 0 ? (certsDone / certReqs.length) * 20 : 20

  // Master classes: 15 pts
  const mcReqs  = allReqs.filter(r => r.type === 'master_class')
  const mcsDone = mcReqs.filter(r => approved('master_class', r.name)).length
  const mcPts   = mcReqs.length > 0 ? (mcsDone / mcReqs.length) * 15 : 15

  // Prácticas: 20 pts
  const hoursReq  = cohort?.internshipHoursRequired ?? 0
  const hoursApp  = internship?.totalHoursApproved ?? 0
  const pracPts   = hoursReq > 0 ? Math.min(1, hoursApp / hoursReq) * 20 : 0

  const xp = Math.round(englishPts + skillPts + certPts + mcPts + pracPts)

  const aptaTesis =
    englishApproved &&
    (skillReqs.length === 0 || skillsDone === skillReqs.length) &&
    (certReqs.length === 0  || certsDone === certReqs.length) &&
    (mcReqs.length === 0    || mcsDone   === mcReqs.length) &&
    hoursReq > 0 && hoursApp >= hoursReq

  const level = LEVEL_THRESHOLDS.find(l => xp >= l.min) ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]

  return { xp, level, aptaTesis, englishApproved, skillsDone, skillsTotal: skillReqs.length,
    certsDone, certsTotal: certReqs.length, mcsDone, mcsTotal: mcReqs.length,
    hoursApp, hoursReq }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentProfilePage({ embedded }: { embedded?: boolean } = {}) {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const { appUser } = useAuth()

  const [student, setStudent]       = useState<AppUser | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [cohorts, setCohorts]       = useState<Cohort[]>([])
  const [cohort, setCohort]         = useState<Cohort | null>(null)
  const [teachers, setTeachers]     = useState<AppUser[]>([])
  const [internship, setInternship] = useState<Internship | null>(null)
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    const [userSnap, msSnap, cohortSnap, teacherSnap, iSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDocs(query(collection(db, 'milestones'), where('studentId', '==', uid))),
      getDocs(query(collection(db, 'cohorts'), where('schoolId', '==', 'sistemas-loja'), orderBy('name'))),
      getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      getDocs(query(collection(db, 'internships'), where('studentId', '==', uid))),
    ])
    
    if (userSnap.exists()) {
      const userData = { uid: userSnap.id, ...userSnap.data() } as AppUser
      setStudent(userData)
      
      const iData = iSnap.empty ? null : { id: iSnap.docs[0].id, ...iSnap.docs[0].data() } as Internship
      setInternship(iData)

      // Load specific cohort
      const cohortId = userData.cohortId ?? iData?.cohortId
      if (cohortId) {
        const cSnap = await getDoc(doc(db, 'cohorts', cohortId))
        if (cSnap.exists()) setCohort({ id: cSnap.id, ...cSnap.data() } as Cohort)
      } else {
        setCohort(null)
      }
    }
    
    setMilestones(msSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)))
    setCohorts(cohortSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cohort)))
    setTeachers(teacherSnap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)))
    setLoading(false)
  }, [uid])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const refreshMilestones = async () => {
    if (!uid) return
    const snap = await getDocs(query(collection(db, 'milestones'), where('studentId', '==', uid)))
    setMilestones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)))
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-gray-400">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    )
  }

  if (!student) {
    return (
      <div className="p-8 text-gray-500">Estudiante no encontrado.</div>
    )
  }

  const handleCohortSave = async (cohortId: string) => {
    await updateDoc(doc(db, 'users', student.uid), { cohortId })
    setStudent(prev => prev ? { ...prev, cohortId } : prev)
    const found = cohorts.find(c => c.id === cohortId)
    setCohort(found ?? null)
    toast.success('Cohorte actualizada')
  }

  const handleTutorSave = async (tutorId: string) => {
    if (internship) {
      await updateDoc(doc(db, 'internships', internship.id), { tutorId })
      setInternship(prev => prev ? { ...prev, tutorId } : prev)
    } else {
      const iRef = await addDoc(collection(db, 'internships'), {
        studentId: student.uid,
        cohortId: student.cohortId ?? '',
        tutorId,
        period: 1,
        totalHoursApproved: 0,
        totalHoursDeclared: 0,
        createdAt: serverTimestamp(),
      })
      setInternship({ id: iRef.id, studentId: student.uid, cohortId: student.cohortId ?? '', tutorId, period: 1, totalHoursApproved: 0, totalHoursDeclared: 0 } as Internship)
    }
    toast.success('Tutor asignado')
  }

  const handleEstadoSave = async (estado: EstadoAcademico) => {
    await updateDoc(doc(db, 'users', student.uid), { estadoAcademico: estado })
    setStudent(p => p ? { ...p, estadoAcademico: estado } : p)
    toast.success('Estado actualizado')
  }

  // Approved maps for the Ruta logic
  const adminApprovedMap = new Map<string, string>()
  milestones.forEach(m => {
    if (m.status === 'approved' && m.issuedByAdmin) {
      adminApprovedMap.set(`${m.type}:${m.title}`, m.id)
    }
  })
  const anyApprovedMap = new Map<string, string>()
  milestones.forEach(m => {
    if (m.status === 'approved') {
      const k = `${m.type}:${m.title}`
      if (!anyApprovedMap.has(k)) anyApprovedMap.set(k, m.id)
    }
  })

  const toggleRequirement = async (req: CohortRequirement) => {
    if (!uid) return
    const key = `${req.type}:${req.name}`
    const adminId = adminApprovedMap.get(key)
    if (adminId) {
      await deleteDoc(doc(db, 'milestones', adminId))
      toast.success('Marcado como no completado')
    } else {
      await addDoc(collection(db, 'milestones'), {
        studentId: uid, type: req.type as MilestoneType,
        title: req.name, status: 'approved', issuedByAdmin: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      toast.success('Marcado como completado')
    }
    await refreshMilestones()
  }

  const progress = computeProgress(milestones, internship, cohort)
  const initials = student.displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  
  const gecMilestone     = milestones.find(m => m.type === 'gec')
  const englishMilestone = milestones.filter(m => m.type === 'english_level').at(-1)

  const allReqs   = cohort?.requirements ?? []
  const skillReqs = allReqs.filter(r => r.type === 'advanced_skill')
  const certReqs  = allReqs.filter(r => r.type === 'programmer_certificate')
  const mcReqs    = allReqs.filter(r => r.type === 'master_class')

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Back button (only if not embedded) */}
      {!embedded && (
        <button
          onClick={() => navigate('/admin/estudiantes')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-2 transition"
        >
          <ArrowLeft size={16} /> Volver al listado
        </button>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xl">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h1 className="text-xl font-bold text-gray-800">{student.displayName}</h1>
              <EstadoSelector estado={student.estadoAcademico ?? 'en_curso'} onSave={handleEstadoSave} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              <InfoRow icon={<Mail size={14} />} label="Correo" value={student.email} />
              <InfoRow icon={<Hash size={14} />} label="Cédula" value={student.cedula ?? '—'} />
              <InfoRow icon={<BookOpen size={14} />} label="Malla" value={student.malla ?? '—'} />
              <InfoRow icon={<GraduationCap size={14} />} label="Ciclo" value={student.ciclo ?? '—'} />
              <CohortField cohortId={student.cohortId} cohorts={cohorts} onSave={handleCohortSave} />
              <TutorField tutorId={internship?.tutorId} teachers={teachers} onSave={handleTutorSave} />
            </div>
          </div>
          {!embedded && (
            <Link
              to={`/admin/estudiantes/${uid}`}
              className="p-2 text-gray-400 hover:text-primary transition"
              title="Perfil completo"
            >
              <ExternalLink size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* XP Widget */}
      <XpWidget progress={progress} />

      {/* Main cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <GecCard studentId={student.uid} milestone={gecMilestone} onSaved={refreshMilestones} />
        <EnglishCard studentId={student.uid} milestone={englishMilestone} onSaved={refreshMilestones} />
        <PracticasCard
          internship={internship}
          cohort={cohort}
          studentId={student.uid}
          cohortId={student.cohortId}
          onCreated={load}
        />
      </div>

      {/* Visitas del admin */}
      {internship && (
        <AdminVisitasSection
          internshipId={internship.id}
          studentId={student.uid}
          adminId={appUser?.uid ?? ''}
        />
      )}

      {/* Requirements Section */}
      <div className="space-y-5">
        {!cohort ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
            Asigna una cohorte para ver y gestionar los requisitos del estudiante.
          </div>
        ) : allReqs.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
            Esta cohorte no tiene requisitos configurados. Ve a{' '}
            <Link to="/admin/cohortes" className="font-semibold underline">Configuración → Cohortes</Link> para añadirlos.
          </div>
        ) : (
          <>
            <RequirementSection
              title="Advanced Skills" icon={<Zap size={15} className="text-primary" />}
              reqs={skillReqs} anyApprovedMap={anyApprovedMap} adminApprovedMap={adminApprovedMap}
              onToggle={toggleRequirement}
            />
            <RequirementSection
              title="Certificados de Programador" icon={<Code2 size={15} className="text-primary" />}
              reqs={certReqs} anyApprovedMap={anyApprovedMap} adminApprovedMap={adminApprovedMap}
              onToggle={toggleRequirement}
            />
            <RequirementSection
              title="Master Classes" icon={<Star size={15} className="text-primary" />}
              reqs={mcReqs} anyApprovedMap={anyApprovedMap} adminApprovedMap={adminApprovedMap}
              onToggle={toggleRequirement}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── XP Widget ────────────────────────────────────────────────────────────────

function XpWidget({ progress }: { progress: ReturnType<typeof computeProgress> }) {
  const { xp, level, aptaTesis } = progress
  const r   = 52
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - xp / 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-8">
      {/* Ring */}
      <div className="relative flex-shrink-0">
        <svg width="128" height="128" className="-rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
          <circle cx="64" cy="64" r={r} fill="none" stroke="#8B0045" strokeWidth="12"
            strokeDasharray={circ} strokeDashoffset={dash}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-800">{xp}</span>
          <span className="text-xs text-gray-400 font-medium">/ 100</span>
        </div>
      </div>

      {/* Level info */}
      <div className="flex-1">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 ${level.bg} ${level.color}`}>
          <span>{level.emoji}</span> {level.name}
        </div>

        <div className="space-y-2.5 max-w-md">
          <ProgressLine label="Inglés"    done={progress.englishApproved ? 1 : 0} total={1} pts={20} />
          {progress.skillsTotal > 0 && <ProgressLine label="Skills"    done={progress.skillsDone} total={progress.skillsTotal} pts={25} />}
          {progress.certsTotal > 0  && <ProgressLine label="Certif."   done={progress.certsDone}  total={progress.certsTotal}  pts={20} />}
          {progress.mcsTotal > 0    && <ProgressLine label="MC"        done={progress.mcsDone}    total={progress.mcsTotal}    pts={15} />}
          {progress.hoursReq > 0    && <ProgressLine label="Prácticas" done={progress.hoursApp} total={progress.hoursReq} pts={20} suffix="h" />}
        </div>

        {aptaTesis && (
          <div className="mt-5 inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
            <GraduationCap size={14} /> Apto para Tesis
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressLine({ label, done, total, pts, suffix }: {
  label: string; done: number; total: number; pts: number; suffix?: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs font-medium text-gray-400 uppercase tracking-tight">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 text-right text-xs font-mono text-gray-500">
        {done}{suffix ?? ''} / {total}{suffix ?? ''} · {pts}p
      </span>
    </div>
  )
}

// ─── GEC Card ────────────────────────────────────────────────────────────────

function GecCard({ studentId, milestone, onSaved }: {
  studentId: string; milestone: Milestone | undefined; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [score, setScore]     = useState(milestone?.score?.toString() ?? '')
  const [saving, setSaving]   = useState(false)

  const handleSave = async () => {
    const val = parseInt(score)
    if (isNaN(val) || val < 0 || val > 100) { toast.error('0 – 100'); return }
    setSaving(true)
    try {
      if (milestone) {
        await updateDoc(doc(db, 'milestones', milestone.id), {
          score: val, status: val >= 100 ? 'approved' : 'pending', updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'milestones'), {
          studentId, type: 'gec', title: 'GEC',
          status: val >= 100 ? 'approved' : 'pending',
          score: val, issuedByAdmin: true,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }
      toast.success('GEC guardado')
      setEditing(false)
      onSaved()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const handleRemove = async () => {
    if (!milestone) return
    if (!confirm('¿Quitar el puntaje GEC?')) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'milestones', milestone.id))
      toast.success('Puntaje GEC eliminado')
      setEditing(false)
      onSaved()
    } catch { toast.error('Error al eliminar') }
    finally { setSaving(false) }
  }

  const current = milestone?.score

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-primary" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">GEC</span>
        </div>
        {!editing && (
          <button onClick={() => { setEditing(true); setScore(current?.toString() ?? '') }}
            className="text-xs text-primary hover:underline font-medium">
            {current !== undefined ? 'Editar' : 'Asignar'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <input type="number" min={0} max={100} autoFocus value={score}
            onChange={e => setScore(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-60">
                <Save size={13} /> {saving ? '...' : 'Guardar'}
              </button>
              <button onClick={() => setEditing(false)} className="px-2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            {milestone && (
              <button onClick={handleRemove} disabled={saving}
                className="w-full flex items-center justify-center gap-1 text-red-500 text-[10px] font-bold uppercase tracking-tight hover:bg-red-50 py-1 rounded transition">
                <Trash2 size={11} /> Quitar puntaje
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          {current !== undefined ? (
            <>
              <p className="text-4xl font-black text-primary leading-none">{current}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">Puntos / 100</p>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-4">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${current}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-4 font-medium italic">Sin puntaje</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── English Card ─────────────────────────────────────────────────────────────

const ENGLISH_LEVELS = ['Nivel 1','Nivel 2','Nivel 3','Nivel 4','Nivel 5','Nivel 6','Nivel 7'] as const
type EnglishLevel = typeof ENGLISH_LEVELS[number]

function EnglishCard({ studentId, milestone, onSaved }: {
  studentId: string; milestone: Milestone | undefined; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [level, setLevel]     = useState<EnglishLevel | ''>('')
  const [saving, setSaving]   = useState(false)
  const current = milestone?.title as EnglishLevel | undefined

  const handleSave = async () => {
    if (!level) { toast.error('Selecciona un nivel'); return }
    setSaving(true)
    try {
      if (milestone) {
        await updateDoc(doc(db, 'milestones', milestone.id), { title: level, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'milestones'), {
          studentId, type: 'english_level', title: level,
          status: 'approved', issuedByAdmin: true,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }
      toast.success('Nivel guardado')
      setEditing(false)
      onSaved()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const handleRemove = async () => {
    if (!milestone) return
    if (!confirm('¿Quitar el nivel de inglés?')) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'milestones', milestone.id))
      toast.success('Nivel de inglés eliminado')
      setEditing(false)
      onSaved()
    } catch { toast.error('Error al eliminar') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-primary" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">Inglés</span>
        </div>
        {!editing && (
          <button onClick={() => { setLevel(current ?? ''); setEditing(true) }}
            className="text-xs text-primary hover:underline font-medium">
            {current ? 'Editar' : 'Asignar'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <select autoFocus value={level} onChange={e => setLevel(e.target.value as EnglishLevel)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700">
            <option value="">Seleccionar...</option>
            {ENGLISH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-60">
                <Save size={13} /> {saving ? '...' : 'Guardar'}
              </button>
              <button onClick={() => setEditing(false)} className="px-2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            {milestone && (
              <button onClick={handleRemove} disabled={saving}
                className="w-full flex items-center justify-center gap-1 text-red-500 text-[10px] font-bold uppercase tracking-tight hover:bg-red-50 py-1 rounded transition">
                <Trash2 size={11} /> Quitar nivel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          {current ? (
            <>
              <span className="text-2xl font-black text-blue-700 bg-blue-50 px-5 py-2 rounded-xl inline-block">{current}</span>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-3 tracking-widest">Nivel Aprobado</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-4 font-medium italic">Sin nivel</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Prácticas Card ───────────────────────────────────────────────────────────

// ─── Helpers de horario ───────────────────────────────────────────────────────

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function horasPorDia(d: HorarioDia): number {
  const [eh, em] = d.horaEntrada.split(':').map(Number)
  const [sh, sm] = d.horaSalida.split(':').map(Number)
  return Math.max(0, (sh * 60 + sm - (eh * 60 + em)) / 60)
}

function horasPorSemana(h: HorarioSemanal): number {
  return h.dias.reduce((sum, d) => sum + horasPorDia(d), 0)
}

function toDateSafe(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  const ts = v as { toDate?: () => Date }
  return ts.toDate?.() ?? null
}

function formatHorario(h: HorarioSemanal): string {
  return h.dias.map(d => `${d.dia.slice(0, 3)}: ${d.horaEntrada}–${d.horaSalida}`).join(' · ')
}

// ─── Tarjeta de prácticas ─────────────────────────────────────────────────────

function PracticasCard({
  internship, cohort, studentId, cohortId, onCreated,
}: {
  internship: Internship | null
  cohort: Cohort | null
  studentId: string
  cohortId?: string
  onCreated: () => void
}) {
  const [showForm, setShowForm] = useState(false)

  const req = cohort?.internshipHoursRequired ?? 0
  const app = internship?.totalHoursApproved ?? 0
  const pct = req > 0 ? Math.min(100, Math.round((app / req) * 100)) : 0

  const hs    = internship?.horarioSemanal
  const hps   = hs ? horasPorSemana(hs) : 0
  const inicio = toDateSafe(internship?.fechaInicio)

  const horasEsperadas = useMemo(() => {
    if (!inicio || hps <= 0) return null
    // eslint-disable-next-line
    return Math.round(((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 7)) * hps)
  }, [inicio, hps])

  const fechaEstimadaFin = (inicio && hps > 0 && req > 0)
    ? new Date(inicio.getTime() + (req / hps) * 7 * 24 * 60 * 60 * 1000)
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase size={16} className="text-primary" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">Prácticas</span>
        </div>
        {internship && (
          <Link to="/admin/practicas/progreso" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            <TrendingUp size={12} /> Progreso global
          </Link>
        )}
      </div>

      {!internship ? (
        showForm ? (
          <InternshipForm
            studentId={studentId}
            cohortId={cohortId}
            onSaved={() => { setShowForm(false); onCreated() }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <div className="text-center py-2 space-y-3">
            <p className="text-sm text-gray-400 italic">Sin práctica registrada</p>
            <button
              onClick={() => {
                if (!cohortId) { toast.error('Asigna una cohorte al estudiante primero'); return }
                setShowForm(true)
              }}
              className="flex items-center gap-1.5 mx-auto bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              <Plus size={13} /> Registrar práctica
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {/* Barra de progreso */}
          {req > 0 && (
            <>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-primary">{pct}%</span>
                <span className="text-xs text-gray-400 font-medium">{app} / {req} h aprobadas</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
              </div>
            </>
          )}

          {/* Horas esperadas vs reales */}
          {horasEsperadas !== null && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              app >= horasEsperadas ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {app >= horasEsperadas
                ? <CheckCircle size={12} />
                : <AlertTriangle size={12} />}
              <span>
                Se esperaban <strong>{horasEsperadas} h</strong> a esta fecha
                {app >= horasEsperadas ? ' — va al día' : ` — faltan ${horasEsperadas - app} h para estar al día`}
              </span>
            </div>
          )}

          {/* Info empresa + horario + fecha estimada */}
          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <InternshipMeta internship={internship} fechaEstimadaFin={fechaEstimadaFin} hps={hps} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Meta info de la práctica ─────────────────────────────────────────────────

function InternshipMeta({
  internship, fechaEstimadaFin, hps,
}: {
  internship: Internship
  fechaEstimadaFin: Date | null
  hps: number
}) {
  const [empresa, setEmpresa] = useState<string | null>(null)

  useEffect(() => {
    if (!internship.empresaId) return
    getDoc(doc(db, 'empresas', internship.empresaId)).then(snap => {
      if (snap.exists()) setEmpresa(snap.data().nombre as string)
    })
  }, [internship.empresaId])

  const inicio = toDateSafe(internship.fechaInicio)

  return (
    <>
      {empresa && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Building2 size={11} className="text-gray-400 flex-shrink-0" />
          {empresa}
        </p>
      )}
      {internship.horarioSemanal && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Clock size={11} className="text-gray-400 flex-shrink-0" />
          {formatHorario(internship.horarioSemanal)}
          {hps > 0 && <span className="text-gray-400">({hps} h/sem)</span>}
        </p>
      )}
      {inicio && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Calendar size={11} className="text-gray-400 flex-shrink-0" />
          Inicio: {inicio.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}
      {fechaEstimadaFin && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <TrendingUp size={11} className="text-gray-400 flex-shrink-0" />
          Fin estimado: <strong className="text-gray-700">{fechaEstimadaFin.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
        </p>
      )}
    </>
  )
}

// ─── Formulario de registro de práctica ──────────────────────────────────────

function InternshipForm({
  studentId, cohortId, onSaved, onCancel,
}: {
  studentId: string
  cohortId?: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [empresas, setEmpresas]   = useState<{ id: string; nombre: string }[]>([])
  const [saving, setSaving]       = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')

  // Horario por día: mapa dia → { entrada, salida }
  const [horarios, setHorarios] = useState<Record<string, { entrada: string; salida: string }>>({
    Lunes:     { entrada: '08:00', salida: '17:00' },
    Martes:    { entrada: '08:00', salida: '17:00' },
    Miércoles: { entrada: '08:00', salida: '17:00' },
    Jueves:    { entrada: '08:00', salida: '17:00' },
    Viernes:   { entrada: '08:00', salida: '17:00' },
  })
  const [diasActivos, setDiasActivos] = useState<Set<string>>(
    new Set(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'])
  )

  useEffect(() => {
    getDocs(query(collection(db, 'empresas'), where('schoolId', '==', 'sistemas-loja'), orderBy('nombre')))
      .then(snap => setEmpresas(snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre as string }))))
  }, [])

  const toggleDia = (dia: string) => {
    setDiasActivos(prev => {
      const next = new Set(prev)
      if (next.has(dia)) { next.delete(dia) } else { next.add(dia) }
      return next
    })
    // inicializar horario si es primera vez
    if (!horarios[dia]) {
      setHorarios(prev => ({ ...prev, [dia]: { entrada: '08:00', salida: '17:00' } }))
    }
  }

  const setHorario = (dia: string, campo: 'entrada' | 'salida', valor: string) =>
    setHorarios(prev => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))

  const diasOrdenados = DIAS_SEMANA.filter(d => diasActivos.has(d))

  const horarioSemanal: HorarioSemanal = {
    dias: diasOrdenados.map(d => ({
      dia: d,
      horaEntrada: horarios[d]?.entrada ?? '08:00',
      horaSalida:  horarios[d]?.salida  ?? '17:00',
    })),
  }

  const hps = diasActivos.size > 0 ? horasPorSemana(horarioSemanal) : 0

  const handleSave = async () => {
    if (!empresaId)           { toast.error('Selecciona una empresa'); return }
    if (diasActivos.size === 0){ toast.error('Selecciona al menos un día'); return }
    if (hps <= 0)             { toast.error('Revisa los horarios: la salida debe ser posterior a la entrada'); return }
    if (!fechaInicio)         { toast.error('Selecciona la fecha de inicio'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'internships'), {
        studentId,
        cohortId: cohortId ?? '',
        period: 1,
        totalHoursApproved: 0,
        totalHoursDeclared: 0,
        empresaId,
        horarioSemanal,
        fechaInicio: new Date(fechaInicio + 'T12:00:00'),
        createdAt: serverTimestamp(),
      })
      toast.success('Práctica registrada')
      onSaved()
    } catch {
      toast.error('Error al registrar')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 text-left">
      {/* Empresa */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Empresa <span className="text-red-500">*</span></label>
        <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700">
          <option value="">Seleccionar...</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        {empresas.length === 0 && (
          <p className="text-[10px] text-amber-600 mt-1">Ve a <strong>Prácticas → Empresas</strong> para añadir empresas.</p>
        )}
      </div>

      {/* Días + horario por día */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Horario por día <span className="text-red-500">*</span></label>

        {/* Selector de días */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DIAS_SEMANA.map(dia => (
            <button key={dia} type="button" onClick={() => toggleDia(dia)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                diasActivos.has(dia)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-primary/40'
              }`}>
              {dia.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Horario individual por día activo */}
        {diasOrdenados.length > 0 && (
          <div className="space-y-2">
            {diasOrdenados.map(dia => {
              const h = horarios[dia] ?? { entrada: '08:00', salida: '17:00' }
              const hd = horasPorDia({ dia, horaEntrada: h.entrada, horaSalida: h.salida })
              return (
                <div key={dia} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-gray-600 w-16 flex-shrink-0">{dia.slice(0, 3)}</span>
                  <input type="time" value={h.entrada}
                    onChange={e => setHorario(dia, 'entrada', e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary text-gray-700 w-24" />
                  <span className="text-gray-400 text-xs">–</span>
                  <input type="time" value={h.salida}
                    onChange={e => setHorario(dia, 'salida', e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary text-gray-700 w-24" />
                  <span className={`text-[10px] font-semibold ml-auto ${hd > 0 ? 'text-primary' : 'text-red-500'}`}>
                    {hd > 0 ? `${hd}h` : '!'}
                  </span>
                </div>
              )
            })}
            <p className="text-[10px] text-gray-400 pt-0.5">
              Total: <strong className="text-primary">{hps.toFixed(1)} horas/semana</strong>
            </p>
          </div>
        )}
      </div>

      {/* Fecha inicio */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de inicio <span className="text-red-500">*</span></label>
        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold py-2 rounded-lg transition disabled:opacity-60">
          <Save size={13} /> {saving ? 'Guardando...' : 'Registrar práctica'}
        </button>
        <button onClick={onCancel} className="px-3 text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>
    </div>
  )
}

// ─── Requirement Section ──────────────────────────────────────────────────────

function RequirementSection({ title, icon, reqs, anyApprovedMap, adminApprovedMap, onToggle }: {
  title: string; icon: React.ReactNode; reqs: CohortRequirement[]
  anyApprovedMap: Map<string, string>; adminApprovedMap: Map<string, string>
  onToggle: (req: CohortRequirement) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const done = reqs.filter(r => anyApprovedMap.has(`${r.type}:${r.name}`)).length

  if (reqs.length === 0) return null

  const handleToggle = async (req: CohortRequirement) => {
    setBusy(req.id); try { await onToggle(req) } finally { setBusy(null) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-bold text-gray-700 text-sm uppercase tracking-tight">{title}</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          done === reqs.length ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {done} / {reqs.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {reqs.map(req => {
          const key = `${req.type}:${req.name}`
          const isApproved = anyApprovedMap.has(key)
          const isAdminApproved = adminApprovedMap.has(key)
          const isBusy = busy === req.id

          return (
            <div key={req.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/30 transition-colors">
              <button onClick={() => handleToggle(req)} disabled={isBusy} className="flex-shrink-0">
                {isBusy ? (
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : isApproved ? (
                  <CheckCircle size={24} className={isAdminApproved ? 'text-green-500' : 'text-blue-500'} />
                ) : (
                  <Circle size={24} className="text-gray-200 hover:text-gray-300" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${isApproved ? 'text-gray-800' : 'text-gray-500'}`}>{req.name}</p>
                {req.ciclo && <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-tighter">Ciclo {req.ciclo}</p>}
              </div>
              {isApproved && !isAdminApproved && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Autoevaluado</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Inline Selectors ──────────────────────────────────────────────────────────

function EstadoSelector({ estado, onSave }: { estado: EstadoAcademico; onSave: (v: EstadoAcademico) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const ESTADOS = Object.keys(ESTADO_LABEL) as EstadoAcademico[]

  if (editing) {
    return (
      <select autoFocus value={estado} disabled={saving}
        onBlur={() => setEditing(false)}
        onChange={async e => {
          setSaving(true); await onSave(e.target.value as EstadoAcademico); setSaving(false); setEditing(false)
        }}
        className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-primary text-gray-700 bg-white"
      >
        {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
      </select>
    )
  }
  return (
    <button onClick={() => setEditing(true)}
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight ${ESTADO_CLASS[estado]} hover:opacity-80 transition`}>
      {ESTADO_LABEL[estado]}
    </button>
  )
}

function CohortField({ cohortId, cohorts, onSave }: { cohortId?: string; cohorts: Cohort[]; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(cohortId ?? '')
  const [saving, setSaving]   = useState(false)
  const current = cohorts.find(c => c.id === cohortId)

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-sm col-span-1 sm:col-span-2">
        <span className="text-gray-400 font-medium">Cohorte:</span>
        <select autoFocus value={value} onChange={e => setValue(e.target.value)}
          className="flex-1 max-w-[240px] px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 focus:ring-2 focus:ring-primary">
          <option value="">Sin asignar</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={async () => { setSaving(true); await onSave(value); setSaving(false); setEditing(false) }}
          disabled={saving} className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-primary-dark transition disabled:opacity-60">OK</button>
        <button onClick={() => setEditing(false)} className="text-gray-400"><X size={16} /></button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400 font-medium">Cohorte:</span>
      <span className="text-gray-700 font-bold">{current ? current.name : '—'}</span>
      <button onClick={() => { setValue(cohortId ?? ''); setEditing(true) }} className="text-gray-300 hover:text-primary transition"><Edit3 size={13} /></button>
    </div>
  )
}

function TutorField({ tutorId, teachers, onSave }: { tutorId?: string; teachers: AppUser[]; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(tutorId ?? '')
  const [saving, setSaving]   = useState(false)
  const current = teachers.find(t => t.uid === tutorId)

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-sm col-span-1 sm:col-span-2">
        <span className="text-gray-400 font-medium">Tutor:</span>
        <select autoFocus value={value} onChange={e => setValue(e.target.value)}
          className="flex-1 max-w-[240px] px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 focus:ring-2 focus:ring-primary">
          <option value="">Sin asignar</option>
          {teachers.map(t => <option key={t.uid} value={t.uid}>{t.displayName}</option>)}
        </select>
        <button onClick={async () => { setSaving(true); await onSave(value); setSaving(false); setEditing(false) }}
          disabled={saving} className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-primary-dark transition disabled:opacity-60">OK</button>
        <button onClick={() => setEditing(false)} className="text-gray-400"><X size={16} /></button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <UserCheck size={14} className="text-gray-400" />
      <span className="text-gray-400 font-medium">Tutor:</span>
      <span className="text-gray-700 font-bold">{current?.displayName ?? '—'}</span>
      <button onClick={() => { setValue(tutorId ?? ''); setEditing(true) }} className="text-gray-300 hover:text-primary transition"><Edit3 size={13} /></button>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-400 font-medium">{label}:</span>
      <span className="text-gray-700 font-bold truncate">{value}</span>
    </div>
  )
}

// ─── Visitas del administrador ────────────────────────────────────────────────

const PERF_OPTIONS = [
  { value: 'excelente',  label: 'Excelente',  cls: 'bg-green-100 text-green-700' },
  { value: 'bueno',      label: 'Bueno',       cls: 'bg-blue-100 text-blue-700' },
  { value: 'regular',    label: 'Regular',     cls: 'bg-amber-100 text-amber-700' },
  { value: 'deficiente', label: 'Deficiente',  cls: 'bg-red-100 text-red-700' },
] as const

type PerfLevel = typeof PERF_OPTIONS[number]['value']

function AdminVisitasSection({
  internshipId, studentId, adminId,
}: {
  internshipId: string
  studentId: string
  adminId: string
}) {
  const [visitas, setVisitas]     = useState<VisitLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [expanded, setExpanded]   = useState(false)

  const load = async () => {
    const snap = await getDocs(
      query(
        collection(db, 'visitLogs'),
        where('internshipId', '==', internshipId),
        where('registradoPor', '==', 'admin'),
        orderBy('date', 'desc'),
      )
    )
    setVisitas(snap.docs.map(d => ({ id: d.id, ...d.data() } as VisitLog)))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <MapPin size={15} className="text-primary" />
          <span className="font-bold text-gray-700 text-sm uppercase tracking-tight">Visitas de seguimiento</span>
          {visitas.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
              {visitas.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setShowForm(v => !v); setExpanded(true) }}
            className="flex items-center gap-1 text-xs bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-dark transition"
          >
            <Plus size={12} /> Registrar visita
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-6 py-4 space-y-4">
          {showForm && (
            <AdminVisitaForm
              internshipId={internshipId}
              studentId={studentId}
              adminId={adminId}
              onSaved={() => { setShowForm(false); load() }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Cargando...
            </div>
          ) : visitas.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-4">No hay visitas registradas aún.</p>
          ) : (
            <div className="space-y-2">
              {visitas.map(v => <VisitaRow key={v.id} visita={v} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AdminVisitaForm({
  internshipId, studentId, adminId, onSaved, onCancel,
}: {
  internshipId: string
  studentId: string
  adminId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [fecha, setFecha]           = useState(new Date().toISOString().split('T')[0])
  const [presente, setPresente]     = useState<boolean>(true)
  const [perf, setPerf]             = useState<PerfLevel>('bueno')
  const [obs, setObs]               = useState('')
  const [saving, setSaving]         = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await addDoc(collection(db, 'visitLogs'), {
        internshipId,
        studentId,
        tutorId: adminId,
        date: new Date(fecha + 'T12:00:00'),
        presente,
        performanceLevel: presente ? perf : 'deficiente',
        observations: obs,
        registradoPor: 'admin',
        createdAt: serverTimestamp(),
      })
      toast.success('Visita registrada')
      onSaved()
    } catch {
      toast.error('Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-tight">Nueva visita</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha <span className="text-red-500">*</span></label>
          <input type="date" value={fecha} max={new Date().toISOString().split('T')[0]}
            onChange={e => setFecha(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary text-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">¿Estaba presente?</label>
          <div className="flex gap-2 mt-1">
            {[true, false].map(v => (
              <button key={String(v)} type="button" onClick={() => setPresente(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                  presente === v
                    ? v ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}>
                {v ? 'Sí' : 'No'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {presente && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Desempeño</label>
          <div className="flex gap-2 flex-wrap">
            {PERF_OPTIONS.map(p => (
              <button key={p.value} type="button" onClick={() => setPerf(p.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  perf === p.value ? p.cls + ' border-transparent' : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
        <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
          placeholder="Notas de la visita..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-60">
          <Save size={13} /> {saving ? 'Guardando...' : 'Guardar visita'}
        </button>
        <button onClick={onCancel} className="px-3 text-gray-500 hover:text-gray-700 text-xs">Cancelar</button>
      </div>
    </div>
  )
}

function VisitaRow({ visita }: { visita: VisitLog }) {
  const date = toDateSafe(visita.date) ?? new Date()
  const perf = PERF_OPTIONS.find(p => p.value === visita.performanceLevel)

  return (
    <div className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        visita.presente === false ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
      }`}>
        {visita.presente === false ? '✗' : '✓'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">
            {date.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
          {visita.presente !== false && perf && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${perf.cls}`}>{perf.label}</span>
          )}
          {visita.presente === false && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Ausente</span>
          )}
        </div>
        {visita.observations && (
          <p className="text-xs text-gray-500 mt-0.5">{visita.observations}</p>
        )}
      </div>
    </div>
  )
}
