import { NavLink } from 'react-router-dom'
import type { NavItem } from './Layout'

interface SidebarProps {
  navItems: NavItem[]
}

const RAINBOW_COLORS = [
  '#6366f1', // indigo-500
  '#10b981', // emerald-500
  '#0ea5e9', // sky-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
]

export default function Sidebar({ navItems }: SidebarProps) {
  return (
    <div className="hidden md:flex relative w-64 flex-shrink-0">
      {/* Rainbow stripes in the clipped corner area */}
      <div className="absolute top-0 right-0 w-[3.325rem] h-[3.325rem] overflow-hidden">
        {RAINBOW_COLORS.map((color, i) => (
          <div
            key={color}
            className="absolute"
            style={{
              backgroundColor: color,
              opacity: 0.8,
              width: '100%',
              height: '100%',
              clipPath: `polygon(${100 - (i + 1) * 20}% 0, ${100 - i * 20}% 0, 100% ${i * 20}%, 100% ${(i + 1) * 20}%)`,
            }}
          />
        ))}
      </div>

      <aside
        className="flex flex-col w-full border-r border-gray-200"
        style={{
          backgroundColor: '#F5EEE4',
          clipPath: 'polygon(0 0, calc(100% - 3.325rem) 0, 100% 3.325rem, 100% 100%, 0 100%)',
        }}
      >
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
    </div>
  )
}
