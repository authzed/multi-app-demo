# Distributed Authorization Demo

A monorepo demonstrating a **distributed centralized authorization system** powered by [SpiceDB](https://spicedb.dev) with four services:

- **Groups Service** (Go) - Google Groups analogue on port 3001
- **Mail Service** (Node.js) - Gmail analogue on port 3002  
- **Docs Service** (Java) - Google Docs analogue on port 3003
- **Frontend** (React + Vite) - Shared UI on port 3000

## Architecture Overview

This demo showcases how **SpiceDB** enables consistent, scalable authorization across multiple microservices:

### SpiceDB Authorization Layer
- **Centralized Permissions**: All authorization decisions are handled by SpiceDB (port 50051)
- **Fine-grained Access Control**: Define complex relationships like "users who are members of groups that own documents"
- **Consistent Policy**: Same authorization logic applies across Groups, Mail, and Docs services
- **Real-time Evaluation**: Permission checks happen in real-time with low latency

### Data Architecture
- **PostgreSQL 17**: Shared database server with isolated databases per service
  - `groups_db` - Groups service data
  - `mail_db` - Mail service data  
  - `docs_db` - Docs service data
  - `spicedb` - SpiceDB authorization data
- **Service Isolation**: Each service manages its own data while sharing authorization

### Authorization Features Powered by SpiceDB
- **Multi-service Permissions**: User permissions from Groups service affect Mail and Docs access
- **Relationship-based Access**: "Members of Engineering group can read internal documents"
- **Hierarchical Authorization**: Group owners have elevated permissions across services
- **Audit Trail**: All permission checks are logged and traceable

## Features

- **SpiceDB Integration**: Each backend service uses Authzed SpiceDB client libraries
- **Cross-service Authorization**: Permissions granted in one service affect access in others
- **Modern UI**: Frontend uses wired-elements for consistent design
- **Container Orchestration**: Full Docker Compose setup with service dependencies
- **Database Per Service**: Isolated PostgreSQL databases with shared SpiceDB instance

## Quick Start

```bash
# Build and run all services
docker-compose up --build

# Access the application
open http://localhost:3000
```

## Individual Services

### Groups Service (Go)
```bash
cd groups-service
go mod tidy
go run main.go
```

### Mail Service (Node.js)
```bash
cd mail-service
npm install
npm start
```

### Docs Service (Java)
```bash
cd docs-service
mvn spring-boot:run
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

- **Groups**: `GET/POST http://localhost:3001/groups`
- **Mail**: `GET/POST http://localhost:3002/emails`
- **Docs**: `GET/POST http://localhost:3003/documents`
- **SpiceDB**: `grpc://localhost:50051` (authorization service)
- **SpiceDB Dashboard**: `http://localhost:8080` (admin interface)

## SpiceDB Integration

Each service connects to SpiceDB for authorization decisions:

```bash
# Example: Check if user can read a document
# This query spans across Groups → Users → Documents relationships
spicedb.CheckPermission({
  resource: { objectType: "document", objectId: "doc123" },
  permission: "read",
  subject: { object: { objectType: "user", objectId: "user456" } }
})
```

### Authorization Schema
The demo implements a comprehensive authorization schema in SpiceDB:
- **Users** can be members of **Groups**
- **Groups** can own **Documents** and **Mail** threads  
- **Permission inheritance** flows from group membership to resource access
- **Role-based access** with owners, managers, and members

This creates powerful authorization patterns like:
- "All Engineering group members can edit technical documents"
- "Mail thread participants can view related group discussions"
- "Document owners can share access with their group members"