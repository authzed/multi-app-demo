# Distributed Authorization Demo

A monorepo demonstrating a distributed centralized authorization system with four services:

- **Groups Service** (Go) - Google Groups analogue on port 3001
- **Mail Service** (Node.js) - Gmail analogue on port 3002  
- **Docs Service** (Java) - Google Docs analogue on port 3003
- **Frontend** (React + Vite) - Shared UI on port 3000

## Features

- Each backend service includes Authzed SpiceDB client library setup
- Frontend uses wired-elements for UI components
- All services containerized with Docker
- Full docker-compose orchestration

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

- Groups: `GET/POST http://localhost:3001/groups`
- Mail: `GET/POST http://localhost:3002/emails`
- Docs: `GET/POST http://localhost:3003/documents`