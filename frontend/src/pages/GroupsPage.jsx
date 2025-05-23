import { useState, useEffect } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredListbox } from 'wired-elements-react'

function GroupsPage() {
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
    <div style={{ margin: '20px' }}>
      <WiredCard>
        <h2>Groups Service</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <WiredInput 
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={{ marginRight: '10px' }}
          />
          <WiredButton onClick={createGroup}>Create Group</WiredButton>
        </div>

        <WiredCard>
          <h3>Existing Groups</h3>
          {groups.map(group => (
            <div key={group.id} style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
              <strong>{group.name}</strong> (ID: {group.id})
            </div>
          ))}
        </WiredCard>
      </WiredCard>
    </div>
  )
}

export default GroupsPage