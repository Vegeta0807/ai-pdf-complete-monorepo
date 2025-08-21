// PURE IN-MEMORY VECTOR SERVICE - NO CHROMADB DEPENDENCIES
const { chunkText } = require('../src/services/pdfService');
const { generateEmbeddings } = require('../src/services/embeddingService');

class MemoryVectorService {
  constructor() {
    console.log(`🚀 MemoryVectorService: PURE IN-MEMORY MODE - NO EXTERNAL DEPENDENCIES`);
    
    // Pure in-memory storage
    this.memoryStore = {
      documents: [],
      embeddings: [],
      metadatas: [],
      ids: []
    };
    
    this.collectionName = 'pdf_documents';
    console.log(`✅ MemoryVectorService: Pure in-memory storage initialized`);
  }

  /**
   * Initialize - no external dependencies needed
   */
  async initialize() {
    console.log(`🧠 MemoryVectorService: Ready - no external initialization needed`);
    return Promise.resolve();
  }

  /**
   * Vectorize and store a document
   */
  async vectorizeDocument(documentId, text, metadata = {}) {
    const startTime = Date.now();
    
    try {
      await this.initialize();

      // Chunk the text
      const chunkObjects = chunkText(text, 1000, 200);

      if (chunkObjects.length === 0) {
        throw new Error('No text chunks generated from document');
      }

      // Extract text strings from chunk objects
      const chunks = chunkObjects.map(chunk => chunk.text);

      // Generate embeddings for all chunks
      console.log(`🔄 Generating embeddings for ${chunkObjects.length} chunks...`);
      const embeddings = await generateEmbeddings(chunks);

      // Prepare data
      const ids = chunkObjects.map((_, index) => `${documentId}_chunk_${index}`);
      const documents = chunks;
      const metadatas = chunkObjects.map((chunkObj, index) => ({
        document_id: documentId,
        chunk_index: index,
        chunk_text: chunkObj.text.substring(0, 100) + '...',
        page_number: chunkObj.estimatedPage,
        start_char: chunkObj.startChar,
        end_char: chunkObj.endChar,
        ...metadata
      }));

      // Store in memory
      console.log(`💾 Storing ${chunkObjects.length} chunks in memory...`);
      this.memoryStore.ids.push(...ids);
      this.memoryStore.embeddings.push(...embeddings);
      this.memoryStore.documents.push(...documents);
      this.memoryStore.metadatas.push(...metadatas);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Document vectorized: ${chunkObjects.length} chunks in ${processingTime}ms`);

      return {
        success: true,
        documentId,
        chunkCount: chunkObjects.length,
        processingTime
      };

    } catch (error) {
      console.error('Vectorization error:', error);
      throw new Error(`Failed to vectorize document: ${error.message}`);
    }
  }

  /**
   * Search for similar chunks
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

      console.log(`🔍 Found ${formattedResults.length} similar chunks (pure in-memory)`);
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
   */
  async deleteDocument(documentId) {
    try {
      const indicesToRemove = [];
      for (let i = 0; i < this.memoryStore.metadatas.length; i++) {
        if (this.memoryStore.metadatas[i].document_id === documentId) {
          indicesToRemove.push(i);
        }
      }

      // Remove in reverse order
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
}

// Create singleton instance
const memoryVectorService = new MemoryVectorService();

// Export functions
module.exports = {
  vectorizeDocument: (documentId, text, metadata) => 
    memoryVectorService.vectorizeDocument(documentId, text, metadata),
  searchSimilarChunks: (query, documentId, limit) => 
    memoryVectorService.searchSimilarChunks(query, documentId, limit),
  deleteDocument: (documentId) => 
    memoryVectorService.deleteDocument(documentId),
  getDocumentStats: async (documentId) => {
    let chunkCount = 0;
    let firstMetadata = null;
    
    for (let i = 0; i < memoryVectorService.memoryStore.metadatas.length; i++) {
      if (memoryVectorService.memoryStore.metadatas[i].document_id === documentId) {
        chunkCount++;
        if (!firstMetadata) {
          firstMetadata = memoryVectorService.memoryStore.metadatas[i];
        }
      }
    }
    
    return {
      documentId,
      chunkCount,
      metadata: firstMetadata || {}
    };
  }
};
