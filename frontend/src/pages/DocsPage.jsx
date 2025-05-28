import { useState, useEffect, useCallback } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import './PageLayout.css'

function DocsPage({ currentUser }) {
  const [documents, setDocuments] = useState([])
  const [newDoc, setNewDoc] = useState({ title: '', content: '' })

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3003/documents', {
        headers: {
          'X-Username': currentUser.username
        }
      })
      const data = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }, [currentUser])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const createDocument = async () => {
    if (!newDoc.title.trim()) return

    try {
      const response = await fetch('http://localhost:3003/documents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Username': currentUser.username
        },
        body: JSON.stringify({
          title: newDoc.title,
          content: newDoc.content
        })
      })
      const createdDoc = await response.json()
      setDocuments([...documents, createdDoc])
      setNewDoc({ title: '', content: '' })
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Docs Service - {currentUser.name}</h2>
      </div>
      
      <div className="page-content">
        <WiredCard className="form-section">
          <h3>Create Document</h3>
          <div className="form-row">
            <WiredInput 
              className="form-input"
              placeholder="Document title"
              value={newDoc.title}
              onChange={(e) => setNewDoc({...newDoc, title: e.target.value})}
            />
          </div>
          <div className="form-row">
            <WiredTextarea 
              className="form-input"
              placeholder="Document content..."
              value={newDoc.content}
              onChange={(e) => setNewDoc({...newDoc, content: e.target.value})}
              rows="6"
            />
          </div>
          <div className="form-row">
            <WiredButton onClick={createDocument}>Create Document</WiredButton>
          </div>
        </WiredCard>

        <div className="content-section">
          <WiredCard>
            <h3>Documents</h3>
            <div className="items-grid">
              {documents.map(doc => (
                <WiredCard key={doc.id} className="item-card">
                  <div><strong>Title:</strong> {doc.title}</div>
                  <div><strong>Owner:</strong> {doc.owner}</div>
                  <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                    Created: {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ marginTop: '10px', color: '#555', fontSize: '14px' }}>
                    {doc.content ? doc.content.substring(0, 150) + (doc.content.length > 150 ? '...' : '') : 'No content'}
                  </div>
                </WiredCard>
              ))}
              {documents.length === 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No documents created yet. Create your first document above!
                </p>
              )}
            </div>
          </WiredCard>
        </div>
      </div>
    </div>
  )
}

export default DocsPage