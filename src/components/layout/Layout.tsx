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
      <Sidebar navItems={navItems} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <BottomNav navItems={navItems} />
    </div>
  )
}
