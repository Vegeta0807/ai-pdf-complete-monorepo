const axios = require('axios');

/**
 * Generate embeddings using Hugging Face Inference API (free)
 * @param {Array<string>} texts - Array of texts to embed
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 */
async function generateEmbeddingsHuggingFace(texts) {
  try {
    const model = 'sentence-transformers/all-MiniLM-L6-v2';
    const apiUrl = `https://api-inference.huggingface.co/models/${model}`;
    
    const response = await axios.post(apiUrl, {
      inputs: texts,
      options: { wait_for_model: true }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (Array.isArray(response.data) && Array.isArray(response.data[0])) {
      console.log(`🔢 Generated ${response.data.length} embeddings using Hugging Face`);
      return response.data;
    } else {
      throw new Error('Invalid response format from Hugging Face API');
    }

  } catch (error) {
    console.error('Hugging Face embedding error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Generate embeddings using OpenAI API
 * @param {Array<string>} texts - Array of texts to embed
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 */
async function generateEmbeddingsOpenAI(texts) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post('https://api.openai.com/v1/embeddings', {
      input: texts,
      model: 'text-embedding-3-small'
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const embeddings = response.data.data.map(item => item.embedding);
    console.log(`🔢 Generated ${embeddings.length} embeddings using OpenAI`);
    return embeddings;

  } catch (error) {
    console.error('OpenAI embedding error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Generate simple embeddings using basic text features (fallback)
 * @param {Array<string>} texts - Array of texts to embed
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 */
async function generateEmbeddingsSimple(texts) {
  console.log('⚠️ Using simple fallback embeddings - not recommended for production');
  
  return texts.map(text => {
    // Create a simple 384-dimensional vector based on text features
    const vector = new Array(384).fill(0);
    
    // Basic features: length, character frequencies, etc.
    vector[0] = Math.min(text.length / 1000, 1); // Normalized length
    
    // Character frequency features
    for (let i = 0; i < Math.min(text.length, 100); i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode % 383) + 1;
      vector[index] += 0.01;
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  });
}

/**
 * Main embedding function with fallback strategy
 * @param {Array<string>} texts - Array of texts to embed
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Invalid input: texts must be a non-empty array');
  }

  // Clean and validate texts
  const cleanTexts = texts.map(text => {
    if (typeof text !== 'string') {
      throw new Error('All texts must be strings');
    }
    return text.trim();
  }).filter(text => text.length > 0);

  if (cleanTexts.length === 0) {
    throw new Error('No valid texts to embed after cleaning');
  }

  // Try different embedding services in order of preference
  const strategies = [
    {
      name: 'OpenAI',
      condition: () => process.env.OPENAI_API_KEY,
      function: generateEmbeddingsOpenAI
    },
    {
      name: 'Hugging Face',
      condition: () => true, // Always available (free tier)
      function: generateEmbeddingsHuggingFace
    },
    {
      name: 'Simple Fallback',
      condition: () => true,
      function: generateEmbeddingsSimple
    }
  ];

  for (const strategy of strategies) {
    if (strategy.condition()) {
      try {
        console.log(`🚀 Trying ${strategy.name} for embeddings...`);
        return await strategy.function(cleanTexts);
      } catch (error) {
        console.warn(`⚠️ ${strategy.name} failed:`, error.message);
        if (strategy.name === 'Simple Fallback') {
          throw error; // Don't continue if even fallback fails
        }
      }
    }
  }

  throw new Error('All embedding strategies failed');
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} - Cosine similarity (-1 to 1)
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

module.exports = {
  generateEmbeddings,
  generateEmbeddingsHuggingFace,
  generateEmbeddingsOpenAI,
  generateEmbeddingsSimple,
  cosineSimilarity
};
