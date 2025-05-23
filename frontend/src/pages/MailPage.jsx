import { useState, useEffect } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'

function MailPage() {
  const [emails, setEmails] = useState([])
  const [newEmail, setNewEmail] = useState({ subject: '', from: '', body: '' })

  useEffect(() => {
    fetchEmails()
  }, [])

  const fetchEmails = async () => {
    try {
      const response = await fetch('http://localhost:3002/emails')
      const data = await response.json()
      setEmails(data)
    } catch (error) {
      console.error('Error fetching emails:', error)
    }
  }

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
      setNewEmail({ subject: '', from: '', body: '' })
    } catch (error) {
      console.error('Error sending email:', error)
    }
  }

  return (
    <div style={{ margin: '20px' }}>
      <WiredCard>
        <h2>Mail Service</h2>
        
        <WiredCard style={{ marginBottom: '20px' }}>
          <h3>Compose Email</h3>
          <div style={{ marginBottom: '10px' }}>
            <WiredInput 
              placeholder="From"
              value={newEmail.from}
              onChange={(e) => setNewEmail({...newEmail, from: e.target.value})}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <WiredInput 
              placeholder="Subject"
              value={newEmail.subject}
              onChange={(e) => setNewEmail({...newEmail, subject: e.target.value})}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <WiredTextarea 
              placeholder="Body"
              value={newEmail.body}
              onChange={(e) => setNewEmail({...newEmail, body: e.target.value})}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <WiredButton onClick={sendEmail}>Send Email</WiredButton>
          </div>
        </WiredCard>

        <WiredCard>
          <h3>Inbox</h3>
          {emails.map(email => (
            <WiredCard key={email.id} style={{ margin: '10px 0' }}>
              <div><strong>From:</strong> {email.from}</div>
              <div><strong>Subject:</strong> {email.subject}</div>
              <div><strong>Body:</strong> {email.body}</div>
            </WiredCard>
          ))}
        </WiredCard>
      </WiredCard>
    </div>
  )
}

export default MailPage