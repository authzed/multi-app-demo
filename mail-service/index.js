const express = require('express');
const cors = require('cors');
const { v1 } = require('@authzed/authzed-node');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const sentEmails = [];

const extractDocumentLinks = (text) => {
  const docLinkRegex = /https?:\/\/[^\/\s]+\/docs\/document\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const matches = [];
  let match;

  while ((match = docLinkRegex.exec(text)) !== null) {
    matches.push(match[1]); // Extract UUID
  }

  return matches;
};

const extractUsernameFromEmail = (email) => {
  return email.split('@')[0];
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mail' });
});

app.get('/emails/sent', (req, res) => {
  const username = req.headers['x-username'];
  
  if (!username) {
    return res.status(400).json({ error: 'X-Username header is required' });
  }
  
  // Filter emails by sender username
  const filteredEmails = sentEmails.filter(email => email.senderUsername === username);
  res.json(filteredEmails);
});

app.post('/emails/preflight', async (req, res) => {
  try {
    const { to, body, from } = req.body;

    if (!to || !body || !from) {
      return res.status(400).json({ error: 'Missing required fields: to, body, from' });
    }

    // Extract document links from email body
    const documentIds = extractDocumentLinks(body);

    if (documentIds.length === 0) {
      return res.status(200).json({ message: 'No document links found', accessibleDocuments: [], inaccessibleDocuments: [], uncheckableDocuments: [] });
    }

    // Extract usernames from sender and recipient emails
    const senderUsername = extractUsernameFromEmail(from);
    const recipientUsername = extractUsernameFromEmail(to);

     res.status(200).json({
      message: 'Recipient has access to all documents',
      recipient: recipientUsername,
      accessibleDocuments: [],
      inaccessibleDocuments: [],
      uncheckableDocuments: []
    });
  } catch (error) {
    console.error('Error in preflight check:', error);
    res.status(500).json({ error: 'Failed to perform preflight check' });
  }
});

app.post('/emails/send', async (req, res) => {
  try {
    const { to, subject, body, from } = req.body;

    if (!to || !subject || !from) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, from' });
    }


    const newEmail = {
      id: Date.now().toString(),
      sentAt: new Date().toISOString(),
      to,
      subject,
      body,
      from,
      senderUsername: extractUsernameFromEmail(from)
    };

    sentEmails.push(newEmail);
    res.status(201).json(newEmail);
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.get('/emails/sent/:id', (req, res) => {
  const email = sentEmails.find(e => e.id === req.params.id);
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  res.json(email);
});

app.listen(PORT, () => {
  console.log(`Mail service running on port ${PORT}`);
});