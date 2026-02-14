import { NavLink } from 'react-router-dom'
import type { NavItem } from './Layout'

interface SidebarProps {
  navItems: NavItem[]
}

export default function Sidebar({ navItems }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-gray-200" style={{ backgroundColor: '#F5EEE4' }}>
      <div className="flex items-center gap-2 rounded-lg p-6 text-xl font-bold text-indigo-600" style={{ backgroundColor: '#F5EEE4' }}>
        <img src="/bread_cat.png" alt="BakeBoard logo" className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-600/20" />
        BakeBoard
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
