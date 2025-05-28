# Document Management Frontend

A React-based frontend for the distributed document management system with SpiceDB authorization.

## Features

- Document and folder management with hierarchical permissions
- Real-time sharing with granular role-based access control
- Permalink generation for easy sharing
- User selection with persistent preferences

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Base URL for permalink generation (production)
VITE_APP_BASE_URL=https://your-domain.com
```

**Development**: If not set, defaults to `window.location.origin`
**Production**: Set to your actual domain for proper permalink generation

### Examples

```bash
# Production
VITE_APP_BASE_URL=https://docs.mycompany.com

# Staging  
VITE_APP_BASE_URL=https://staging-docs.mycompany.com
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
### 