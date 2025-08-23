const Groq = require('groq-sdk');
const { OpenAI } = require('openai');

/**
 * Clean citation patterns from AI response
 * @param {string} response - AI response text
 * @returns {string} - Cleaned response
 */
function cleanCitationPatterns(response) {
  if (!response) return response;

  // Remove patterns like [Source X (Page Y) [Chunk Z]]
  let cleaned = response.replace(/\[Source \d+[^\]]*\]/g, '');

  // Remove patterns like [Page X]
  cleaned = cleaned.replace(/\[Page \d+[^\]]*\]/g, '');

  // Remove patterns like [Chunk X]
  cleaned = cleaned.replace(/\[Chunk \d+[^\]]*\]/g, '');

  // Remove any remaining bracketed references
  cleaned = cleaned.replace(/\[[^\]]*Source[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\[[^\]]*Page[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\[[^\]]*Chunk[^\]]*\]/g, '');

  // Clean up any double spaces or line breaks left by removals
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');

  return cleaned;
}

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
    const context = relevantChunks.length > 0
      ? relevantChunks
          .map((chunk, index) => {
            // Try multiple possible page number fields for compatibility
            const pageNumber = chunk.metadata?.page_number || chunk.metadata?.estimated_page || chunk.page;
            const pageInfo = pageNumber ? ` (Page ${pageNumber})` : '';
            const chunkInfo = chunk.metadata?.chunk_index !== undefined ? ` [Chunk ${chunk.metadata.chunk_index}]` : '';
            return `[Source ${index + 1}${pageInfo}${chunkInfo}]: ${chunk.content}`;
          })
          .join('\n\n---\n\n')
      : '';

    // Enhanced financial document detection
    const financialKeywords = [
      'balance', 'transaction', 'account', 'statement', 'payment', 'deposit', 'withdrawal',
      'credit', 'debit', 'transfer', 'fee', 'interest', 'overdraft', 'available balance',
      'current balance', 'previous balance', 'beginning balance', 'ending balance',
      'account number', 'routing number', 'statement period', 'transaction date',
      'description', 'amount', 'running balance', 'merchant', 'payee', 'check number',
      'bank statement', 'checking account', 'savings account', 'credit card statement'
    ];

    const hasFinancialKeywords = financialKeywords.some(keyword =>
      context.toLowerCase().includes(keyword.toLowerCase())
    );

    const hasMonetaryAmounts = /(\$|€|£|¥)\s*\d+\.\d{2}|\d+\.\d{2}\s*(CR|DR|debit|credit)/gi.test(context);
    const hasDatePatterns = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}/g.test(context);

    const isFinancialDoc = hasFinancialKeywords && (hasMonetaryAmounts || hasDatePatterns);
    const isBankStatement = /bank\s+statement|checking\s+account|savings\s+account|account\s+summary/gi.test(context);

    // Build conversation history with enhanced system prompt
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant that can both analyze PDF documents and answer general questions.

${context ? `
DOCUMENT ANALYSIS MODE:
You are analyzing a PDF document. Use ONLY the information provided in the context below to answer questions.

CORE INSTRUCTIONS:
- Be extremely precise with numbers, dates, amounts, and financial data
- Maintain exact formatting and values from the original document
- DO NOT include citation patterns like [Source X], [Page Y], or [Chunk Z] in your response text
- Reference information naturally without explicit citation markers or brackets
- Preserve the original currency symbols and formats exactly as shown in the document
- Do not assume currency types - use only what is explicitly shown in the document
- Each source in the context corresponds to a specific part of the document with page information
` : `
GENERAL ASSISTANCE MODE:
You are answering a general question that doesn't require document analysis. Provide helpful, accurate information based on your knowledge.

CORE INSTRUCTIONS:
- Be helpful, accurate, and conversational
- Provide clear explanations and examples when appropriate
- If you're unsure about something, acknowledge the uncertainty
- Keep responses concise but informative
`}

