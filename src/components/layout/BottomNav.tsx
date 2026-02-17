import { NavLink } from 'react-router-dom'
import type { NavItem } from './Layout'

interface BottomNavProps {
  navItems: NavItem[]
}

const NAV_COLORS: Record<string, string> = {
  '/':       'bg-amber-500/75',
  '/movies': 'bg-rose-500/75',
  '/gaming': 'bg-sky-500/75',
  '/music':  'bg-emerald-500/75',
}

export default function BottomNav({ navItems }: BottomNavProps) {
  return (
    <nav className="flex md:hidden fixed bottom-0 inset-x-0 h-16 z-50 border-t border-gray-200" style={{ backgroundColor: '#F5EEE4' }}>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
        >
          {({ isActive }) => {
            const active = isActive
            const colorClass = NAV_COLORS[item.path] || 'bg-amber-500/75'
            return (
              <>
                <span className={`flex flex-col items-center justify-center gap-1 w-16 h-13 rounded-lg transition-colors ${active ? `${colorClass} text-white` : 'text-gray-400'}`}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </span>
              </>
            )
          }}
        </NavLink>
      ))}
    </nav>
  )
}
