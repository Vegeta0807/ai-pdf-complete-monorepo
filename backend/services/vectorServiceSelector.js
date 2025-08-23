// Vector Service Selector - Environment-based service selection
// Development: Uses ChromaDB-based vectorService
// Production: Uses in-memory memoryVectorService

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Default to production mode if NODE_ENV is not set or is unknown
const useMemoryService = !isDevelopment;

let vectorService;

if (isDevelopment) {
  console.log('🔧 Development mode: Using ChromaDB vectorService');
  vectorService = require('../src/services/vectorService');
} else {
  console.log(`🚀 ${isProduction ? 'Production' : 'Default'} mode: Using in-memory memoryVectorService`);
  console.log(`📊 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  vectorService = require('./memoryVectorService');
}

// Export the selected service
module.exports = vectorService;