${isFinancialDoc ? `
FINANCIAL DOCUMENT EXPERTISE:
- Extract transaction details with complete accuracy: dates, amounts, descriptions, account numbers
- Preserve exact monetary values and currency symbols as shown in the document
- DO NOT assume currency types (like $ for dollars) - use only what is explicitly shown
- Distinguish between different transaction types (credits, debits, transfers, fees)
- Maintain chronological order when listing transactions
- Include running balances and account totals exactly as shown
- Identify account information, statement periods, and merchant/payee details precisely
- For calculations, use only the exact numbers and currency symbols provided in the document
- When referencing amounts, use the exact format from the document (e.g., if it shows "1,234.56" without currency symbol, don't add one)

${isBankStatement ? `
BANK STATEMENT SPECIFIC INSTRUCTIONS:
- Identify the account holder name, account number, and statement period
- Extract opening balance, closing balance, and any intermediate balances
- List all transactions with: date, description, amount, and transaction type
- Identify deposits, withdrawals, transfers, fees, and interest payments
- Note any overdraft fees, service charges, or other bank fees
- Preserve the exact transaction descriptions as they appear
- When summarizing transactions, group by type (deposits, withdrawals, etc.)
- Calculate totals only using the exact amounts and currency formats shown in the statement
- Do not convert or assume currency types - use exactly what appears in the document
` : ''}
` : ''}
RESPONSE GUIDELINES:
- Start with a direct, accurate answer
- Include specific details and exact values from the document
- Reference information naturally without any citation markers, brackets, or source labels
- ABSOLUTELY FORBIDDEN: Never use patterns like [Source X], [Page Y], [Chunk Z], or similar bracketed references
- ABSOLUTELY FORBIDDEN: Do not include any text in square brackets [ ] in your response
- If the context lacks information for a question, state this clearly
- For financial queries, double-check all numbers and calculations
- Write in a natural, conversational tone without technical citation formats
- When referencing document sections, use natural language like "according to the statement" or "as shown in the document"
- Instead of citing sources with brackets, simply state the information as fact from the document

${context ? `CONTEXT FROM PDF:\n${context}` : ''}`
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message with explicit instruction
    messages.push({
      role: 'user',
      content: `${message}

IMPORTANT: Do not include any bracketed citations like [Source X], [Page Y], or [Chunk Z] in your response. Reference information naturally without brackets.`
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

    // Clean any citation patterns from the response
    const cleanedResponse = cleanCitationPatterns(response);

    console.log(`🤖 Generated response using Groq (${completion.usage?.total_tokens || 'unknown'} tokens)`);

    return {
      text: cleanedResponse,
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
    const context = relevantChunks.length > 0
      ? relevantChunks
          .map((chunk, index) => {
            // Try multiple possible page number fields for compatibility
            const pageNumber = chunk.metadata?.page_number || chunk.metadata?.estimated_page || chunk.page;
            const pageInfo = pageNumber ? `, Page ${pageNumber}` : '';
            const chunkInfo = chunk.metadata?.chunk_index !== undefined ? `, Chunk ${chunk.metadata.chunk_index}` : '';
            let chunkText = `[Source ${index + 1}${pageInfo}${chunkInfo}]`;
            chunkText += `\n${chunk.content}`;
            return chunkText;
          })
          .join('\n\n---\n\n')
      : '';

    // Enhanced financial document detection (same as Groq)
    const financialKeywords = [
      'balance', 'transaction', 'account', 'statement', 'payment', 'deposit', 'withdrawal',
      'credit', 'debit', 'transfer', 'fee', 'interest', 'overdraft', 'available balance',
      'current balance', 'previous balance', 'beginning balance', 'ending balance',
      'account number', 'routing number', 'statement period', 'transaction date',
      'description', 'amount', 'running balance', 'merchant', 'payee', 'check number',
      'bank statement', 'checking account', 'savings account', 'credit card statement'
    ];

    const hasFinancialKeywords = financialKeywords.some(keyword =>
      context.toLowerCase().includes(keyword.toLowerCase())
    );

    const hasMonetaryAmounts = /(\$|€|£|¥)\s*\d+\.\d{2}|\d+\.\d{2}\s*(CR|DR|debit|credit)/gi.test(context);
    const hasDatePatterns = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}/g.test(context);

    const isFinancialDoc = hasFinancialKeywords && (hasMonetaryAmounts || hasDatePatterns);
    const isBankStatement = /bank\s+statement|checking\s+account|savings\s+account|account\s+summary/gi.test(context);

    // Build messages array with enhanced system prompt
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant that can both analyze PDF documents and answer general questions.

${context ? `
DOCUMENT ANALYSIS MODE:
You are analyzing a PDF document. Use ONLY the information provided in the context below to answer questions.

