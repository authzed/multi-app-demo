import { useState, useEffect, useCallback } from 'react'
import { WiredCard, WiredButton, WiredInput, WiredTextarea } from 'wired-elements-react'
import './PageLayout.css'

function MailPage({ currentUser }) {
  const [emails, setEmails] = useState([])
  const [newEmail, setNewEmail] = useState({ subject: '', to: '', body: '' })

  const fetchEmails = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3002/emails/sent', {
        headers: {
          'X-Username': currentUser.username
        }
      })
      const data = await response.json()
      setEmails(data)
    } catch (error) {
      console.error('Error fetching emails:', error)
    }
  }, [currentUser.username])

  useEffect(() => {
    fetchEmails()
  }, [currentUser, fetchEmails])

  const sendEmail = async () => {
    if (!newEmail.subject.trim() || !newEmail.to.trim()) return

    try {
      // First, perform preflight check if there's a body
      if (newEmail.body.trim()) {
        const preflightResponse = await fetch('http://localhost:3002/emails/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: newEmail.to,
            body: newEmail.body,
            from: currentUser.username + '@company.com'
          })
        })
        
        if (!preflightResponse.ok) {
          const preflightData = await preflightResponse.json()
          if (preflightResponse.status === 403) {
            const inaccessibleDocs = preflightData.inaccessibleDocuments || []
            const uncheckableDocs = preflightData.uncheckableDocuments || []
            
            let errorMessage = 'Cannot send email:\n'
            
            if (inaccessibleDocs.length > 0) {
              errorMessage += `\nRecipient ${preflightData.recipient} does not have access to these documents:\n${inaccessibleDocs.join('\n')}`
            }
            
            if (uncheckableDocs.length > 0) {
              errorMessage += `\nYou don't have permission to check access for these documents:\n${uncheckableDocs.join('\n')}`
            }
            
            if (inaccessibleDocs.length === 0 && uncheckableDocs.length === 0) {
              errorMessage += preflightData.error
            }
            
            alert(errorMessage)
          } else {
            alert(`Preflight check failed: ${preflightData.error || 'Unknown error'}`)
          }
          return
        }
      }

      // If preflight passes, send the email
      const emailToSend = {
        ...newEmail,
        from: currentUser.username + '@company.com'
      }
      const response = await fetch('http://localhost:3002/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailToSend)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        alert(`Failed to send email: ${errorData.error || 'Unknown error'}`)
        return
      }
      
      const createdEmail = await response.json()
      setEmails([...emails, createdEmail])
      setNewEmail({ subject: '', to: '', body: '' })
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Failed to send email. Please try again.')
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