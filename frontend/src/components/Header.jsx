import { Link, useLocation } from 'react-router-dom'
import { WiredButton, WiredCard } from 'wired-elements-react'
import UserProfilePicker from './UserProfilePicker'
import './Header.css'

function Header({ users, currentUser, setCurrentUser }) {
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/groups' && (location.pathname === '/' || location.pathname === '/groups')) {
      return true
    }
    return location.pathname === path
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="app-title">Authorization Demo</h1>
          <nav className="app-nav">
            <Link to="/groups" className={isActive('/groups') ? 'active' : ''}>
              <WiredButton>Groups</WiredButton>
            </Link>
            <Link to="/mail" className={isActive('/mail') ? 'active' : ''}>
              <WiredButton>Mail</WiredButton>
            </Link>
            <Link to="/docs" className={isActive('/docs') ? 'active' : ''}>
              <WiredButton>Docs</WiredButton>
            </Link>
          </nav>
        </div>
        
        <div className="header-right">
          <UserProfilePicker 
            users={users} 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser} 
          />
        </div>
      </div>
    </header>
  )
}

export default Header