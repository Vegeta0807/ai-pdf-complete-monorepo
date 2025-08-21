// Vector Service Selector - Environment-based service selection
// Development: Uses ChromaDB-based vectorService
// Production: Uses in-memory memoryVectorService

const isDevelopment = process.env.NODE_ENV === 'development';

let vectorService;

if (isDevelopment) {
  console.log('🔧 Development mode: Using ChromaDB vectorService');
  vectorService = require('../src/services/vectorService');
} else {
  console.log('🚀 Production mode: Using in-memory memoryVectorService');
  vectorService = require('./memoryVectorService');
}

// Export the selected service
module.exports = vectorService;
