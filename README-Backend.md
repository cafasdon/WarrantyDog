# WarrantyDog Backend Proxy

## Overview
This backend proxy server solves CORS issues when calling vendor APIs (like Dell) from the browser. Instead of making direct API calls that get blocked by CORS policy, the frontend now calls our backend proxy which forwards requests to the vendor APIs.

## Quick Start

### Option 1: Using the Batch File (Windows)
```bash
# Double-click or run:
start-backend.bat
```

### Option 2: Using npm
```bash
# Start the backend server
npm run server

# Or for development with auto-restart
npm run dev-server
```

### Option 3: Direct Node.js
```bash
node server.js
```

## How It Works

1. **Frontend** makes API calls to `/api/dell/warranty/:serviceTag`
2. **Backend Proxy** receives the request with the Dell API key in headers
3. **Backend** forwards the request to Dell's actual API
4. **Dell API** responds to the backend (no CORS issues)
5. **Backend** returns the response to the frontend

## API Endpoints

### Dell Warranty Lookup
```
GET /api/dell/warranty/:serviceTag
Headers: X-Dell-Api-Key: your-dell-api-key
```

### Health Check
```
GET /api/health
```

## Configuration

The backend server runs on port 3001 by default. You can change this by setting the PORT environment variable:

```bash
PORT=3002 node server.js
```

## Frontend Integration

The frontend automatically detects if it's running with the backend proxy. When you:

1. Start the backend server on port 3001
2. Use the frontend on any port (8080, 3001, etc.)
3. The frontend will automatically use `/api/dell/warranty/` endpoints

## Development Workflow

1. **Start Backend**: `npm run dev-server` (auto-restarts on changes)
2. **Start Frontend**: `npm run dev` (live-server on port 8080)
3. **Access App**: Go to `http://localhost:3001` (served by backend)

## Production Deployment

For production, you can:

1. **Single Server**: Use the backend to serve both API and static files
2. **Separate Servers**: Deploy backend separately and configure frontend to call it
3. **Docker**: Use the existing Docker setup with backend integration

## Troubleshooting

### CORS Issues
- Make sure the backend is running before using the frontend
- Check that API calls are going to `/api/dell/warranty/` not directly to Dell

### Port Conflicts
- Backend defaults to port 3001
- Change with `PORT=3002 npm run server`

### API Key Issues
- Ensure Dell API key is properly configured in the frontend
- Check browser console for API key validation messages
