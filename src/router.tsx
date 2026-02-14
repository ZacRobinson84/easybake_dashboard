import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Movies from './pages/Movies'
import Gaming from './pages/Gaming'
import Music from './pages/Music'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'movies', element: <Movies /> },
      { path: 'gaming', element: <Gaming /> },
      { path: 'music', element: <Music /> },
    ],
  },
])
