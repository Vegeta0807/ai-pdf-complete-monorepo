# Vector Service Configuration

This project now supports environment-based vector service selection:

## Configuration

- **Development Environment**: Uses ChromaDB-based `vectorService` with persistent storage
- **Production Environment**: Uses in-memory `memoryVectorService` for zero external dependencies

## How it works

The `backend/services/vectorServiceSelector.js` file automatically selects the appropriate vector service based on the `NODE_ENV` environment variable:

```javascript
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Uses ChromaDB vectorService
  vectorService = require('../src/services/vectorService');
} else {
  // Uses in-memory memoryVectorService  
  vectorService = require('./memoryVectorService');
}
```

## Development Setup

1. **Install dependencies** (including cross-env for Windows compatibility):
   ```bash
   npm run install:all
   ```

2. **Start ChromaDB for development**:
   ```bash
   npm run docker:dev
   ```

3. **Start development servers**:
   ```bash
   npm run dev
   ```

The development environment will:
- Use ChromaDB container (`ai-pdf-chroma-dev`) on port 8000
- Store vectors persistently in ChromaDB
- Set `NODE_ENV=development` automatically

## Production Setup

Production uses the in-memory vector service with no external dependencies:

```bash
npm run build
npm start
```

## Docker Commands

- `npm run docker:dev` - Start ChromaDB for development
- `npm run docker:dev:down` - Stop ChromaDB development container
- `npm run docker:up` - Start ChromaDB for production (if needed)
- `npm run docker:down` - Stop ChromaDB production container
- `npm run docker:status` - Check ChromaDB container status

## Benefits

- **Development**: Full ChromaDB features with persistent storage and better performance
- **Production**: Zero external dependencies, faster deployment, simpler infrastructure
- **Automatic**: No manual configuration needed, environment-based selection
