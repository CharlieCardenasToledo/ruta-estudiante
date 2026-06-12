import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import Papa from 'papaparse'
import {
  Users, Upload, Download, Search, CheckCircle,
  XCircle, Loader2, FileText, AlertCircle, Copy, ChevronDown, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import { createAppUser, generatePassword } from '../../lib/createUser'
import { emailFromName, mallaToId, estadoToKey, cicloToNumber } from '../../lib/emailFromName'
import type { AppUser, EstadoAcademico } from '../../types'
import StudentProfilePage from './StudentProfilePage'

const CYCLE_NUMBER: Record<string, number> = {
  'Primero': 1, 'Segundo': 2, 'Tercero': 3, 'Cuarto': 4,
  'Quinto': 5, 'Sexto': 6, 'Séptimo': 7, 'Octavo': 8,
}

function cycleThreshold(ciclo: string): number {
  const n = CYCLE_NUMBER[ciclo] ?? 0
  if (n === 0) return 0
  if (n >= 7) return 6
  return Math.max(0, 6 - (7 - n) * 2)
}

type Tab = 'list' | 'csv'

const ESTADO_LABEL: Record<EstadoAcademico, string> = {
  en_curso: 'En Curso', graduado: 'Graduado',
  no_continua: 'No Continúa', cambio_carrera: 'Cambio de Carrera',
}
const ESTADO_CLASS: Record<EstadoAcademico, string> = {
  en_curso: 'bg-green-100 text-green-700', graduado: 'bg-blue-100 text-blue-700',
  no_continua: 'bg-red-100 text-red-600', cambio_carrera: 'bg-yellow-100 text-yellow-700',
}
const CICLOS = ['Primero','Segundo','Tercero','Cuarto','Quinto','Sexto','Séptimo','Octavo','Graduado']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const [tab, setTab] = useState<Tab>('list')

  if (tab === 'csv') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Estudiantes</h1>
            <p className="text-gray-500 mt-1 text-sm">Importa estudiantes desde el SGA.</p>
          </div>
          <TabSwitcher tab={tab} onTab={setTab} />
        </div>
        <CsvImport />
      </div>
    )
  }

  return <DirectoryView onTabChange={setTab} />
}

function TabSwitcher({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      <TabBtn active={tab === 'list'} onClick={() => onTab('list')} icon={<Users size={14} />}>Directorio</TabBtn>
      <TabBtn active={tab === 'csv'}  onClick={() => onTab('csv')}  icon={<Upload size={14} />}>Importar</TabBtn>
    </div>
  )
}

