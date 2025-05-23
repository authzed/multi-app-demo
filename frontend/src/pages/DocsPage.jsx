import { useState, useEffect } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'

function DocsPage() {
  const [documents, setDocuments] = useState([])
  const [newDoc, setNewDoc] = useState({ title: '', content: '', owner: '' })

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:3003/documents')
      const data = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const createDocument = async () => {
    if (!newDoc.title.trim() || !newDoc.owner.trim()) return

    try {
      const response = await fetch('http://localhost:3003/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      })
      const createdDoc = await response.json()
      setDocuments([...documents, createdDoc])
      setNewDoc({ title: '', content: '', owner: '' })
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }

  return (
    <div style={{ margin: '20px' }}>
      <WiredCard>
        <h2>Docs Service</h2>
        
        <WiredCard style={{ marginBottom: '20px' }}>
          <h3>Create Document</h3>
          <div style={{ marginBottom: '10px' }}>
            <WiredInput 
              placeholder="Title"
              value={newDoc.title}
              onChange={(e) => setNewDoc({...newDoc, title: e.target.value})}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <WiredInput 
              placeholder="Owner"
              value={newDoc.owner}
              onChange={(e) => setNewDoc({...newDoc, owner: e.target.value})}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <WiredTextarea 
              placeholder="Content"
              value={newDoc.content}
              onChange={(e) => setNewDoc({...newDoc, content: e.target.value})}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <WiredButton onClick={createDocument}>Create Document</WiredButton>
          </div>
        </WiredCard>

        <WiredCard>
          <h3>Documents</h3>
          {documents.map(doc => (
            <WiredCard key={doc.id} style={{ margin: '10px 0' }}>
              <div><strong>Title:</strong> {doc.title}</div>
              <div><strong>Owner:</strong> {doc.owner}</div>
              <div><strong>Content:</strong> {doc.content}</div>
            </WiredCard>
          ))}
        </WiredCard>
      </WiredCard>
    </div>
  )
}

export default DocsPage