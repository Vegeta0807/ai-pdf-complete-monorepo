// COMPLETE REWRITE - NO CHROMADB DEPENDENCY AT ALL
// const { ChromaClient } = require('chromadb'); // REMOVED - NO CHROMADB
const { chunkText } = require('./pdfService');
const { generateEmbeddings } = require('./embeddingService');

class VectorService {
  constructor() {
    console.log(`🚀 VectorService: PURE IN-MEMORY MODE - NO CHROMADB AT ALL`);
    console.log(`🔧 VectorService: NODE_ENV = ${process.env.NODE_ENV}`);

    // Pure in-memory storage - no external dependencies
    this.memoryStore = {
      documents: [],
      embeddings: [],
      metadatas: [],
      ids: []
    };

    this.collectionName = 'pdf_documents';
    console.log(`✅ VectorService: Pure in-memory storage initialized`);
  }

  /**
   * Initialize the vector service - pure in-memory, no external dependencies
   */
  async initialize() {
    console.log(`🧠 VectorService: Pure in-memory initialization - no external calls`);
    console.log(`✅ In-memory collection ready: ${this.collectionName}`);
    // Nothing to initialize - pure in-memory storage is ready
    return Promise.resolve();
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

      // Store vectors in memory
      console.log(`💾 Storing ${chunks.length} chunks in memory...`);
      this.memoryStore.ids.push(...ids);
      this.memoryStore.embeddings.push(...embeddings);
      this.memoryStore.documents.push(...documents);
      this.memoryStore.metadatas.push(...metadatas);

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

      // In-memory search using cosine similarity
      console.log(`🔍 Searching ${this.memoryStore.embeddings.length} stored chunks...`);
      const results = [];

      for (let i = 0; i < this.memoryStore.embeddings.length; i++) {
        // Filter by document ID if specified
        if (documentId && this.memoryStore.metadatas[i].document_id !== documentId) {
          continue;
        }

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding[0], this.memoryStore.embeddings[i]);
        results.push({
          content: this.memoryStore.documents[i],
          similarity,
          metadata: this.memoryStore.metadatas[i],
          id: this.memoryStore.ids[i]
        });
      }

      // Sort by similarity and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const formattedResults = results.slice(0, limit);

      console.log(`🔍 Found ${formattedResults.length} similar chunks for query (pure in-memory)`);
      return formattedResults;

    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Failed to search similar chunks: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Delete a document and all its chunks
   * @param {string} documentId - Document ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDocument(documentId) {
    try {
      await this.initialize();

      // Delete all chunks for this document from memory
      const indicesToRemove = [];
      for (let i = 0; i < this.memoryStore.metadatas.length; i++) {
        if (this.memoryStore.metadatas[i].document_id === documentId) {
          indicesToRemove.push(i);
        }
      }

      // Remove in reverse order to maintain indices
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        const index = indicesToRemove[i];
        this.memoryStore.ids.splice(index, 1);
        this.memoryStore.embeddings.splice(index, 1);
        this.memoryStore.documents.splice(index, 1);
        this.memoryStore.metadatas.splice(index, 1);
      }

      console.log(`🗑️ Deleted document: ${documentId} (${indicesToRemove.length} chunks)`);
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

      // Count chunks for this document
      let chunkCount = 0;
      let firstMetadata = null;

      for (let i = 0; i < this.memoryStore.metadatas.length; i++) {
        if (this.memoryStore.metadatas[i].document_id === documentId) {
          chunkCount++;
          if (!firstMetadata) {
            firstMetadata = this.memoryStore.metadatas[i];
          }
        }
      }

      return {
        documentId,
        chunkCount,
        metadata: firstMetadata || {}
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
