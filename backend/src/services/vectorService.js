const { ChromaClient } = require('chromadb');
const { chunkText } = require('./pdfService');
const { generateEmbeddings } = require('./embeddingService');

// Custom embedding function for ChromaDB
class CustomEmbeddingFunction {
  async generate(texts) {
    return await generateEmbeddings(texts);
  }
}

class VectorService {
  constructor() {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    const url = new URL(chromaUrl);

    this.client = new ChromaClient({
      host: url.hostname,
      port: parseInt(url.port) || 8000,
      ssl: url.protocol === 'https:'
    });
    this.collectionName = 'pdf_documents';
    this.collection = null;
  }

  /**
   * Initialize the vector service and create collection if needed
   */
  async initialize() {
    try {
      // Try to get existing collection
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
          embeddingFunction: new CustomEmbeddingFunction()
        });
        console.log(`✅ Connected to existing collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: {
            description: 'PDF document chunks for RAG system',
            created_at: new Date().toISOString()
          },
          embeddingFunction: new CustomEmbeddingFunction()
        });
        console.log(`🆕 Created new collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Failed to initialize vector service:', error);
      throw error;
    }
  }

  /**
   * Vectorize and store a document
   * @param {string} documentId - Unique document identifier
   * @param {string} text - Document text content
   * @param {object} metadata - Document metadata
   * @returns {Promise<object>} - Processing results
   */
  async vectorizeDocument(documentId, text, metadata = {}) {
    const startTime = Date.now();
    
    try {
      await this.initialize();

      // Chunk the text
      const chunks = chunkText(text, 1000, 200);
      
      if (chunks.length === 0) {
        throw new Error('No text chunks generated from document');
      }

      // Generate embeddings for all chunks
      console.log(`🔄 Generating embeddings for ${chunks.length} chunks...`);
      const embeddings = await generateEmbeddings(chunks);

      // Prepare data for Chroma
      const ids = chunks.map((_, index) => `${documentId}_chunk_${index}`);
      const documents = chunks;
      const metadatas = chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        chunk_text: chunk.substring(0, 100) + '...',
        ...metadata
      }));

      // Store in Chroma
      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Document vectorized: ${chunks.length} chunks in ${processingTime}ms`);

      return {
        chunksCreated: chunks.length,
        processingTime,
        documentId
      };

    } catch (error) {
      console.error('Vectorization error:', error);
      throw new Error(`Failed to vectorize document: ${error.message}`);
    }
  }

  /**
   * Search for similar chunks
   * @param {string} query - Search query
   * @param {string} documentId - Optional document ID to filter by
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} - Similar chunks with metadata
   */
  async searchSimilarChunks(query, documentId = null, limit = 5) {
    try {
      await this.initialize();

      // Generate embedding for the query
      const queryEmbedding = await generateEmbeddings([query]);

      // Prepare search parameters
      const searchParams = {
        queryEmbeddings: queryEmbedding,
        nResults: limit
      };

      // Add document filter if specified
      if (documentId) {
        searchParams.where = { document_id: documentId };
      }

      // Search in Chroma
      const results = await this.collection.query(searchParams);

      // Format results
      const formattedResults = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          formattedResults.push({
            content: results.documents[0][i],
            similarity: 1 - (results.distances[0][i] || 0), // Convert distance to similarity
            metadata: results.metadatas[0][i],
            id: results.ids[0][i]
          });
        }
      }

      console.log(`🔍 Found ${formattedResults.length} similar chunks for query`);
      return formattedResults;

    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Failed to search similar chunks: ${error.message}`);
    }
  }

  /**
   * Delete a document and all its chunks
   * @param {string} documentId - Document ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDocument(documentId) {
    try {
      await this.initialize();

      // Delete all chunks for this document
      await this.collection.delete({
        where: { document_id: documentId }
      });

      console.log(`🗑️ Deleted document: ${documentId}`);
      return true;

    } catch (error) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Get document statistics
   * @param {string} documentId - Document ID
   * @returns {Promise<object>} - Document stats
   */
  async getDocumentStats(documentId) {
    try {
      await this.initialize();

      const results = await this.collection.get({
        where: { document_id: documentId }
      });

      return {
        documentId,
        chunkCount: results.ids.length,
        metadata: results.metadatas[0] || {}
      };

    } catch (error) {
      console.error('Stats error:', error);
      throw new Error(`Failed to get document stats: ${error.message}`);
    }
  }
}

// Create singleton instance
const vectorService = new VectorService();

// Export functions that use the singleton
module.exports = {
  vectorizeDocument: (documentId, text, metadata) => 
    vectorService.vectorizeDocument(documentId, text, metadata),
  searchSimilarChunks: (query, documentId, limit) => 
    vectorService.searchSimilarChunks(query, documentId, limit),
  deleteDocument: (documentId) => 
    vectorService.deleteDocument(documentId),
  getDocumentStats: (documentId) => 
    vectorService.getDocumentStats(documentId)
};
