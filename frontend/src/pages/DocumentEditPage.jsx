import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import ShareDialog from '../components/ShareDialog'
import './PageLayout.css'

function DocumentEditPage({ currentUser }) {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState(null)
  const [originalDocument, setOriginalDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [shareDialog, setShareDialog] = useState({ isOpen: false })

  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:3003/documents/${documentId}`, {
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        const docData = await response.json()
        setDocument(docData)
        setOriginalDocument(docData)
        setTitle(docData.title)
        setContent(docData.content || '')
      } else if (response.status === 404) {
        setError('Document not found')
      } else if (response.status === 403) {
        setError('Permission denied - You do not have access to this document')
      } else {
        setError('Failed to load document')
      }
    } catch (error) {
      console.error('Error fetching document:', error)
      setError('Failed to load document')
    } finally {
      setLoading(false)
    }
  }, [documentId, currentUser])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const hasChanges = () => {
    if (!originalDocument) return false
    return title !== originalDocument.title || content !== (originalDocument.content || '')
  }

  const saveDocument = async () => {
    if (!hasChanges()) return

    try {
      setSaving(true)
      const response = await fetch(`http://localhost:3003/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser.username
        },
        body: JSON.stringify({
          title: title,
          content: content
        })
      })

      if (response.ok) {
        const updatedDoc = await response.json()
        setDocument(updatedDoc)
        setOriginalDocument(updatedDoc)
        alert('Document saved successfully!')
      } else {
        alert('Failed to save document')
      }
    } catch (error) {
      console.error('Error saving document:', error)
      alert('Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  const deleteDocument = async () => {
    if (!window.confirm(`Are you sure you want to delete "${document.title}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3003/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'X-Username': currentUser.username
        }
      })

      if (response.ok) {
        // Navigate back to the folder containing this document
        if (document.folder) {
          if (document.folder.id && !document.folder.isRoot) {
            navigate(`/docs/folder/${document.folder.id}`)
          } else {
            navigate('/docs')
          }
        } else {
          navigate('/docs')
        }
      } else {
        alert('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document')
    }
  }

  const goBackToFolder = () => {
    if (document && document.folder) {
      if (document.folder.id && !document.folder.isRoot) {
        navigate(`/docs/folder/${document.folder.id}`)
      } else {
        // Navigate to root folder view
        navigate('/docs')
      }
    } else {
      // No folder information, go to root
      navigate('/docs')
    }
  }

  const openShareDialog = () => {
    setShareDialog({ isOpen: true })
  }

  const closeShareDialog = () => {
    setShareDialog({ isOpen: false })
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Loading document...</h2>
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>📄 Edit Document</h2>
            <p style={{ color: '#666', margin: '5px 0' }}>
              Owner: {document.owners && document.owners.length > 0 ? document.owners.join(', ') : 'No owners'}
            </p>
            <p style={{ color: '#888', margin: '5px 0', fontSize: '14px' }}>
              Created: {new Date(document.createdAt).toLocaleDateString()}
              {document.updatedAt !== document.createdAt && (
                <span> • Updated: {new Date(document.updatedAt).toLocaleDateString()}</span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <WiredButton onClick={goBackToFolder}>
              ← Back to Folder
            </WiredButton>
            <WiredButton 
              onClick={saveDocument}
              disabled={!hasChanges() || saving}
              style={{ 
                backgroundColor: hasChanges() ? '#2ecc71' : '#95a5a6', 
                color: 'white' 
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </WiredButton>
            <WiredButton 
              onClick={openShareDialog}
              style={{ 
                backgroundColor: '#3498db',
                color: 'white'
              }}
            >
              Share
            </WiredButton>
            {document.owners && document.owners.includes(currentUser.username) && (
              <WiredButton 
                onClick={deleteDocument}
                style={{ 
                  backgroundColor: '#e74c3c',
                  color: 'white'
                }}
              >
                Delete
              </WiredButton>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="full-width-section">
          <WiredCard className="content-section">
            <h3>Document Details</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Title
              </label>
              <WiredInput
                style={{ width: '100%' }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Content
              </label>
              <WiredTextarea
                style={{ width: '100%', minHeight: '400px' }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your document content here..."
                rows="20"
              />
            </div>

            {hasChanges() && (
              <div style={{ 
                marginTop: '20px', 
                padding: '10px', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                color: '#856404'
              }}>
                ⚠️ You have unsaved changes
              </div>
            )}
          </WiredCard>
        </div>
      </div>
      
      <ShareDialog
        isOpen={shareDialog.isOpen}
        onClose={closeShareDialog}
        resourceType="document"
        resourceId={documentId}
        currentUser={currentUser}
      />
    </div>
  )
}

export default DocumentEditPage