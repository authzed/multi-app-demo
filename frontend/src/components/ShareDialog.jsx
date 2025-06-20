import { useState, useEffect, useCallback } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredCombo, WiredItem } from 'wired-elements-react'
import { API_URLS } from '../config/api'
import './ShareDialog.css'

function ShareDialog({ isOpen, onClose, resourceType, resourceId, currentUser }) {
  const [shares, setShares] = useState([])
  const [originalShares, setOriginalShares] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false)
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [entitiesLoading, setEntitiesLoading] = useState(true)

  const fetchShares = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = resourceType === 'document' 
        ? `/documents/${resourceId}/shares`
        : `/folders/${resourceId}/shares`
      
      const response = await fetch(`${API_URLS.docs}${endpoint}`, {
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Ensure backward compatibility by setting default subjectType
        const sharesWithType = (data.shares || []).map(share => ({
          ...share,
          subjectType: share.subjectType || 'user'
        }))
        setShares(sharesWithType)
        setOriginalShares(sharesWithType)
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
  }, [resourceType, resourceId, currentUser.username, onClose])

  const fetchUsersAndGroups = useCallback(async () => {
    setEntitiesLoading(true)
    try {
      // Fetch users and groups in parallel
      const [usersResponse, groupsResponse] = await Promise.all([
        fetch(`${API_URLS.groups}/api/users`),
        fetch(`${API_URLS.groups}/api/groups`)
      ])

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData)
      } else {
        console.error('Failed to fetch users from groups service')
        setUsers([])
      }

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json()
        setGroups(groupsData)
      } else {
        console.error('Failed to fetch groups from groups service')
        setGroups([])
      }
    } catch (error) {
      console.error('Error fetching users and groups:', error)
      setUsers([])
      setGroups([])
    } finally {
      setEntitiesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && resourceType && resourceId) {
      fetchShares()
      fetchUsersAndGroups()
    }
  }, [isOpen, resourceType, resourceId, fetchShares, fetchUsersAndGroups])

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

  const getDisplayNameForShare = (share) => {
    if (share.subjectType === 'group') {
      // Find the group name from our fetched groups
      const group = groups.find(g => g.username === share.username)
      if (group) {
        return `${group.name} (${share.username}) - Group`
      }
      return `${share.username} - Group`
    } else {
      // Find the user name from our fetched users
      const user = users.find(u => u.username === share.username)
      if (user) {
        return `${user.name} (${share.username})`
      }
      return share.username
    }
  }

  const getAvailableEntities = () => {
    // Combine users and groups into a single list
    const allEntities = [
      ...users.map(user => ({
        id: user.username,
        name: user.name,
        type: 'user',
        displayName: `${user.name} (${user.username})`
      })),
      ...groups.map(group => ({
        id: group.username,
        name: group.name,
        type: 'group',
        displayName: `${group.name} (${group.username}) - Group`
      }))
    ]

    // Filter out entities that already have shares
    const sharedUsernames = shares.filter(share => !share.isDeleted).map(share => share.username)
    return allEntities.filter(entity => !sharedUsernames.includes(entity.id))
  }

  const addShare = () => {
    if (!newUsername || !newUsername.trim()) {
      alert('Please select a user or group')
      return
    }

    // Check if user is already shared with
    const existingShare = shares.find(share => share.username === newUsername.trim())
    if (existingShare) {
      alert('This user already has access. You can change their role by updating the existing share.')
      return
    }

    // Find the selected entity to get its type
    const selectedEntity = getAvailableEntities().find(entity => entity.id === newUsername.trim())
    const subjectType = selectedEntity ? selectedEntity.type : 'user'

    const newShare = {
      username: newUsername.trim(),
      role: newRole,
      subjectType: subjectType,
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

      // Helper function to determine subject type for existing shares
      const getSubjectTypeForUsername = (username) => {
        const allEntities = [
          ...users.map(user => ({ id: user.username, type: 'user' })),
          ...groups.map(group => ({ id: group.username, type: 'group' }))
        ]
        const entity = allEntities.find(e => e.id === username)
        return entity ? entity.type : 'user'
      }

      // Collect new shares
      shares.filter(share => share.isNew).forEach(share => {
        const shareRequest = {
          username: share.username,
          role: share.role,
          subjectType: share.subjectType || 'user'
        }
        // Add subject relation for groups
        if (share.subjectType === 'group') {
          shareRequest.subjectRelation = 'all_members'
        }
        toAdd.push(shareRequest)
      })

      // Collect deleted shares
      shares.filter(share => share.isDeleted).forEach(share => {
        const subjectType = getSubjectTypeForUsername(share.username)
        const shareRequest = {
          username: share.username,
          role: share.role,
          subjectType: subjectType
        }
        // Add subject relation for groups
        if (subjectType === 'group') {
          shareRequest.subjectRelation = 'all_members'
        }
        toRemove.push(shareRequest)
      })

      // Collect modified shares (remove old, add new)
      shares.filter(share => share.isModified).forEach(share => {
        const originalShare = originalShares.find(orig => orig.username === share.username)
        if (originalShare) {
          const originalSubjectType = getSubjectTypeForUsername(originalShare.username)
          const originalShareRequest = {
            username: originalShare.username,
            role: originalShare.role,
            subjectType: originalSubjectType
          }
          if (originalSubjectType === 'group') {
            originalShareRequest.subjectRelation = 'all_members'
          }
          toRemove.push(originalShareRequest)

          const newSubjectType = getSubjectTypeForUsername(share.username)
          const newShareRequest = {
            username: share.username,
            role: share.role,
            subjectType: newSubjectType
          }
          if (newSubjectType === 'group') {
            newShareRequest.subjectRelation = 'all_members'
          }
          toAdd.push(newShareRequest)
        }
      })

      const response = await fetch(`${API_URLS.docs}/shares`, {
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

  const generatePermalink = () => {
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin
    if (resourceType === 'document') {
      return `${baseUrl}/docs/document/${resourceId}`
    } else {
      return `${baseUrl}/docs/folder/${resourceId}`
    }
  }

  const copyLink = async () => {
    try {
      const permalink = generatePermalink()
      await navigator.clipboard.writeText(permalink)
      setCopyLinkSuccess(true)
      setTimeout(() => setCopyLinkSuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
      alert('Failed to copy link to clipboard')
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
                          <span className="username">{getDisplayNameForShare(share)}</span>
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
                {entitiesLoading ? (
                  <div className="loading-state">Loading users and groups...</div>
                ) : (
                  <div className="add-share-form">
                    <WiredCombo
                      selected={newUsername}
                      onselected={(e) => setNewUsername(e.detail.selected)}
                      disabled={saving}
                      className="username-input"
                    >
                      <WiredItem value="" text="Select user or group">
                        Select user or group
                      </WiredItem>
                      {getAvailableEntities().map(entity => (
                        <WiredItem key={entity.id} value={entity.id}>
                          {entity.displayName}
                        </WiredItem>
                      ))}
                    </WiredCombo>
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
                      disabled={saving || !newUsername}
                      style={{ backgroundColor: '#2ecc71', color: 'white' }}
                    >
                      Add
                    </WiredButton>
                  </div>
                )}
              </div>

              <div className="dialog-actions">
                <WiredButton
                  onClick={copyLink}
                  disabled={saving}
                  style={{ 
                    backgroundColor: copyLinkSuccess ? '#2ecc71' : '#9b59b6', 
                    color: 'white',
                    marginRight: 'auto'
                  }}
                >
                  {copyLinkSuccess ? '✓ Copied!' : 'Copy Link'}
                </WiredButton>
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