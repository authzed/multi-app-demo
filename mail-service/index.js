const express = require('express');
const cors = require('cors');
const { v1 } = require('@authzed/authzed-node');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const emails = [
  { id: '1', subject: 'Welcome to the platform', from: 'admin@company.com', body: 'Welcome message...' },
  { id: '2', subject: 'Weekly Update', from: 'team@company.com', body: 'This week updates...' }
];

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mail' });
});

app.get('/emails', (req, res) => {
  res.json(emails);
});

app.post('/emails', (req, res) => {
  const newEmail = {
    id: Date.now().toString(),
    ...req.body
  };
  emails.push(newEmail);
  res.status(201).json(newEmail);
});

app.get('/emails/:id', (req, res) => {
  const email = emails.find(e => e.id === req.params.id);
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  res.json(email);
});

app.listen(PORT, () => {
  console.log(`Mail service running on port ${PORT}`);
});