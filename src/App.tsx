import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'

function AuthGate() {
  const { token } = useAuth()
  if (!token) return <Login />
  return <RouterProvider router={router} />
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

export default App
