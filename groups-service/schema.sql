-- Groups service database schema

-- Groups table (using username as primary key)
-- Note: No membership/ownership info stored here - SpiceDB is the source of truth
CREATE TABLE IF NOT EXISTS groups (
    username VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    visibility VARCHAR(50) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'RESTRICTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table for group discussions (using group username)
-- Note: No foreign key to users since users are hardcoded
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    group_username VARCHAR(100) REFERENCES groups(username) ON DELETE CASCADE,
    sender_username VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_group_username ON messages(group_username);
CREATE INDEX IF NOT EXISTS idx_messages_sender_username ON messages(sender_username);

-- Insert some sample data
-- Note: Group membership/ownership will be managed via SpiceDB relationships
INSERT INTO groups (username, name, description) VALUES 
    ('engineering', 'Engineering Team', 'Software engineering discussions and updates'),
    ('product', 'Product Team', 'Product management and roadmap discussions')
ON CONFLICT (username) DO NOTHING;