CORE INSTRUCTIONS:
- Be extremely precise with numbers, dates, and financial data
- If the context doesn't contain relevant information, say so clearly
- DO NOT include citation patterns like [Source X], [Page Y], or [Chunk Z] in your response text
- Reference information naturally without explicit citation markers or brackets
- Maintain the exact formatting and values from the original document
- Preserve the original currency symbols and formats exactly as shown in the document
- Do not assume currency types - use only what is explicitly shown in the document
` : `
GENERAL ASSISTANCE MODE:
You are answering a general question that doesn't require document analysis. Provide helpful, accurate information based on your knowledge.

CORE INSTRUCTIONS:
- Be helpful, accurate, and conversational
- Provide clear explanations and examples when appropriate
- If you're unsure about something, acknowledge the uncertainty
- Keep responses concise but informative
`}

${isFinancialDoc ? `
FINANCIAL DOCUMENT GUIDELINES:
- Pay special attention to transaction details, amounts, dates, and account information
- Preserve exact monetary values and currency symbols as shown in the document
- DO NOT assume currency types (like $ for dollars) - use only what is explicitly shown
- Distinguish between credits, debits, balances, and different transaction types
- When summarizing transactions, maintain chronological order and include all relevant details
- For account statements, clearly identify account numbers, statement periods, and running balances
- Be precise about transaction descriptions and merchant/payee information
- When referencing amounts, use the exact format from the document

${isBankStatement ? `
BANK STATEMENT SPECIFIC GUIDELINES:
- Identify the account holder name, account number, and statement period
- Extract opening balance, closing balance, and any intermediate balances
- List all transactions with: date, description, amount, and transaction type
- Identify deposits, withdrawals, transfers, fees, and interest payments
- Note any overdraft fees, service charges, or other bank fees
- Preserve the exact transaction descriptions as they appear
- When summarizing transactions, group by type (deposits, withdrawals, etc.)
- Calculate totals only using the exact amounts and currency formats shown in the statement
- Do not convert or assume currency types - use exactly what appears in the document
` : ''}
` : ''}

RESPONSE FORMAT:
- Start with a direct answer to the question
- Include specific details and exact values from the document
- Reference information naturally without any citation markers, brackets, or source labels
- ABSOLUTELY FORBIDDEN: Never use patterns like [Source X], [Page Y], [Chunk Z], or similar bracketed references
- ABSOLUTELY FORBIDDEN: Do not include any text in square brackets [ ] in your response
- If calculations are needed, show your work using only the provided data
- Write in a natural, conversational tone without technical citation formats
- When referencing document sections, use natural language like "according to the statement" or "as shown in the document"
- Instead of citing sources with brackets, simply state the information as fact from the document

${context ? `CONTEXT FROM PDF:\n${context}` : ''}`
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message with explicit instruction
    messages.push({
      role: 'user',
      content: `${message}

IMPORTANT: Do not include any bracketed citations like [Source X], [Page Y], or [Chunk Z] in your response. Reference information naturally without brackets.`
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

    // Clean any citation patterns from the response
    const cleanedResponse = cleanCitationPatterns(response);

    console.log(`🤖 Generated response using OpenAI (${completion.usage?.total_tokens || 'unknown'} tokens)`);

    return {
      text: cleanedResponse,
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
