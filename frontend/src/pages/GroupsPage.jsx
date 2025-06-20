import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import { API_URLS } from '../config/api'
import './PageLayout.css'

function GroupsPage({ currentUser }) {
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    username: ''
  })

  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch('${API_URLS.groups}/groups', {
        headers: {
          'X-Username': currentUser.username
        }
      })
      const data = await response.json()
      setGroups(data)
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }, [currentUser.username])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const createGroup = async () => {
    if (!newGroup.name.trim() || !newGroup.username.trim()) return

    try {
      const response = await fetch('${API_URLS.groups}/groups', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Username': currentUser.username 
        },
        body: JSON.stringify({ 
          name: newGroup.name,
          description: newGroup.description || `A group for ${newGroup.name} discussions`,
          username: newGroup.username,
          visibility: 'PUBLIC',
          owner_username: currentUser.username
        })
      })
      
      if (response.ok) {
        const createdGroup = await response.json()
        setGroups([createdGroup, ...groups])
        setNewGroup({ name: '', description: '', username: '' })
      } else {
        const error = await response.json()
        alert(`Failed to create group: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating group:', error)
      alert('Failed to create group. Please try again.')
    }
  }

  const deleteGroup = async (groupUsername, groupName) => {
    if (!window.confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`${API_URLS.groups}/groups/${groupUsername}`, {
        method: 'DELETE',
        headers: {
          'X-Username': currentUser.username
        }
      })
      
      if (response.ok) {
        setGroups(groups.filter(group => group.username !== groupUsername))
      } else {
        const error = await response.json()
        alert(`Failed to delete group: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Failed to delete group. Please try again.')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Groups Service - {currentUser.name}</h2>
      </div>
      
      <div className="page-content">
        <div className="full-width-section">
          <WiredCard className="form-section">
            <h3>Create New Group</h3>
            <div className="form-row">
              <WiredInput 
                className="form-input"
                placeholder="Group name"
                value={newGroup.name}
                onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
              />
            </div>
            <div className="form-row">
              <WiredInput 
                className="form-input"
                placeholder="Group username (required, will be used for email as username@company.com)"
                value={newGroup.username}
                onChange={(e) => setNewGroup({...newGroup, username: e.target.value})}
              />
            </div>
            <div className="form-row">
              <WiredTextarea 
                className="form-input"
                placeholder="Group description (optional)"
                value={newGroup.description}
                onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                rows="3"
              />
            </div>
            <div className="form-row">
              <WiredButton onClick={createGroup}>Create Group</WiredButton>
            </div>
          </WiredCard>
        </div>

        <div className="full-width-section">
          <WiredCard className="content-section">
            <h3>Existing Groups</h3>
            <div className="items-grid">
              {groups.map(group => (
                <WiredCard key={group.username} className="item-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div 
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/groups/${group.username}`)}
                    >
                      <strong style={{ color: '#007bff', textDecoration: 'underline' }}>
                        {group.name}
                      </strong>
                    </div>
                    <WiredButton 
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px', 
                        background: '#ff4444',
                        color: 'white'
                      }}
                      onClick={() => deleteGroup(group.username, group.name)}
                    >
                      Delete
                    </WiredButton>
                  </div>
                  <div style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                    {group.email}
                  </div>
                  {group.description && (
                    <div style={{ color: '#555', fontSize: '13px', marginBottom: '8px' }}>
                      {group.description}
                    </div>
                  )}
                  <div style={{ color: '#888', fontSize: '12px' }}>
                    Owners: {group.owners && group.owners.length > 0 ? group.owners.join(', ') : 'None'} • {group.visibility} • Created {new Date(group.created_at).toLocaleDateString()}
                  </div>
                </WiredCard>
              ))}
              {groups.length === 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No groups created yet. Create your first group above!
                </p>
              )}
            </div>
          </WiredCard>
        </div>
      </div>
    </div>
  )
}

export default GroupsPage