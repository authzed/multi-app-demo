const express = require('express');
const cors = require('cors');
const { v1 } = require('@authzed/authzed-node');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const sentEmails = [];

// SpiceDB client setup
let spiceDbClient;

const initSpiceDB = async () => {
  const token = process.env.SPICEDB_TOKEN || 'testtesttesttest';
  const endpoint = process.env.SPICEDB_ENDPOINT || 'localhost:50051';

  spiceDbClient = v1.NewClient(token, endpoint, v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
};

const extractDocumentLinks = (text) => {
  const docLinkRegex = /https?:\/\/[^\/\s]+\/docs\/document\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const matches = [];
  let match;

  while ((match = docLinkRegex.exec(text)) !== null) {
    matches.push(match[1]); // Extract UUID
  }

  return matches;
};

const checkDocumentPermission = async (documentId, username, permission = 'view') => {
  try {
    const resource = v1.ObjectReference.create({
      objectType: 'document',
      objectId: documentId
    });

    const subject = v1.SubjectReference.create({
      object: v1.ObjectReference.create({
        objectType: 'user',
        objectId: username
      })
    });

    const checkRequest = v1.CheckPermissionRequest.create({
      resource,
      permission,
      subject
    });

    // Log the SpiceDB check request parameters
    console.log('SpiceDB CheckPermission Request:', {
      resource: {
        objectType: checkRequest.resource.objectType,
        objectId: checkRequest.resource.objectId
      },
      permission: checkRequest.permission,
      subject: {
        object: {
          objectType: checkRequest.subject.object.objectType,
          objectId: checkRequest.subject.object.objectId
        }
      }
    });

    const response = await spiceDbClient.promises.checkPermission(checkRequest);

    // Log the response as well
    console.log('SpiceDB CheckPermission Response:', {
      permissionship: response.permissionship,
      checkedAt: response.checkedAt
    });

    return response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
  } catch (error) {
    console.error('SpiceDB permission check failed:', error);
    return false;
  }
};

const extractUsernameFromEmail = (email) => {
  return email.split('@')[0];
};

// Initialize SpiceDB on startup
initSpiceDB().catch(console.error);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mail' });
});

app.get('/emails/sent', (req, res) => {
  res.json(sentEmails);
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

    const accessibleDocuments = [];
    const inaccessibleDocuments = [];
    const uncheckableDocuments = [];

    // Check permissions for each document
    for (const documentId of documentIds) {
      // First check if sender has permission to manage sharing on this document
      const senderCanManageSharing = await checkDocumentPermission(documentId, senderUsername, 'manage_sharing');
      
      if (!senderCanManageSharing) {
        // If sender can't manage sharing, add to uncheckable list
        console.log(`Sender ${senderUsername} cannot manage sharing for document ${documentId}, adding to uncheckable documents`);
        uncheckableDocuments.push(documentId);
        continue;
      }

      // If sender can manage sharing, check if recipient has view access
      const recipientHasAccess = await checkDocumentPermission(documentId, recipientUsername, 'view');
      if (recipientHasAccess) {
        accessibleDocuments.push(documentId);
      } else {
        inaccessibleDocuments.push(documentId);
      }
    }

    if (inaccessibleDocuments.length > 0 || uncheckableDocuments.length > 0) {
      return res.status(403).json({
        error: 'Issues found with document access',
        recipient: recipientUsername,
        accessibleDocuments,
        inaccessibleDocuments,
        uncheckableDocuments
      });
    }

    res.status(200).json({
      message: 'Recipient has access to all documents',
      recipient: recipientUsername,
      accessibleDocuments,
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
      from
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