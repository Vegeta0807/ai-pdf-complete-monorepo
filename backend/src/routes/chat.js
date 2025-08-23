const express = require('express');
const { chatValidation } = require('../middleware/validation');
const { searchSimilarChunks } = require('../../services/vectorServiceSelector');
const { generateResponse } = require('../services/aiService');
const { documentStatusService, STATUS } = require('../services/documentStatusService');

const router = express.Router();

/**
 * Check if the question requires document context
 * @param {string} message - User message
 * @returns {boolean} - True if question needs document context
 */
function requiresDocumentContext(message) {
  const lowerMessage = message.toLowerCase().trim();

  // Clear general questions that don't need document context
  const generalPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening)$/,
    /^(thank you|thanks|bye|goodbye)$/,
    /^(yes|no|ok|okay|sure|fine)$/,
    /^(help|what can you do|how do you work)$/,
    /^what is (ai|artificial intelligence|machine learning|deep learning)$/,
    /^how does (ai|artificial intelligence|machine learning) work$/,
    /^(define|explain|what is|what are) [^.]*$/,
    /^(how to|how do|how does|why does|why do) [^.]*$/,
    /^(can you|could you|would you|will you) (help|assist|explain|tell me)$/,
    /^what (is|are) the (definition|meaning) of$/,
    /^(who is|who was|when is|when was|where is|where was)$/,
    // Language and conversation questions
    /^(can i|may i|should i) (ask|speak|talk|chat) (in|with)$/,
    /hindi mei|english mei|language|translate/,
    /^(kya|kaise|kahan|kab|kyun)/,  // Hindi question words
    /^(what|how|where|when|why) (language|tongue)/,
    /^(speak|talk|chat|converse) (in|with)/
  ];

  // Document-specific indicators that DO need context
  const documentPatterns = [
    /\b(document|pdf|file|page|section|chapter|statement|report|invoice|receipt|contract|agreement)\b/,
    /\b(in this|from this|according to this|based on this|mentioned in|stated in|shown in)\b/,
    /\b(total|sum|amount|balance|credit|debit|transaction|payment|charge|fee|account)\b/,
    /\b(show me|find|search|locate|extract|list|summarize|summary)\b/,
    /\b(what does (this|the document|it) say|what is mentioned|what shows)\b/,
    /\b(analyze|review|examine) (this|the)\b/,
    // More inclusive patterns for document questions
    /\b(name|address|phone|email|date|number|amount|price|cost|value)\b/,
    /\b(who|what|when|where|how much|how many)\b.*\b(is|are|was|were)\b/,
    /\b(tell me|explain|describe|identify)\b/,
    /\b(content|information|details|data)\b/,
    /\b(company|organization|person|client|customer)\b/,
    /\b(project|task|work|job|position|role)\b/,
    // Specific patterns for the failing questions
    /\bthis\s+(document|pdf|file)\b/,
    /\bthe\s+(document|pdf|file)\b/,
    /\bpurpose\s+of\s+(this|the)\b/,
    /\babout\s+(this|the)\b/,
    /\bwhat\s+is\s+(this|the)\b/,
    /\bwhat\s+does\s+(this|the)\b/
  ];

  // Check if it contains document-specific patterns FIRST
  const hasDocumentContext = documentPatterns.some(pattern => pattern.test(lowerMessage));

  // If it clearly needs document context, use it regardless of general patterns
  if (hasDocumentContext) {
    return true;
  }

  // Then check if it's clearly a general question
  for (const pattern of generalPatterns) {
    if (pattern.test(lowerMessage)) {
      return false; // If it matches general patterns, it's definitely general
    }
  }

  // For single words or very short phrases, check if they could be document-related
  const wordCount = lowerMessage.trim().split(/\s+/).length;

  // If it's a very short phrase (1-2 words), be more permissive
  // Many legitimate document questions are short: "nociceptors", "summary", "conclusion", etc.
  if (wordCount <= 2) {
    // Only exclude if it's clearly a greeting or common general word
    const commonGeneralWords = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'bye', 'goodbye', 'yes', 'no', 'ok', 'okay'];
    if (commonGeneralWords.includes(lowerMessage)) {
      return false;
    }
    // For other short phrases, assume they might be document-related
    return true;
  }

  // For longer questions (3+ words), assume they're likely document-related
  return true;
}

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

    // Check if the question requires document context
    const needsDocumentContext = requiresDocumentContext(message);
    console.log(`🔍 Document context needed: ${needsDocumentContext}`);

    let relevantChunks = [];
    let aiResponse;

    if (needsDocumentContext) {
      // Search for relevant chunks in the vector database
      relevantChunks = await searchSimilarChunks(message, documentId, 5);
      console.log(`📊 Found ${relevantChunks.length} relevant chunks`);

      if (relevantChunks.length > 0) {
        console.log(`📄 First chunk preview: ${relevantChunks[0].content.substring(0, 100)}...`);
        console.log(`📋 First chunk metadata:`, relevantChunks[0].metadata);
      }

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
      aiResponse = await generateResponse(message, relevantChunks, conversationHistory);
    } else {
      // Generate general AI response without document context
      aiResponse = await generateResponse(message, [], conversationHistory);
    }

    // Build response data
    const responseData = {
      response: aiResponse.text,
      confidence: aiResponse.confidence,
      tokensUsed: aiResponse.tokensUsed
    };

    // Only include sources and citations if the question needed document context
    console.log(`🔧 Building response - needsDocumentContext: ${needsDocumentContext}, chunks: ${relevantChunks.length}`);

    if (needsDocumentContext && relevantChunks.length > 0) {
      console.log(`📝 Building sources and citations for ${relevantChunks.length} chunks`);
      responseData.sources = relevantChunks.map((chunk, index) => {
        // Get page number from metadata - prioritize page_number field (most reliable)
        const pageNumber = chunk.metadata?.page_number;
        const totalPages = chunk.metadata?.num_pages || chunk.metadata?.numPages || 1;

        // Use page number directly if it exists and is valid, no strict validation against totalPages
        const validPageNumber = (pageNumber && pageNumber >= 1) ? Math.round(pageNumber) : null;

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
      });

      responseData.citations = relevantChunks.map((chunk, index) => {
        // Get page number from metadata - prioritize page_number field (most reliable)
        const pageNumber = chunk.metadata?.page_number;
        const chunkIndex = chunk.metadata?.chunk_index;

        // Use page number directly if it exists and is valid, no strict validation
        const validPageNumber = (pageNumber && pageNumber >= 1) ? Math.round(pageNumber) : null;

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
      });
    } else {
      // For general questions, don't include sources or citations
      responseData.sources = [];
      responseData.citations = [];
    }

    console.log(`📤 Sending response with ${responseData.sources?.length || 0} sources and ${responseData.citations?.length || 0} citations`);

    res.json({
      success: true,
      data: responseData
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
