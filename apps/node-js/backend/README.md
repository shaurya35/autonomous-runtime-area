# Backend - Error Injection Setup

## Overview
This is a **lightweight Node.js backend** with built-in error injection capabilities. All error injection logic is embedded in `index.js` to minimize dependencies and file structure.

## Features
✅ 5 Error Injection Scenarios  
✅ Cross-platform Shell Scripts (Mac, Linux, Windows)  
✅ Minimal Dependencies  
✅ Simple HTTP API  

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create .env file (optional):
```bash
cp .env.example .env
```

## Running the Backend

### Normal Mode
```bash
npm start
# or
npm run dev  # with auto-reload
```

### With Error Injection
Use scripts in the `../script/` folder:

```bash
cd ../script
chmod +x *.sh              # Make scripts executable (first time)
./01-inject-jwt-invalid.sh # Run error scenario
```

## Error Scenarios

| Script | Failure Type | Effect |
|--------|-------------|--------|
| `01-inject-jwt-invalid.sh` | JWT Verification | Protected endpoints return 401 |
| `02-inject-debug-prod.sh` | Debug Logging | Sensitive info exposed in logs |
| `03-inject-wrong-db.sh` | Database Connection | DB queries fail silently |
| `04-inject-memory-leak.sh` | Memory Leak | Cache grows unbounded |
| `05-inject-redis-down.sh` | Circuit Breaker | Favorites service returns 503 |

## API Endpoints

- `GET /health` - Health check with failure mode info
- `POST /api/test` - Test endpoint with failure injection

## Environment Variables

```
FAILURE_INJECTION=true|false    # Enable/disable error injection
FAILURE_SCENARIO=<scenario>     # Which scenario to run
FAILURE_DELAY_MS=0              # Optional delay in milliseconds
LOG_LEVEL=info|debug            # Logging level
PORT=5000                       # Server port
JWT_SECRET=your-secret-key      # JWT secret
MONGODB_URI=mongodb://localhost:27017/moviebox  # MongoDB URI
SESSION_CACHE_SIZE=100          # Session cache max size
```

## Project Structure

```
backend/
├── index.js           # All backend + error injection code (inline)
├── package.json       # Dependencies
└── .env              # Environment variables
```

## Testing Workflow

1. **Start failure scenario**:
   ```bash
   cd ../script
   ./01-inject-jwt-invalid.sh
   ```

2. **Test in your app** - Verify the failure is working

3. **Stop the server** with `Ctrl+C`

4. **Revert to normal**:
   ```bash
   ./01-revert-jwt-invalid.sh
   ```

## Lightweight Design
- All code is inline in `index.js`
- No separate config files
- Minimal dependencies (express, cors, dotenv)
- No external logging framework by default
- Easy to understand and modify
