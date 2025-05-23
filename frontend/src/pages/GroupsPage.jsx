import { useState, useEffect } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import './PageLayout.css'

function GroupsPage({ currentUser }) {
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    email: ''
  })

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:3001/groups')
      const data = await response.json()
      setGroups(data)
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const createGroup = async () => {
    if (!newGroup.name.trim()) return

    // Generate default email if not provided
    const emailToUse = newGroup.email.trim() || 
      `${newGroup.name.toLowerCase().replace(/\s+/g, '-')}@company.com`

    try {
      const response = await fetch('http://localhost:3001/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newGroup.name,
          description: newGroup.description || `A group for ${newGroup.name} discussions`,
          email: emailToUse,
          visibility: 'PUBLIC',
          owner_username: currentUser.username
        })
      })
      const createdGroup = await response.json()
      setGroups([createdGroup, ...groups])
      setNewGroup({ name: '', description: '', email: '' })
    } catch (error) {
      console.error('Error creating group:', error)
    }
  }

  const deleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/groups/${groupId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setGroups(groups.filter(group => group.id !== groupId))
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
                placeholder="Group email (optional, will auto-generate if empty)"
                value={newGroup.email}
                onChange={(e) => setNewGroup({...newGroup, email: e.target.value})}
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
                <WiredCard key={group.id} className="item-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div><strong>{group.name}</strong></div>
                    <WiredButton 
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px', 
                        background: '#ff4444',
                        color: 'white'
                      }}
                      onClick={() => deleteGroup(group.id, group.name)}
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