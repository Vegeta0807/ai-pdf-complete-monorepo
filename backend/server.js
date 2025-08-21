const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pdfRoutes = require('./src/routes/pdf');
const chatRoutes = require('./src/routes/chat');
const healthRoutes = require('./src/routes/health');
const { errorHandler } = require('./src/middleware/errorHandler');
const { createUploadsDir } = require('./src/utils/fileUtils');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway/hosted environments
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Create uploads directory if it doesn't exist
createUploadsDir();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/chat', chatRoutes);

// Serve Angular frontend in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const fs = require('fs');

  // Try multiple possible build locations (Angular 17+ uses browser subfolder)
  const possiblePaths = [
    path.join(__dirname, '../frontend/dist/ai-pdf-app/browser'),
    path.join(__dirname, '../frontend/dist/ai-pdf-app'),
    path.join(__dirname, '../frontend/dist'),
    path.join(__dirname, '../dist/ai-pdf-app/browser'),
    path.join(__dirname, '../dist/ai-pdf-app'),
    path.join(__dirname, '../dist')
  ];

  let staticPath = null;
  let indexPath = null;

  console.log('🔍 Checking build files...');

  for (const testPath of possiblePaths) {
    console.log(`Testing path: ${testPath}`);
    if (fs.existsSync(testPath)) {
      console.log(`✅ Path exists: ${testPath}`);
      console.log(`Contents:`, fs.readdirSync(testPath));

      const testIndexPath = path.join(testPath, 'index.html');
      if (fs.existsSync(testIndexPath)) {
        console.log(`✅ Found index.html at: ${testIndexPath}`);
        staticPath = testPath;
        indexPath = testIndexPath;
        break;
      }
    } else {
      console.log(`❌ Path not found: ${testPath}`);
    }
  }

  if (staticPath && indexPath) {
    console.log(`🚀 Serving static files from: ${staticPath}`);
    app.use(express.static(staticPath));

    // Handle Angular routing
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({
          success: false,
          message: 'API route not found'
        });
      }
    });
  } else {
    console.log('❌ No Angular build found in any expected location');
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.status(500).json({
          success: false,
          message: 'Frontend build not found. Check build logs.',
          searchedPaths: possiblePaths
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'API route not found'
        });
      }
    });
  }
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });
}

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 AI PDF Chat Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Chroma DB: ${process.env.CHROMA_URL}`);
});

module.exports = app;
