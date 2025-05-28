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
  const parentFolderId = folderData?.parentFolderId

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
                if (parentFolderId) {
                  navigate(`/docs/folder/${parentFolderId}`)
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

        {/* Unified Files and Folders Table */}
        <div className="full-width-section">
          <WiredCard className="content-section">
            <h3>📂 Contents ({subFolders.length + documents.length})</h3>
            {(subFolders.length > 0 || documents.length > 0) ? (
              <div style={{ overflowX: 'auto' }}>
                <style>
                  {`
                    .folder-table tr:hover {
                      background-color: #4a4a4a !important;
                    }
                  `}
                </style>
                <table className="folder-table" style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  marginTop: '15px'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #333' }}>
                      <th style={{ 
                        textAlign: 'left', 
                        padding: '12px 8px', 
                        fontWeight: 'bold',
                        width: '40%'
                      }}>
                        Name
                      </th>
                      <th style={{ 
                        textAlign: 'left', 
                        padding: '12px 8px', 
                        fontWeight: 'bold',
                        width: '15%'
                      }}>
                        Type
                      </th>
                      <th style={{ 
                        textAlign: 'left', 
                        padding: '12px 8px', 
                        fontWeight: 'bold',
                        width: '20%'
                      }}>
                        Owner
                      </th>
                      <th style={{ 
                        textAlign: 'left', 
                        padding: '12px 8px', 
                        fontWeight: 'bold',
                        width: '20%'
                      }}>
                        Created
                      </th>
                      <th style={{ 
                        textAlign: 'center', 
                        padding: '12px 8px', 
                        fontWeight: 'bold',
                        width: '5%'
                      }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Folders first */}
                    {subFolders.map(folder => (
                      <tr 
                        key={`folder-${folder.id}`}
                        style={{ 
                          borderBottom: '1px solid #eee',
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate(`/docs/folder/${folder.id}`)}
                      >
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>📁</span>
                            <strong style={{ color: '#007bff' }}>{folder.name}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>
                          Folder
                        </td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>
                          {folder.owner}
                        </td>
                        <td style={{ padding: '12px 8px', color: '#888', fontSize: '14px' }}>
                          {new Date(folder.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {folder.owner === currentUser.username && (
                            <WiredButton 
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteFolder(folder.id, folder.name)
                              }}
                              style={{ 
                                fontSize: '11px', 
                                padding: '4px 8px',
                                backgroundColor: '#e74c3c',
                                color: 'white'
                              }}
                            >
                              Delete
                            </WiredButton>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Documents after folders */}
                    {documents.map(doc => (
                      <tr 
                        key={`doc-${doc.id}`}
                        style={{ borderBottom: '1px solid #eee' }}
                      >
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>📄</span>
                            <span 
                              style={{ 
                                color: '#007bff', 
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={() => navigate(`/docs/document/${doc.id}`)}
                            >
                              {doc.title}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>
                          Document
                        </td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>
                          {doc.owner}
                        </td>
                        <td style={{ padding: '12px 8px', color: '#888', fontSize: '14px' }}>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {doc.owner === currentUser.username && (
                            <WiredButton 
                              onClick={() => deleteDocument(doc.id, doc.title)}
                              style={{ 
                                fontSize: '11px', 
                                padding: '4px 8px',
                                backgroundColor: '#e74c3c',
                                color: 'white'
                              }}
                            >
                              Delete
                            </WiredButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#666', textAlign: 'center', padding: '40px 20px' }}>
                This folder is empty. Create your first document or folder above!
              </p>
            )}
          </WiredCard>
        </div>
      </div>
    </div>
  )
}

export default FolderDetailPage