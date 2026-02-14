import { NavLink } from 'react-router-dom'
import type { NavItem } from './Layout'

interface BottomNavProps {
  navItems: NavItem[]
}

export default function BottomNav({ navItems }: BottomNavProps) {
  return (
    <nav className="flex md:hidden fixed bottom-0 inset-x-0 h-16 z-50 bg-white border-t border-gray-200">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-gray-400'
            }`
          }
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
