-- Groups service database schema

-- Groups table (using username as primary key)
CREATE TABLE IF NOT EXISTS groups (
    username VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    visibility VARCHAR(50) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'RESTRICTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group memberships table (using group username)
CREATE TABLE IF NOT EXISTS group_memberships (
    id SERIAL PRIMARY KEY,
    group_username VARCHAR(100) REFERENCES groups(username) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_username, username)
);

-- Messages table for group discussions (using group username)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    group_username VARCHAR(100) REFERENCES groups(username) ON DELETE CASCADE,
    sender_username VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_username ON group_memberships(group_username);
CREATE INDEX IF NOT EXISTS idx_group_memberships_username ON group_memberships(username);
CREATE INDEX IF NOT EXISTS idx_group_memberships_role ON group_memberships(role);
CREATE INDEX IF NOT EXISTS idx_messages_group_username ON messages(group_username);
CREATE INDEX IF NOT EXISTS idx_messages_sender_username ON messages(sender_username);

-- Insert some sample data
INSERT INTO groups (username, name, description) VALUES 
    ('engineering', 'Engineering Team', 'Software engineering discussions and updates'),
    ('product', 'Product Team', 'Product management and roadmap discussions')
ON CONFLICT (username) DO NOTHING;

INSERT INTO group_memberships (group_username, username, role) VALUES 
    ('engineering', 'achen', 'OWNER'),
    ('engineering', 'jrivera', 'MEMBER'),
    ('engineering', 'tkim', 'MEMBER'),
    ('product', 'achen', 'OWNER'),
    ('product', 'cmorgan', 'MEMBER'),
    ('product', 'rthompson', 'MEMBER')
ON CONFLICT (group_username, username) DO NOTHING;