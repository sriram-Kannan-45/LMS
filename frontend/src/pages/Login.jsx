import { Navigate, useLocation } from 'react-router-dom'

function LoginRedirect() {
  const location = useLocation()
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