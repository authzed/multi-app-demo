import { useState, useEffect, useCallback } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import './PageLayout.css'

function MailPage({ currentUser }) {
  const [emails, setEmails] = useState([])
  const [newEmail, setNewEmail] = useState({ subject: '', from: '', body: '' })

  const fetchEmails = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3002/emails')
      const data = await response.json()
      setEmails(data)
    } catch (error) {
      console.error('Error fetching emails:', error)
    }
  }, [])

  useEffect(() => {
    fetchEmails()
    setNewEmail(prevEmail => ({ ...prevEmail, from: currentUser.username + '@company.com' }))
  }, [currentUser, fetchEmails])

  const sendEmail = async () => {
    if (!newEmail.subject.trim() || !newEmail.from.trim()) return

    try {
      const response = await fetch('http://localhost:3002/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmail)
      })
      const createdEmail = await response.json()
      setEmails([...emails, createdEmail])
      setNewEmail({ subject: '', from: currentUser.username + '@company.com', body: '' })
    } catch (error) {
      console.error('Error sending email:', error)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Mail Service - {currentUser.name}</h2>
      </div>
      
      <div className="page-content">
        <WiredCard className="form-section">
          <h3>Compose Email</h3>
          <div className="form-row">
            <WiredInput 
              className="form-input"
              placeholder="From"
              value={newEmail.from}
              onChange={(e) => setNewEmail({...newEmail, from: e.target.value})}
            />
          </div>
          <div className="form-row">
            <WiredInput 
              className="form-input"
              placeholder="Subject"
              value={newEmail.subject}
              onChange={(e) => setNewEmail({...newEmail, subject: e.target.value})}
            />
          </div>
          <div className="form-row">
            <WiredTextarea 
              className="form-input"
              placeholder="Email body..."
              value={newEmail.body}
              onChange={(e) => setNewEmail({...newEmail, body: e.target.value})}
              rows="4"
            />
          </div>
          <div className="form-row">
            <WiredButton onClick={sendEmail}>Send Email</WiredButton>
          </div>
        </WiredCard>

        <div className="content-section">
          <WiredCard>
            <h3>Inbox</h3>
            <div className="items-grid">
              {emails.map(email => (
                <WiredCard key={email.id} className="item-card">
                  <div><strong>From:</strong> {email.from}</div>
                  <div><strong>Subject:</strong> {email.subject}</div>
                  <div style={{ marginTop: '10px', color: '#555' }}>{email.body}</div>
                </WiredCard>
              ))}
              {emails.length === 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No emails in inbox. Send your first email above!
                </p>
              )}
            </div>
          </WiredCard>
        </div>
      </div>
    </div>
  )
}

export default MailPage