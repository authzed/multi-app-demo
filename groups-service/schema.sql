-- Groups service database schema

-- Groups table (without fixed ownership)
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255) UNIQUE NOT NULL,
    visibility VARCHAR(50) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'RESTRICTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group memberships table (using usernames instead of user IDs)
CREATE TABLE IF NOT EXISTS group_memberships (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, username)
);

-- Messages table for group discussions (using usernames)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    sender_username VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_username ON group_memberships(username);
CREATE INDEX IF NOT EXISTS idx_group_memberships_role ON group_memberships(role);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_username ON messages(sender_username);

-- Insert some sample data
INSERT INTO groups (name, description, email) VALUES 
    ('Engineering Team', 'Software engineering discussions and updates', 'engineering@company.com'),
    ('Product Team', 'Product management and roadmap discussions', 'product@company.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO group_memberships (group_id, username, role) VALUES 
    (1, 'achen', 'OWNER'),
    (1, 'jrivera', 'MEMBER'),
    (1, 'tkim', 'MEMBER'),
    (2, 'achen', 'OWNER'),
    (2, 'cmorgan', 'MEMBER'),
    (2, 'rthompson', 'MEMBER')
ON CONFLICT (group_id, username) DO NOTHING;