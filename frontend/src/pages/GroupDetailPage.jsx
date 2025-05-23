import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { WiredCard, WiredButton, WiredInput, WiredCombo } from 'wired-elements-react'
import './PageLayout.css'

function GroupDetailPage({ currentUser }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('MEMBER')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchGroupDetails()
    fetchGroupMembers()
  }, [id])

  const fetchGroupDetails = async () => {
    try {
      const response = await fetch('http://localhost:3001/groups')
      const groups = await response.json()
      const groupDetail = groups.find(g => g.id === parseInt(id))
      
      if (groupDetail) {
        setGroup(groupDetail)
      } else {
        setError('Group not found')
      }
    } catch (error) {
      console.error('Error fetching group details:', error)
      setError('Failed to fetch group details')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroupMembers = async () => {
    try {
      const response = await fetch(`http://localhost:3001/groups/${id}/members`)
      const data = await response.json()
      setMembers(data)
    } catch (error) {
      console.error('Error fetching group members:', error)
    }
  }

  const addMember = async () => {
    if (!newMemberUsername.trim()) return

    try {
      const response = await fetch(`http://localhost:3001/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newMemberUsername,
          role: newMemberRole
        })
      })

      if (response.ok) {
        await fetchGroupMembers()
        setNewMemberUsername('')
        setNewMemberRole('MEMBER')
        
        // If we're adding an owner, refresh group details to update owners list
        if (newMemberRole === 'OWNER') {
          await fetchGroupDetails()
        }
      } else {
        const error = await response.json()
        alert(`Failed to add member: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Failed to add member. Please try again.')
    }
  }

  const removeMember = async (username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from the group?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/groups/${id}/members/${username}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchGroupMembers()
        await fetchGroupDetails() // Refresh to update owners list
      } else {
        const error = await response.json()
        alert(`Failed to remove member: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Failed to remove member. Please try again.')
    }
  }

  const deleteGroup = async () => {
    if (!window.confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/groups/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        navigate('/groups')
      } else {
        const error = await response.json()
        alert(`Failed to delete group: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Failed to delete group. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Error: {error}</h2>
          <WiredButton onClick={() => navigate('/groups')}>
            Back to Groups
          </WiredButton>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>{group.name}</h2>
            <p style={{ color: '#666', margin: '5px 0' }}>{group.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <WiredButton onClick={() => navigate('/groups')}>
              Back to Groups
            </WiredButton>
            <WiredButton 
              onClick={deleteGroup}
              style={{ background: '#ff4444', color: 'white' }}
            >
              Delete Group
            </WiredButton>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Group Info Section */}
        <div className="full-width-section">
          <WiredCard className="content-section">
            <h3>Group Information</h3>
            <div style={{ marginBottom: '15px' }}>
              <strong>Description:</strong> {group.description || 'No description provided'}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Visibility:</strong> {group.visibility}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Owners:</strong> {group.owners && group.owners.length > 0 ? group.owners.join(', ') : 'None'}
            </div>
            <div>
              <strong>Created:</strong> {new Date(group.created_at).toLocaleDateString()}
            </div>
          </WiredCard>
        </div>

        {/* Add Member Section */}
        <div className="full-width-section">
          <WiredCard className="form-section">
            <h3>Add Member</h3>
            <div className="form-row">
              <WiredInput 
                className="form-input"
                placeholder="Username"
                value={newMemberUsername}
                onChange={(e) => setNewMemberUsername(e.target.value)}
              />
              <WiredCombo 
                selected={newMemberRole}
                onChange={(e) => setNewMemberRole(e.detail.selected)}
              >
                <wired-item value="MEMBER" >Member</wired-item>
                <wired-item value="MANAGER" >Manager</wired-item>
                <wired-item value="OWNER" >Owner</wired-item>
              </WiredCombo>
              <WiredButton onClick={addMember}>Add Member</WiredButton>
            </div>
          </WiredCard>
        </div>

        {/* Members List Section */}
        <div className="full-width-section">
          <WiredCard className="content-section">
            <h3>Members ({members.length})</h3>
            <div className="items-grid">
              {members.map(member => (
                <WiredCard key={member.username} className="item-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div><strong>{member.username}</strong></div>
                      <div style={{ color: '#666', fontSize: '14px' }}>
                        Role: {member.role}
                      </div>
                    </div>
                    <WiredButton 
                      onClick={() => removeMember(member.username)}
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        background: '#ff4444',
                        color: 'white'
                      }}
                    >
                      Remove
                    </WiredButton>
                  </div>
                </WiredCard>
              ))}
              {members.length === 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No members in this group yet.
                </p>
              )}
            </div>
          </WiredCard>
        </div>
      </div>
    </div>
  )
}

export default GroupDetailPage