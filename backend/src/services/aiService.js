const Groq = require('groq-sdk');
const { OpenAI } = require('openai');

/**
 * Generate response using Groq API
 * @param {string} message - User message
 * @param {Array} relevantChunks - Relevant document chunks
 * @param {Array} conversationHistory - Previous conversation
 * @returns {Promise<object>} - AI response with metadata
 */
async function generateResponseGroq(message, relevantChunks, conversationHistory = []) {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    // Build enhanced context from relevant chunks with page information
    const context = relevantChunks
      .map((chunk, index) => {
        const pageInfo = chunk.metadata?.page_number ? ` (Page ${chunk.metadata.page_number})` : '';
        return `[Source ${index + 1}${pageInfo}]: ${chunk.content}`;
      })
      .join('\n\n---\n\n');

    // Detect document type for specialized instructions
    const isFinancialDoc = /(\$|€|£|¥|\d+\.\d{2}|balance|transaction|account|statement|payment|deposit|withdrawal|credit|debit)/gi.test(context);

    // Build conversation history with enhanced system prompt
    const messages = [
      {
        role: 'system',
        content: `You are a highly accurate AI assistant specialized in analyzing PDF documents with exceptional precision for structured data, especially financial documents like account statements, invoices, and reports.

CORE INSTRUCTIONS:
- Use ONLY the information provided in the context below to answer questions
- Be extremely precise with numbers, dates, amounts, and financial data
- Maintain exact formatting and values from the original document
- When referencing information, include citations in the format [Source X] where X is the source number
- Each source corresponds to a specific part of the document with page information when available

${isFinancialDoc ? `
FINANCIAL DOCUMENT EXPERTISE:
- Extract transaction details with complete accuracy: dates, amounts, descriptions, account numbers
- Preserve exact monetary values including cents (e.g., $1,234.56 not $1,234)
- Distinguish between different transaction types (credits, debits, transfers, fees)
- Maintain chronological order when listing transactions
- Include running balances and account totals exactly as shown
- Identify account information, statement periods, and merchant/payee details precisely
- For calculations, use only the exact numbers provided in the document
` : ''}

RESPONSE GUIDELINES:
- Start with a direct, accurate answer
- Include specific details and exact values from the document
- Cite sources with [Source X] format for all referenced information
- If the context lacks information for a question, state this clearly
- For financial queries, double-check all numbers and calculations

CONTEXT FROM PDF:
${context}`
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    const completion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.1-8b-instant', // Current fast and capable model
      temperature: 0.3,
      max_tokens: 1000,
      top_p: 0.9
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response generated from Groq');
    }

    console.log(`🤖 Generated response using Groq (${completion.usage?.total_tokens || 'unknown'} tokens)`);

    return {
      text: response,
      confidence: 0.85, // Groq generally provides good responses
      tokensUsed: completion.usage?.total_tokens || 0,
      model: 'llama-3.1-8b-instant',
      provider: 'groq'
    };

  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
}

/**
 * Generate response using OpenAI API
 * @param {string} message - User message
 * @param {Array} relevantChunks - Relevant document chunks
 * @param {Array} conversationHistory - Previous conversation
 * @returns {Promise<object>} - AI response with metadata
 */
async function generateResponseOpenAI(message, relevantChunks, conversationHistory = []) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Build enhanced context from relevant chunks with metadata
    const context = relevantChunks
      .map((chunk, index) => {
        let chunkText = `[Chunk ${index + 1}`;
        if (chunk.page) chunkText += `, Page ${chunk.page}`;
        chunkText += `]\n${chunk.content}`;
        return chunkText;
      })
      .join('\n\n---\n\n');

    // Detect document type for specialized instructions
    const isFinancialDoc = /(\$|€|£|¥|\d+\.\d{2}|balance|transaction|account|statement|payment|deposit|withdrawal|credit|debit)/gi.test(context);

    // Build messages array with enhanced system prompt
    const messages = [
      {
        role: 'system',
        content: `You are a highly accurate AI assistant specialized in analyzing PDF documents. You excel at extracting precise information, especially from structured documents like financial statements, reports, and account statements.

CORE INSTRUCTIONS:
- Use ONLY the information provided in the context below to answer questions
- Be extremely precise with numbers, dates, and financial data
- If the context doesn't contain relevant information, say so clearly
- Provide specific citations with page numbers when available
- Maintain the exact formatting and values from the original document

${isFinancialDoc ? `
FINANCIAL DOCUMENT GUIDELINES:
- Pay special attention to transaction details, amounts, dates, and account information
- Preserve exact monetary values and currency symbols
- Distinguish between credits, debits, balances, and different transaction types
- When summarizing transactions, maintain chronological order and include all relevant details
- For account statements, clearly identify account numbers, statement periods, and running balances
- Be precise about transaction descriptions and merchant/payee information
` : ''}

RESPONSE FORMAT:
- Start with a direct answer to the question
- Include specific details and exact values from the document
- Cite page numbers or sections when referencing information
- If calculations are needed, show your work using only the provided data

CONTEXT FROM PDF:
${context}`
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Latest, fast, and cost-effective model
      messages,
      temperature: 0.3,
      max_tokens: 1000,
      top_p: 0.9
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response generated from OpenAI');
    }

    console.log(`🤖 Generated response using OpenAI (${completion.usage?.total_tokens || 'unknown'} tokens)`);

    return {
      text: response,
      confidence: 0.9, // OpenAI generally provides high-quality responses
      tokensUsed: completion.usage?.total_tokens || 0,
      model: 'gpt-4o-mini',
      provider: 'openai'
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Generate simple response using template (fallback)
 * @param {string} message - User message
 * @param {Array} relevantChunks - Relevant document chunks
 * @returns {Promise<object>} - Simple response
 */
async function generateResponseSimple(message, relevantChunks) {
  console.log('⚠️ Using simple fallback response generation');

  if (relevantChunks.length === 0) {
    return {
      text: "I couldn't find relevant information in the uploaded PDF to answer your question. Please try rephrasing your question or upload a different document.",
      confidence: 0.1,
      tokensUsed: 0,
      model: 'simple-fallback',
      provider: 'local'
    };
  }

  // Simple template-based response
  const topChunk = relevantChunks[0];
  const response = `Based on the uploaded document, here's what I found:\n\n${topChunk.content.substring(0, 500)}${topChunk.content.length > 500 ? '...' : ''}\n\nThis information has a similarity score of ${(topChunk.similarity * 100).toFixed(1)}% to your question.`;

  return {
    text: response,
    confidence: Math.min(topChunk.similarity, 0.7),
    tokensUsed: 0,
    model: 'simple-fallback',
    provider: 'local'
  };
}

/**
 * Main response generation function with fallback strategy
 * @param {string} message - User message
 * @param {Array} relevantChunks - Relevant document chunks
 * @param {Array} conversationHistory - Previous conversation
 * @returns {Promise<object>} - AI response with metadata
 */
async function generateResponse(message, relevantChunks, conversationHistory = []) {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message: must be a non-empty string');
  }

  if (!Array.isArray(relevantChunks)) {
    throw new Error('Invalid relevantChunks: must be an array');
  }

  // Try different AI services in order of preference
  const strategies = [
    {
      name: 'Groq',
      condition: () => process.env.GROQ_API_KEY,
      function: generateResponseGroq
    },
    {
      name: 'OpenAI',
      condition: () => process.env.OPENAI_API_KEY,
      function: generateResponseOpenAI
    },
    {
      name: 'Simple Fallback',
      condition: () => true,
      function: generateResponseSimple
    }
  ];

  for (const strategy of strategies) {
    if (strategy.condition()) {
      try {
        console.log(`🚀 Trying ${strategy.name} for response generation...`);
        return await strategy.function(message, relevantChunks, conversationHistory);
      } catch (error) {
        console.warn(`⚠️ ${strategy.name} failed:`, error.message);
        if (strategy.name === 'Simple Fallback') {
          throw error; // Don't continue if even fallback fails
        }
      }
    }
  }

  throw new Error('All response generation strategies failed');
}

module.exports = {
  generateResponse,
  generateResponseGroq,
  generateResponseOpenAI,
  generateResponseSimple
};
