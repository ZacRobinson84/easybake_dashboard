import { Outlet } from 'react-router-dom'
import { Home, Film, Gamepad2, Music } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export interface NavItem {
  label: string
  path: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Movies', path: '/movies', icon: Film },
  { label: 'Games', path: '/gaming', icon: Gamepad2 },
  { label: 'Music', path: '/music', icon: Music },
]

export default function Layout() {
  return (
    <div className="h-dvh flex flex-col md:flex-row overflow-hidden">
      <div className="md:hidden relative">
        {/* Rainbow stripes in the clipped corner area */}
        <div className="absolute top-0 right-0 w-[3.325rem] h-[3.325rem] overflow-hidden z-10">
          {['#6366f1', '#10b981', '#0ea5e9', '#f43f5e', '#f59e0b'].map((color, i) => (
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
        <header
          className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-xl font-bold text-indigo-600"
          style={{
            backgroundColor: '#F5EEE4',
            clipPath: 'polygon(0 0, calc(100% - 3.325rem) 0, 100% 3.325rem, 100% 100%, 0 100%)',
          }}
        >
          <img src="/bread_cat.png" alt="BakeBoard logo" className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-600/20" />
          BakeBoard
        </header>
      </div>
      <Sidebar navItems={navItems} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0" style={{ backgroundColor: '#E8CEBF' }}>
        <Outlet />
      </main>
      <BottomNav navItems={navItems} />
    </div>
  )
}
