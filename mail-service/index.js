const express = require('express');
const cors = require('cors');
const { v1 } = require('@authzed/authzed-node');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const sentEmails = [];

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mail' });
});

app.get('/emails/sent', (req, res) => {
  res.json(sentEmails);
});

app.post('/emails/send', (req, res) => {
  const newEmail = {
    id: Date.now().toString(),
    sentAt: new Date().toISOString(),
    ...req.body
  };
  sentEmails.push(newEmail);
  res.status(201).json(newEmail);
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