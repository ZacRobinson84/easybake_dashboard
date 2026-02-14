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
  { label: 'Gaming', path: '/gaming', icon: Gamepad2 },
  { label: 'Music', path: '/music', icon: Music },
]

export default function Layout() {
  return (
    <div className="h-dvh flex flex-col md:flex-row overflow-hidden">
      <header className="md:hidden flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-xl font-bold text-indigo-600" style={{ backgroundColor: '#F5EEE4' }}>
        <img src="/bread_cat.png" alt="BakeBoard logo" className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-600/20" />
        BakeBoard
      </header>
      <Sidebar navItems={navItems} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0" style={{ backgroundColor: '#E8CEBF' }}>
        <Outlet />
      </main>
      <BottomNav navItems={navItems} />
    </div>
  )
}
