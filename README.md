# AI PDF Chat - Full Stack Monorepo

A complete AI-powered PDF chat application with vectorization and RAG (Retrieval-Augmented Generation) capabilities.

## 📁 Project Structure

```
ai-pdf-chat-monorepo/
├── backend/                # Node.js API server
│   ├── src/               # Backend source code
│   ├── package.json       # Backend dependencies
│   └── docker-compose.yml # Vector database setup
├── frontend/              # AngularJS frontend (empty - ready for your project)
├── shared/                # Shared utilities and types
│   ├── types.js          # Common types and constants
│   └── api-client.js     # API client utilities
├── package.json          # Root package.json with workspace scripts
├── docker-compose.full.yml # Full stack deployment
└── README.md             # This file
```

## 🎯 Features

- 📄 **PDF Processing**: Upload and extract text from PDF documents
- 🔍 **Vector Search**: Semantic search using embeddings and Chroma vector database
- 🤖 **AI Chat**: Intelligent responses using Groq, OpenAI, or fallback models
- 🚀 **Fast & Scalable**: Built with Express.js and optimized for performance
- 🔒 **Secure**: Input validation, rate limiting, and security headers
- 🐳 **Docker Ready**: Easy deployment with Docker Compose
- 🎨 **Frontend Ready**: Empty frontend directory for your AngularJS project

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: AngularJS
- **Vector Database**: ChromaDB (self-hosted)
- **AI Models**: Groq (primary), OpenAI (fallback)
- **PDF Processing**: pdf-parse (with LlamaParse integration ready)
- **Embeddings**: Hugging Face Transformers (free) or OpenAI

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- API keys (optional but recommended):
  - Groq API key (free tier available)
  - OpenAI API key (optional)
  - LlamaParse API key (optional)

### Installation

1. **Install root dependencies**:
```bash
npm install
```

2. **Install all workspace dependencies**:
```bash
npm run install:all
```

3. **Install your AngularJS project**:
```bash
# Install your existing AngularJS project files into the frontend/ directory
```

4. **Backend environment setup**:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

5. **Start the vector database**:
```bash
npm run docker:up
```

6. **Start both backend and frontend**:
```bash
npm run dev
```

- Backend will start on `http://localhost:3000`
- Frontend will start on `http://localhost:4200` 

## 📋 Available Scripts

### Root Level Commands
```bash
npm run dev              # Start both backend and frontend
npm run install:all      # Install all dependencies
npm run build           # Build both projects
npm run test            # Run all tests
npm run docker:up       # Start vector database
npm run docker:down     # Stop vector database
```

### Backend Only Commands
```bash
npm run dev:backend     # Start only backend
npm run build:backend   # Build backend
npm run test:backend    # Test backend
```

### Frontend Only Commands
```bash
npm run dev:frontend    # Start only frontend
npm run build:frontend  # Build frontend
npm run test:frontend   # Test frontend
```

## 🔌 API Endpoints

### Health Check
```bash
GET /api/health
```

### PDF Upload
```bash
POST /api/pdf/upload
Content-Type: multipart/form-data

# Form data:
# pdf: <PDF file>
```

### Chat with PDF
```bash
POST /api/chat/message
Content-Type: application/json

{
  "message": "What is this document about?",
  "documentId": "uuid-of-uploaded-document",
  "conversationHistory": [] // optional
}
```

## Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# AI APIs (at least one recommended)
GROQ_API_KEY=your_groq_key        # Free tier available
OPENAI_API_KEY=your_openai_key    # Optional
LLAMAPARSE_API_KEY=your_key       # Optional, for advanced PDF parsing

# Vector Database
CHROMA_URL=http://localhost:8000

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=uploads

# Security
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3001
```

### Getting API Keys

1. **Groq (Recommended - Free)**:
   - Visit: https://console.groq.com/
   - Sign up and get free API key
   - Very fast inference, generous free tier

2. **OpenAI (Optional)**:
   - Visit: https://platform.openai.com/
   - $5 free credit for new accounts

3. **LlamaParse (Optional)**:
   - Visit: https://cloud.llamaindex.ai/
   - 1,000 pages/day free tier
   - Better for complex PDFs with tables/images

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PDF Upload    │───▶│   Text Extract   │───▶│   Chunking      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Query    │───▶│  Vector Search   │◀───│   Embeddings    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────▶│   AI Response   │◀─────────────┘
                        └─────────────────┘
```

## Development

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Docker Commands
```bash
npm run docker:up    # Start Chroma DB
npm run docker:down  # Stop Chroma DB
```

## Deployment

### Production Environment
1. Set `NODE_ENV=production`
2. Use a proper process manager (PM2, systemd)
3. Set up reverse proxy (nginx)
4. Configure proper logging
5. Use managed vector database for scale

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Cost Optimization

This setup is designed for minimal costs:

- **Free Tier Usage**: Groq + Hugging Face embeddings + self-hosted Chroma
- **Expected Costs**: $0-5/month for small VPS hosting
- **Scaling**: Can upgrade to managed services when needed

## Troubleshooting

### Common Issues

1. **Chroma Connection Failed**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **PDF Processing Errors**:
   - Check file size limits
   - Ensure PDF is not password protected
   - Try different PDF files

3. **AI API Errors**:
   - Verify API keys in .env
   - Check API rate limits
   - Monitor API usage

### Logs
Check server logs for detailed error information:
```bash
npm run dev  # Development logs
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

## License

MIT License - see LICENSE file for details.
