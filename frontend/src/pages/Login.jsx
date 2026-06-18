import { Navigate, useLocation } from 'react-router-dom'

function LoginRedirect() {
  const location = useLocation()
  
  // If user is already logged in, redirect them to their actual role's dashboard
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser)
      if (user?.role === 'ADMIN') {
        return <Navigate to="/admin" state={location.state} replace />
      }
      if (user?.role === 'TRAINER') {
        return <Navigate to="/trainer" state={location.state} replace />
      }
      if (user?.role === 'PARTICIPANT') {
        return <Navigate to="/participant" state={location.state} replace />
      }
    } catch (e) {
      localStorage.removeItem('user')
    }
  }

  const lastRole = localStorage.getItem('lastRole')
  if (lastRole === 'ADMIN') {
    return <Navigate to="/admin/login" state={location.state} replace />
  }
  if (lastRole === 'TRAINER') {
    return <Navigate to="/trainer/login" state={location.state} replace />
  }
  return <Navigate to="/participant/login" state={location.state} replace />
}

export default LoginRedirect