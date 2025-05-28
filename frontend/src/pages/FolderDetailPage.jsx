import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import './PageLayout.css'

function FolderDetailPage({ currentUser }) {
  const { folderId } = useParams()
  const navigate = useNavigate()
  const [folderData, setFolderData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNewDocForm, setShowNewDocForm] = useState(false)
  const [showNewFolderForm, setShowNewFolderForm] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContent, setNewDocContent] = useState('')
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    fetchFolderContents()
  }, [folderId, currentUser])

  const fetchFolderContents = async () => {
    try {
      setLoading(true)
      const url = folderId ? 
        `http://localhost:3003/folders/${folderId}` : 
        'http://localhost:3003/folders/root'
      
      const response = await fetch(url, {
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        const data = await response.json()
        setFolderData(data)
      } else if (response.status === 404) {
        setError('Folder not found')
      } else {
        setError('Failed to load folder')
      }
    } catch (error) {
      console.error('Error fetching folder contents:', error)
      setError('Failed to load folder')
    } finally {
      setLoading(false)
    }
  }

  const createDocument = async () => {
    if (!newDocTitle.trim()) return

    try {
      const response = await fetch('http://localhost:3003/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser.username
        },
        body: JSON.stringify({
          title: newDocTitle,
          content: newDocContent,
          folderId: folderData?.folder?.id
        })
      })

      if (response.ok) {
        setNewDocTitle('')
        setNewDocContent('')
        setShowNewDocForm(false)
        fetchFolderContents()
      } else {
        alert('Failed to create document')
      }
    } catch (error) {
      console.error('Error creating document:', error)
      alert('Failed to create document')
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const response = await fetch('http://localhost:3003/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser.username
        },
        body: JSON.stringify({
          name: newFolderName,
          parentFolderId: folderData?.folder?.id
        })
      })

      if (response.ok) {
        setNewFolderName('')
        setShowNewFolderForm(false)
        fetchFolderContents()
      } else {
        alert('Failed to create folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
      alert('Failed to create folder')
    }
  }

  const deleteDocument = async (docId, docTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${docTitle}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3003/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        fetchFolderContents()
      } else {
        alert('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document')
    }
  }

  const deleteFolder = async (folderId, folderName) => {
    if (!window.confirm(`Are you sure you want to delete "${folderName}" and all its contents?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3003/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        fetchFolderContents()
      } else {
        alert('Failed to delete folder')
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
      alert('Failed to delete folder')
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
          <WiredButton onClick={() => navigate('/docs')}>
            Back to Docs
          </WiredButton>
        </div>
      </div>
    )
  }

  const currentFolder = folderData?.folder
  const subFolders = folderData?.subFolders || []
  const documents = folderData?.documents || []

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>📁 {currentFolder?.name || 'Documents'}</h2>
            {currentFolder && !currentFolder.isRoot && (
              <p style={{ color: '#666', margin: '5px 0' }}>
                Owner: {currentFolder.owner}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {currentFolder && !currentFolder.isRoot && (
              <WiredButton onClick={() => {
                if (currentFolder.parentFolder) {
                  navigate(`/docs/folder/${currentFolder.parentFolder.id}`)
                } else {
                  navigate('/docs')
                }
              }}>
                ↑ Up
              </WiredButton>
            )}
            <WiredButton 
              onClick={() => setShowNewFolderForm(!showNewFolderForm)}
              style={{ backgroundColor: '#3498db', color: 'white' }}
            >
              + New Folder
            </WiredButton>
            <WiredButton 
              onClick={() => setShowNewDocForm(!showNewDocForm)}
              style={{ backgroundColor: '#2ecc71', color: 'white' }}
            >
              + New Document
            </WiredButton>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* New Folder Form */}
        {showNewFolderForm && (
          <div className="full-width-section">
            <WiredCard className="form-section">
              <h3>Create New Folder</h3>
              <div className="form-row">
                <WiredInput
                  className="form-input"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
                <WiredButton onClick={createFolder}>Create Folder</WiredButton>
                <WiredButton 
                  onClick={() => {
                    setShowNewFolderForm(false)
                    setNewFolderName('')
                  }}
                  style={{ backgroundColor: '#666', color: 'white' }}
                >
                  Cancel
                </WiredButton>
              </div>
            </WiredCard>
          </div>
        )}

        {/* New Document Form */}
        {showNewDocForm && (
          <div className="full-width-section">
            <WiredCard className="form-section">
              <h3>Create New Document</h3>
              <div className="form-row">
                <WiredInput
                  className="form-input"
                  placeholder="Document title"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                />
              </div>
              <div className="form-row">
                <WiredTextarea
                  className="form-input"
                  placeholder="Document content..."
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  rows="4"
                />
              </div>
              <div className="form-row">
                <WiredButton onClick={createDocument}>Create Document</WiredButton>
                <WiredButton 
                  onClick={() => {
                    setShowNewDocForm(false)
                    setNewDocTitle('')
                    setNewDocContent('')
                  }}
                  style={{ backgroundColor: '#666', color: 'white' }}
                >
                  Cancel
                </WiredButton>
              </div>
            </WiredCard>
          </div>
        )}

        {/* Folders Section */}
        {subFolders.length > 0 && (
          <div className="full-width-section">
            <WiredCard className="content-section">
              <h3>📁 Folders ({subFolders.length})</h3>
              <div className="items-grid">
                {subFolders.map(folder => (
                  <WiredCard 
                    key={folder.id} 
                    className="item-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/docs/folder/${folder.id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>📁</span>
                          <strong>{folder.name}</strong>
                        </div>
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                          Owner: {folder.owner}
                        </div>
                        <div style={{ color: '#888', fontSize: '12px' }}>
                          Created: {new Date(folder.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {folder.owner === currentUser.username && (
                        <WiredButton 
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteFolder(folder.id, folder.name)
                          }}
                          style={{ 
                            fontSize: '12px', 
                            padding: '4px 8px',
                            backgroundColor: '#e74c3c',
                            color: 'white'
                          }}
                        >
                          Delete
                        </WiredButton>
                      )}
                    </div>
                    <div style={{ 
                      marginTop: '10px', 
                      padding: '5px 0', 
                      borderTop: '1px solid #eee', 
                      fontSize: '12px', 
                      color: '#007bff' 
                    }}>
                      Click to open →
                    </div>
                  </WiredCard>
                ))}
              </div>
            </WiredCard>
          </div>
        )}

        {/* Documents Section */}
        <div className="full-width-section">
          <WiredCard className="content-section">
            <h3>📄 Documents ({documents.length})</h3>
            <div className="items-grid">
              {documents.map(doc => (
                <WiredCard key={doc.id} className="item-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📄</span>
                        <strong>{doc.title}</strong>
                      </div>
                      <div style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                        Owner: {doc.owner}
                      </div>
                      <div style={{ color: '#888', fontSize: '12px' }}>
                        Created: {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ marginTop: '10px', color: '#555', fontSize: '14px' }}>
                        {doc.content ? doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '') : 'No content'}
                      </div>
                    </div>
                    {doc.owner === currentUser.username && (
                      <WiredButton 
                        onClick={() => deleteDocument(doc.id, doc.title)}
                        style={{ 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          backgroundColor: '#e74c3c',
                          color: 'white'
                        }}
                      >
                        Delete
                      </WiredButton>
                    )}
                  </div>
                </WiredCard>
              ))}
              {documents.length === 0 && subFolders.length === 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  This folder is empty. Create your first document or folder above!
                </p>
              )}
              {documents.length === 0 && subFolders.length > 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No documents in this folder yet. Create a new document above!
                </p>
              )}
            </div>
          </WiredCard>
        </div>
      </div>
    </div>
  )
}

export default FolderDetailPage