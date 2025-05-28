import { useState, useEffect } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredCombo, WiredItem } from 'wired-elements-react'
import './ShareDialog.css'

function ShareDialog({ isOpen, onClose, resourceType, resourceId, currentUser }) {
  const [shares, setShares] = useState([])
  const [originalShares, setOriginalShares] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState('viewer')

  useEffect(() => {
    if (isOpen && resourceType && resourceId) {
      fetchShares()
    }
  }, [isOpen, resourceType, resourceId])

  const fetchShares = async () => {
    setLoading(true)
    try {
      const endpoint = resourceType === 'document' 
        ? `/documents/${resourceId}/shares`
        : `/folders/${resourceId}/shares`
      
      const response = await fetch(`http://localhost:3003${endpoint}`, {
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        const data = await response.json()
        setShares(data.shares || [])
        setOriginalShares(data.shares || [])
      } else if (response.status === 403) {
        alert('You do not have permission to manage sharing for this item')
        onClose()
      } else {
        alert('Failed to load sharing information')
        onClose()
      }
    } catch (error) {
      console.error('Error fetching shares:', error)
      alert('Failed to load sharing information')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const getRoleDisplayName = (role) => {
    if (resourceType === 'document') {
      switch (role) {
        case 'reader': return 'Viewer'
        case 'editor': return 'Editor'
        case 'owner': return 'Owner'
        default: return role
      }
    } else {
      switch (role) {
        case 'viewer': return 'Viewer'
        case 'editor': return 'Editor'
        case 'owner': return 'Owner'
        default: return role
      }
    }
  }

  const getRoleOptions = () => {
    if (resourceType === 'document') {
      return [
        { value: 'reader', label: 'Viewer - Can view document' },
        { value: 'editor', label: 'Editor - Can view and edit document' },
        { value: 'owner', label: 'Owner - Can view, edit, and delete document' }
      ]
    } else {
      return [
        { value: 'viewer', label: 'Viewer - Can view folder and contents' },
        { value: 'editor', label: 'Editor - Can view and manage contents' },
        { value: 'owner', label: 'Owner - Can do everything including delete folder' }
      ]
    }
  }

  const addShare = () => {
    if (!newUsername.trim()) {
      alert('Please enter a username')
      return
    }

    // Check if user is already shared with
    const existingShare = shares.find(share => share.username === newUsername.trim())
    if (existingShare) {
      alert('This user already has access. You can change their role by updating the existing share.')
      return
    }

    const newShare = {
      username: newUsername.trim(),
      role: newRole,
      isNew: true
    }

    setShares([...shares, newShare])
    setNewUsername('')
    setNewRole('viewer')
  }

  const removeShare = (index) => {
    const shareToRemove = shares[index]
    const updatedShares = shares.filter((_, i) => i !== index)
    
    // Mark as deleted if it was an original share
    if (!shareToRemove.isNew) {
      shareToRemove.isDeleted = true
      updatedShares.push(shareToRemove)
    }
    
    setShares(updatedShares)
  }

  const updateShareRole = (index, newRole) => {
    const updatedShares = [...shares]
    updatedShares[index] = { ...updatedShares[index], role: newRole, isModified: true }
    setShares(updatedShares)
  }

  const hasChanges = () => {
    // Check for new shares
    const newShares = shares.filter(share => share.isNew)
    if (newShares.length > 0) return true

    // Check for deleted shares
    const deletedShares = shares.filter(share => share.isDeleted)
    if (deletedShares.length > 0) return true

    // Check for modified shares
    const modifiedShares = shares.filter(share => share.isModified)
    if (modifiedShares.length > 0) return true

    return false
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const toAdd = []
      const toRemove = []

      // Collect new shares
      shares.filter(share => share.isNew).forEach(share => {
        toAdd.push({
          username: share.username,
          role: share.role
        })
      })

      // Collect deleted shares
      shares.filter(share => share.isDeleted).forEach(share => {
        toRemove.push({
          username: share.username,
          role: share.role
        })
      })

      // Collect modified shares (remove old, add new)
      shares.filter(share => share.isModified).forEach(share => {
        const originalShare = originalShares.find(orig => orig.username === share.username)
        if (originalShare) {
          toRemove.push({
            username: originalShare.username,
            role: originalShare.role
          })
          toAdd.push({
            username: share.username,
            role: share.role
          })
        }
      })

      const response = await fetch('http://localhost:3003/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser.username
        },
        body: JSON.stringify({
          resourceType,
          resourceId,
          toAdd,
          toRemove
        })
      })

      if (response.ok) {
        alert('Sharing settings saved successfully!')
        onClose()
      } else if (response.status === 403) {
        alert('You do not have permission to manage sharing for this item')
      } else {
        alert('Failed to save sharing settings')
      }
    } catch (error) {
      console.error('Error saving shares:', error)
      alert('Failed to save sharing settings')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const visibleShares = shares.filter(share => !share.isDeleted)

  return (
    <div className="share-dialog-overlay">
      <div className="share-dialog">
        <WiredCard className="share-dialog-content">
          <div className="share-dialog-header">
            <h3>Share {resourceType === 'document' ? 'Document' : 'Folder'}</h3>
            <button className="close-button" onClick={onClose} disabled={saving}>
              ×
            </button>
          </div>

          {loading ? (
            <div className="loading-state">Loading sharing information...</div>
          ) : (
            <>
              <div className="share-section">
                <h4>Current Shares</h4>
                {visibleShares.length === 0 ? (
                  <p className="no-shares">No one else has access to this {resourceType}</p>
                ) : (
                  <div className="shares-list">
                    {visibleShares.map((share, index) => (
                      <div key={`${share.username}-${index}`} className="share-item">
                        <div className="share-info">
                          <span className="username">{share.username}</span>
                          <WiredCombo
                            selected={share.role}
                            onselected={(e) => updateShareRole(index, e.detail.selected)}
                            disabled={saving}
                            className="role-select"
                          >
                            {getRoleOptions().map(option => (
                              <WiredItem key={option.value} value={option.value}>
                                {getRoleDisplayName(option.value)}
                              </WiredItem>
                            ))}
                          </WiredCombo>
                        </div>
                        <WiredButton
                          onClick={() => removeShare(index)}
                          disabled={saving}
                          style={{ backgroundColor: '#e74c3c', color: 'white', fontSize: '12px' }}
                        >
                          Remove
                        </WiredButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="add-share-section">
                <h4>Add New Share</h4>
                <div className="add-share-form">
                  <WiredInput
                    placeholder="Enter username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={saving}
                    className="username-input"
                  />
                  <WiredCombo
                    selected={newRole}
                    onselected={(e) => setNewRole(e.detail.selected)}
                    disabled={saving}
                    className="role-select"
                  >
                    {getRoleOptions().map(option => (
                      <WiredItem key={option.value} value={option.value}>
                        {getRoleDisplayName(option.value)}
                      </WiredItem>
                    ))}
                  </WiredCombo>
                  <WiredButton
                    onClick={addShare}
                    disabled={saving}
                    style={{ backgroundColor: '#2ecc71', color: 'white' }}
                  >
                    Add
                  </WiredButton>
                </div>
              </div>

              <div className="dialog-actions">
                <WiredButton
                  onClick={onClose}
                  disabled={saving}
                  style={{ backgroundColor: '#95a5a6', color: 'white' }}
                >
                  Cancel
                </WiredButton>
                <WiredButton
                  onClick={saveChanges}
                  disabled={!hasChanges() || saving}
                  style={{
                    backgroundColor: hasChanges() ? '#3498db' : '#bdc3c7',
                    color: 'white'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </WiredButton>
              </div>

              {hasChanges() && (
                <div className="changes-indicator">
                  ⚠️ You have unsaved changes
                </div>
              )}
            </>
          )}
        </WiredCard>
      </div>
    </div>
  )
}

export default ShareDialog