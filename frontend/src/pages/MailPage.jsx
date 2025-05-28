import { useState, useEffect, useCallback } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import './PageLayout.css'

function MailPage({ currentUser }) {
  const [emails, setEmails] = useState([])
  const [newEmail, setNewEmail] = useState({ subject: '', to: '', body: '' })

  const fetchEmails = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3002/emails/sent')
      const data = await response.json()
      setEmails(data)
    } catch (error) {
      console.error('Error fetching emails:', error)
    }
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [currentUser, fetchEmails])

  const sendEmail = async () => {
    if (!newEmail.subject.trim() || !newEmail.to.trim()) return

    try {
      const emailToSend = {
        ...newEmail,
        from: currentUser.username + '@company.com'
      }
      const response = await fetch('http://localhost:3002/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailToSend)
      })
      const createdEmail = await response.json()
      setEmails([...emails, createdEmail])
      setNewEmail({ subject: '', to: '', body: '' })
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
              placeholder="To"
              value={newEmail.to}
              onChange={(e) => setNewEmail({...newEmail, to: e.target.value})}
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

        <WiredCard style={{ width: '100%', marginTop: '20px' }}>
          <h3>Outbox</h3>
          {emails.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              No emails sent yet. Send your first email above!
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>From</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>To</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Subject</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Sent</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(email => (
                  <tr key={email.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>{email.from}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>{email.to}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>{email.subject}</td>
                    <td style={{ padding: '10px' }}>{new Date(email.sentAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </WiredCard>
      </div>
    </div>
  )
}

export default MailPage