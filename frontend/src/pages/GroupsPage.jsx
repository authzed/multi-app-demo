import { useState, useEffect } from 'react'
import { WiredCard, WiredButton, WiredInput } from 'wired-elements-react'
import './PageLayout.css'

function GroupsPage({ currentUser }) {
  const [groups, setGroups] = useState([])
  const [newGroupName, setNewGroupName] = useState('')

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
    if (!newGroupName.trim()) return

    try {
      const response = await fetch('http://localhost:3001/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName })
      })
      const newGroup = await response.json()
      setGroups([...groups, newGroup])
      setNewGroupName('')
    } catch (error) {
      console.error('Error creating group:', error)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Groups Service - {currentUser.name}</h2>
      </div>
      
      <div className="page-content">
        <WiredCard className="form-section">
          <h3>Create New Group</h3>
          <div className="form-row">
            <WiredInput 
              className="form-input"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <WiredButton onClick={createGroup}>Create Group</WiredButton>
          </div>
        </WiredCard>

        <div className="content-section">
          <WiredCard>
            <h3>Existing Groups</h3>
            <div className="items-grid">
              {groups.map(group => (
                <WiredCard key={group.id} className="item-card">
                  <div><strong>{group.name}</strong></div>
                  <div style={{ color: '#666', fontSize: '14px' }}>ID: {group.id}</div>
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