const express = require('express');
const { chatValidation } = require('../middleware/validation');
const { searchSimilarChunks } = require('../../services/vectorServiceSelector');
const { generateResponse } = require('../services/aiService');

const router = express.Router();

// Chat with PDF
router.post('/message', chatValidation, async (req, res) => {
  try {
    const { message, documentId, conversationHistory = [] } = req.body;

    console.log(`💬 Chat request for document: ${documentId}`);
    console.log(`📝 Message: ${message}`);

    // Search for relevant chunks in the vector database
    const relevantChunks = await searchSimilarChunks(message, documentId, 5);

    if (relevantChunks.length === 0) {
      return res.json({
        success: true,
        data: {
          response: "I couldn't find relevant information in the uploaded PDF to answer your question. Please try rephrasing your question or upload a different document.",
          sources: [],
          confidence: 0
        }
      });
    }

    // Generate AI response using the relevant context
    const aiResponse = await generateResponse(message, relevantChunks, conversationHistory);

    res.json({
      success: true,
      data: {
        response: aiResponse.text,
        sources: relevantChunks.map((chunk, index) => ({
          id: index + 1,
          content: chunk.content.substring(0, 200) + '...',
          similarity: chunk.similarity,
          pageNumber: chunk.metadata?.page_number || null,
          chunkIndex: chunk.metadata?.chunk_index || null,
          metadata: chunk.metadata
        })),
        citations: relevantChunks.map((chunk, index) => {
          const pageNumber = chunk.metadata?.page_number;
          const totalPages = chunk.metadata?.num_pages || 1;

          // Validate page number
          const validPageNumber = (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) ? pageNumber : null;

          // Create a more descriptive label
          const generateSourceLabel = (pageNum, content, index) => {
            if (pageNum) {
              // Extract first few words for context
              const firstWords = content.trim().split(/\s+/).slice(0, 4).join(' ');
              const cleanWords = firstWords.replace(/[^\w\s]/g, '').trim();

              if (cleanWords.length > 0) {
                return `Page ${pageNum}: "${cleanWords}..."`;
              } else {
                return `Page ${pageNum}`;
              }
            } else {
              // Fallback for chunks without page numbers
              const firstWords = content.trim().split(/\s+/).slice(0, 3).join(' ');
              const cleanWords = firstWords.replace(/[^\w\s]/g, '').trim();

              if (cleanWords.length > 0) {
                return `"${cleanWords}..."`;
              } else {
                return `Reference ${index + 1}`;
              }
            }
          };

          return {
            id: index + 1,
            pageNumber: validPageNumber,
            text: chunk.content.substring(0, 150) + '...',
            sourceLabel: generateSourceLabel(validPageNumber, chunk.content, index)
          };
        }),
        confidence: aiResponse.confidence,
        tokensUsed: aiResponse.tokensUsed
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chat message',
      error: error.message
    });
  }
});

// Get conversation history (if implementing conversation storage)
router.get('/conversation/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // TODO: Implement conversation history retrieval
    // This could be stored in a simple JSON file or database
    
    res.json({
      success: true,
      data: {
        documentId,
        messages: []
        // Add conversation history here
      }
    });
  } catch (error) {
    console.error('Conversation retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation',
      error: error.message
    });
  }
});

// Clear conversation history
router.delete('/conversation/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // TODO: Implement conversation history clearing
    
    res.json({
      success: true,
      message: 'Conversation history cleared'
    });
  } catch (error) {
    console.error('Conversation clearing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear conversation',
      error: error.message
    });
  }
});

module.exports = router;
