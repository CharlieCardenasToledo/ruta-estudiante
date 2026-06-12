import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
const logo = '/logo-uide.png'

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type FormData = z.infer<typeof schema>

const ROLE_REDIRECT: Record<string, string> = {
  student: '/student',
  admin: '/admin',
  teacher: '/teacher',
}

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { appUser } = useAuth()

  useEffect(() => {
    if (appUser) {
      navigate(ROLE_REDIRECT[appUser.role] ?? '/login', { replace: true })
    }
  }, [appUser, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      setLoading(true)
      await signInWithEmailAndPassword(auth, data.email, data.password)
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-8">

        <div className="flex flex-col items-center gap-4">
          <img src={logo} alt="UIDE" className="h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Ruta Estudiante</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sistema de seguimiento académico y profesional
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              placeholder="correo@uide.edu.ec"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Powered by Arizona State University®
      </p>
    </div>
  )
}
