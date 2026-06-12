import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { LogOut, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { auth } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
const logo = '/logo-uide.png'

interface NavItem {
  label: string
  to: string
  icon?: ReactNode
  section?: string
}

interface Props {
  children: ReactNode
  navItems: NavItem[]
}

const ROLE_LABEL: Record<string, string> = {
  student: 'Estudiante',
  admin: 'Administrador',
  teacher: 'Tutor',
}

export default function Layout({ children, navItems }: Props) {
  const { appUser } = useAuth()
  const navigate    = useNavigate()
  const location    = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login')
  }

  const initials = appUser?.displayName
    ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? '?'

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={`bg-primary flex flex-col flex-shrink-0 transition-all duration-200
        ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Logo + toggle */}
        <div className={`flex items-center border-b border-white/10 h-16 flex-shrink-0
          ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}`}
        >
          {!collapsed && (
            <>
              <img src={logo} alt="UIDE" className="h-8 object-contain brightness-0 invert flex-shrink-0" />
              <span className="text-white font-bold text-sm leading-tight flex-1 min-w-0">
                Ruta<br />Estudiante
              </span>
            </>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition flex-shrink-0"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden
          ${collapsed ? 'px-2' : 'px-3'}`}
        >
          {navItems.map((item) => {
            const active = location.pathname === item.to ||
              (item.to !== '/admin' && item.to !== '/teacher' && item.to !== '/student' &&
                location.pathname.startsWith(item.to))

            return (
              <Fragment key={item.to}>
                {/* Section label — hidden when collapsed */}
                {item.section && !collapsed && (
                  <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    {item.section}
                  </p>
                )}
                {/* Section divider when collapsed */}
                {item.section && collapsed && (
                  <div className="border-t border-white/10 my-2" />
                )}

                <Link
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition
                    ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
                    ${active
                      ? 'bg-white text-primary'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  {item.icon}
                  {!collapsed && item.label}
                </Link>
              </Fragment>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className={`border-t border-white/10 flex-shrink-0
          ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`}
        >
          {collapsed ? (
            /* Collapsed: avatar + logout stacked */
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center"
                title={appUser?.displayName}>
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="text-white/60 hover:text-white transition"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            /* Expanded: name + role + logout */
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-white" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-white text-xs font-semibold truncate">{appUser?.displayName}</p>
                  <p className="text-white/60 text-xs">{ROLE_LABEL[appUser?.role ?? '']}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full text-white/70 hover:text-white text-xs transition"
              >
                <LogOut size={14} /> Cerrar sesión
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