function TabBtn({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition
        ${active ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      {icon}{children}
    </button>
  )
}

// ─── Two-panel directory ──────────────────────────────────────────────────────

function DirectoryView({ onTabChange }: { onTabChange: (t: Tab) => void }) {
  const { uid: paramUid } = useParams<{ uid?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [students, setStudents]   = useState<AppUser[]>([])
  const [levelMap, setLevelMap]   = useState<Map<string, number>>(new Map())
  const [loading, setLoading]     = useState(true)
  const [selectedUid, setSelectedUid] = useState<string | null>(paramUid ?? null)

  const search = searchParams.get('q') ?? ''
  const ciclo  = searchParams.get('ciclo') ?? ''
  const estado = (searchParams.get('estado') ?? '') as EstadoAcademico | ''

  const setFilter = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  // Sync when URL param changes (browser back/forward)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedUid(paramUid ?? null) }, [paramUid])

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
      getDocs(query(collection(db, 'milestones'), where('type', '==', 'english_level'), where('status', '==', 'approved'))),
    ]).then(([studSnap, milSnap]) => {
      const list = studSnap.docs
        .map(d => ({ uid: d.id, ...d.data() } as AppUser))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
      setStudents(list)
      const map = new Map<string, number>()
      milSnap.docs.forEach(d => {
        const { studentId, title } = d.data() as { studentId: string; title: string }
        const lvl = parseInt(title.replace('Nivel ', ''))
        if (!isNaN(lvl) && lvl > (map.get(studentId) ?? 0)) map.set(studentId, lvl)
      })
      setLevelMap(map)
      setLoading(false)
    })
  }, [])

  const handleSelect = (uid: string) => {
    setSelectedUid(uid)
    const qs = searchParams.toString()
    navigate(`/admin/estudiantes/${uid}${qs ? `?${qs}` : ''}`)
  }

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const filtered = students.filter(s => {
    const term = normalize(search)
    const matchSearch =
      normalize(s.displayName).includes(term) ||
      normalize(s.email).includes(term) ||
      (s.cedula ?? '').includes(term)
    const matchCiclo = !ciclo || (s.ciclo ?? '').toLowerCase() === ciclo.toLowerCase()
    const matchEstado = !estado || (s.estadoAcademico ?? 'en_curso') === estado
    return matchSearch && matchCiclo && matchEstado
  })

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-white flex-shrink-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-gray-800">Estudiantes</h1>
            <button
              onClick={() => onTabChange('csv')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition"
              title="Importar CSV"
            >
              <Upload size={13} /> Importar
            </button>
          </div>
          {/* Search */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar nombre, cédula..."
              value={search}
              onChange={e => setFilter('q', e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Ciclo filter */}
            <div className="relative">
              <select value={ciclo} onChange={e => setFilter('ciclo', e.target.value)}
                className="w-full appearance-none px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary bg-white">
                <option value="">Todos los ciclos</option>
                {CICLOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Estado filter */}
            <div className="relative">
              <select value={estado} onChange={e => setFilter('estado', e.target.value)}
                className="w-full appearance-none px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary bg-white">
                <option value="">Todos los estados</option>
                {Object.entries(ESTADO_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-2">{filtered.length} estudiante{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-1 text-gray-400">
              <Users size={24} className="text-gray-300" />
              <p className="text-xs">Sin resultados</p>
            </div>
          ) : (
            filtered.map(s => {
              const estado = (s.estadoAcademico ?? 'en_curso') as EstadoAcademico
              const initials = s.displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              const threshold = cycleThreshold(s.ciclo ?? '')
              const level = levelMap.get(s.uid) ?? 0
              const isAtRisk = threshold > 0 && level < threshold && estado === 'en_curso'
              const active = selectedUid === s.uid
              return (
                <button
                  key={s.uid}
                  onClick={() => handleSelect(s.uid)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition
                    ${active ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold
                    ${active ? 'bg-primary text-white' : isAtRisk ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${active ? 'text-primary' : 'text-gray-800'}`}>{s.displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {s.ciclo && <span className="text-[10px] text-gray-400">{s.ciclo}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ESTADO_CLASS[estado]}`}>
                        {ESTADO_LABEL[estado]}
                      </span>
                      {isAtRisk && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                          <AlertTriangle size={9} /> N{level || '?'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {selectedUid ? (
          <StudentProfilePage key={selectedUid} embedded />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <Users size={48} className="text-gray-200" />
            <p className="text-sm">Selecciona un estudiante para ver su perfil</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CSV import (unchanged) ───────────────────────────────────────────────────

interface InstitutionalRow {
  cedula: string; nombre_completo: string; correo: string
  malla: string; estado: string; ciclo_academico: string
}
interface ParsedStudent {
  cedula: string; displayName: string; email: string
  malla: string; estadoAcademico: EstadoAcademico; ciclo: string; currentCycle: number
}
interface ImportResult {
  displayName: string; email: string; password: string; status: 'ok' | 'error'; error?: string
}
type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

function CsvImport() {
  const [step, setStep]       = useState<ImportStep>('upload')
  const [parsed, setParsed]   = useState<ParsedStudent[]>([])
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [results, setResults] = useState<ImportResult[]>([])
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    const csv = 'Cédula\tNombre Completo\tMALLA\tESTADO\tCiclo académico\n1150077467\tAbad Montesdeoca Nicole Belen\tITIL_MALLA 2023\tEn Curso\tSexto'
    const blob = new Blob([csv], { type: 'text/tab-separated-values' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'plantilla-estudiantes-uide.tsv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseFile = (file: File) => {
    Papa.parse<InstitutionalRow>(file, {
      header: true, skipEmptyLines: true, delimiter: '',
      transformHeader: h => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_'),
      transform: (v: string) => v.trim(),
      complete: ({ data }) => {
        const errors: Record<number, string> = {}
        const students: ParsedStudent[] = data.map((row, i) => {
          const nombre = row.nombre_completo ?? ''
          if (!nombre) errors[i] = 'Falta nombre'
          const email = (row.correo ?? '').trim() || emailFromName(nombre)
          if (!email && !errors[i]) errors[i] = 'Falta el correo'
          return {
            cedula: row.cedula ?? '', displayName: nombre, email,
            malla: row.malla ?? '', cohortId: mallaToId(row.malla ?? ''),
            estadoAcademico: estadoToKey(row.estado ?? ''),
            ciclo: row.ciclo_academico ?? '', currentCycle: cicloToNumber(row.ciclo_academico ?? ''),
          }
        })
        const seen = new Set<string>()
        students.forEach((s, i) => {
          if (!errors[i] && s.email) {
            if (seen.has(s.email)) errors[i] = `Email duplicado: ${s.email}`
            else seen.add(s.email)
          }
        })
        setParsed(students); setRowErrors(errors); setStep('preview')
      },
      error: () => toast.error('No se pudo leer el archivo.'),
    })
  }

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(csv|tsv|txt)$/i)) { toast.error('Solo .csv o .tsv'); return }
    parseFile(file)
  }

  const validRows = parsed.filter((_, i) => !rowErrors[i])

  const handleImport = async () => {
    setStep('importing'); setProgress(0)
    const res: ImportResult[] = []
    for (let i = 0; i < validRows.length; i++) {
      const s = validRows[i]; const password = generatePassword()
      try {
        await createAppUser({
          email: s.email, password, displayName: s.displayName, role: 'student',
          cedula: s.cedula || undefined, malla: s.malla || undefined,
          ciclo: s.ciclo || undefined, currentCycle: s.currentCycle || undefined,
          estadoAcademico: s.estadoAcademico,
        })
        res.push({ displayName: s.displayName, email: s.email, password, status: 'ok' })
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        res.push({ displayName: s.displayName, email: s.email, password: '',
          status: 'error', error: code === 'auth/email-already-in-use' ? 'Correo ya registrado' : 'Error' })
      }
      setProgress(i + 1)
    }
    setResults(res); setStep('done')
  }

  const copyAll = () => {
    navigator.clipboard.writeText(
      results.filter(r => r.status === 'ok').map(r => `${r.displayName}\t${r.email}\t${r.password}`).join('\n')
    )
    toast.success('Credenciales copiadas')
  }

  const reset = () => {
    setStep('upload'); setParsed([]); setRowErrors({}); setResults([]); setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (step === 'upload') return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-semibold text-gray-800">Importar desde archivo</h2>
            <p className="text-sm text-gray-500 mt-0.5">Exporta el listado del SGA y súbelo aquí.</p>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-primary hover:underline flex-shrink-0">
            <Download size={14} /> Plantilla
          </button>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition
            ${dragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}`}
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <FileText size={22} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Arrastra tu archivo aquí</p>
            <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar · .csv o .tsv</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
        <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
          <p className="font-semibold mb-1">Columnas (separadas por tab o coma):</p>
          <p className="font-mono">Cédula · Nombre Completo · MALLA · ESTADO · Ciclo académico</p>
        </div>
      </div>
    </div>
  )

  if (step === 'preview') {
    const errorCount = Object.keys(rowErrors).length
    return (
      <div className="max-w-5xl">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-800">Vista previa</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="text-green-600 font-medium">{validRows.length} válidos</span>
                {errorCount > 0 && <span className="text-red-500 font-medium ml-2">{errorCount} con error</span>}
              </p>
            </div>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">Cambiar archivo</button>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Malla</th><th className="px-4 py-3">Ciclo</th>
                  <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Val.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsed.map((s, i) => {
                  const err = rowErrors[i]
                  return (
                    <tr key={i} className={err ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{s.cedula || '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-xs text-gray-800">{s.displayName || '—'}</td>
                      <td className="px-4 py-2.5 text-primary text-xs font-mono">{s.email || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{s.malla || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{s.ciclo || '—'}</td>
                      <td className="px-4 py-2.5">
                        {s.estadoAcademico && (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_CLASS[s.estadoAcademico]}`}>
                            {ESTADO_LABEL[s.estadoAcademico]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {err
                          ? <span className="flex items-center gap-1 text-red-500 text-xs"><AlertCircle size={12}/>{err}</span>
                          : <CheckCircle size={14} className="text-green-500" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-5 border-t border-gray-100 flex gap-3">
            <button onClick={handleImport} disabled={validRows.length === 0}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50">
              <Upload size={15} /> Importar {validRows.length}
            </button>
            <button onClick={reset} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'importing') return (
    <div className="max-w-md bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center gap-4">
      <Loader2 size={32} className="animate-spin text-primary" />
      <p className="font-medium text-gray-700">Creando cuentas...</p>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(progress / validRows.length) * 100}%` }} />
      </div>
      <p className="text-sm text-gray-400">{progress} de {validRows.length}</p>
    </div>
  )

  const okCount = results.filter(r => r.status === 'ok').length
  const failCount = results.filter(r => r.status === 'error').length
  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <div><p className="text-sm font-semibold text-green-700">{okCount} creados</p></div>
        </div>
        {failCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <XCircle size={20} className="text-red-500" />
            <div><p className="text-sm font-semibold text-red-600">{failCount} fallidos</p></div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Credenciales generadas</h2>
          {okCount > 0 && (
            <button onClick={copyAll} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Copy size={14} /> Copiar todas
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-100">
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Contraseña</th><th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((r, i) => (
                <tr key={i} className={r.status === 'error' ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2.5 font-medium text-xs text-gray-800">{r.displayName}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.email}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.status === 'ok' ? r.password : '—'}</td>
                  <td className="px-4 py-2.5">
                    {r.status === 'ok'
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12}/> Creado</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={12}/> {r.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-5 border-t border-gray-100">
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Guarda estas contraseñas ahora. No se podrán recuperar después.
          </p>
          <button onClick={reset}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            <Upload size={15} /> Importar otro archivo
          </button>
        </div>
      </div>
    </div>
  )
}
