const express = require('express');
const { chatValidation } = require('../middleware/validation');
const { searchSimilarChunks } = require('../../services/vectorServiceSelector');
const { generateResponse } = require('../services/aiService');
const { documentStatusService, STATUS } = require('../services/documentStatusService');

const router = express.Router();

// Chat with PDF
router.post('/message', chatValidation, async (req, res) => {
  try {
    const { message, documentId, conversationHistory = [] } = req.body;

    console.log(`💬 Chat request for document: ${documentId}`);
    console.log(`📝 Message: ${message}`);

    // Check document processing status
    const documentStatus = documentStatusService.getStatus(documentId);

    if (!documentStatus) {
      return res.status(404).json({
        success: false,
        message: 'Document not found. Please upload a PDF first.',
        error: 'DOCUMENT_NOT_FOUND'
      });
    }

    // Block chat if document is still processing
    if (!documentStatusService.isReadyForChat(documentId)) {
      const status = documentStatus.status;
      const progress = documentStatus.progress || 0;
      const progressMessage = documentStatus.progressMessage || 'Processing...';

      let userMessage = '';
      switch (status) {
        case STATUS.UPLOADING:
        case STATUS.UPLOADED:
          userMessage = 'Your document is being uploaded. Please wait...';
          break;
        case STATUS.PROCESSING:
          userMessage = `Your document is being processed (${Math.round(progress)}%). Please wait...`;
          break;
        case STATUS.VECTORIZING:
          userMessage = `Creating embeddings for your document (${Math.round(progress)}%). Almost ready...`;
          break;
        case STATUS.ERROR:
          userMessage = 'There was an error processing your document. Please try uploading again.';
          break;
        default:
          userMessage = 'Your document is still being processed. Please wait...';
      }

      return res.json({
        success: false,
        message: userMessage,
        data: {
          processingStatus: status,
          progress: progress,
          progressMessage: progressMessage,
          isProcessing: true
        },
        error: 'DOCUMENT_PROCESSING'
      });
    }

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
        sources: relevantChunks.map((chunk, index) => {
          const pageNumber = chunk.metadata?.page_number || chunk.metadata?.estimated_page;
          const totalPages = chunk.metadata?.num_pages || chunk.metadata?.numPages || 1;
          const validPageNumber = (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) ? pageNumber : null;

          return {
            id: index + 1,
            content: chunk.content.substring(0, 200) + '...',
            similarity: chunk.similarity,
            pageNumber: validPageNumber,
            chunkIndex: chunk.metadata?.chunk_index || null,
            metadata: {
              ...chunk.metadata,
              validated_page_number: validPageNumber,
              total_pages: totalPages
            }
          };
        }),
        citations: relevantChunks.map((chunk, index) => {
          // Try multiple possible page number fields for compatibility
          const pageNumber = chunk.metadata?.page_number || chunk.metadata?.estimated_page;
          const totalPages = chunk.metadata?.num_pages || chunk.metadata?.numPages || 1;
          const chunkIndex = chunk.metadata?.chunk_index;

          // Validate page number
          const validPageNumber = (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) ? pageNumber : null;

          // Create a more descriptive label
          const generateSourceLabel = (pageNum, content, index, chunkIdx) => {
            if (pageNum) {
              // Extract first few words for context
              const firstWords = content.trim().split(/\s+/).slice(0, 4).join(' ');
              const cleanWords = firstWords.replace(/[^\w\s$€£¥\d.,]/g, '').trim();

              if (cleanWords.length > 0) {
                const chunkInfo = chunkIdx !== undefined ? ` (Section ${chunkIdx + 1})` : '';
                return `Page ${pageNum}${chunkInfo}: "${cleanWords}..."`;
              } else {
                return `Page ${pageNum}`;
              }
            } else {
              // Fallback for chunks without page numbers
              const firstWords = content.trim().split(/\s+/).slice(0, 3).join(' ');
              const cleanWords = firstWords.replace(/[^\w\s$€£¥\d.,]/g, '').trim();

              if (cleanWords.length > 0) {
                const chunkInfo = chunkIdx !== undefined ? ` (Section ${chunkIdx + 1})` : '';
                return `"${cleanWords}..."${chunkInfo}`;
              } else {
                return `Reference ${index + 1}`;
              }
            }
          };

          return {
            id: index + 1,
            pageNumber: validPageNumber,
            text: chunk.content.substring(0, 150) + '...',
            sourceLabel: generateSourceLabel(validPageNumber, chunk.content, index, chunkIndex),
            similarity: chunk.similarity,
            chunkIndex: chunkIndex
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
