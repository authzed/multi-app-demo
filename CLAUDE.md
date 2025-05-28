# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a distributed authorization demo showcasing SpiceDB-powered microservices with four main components:

- **Groups Service** (Go, port 3001) - Google Groups analogue using Gin framework
- **Mail Service** (Node.js, port 3002) - Gmail analogue using Express  
- **Docs Service** (Java Spring Boot, port 3003) - Google Docs analogue using Spring Data JPA
- **Frontend** (React + Vite, port 3000) - Shared UI using wired-elements for consistent design

### Key Dependencies
- **SpiceDB**: Centralized authorization service (port 50051) with dashboard on port 8080, uses PostgreSQL for relationship storage
- **PostgreSQL 17**: Shared database server with isolated databases per service (groups_db, mail_db, docs_db, spicedb)
- **Frontend**: Uses wired-elements-react library and patch-package for customizations

### Authorization Architecture
All services integrate with SpiceDB using official client libraries:
- Go service: `github.com/authzed/authzed-go`
- Java service: `com.authzed.api:authzed` 
- Node.js service: `@authzed/authzed-node`

SpiceDB schema defines user/group relationships and permissions, enabling cross-service authorization patterns.

## Development Commands

### Full Stack Development
```bash
# Start all services with Docker Compose
docker-compose up --build

# Start individual services for development
cd groups-service && go run main.go
cd mail-service && npm start  
cd docs-service && mvn spring-boot:run
cd frontend && npm run dev
```

### Frontend Development
```bash
cd frontend
npm install          # Install dependencies and apply patches
npm run dev          # Development server on port 3000
npm run build        # Production build
npm run lint         # ESLint validation
npm run preview      # Preview production build
```

### Java Service Development  
```bash
cd docs-service
mvn spring-boot:run  # Run Spring Boot application
mvn clean install   # Build and test
```

### Go Service Development
```bash
cd groups-service
go mod tidy          # Update dependencies
go run main.go       # Run development server
```

### Mail Service Development
```bash
cd mail-service
npm install          # Install dependencies
npm start            # Production mode
npm run dev          # Development with nodemon
```

## Service Endpoints

- Groups Service: http://localhost:3001
- Mail Service: http://localhost:3002
- Docs Service: http://localhost:3003
- Frontend: http://localhost:3000
- SpiceDB gRPC: localhost:50051
- SpiceDB Dashboard: http://localhost:8080

## Database Configuration

Services connect to PostgreSQL with these connection patterns:
- Go: `postgres://demo:demo123@localhost:5432/groups_db`
- Node.js: `postgres://demo:demo123@localhost:5432/mail_db`
- Java: `jdbc:postgresql://localhost:5432/docs_db` (username: demo, password: demo123)

SpiceDB uses PostgreSQL for relationship storage in the `spicedb` database.

## SpiceDB Integration

All authorization decisions flow through SpiceDB using the shared token `testtesttesttest` in development. Services check permissions before allowing operations, enabling patterns like "members of Engineering group can edit technical documents" across service boundaries.