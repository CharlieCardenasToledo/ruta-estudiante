import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { currentUser, appUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentUser || !appUser) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(appUser.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
