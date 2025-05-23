import { useState, useRef, useEffect } from 'react'
import { WiredCard } from 'wired-elements-react'
import './UserProfilePicker.css'

function UserProfilePicker({ users, currentUser, setCurrentUser }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getInitials = (name) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase()
  }

  const handleUserSelect = (user) => {
    setCurrentUser(user)
    setIsOpen(false)
  }

  return (
    <div className="user-profile-picker" ref={dropdownRef}>
      <div 
        className="current-user-avatar" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ backgroundColor: currentUser.color }}
      >
        {getInitials(currentUser.name)}
      </div>

      {isOpen && (
        <div className="user-dropdown">
          <WiredCard className="dropdown-card">
            <div className="dropdown-header">
              <strong>Switch User</strong>
            </div>
            <div className="user-list">
              {users.map(user => (
                <div 
                  key={user.id}
                  className={`user-option ${currentUser.id === user.id ? 'active' : ''}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <div 
                    className="user-avatar small"
                    style={{ backgroundColor: user.color }}
                  >
                    {getInitials(user.name)}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-username">@{user.username}</div>
                  </div>
                </div>
              ))}
            </div>
          </WiredCard>
        </div>
      )}
    </div>
  )
}

export default UserProfilePicker