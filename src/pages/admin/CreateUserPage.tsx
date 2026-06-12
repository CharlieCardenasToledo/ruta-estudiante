import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, RefreshCw, UserPlus, CheckCircle, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { createAppUser, generatePassword } from '../../lib/createUser'

const schema = z.object({
  displayName: z.string().min(3, 'Ingresa el nombre completo'),
  email: z.string().email('Correo no válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['student', 'teacher']),
  cohortId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface SuccessInfo {
  displayName: string
  email: string
  password: string
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  student: 'Estudiante',
  teacher: 'Tutor',
}

export default function CreateUserPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<SuccessInfo | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'student' },
  })

  const role = useWatch({ control, name: 'role', defaultValue: 'student' })

  const handleGenerate = () => {
    const pwd = generatePassword()
    setValue('password', pwd, { shouldValidate: true })
    setShowPassword(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true)
      await createAppUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        role: data.role,
        cohortId: data.cohortId || undefined,
      })
      setSuccess({
        displayName: data.displayName,
        email: data.email,
        password: data.password,
        role: data.role,
      })
      reset()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        toast.error('Este correo ya está registrado.')
      } else {
        toast.error('Error al crear el usuario. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return <SuccessScreen info={success} onNew={() => setSuccess(null)} />
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Crear Usuario</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Registra una nueva cuenta de estudiante o tutor en el sistema.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. María García López"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="correo@uide.edu.ec"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña temporal <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition whitespace-nowrap"
              >
                <RefreshCw size={14} />
                Generar
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rol <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {(['student', 'teacher'] as const).map((r) => (
                <label
                  key={r}
                  className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm font-medium cursor-pointer transition
                    ${role === r
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                >
                  <input type="radio" value={r} className="sr-only" {...register('role')} />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </div>

          {/* Cohorte (solo estudiante) */}
          {role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID de Cohorte <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. cohorte-2024-a"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                {...register('cohortId')}
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <UserPlus size={16} />
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SuccessScreen({ info, onNew }: { info: SuccessInfo; onNew: () => void }) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado`)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Crear Usuario</h1>
      </div>

      <div className="bg-white rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Cuenta creada exitosamente</p>
            <p className="text-sm text-gray-500">Comparte estas credenciales con el usuario</p>
          </div>
        </div>

        <div className="space-y-3 bg-gray-50 rounded-lg p-4 text-sm">
          <CredentialRow label="Nombre" value={info.displayName} />
          <CredentialRow label="Correo" value={info.email} onCopy={() => copyToClipboard(info.email, 'Correo')} />
          <CredentialRow label="Contraseña" value={info.password} onCopy={() => copyToClipboard(info.password, 'Contraseña')} />
          <CredentialRow label="Rol" value={ROLE_LABEL[info.role]} />
        </div>

        <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Guarda esta contraseña ahora. No se puede recuperar después.
        </p>

        <button
          onClick={onNew}
          className="mt-5 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm"
        >
          <UserPlus size={15} />
          Crear otro usuario
        </button>
      </div>
    </div>
  )
}

function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="font-medium text-gray-800 flex-1 break-all">{value}</span>
      {onCopy && (
        <button onClick={onCopy} className="text-gray-400 hover:text-primary transition flex-shrink-0">
          <Copy size={14} />
        </button>
      )}
    </div>
  )
}
