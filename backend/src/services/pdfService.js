const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Process PDF using pdf-parse (local processing) with progress tracking
 * @param {string} filePath - Path to the PDF file
 * @param {object} options - Processing options
 * @param {function} options.onProgress - Progress callback function
 * @returns {Promise<object>} - Extracted text content with page information
 */
async function processPDFLocal(filePath, options = {}) {
  const { onProgress } = options;
  try {
    if (onProgress) onProgress(10, 'Reading PDF file...');
    const dataBuffer = await fs.readFile(filePath);

    if (onProgress) onProgress(30, 'Parsing PDF content...');
    // Enhanced PDF parsing options for better text extraction
    const data = await pdfParse(dataBuffer, {
      // Preserve more whitespace and formatting
      normalizeWhitespace: false,
      // Better handling of tables and structured content
      max: 0, // No page limit
      version: 'v1.10.100' // Use latest version features
    });

    console.log(`📄 PDF processed locally: ${data.numpages} pages, ${data.text.length} characters`);
    if (onProgress) onProgress(60, 'Processing text content...');

    // Enhanced text processing for financial documents
    let processedText = data.text;

    // Detect if this is likely a bank statement or financial document
    const isFinancialDoc = /(\$|€|£|¥|\d+\.\d{2}|balance|transaction|account|statement|payment|deposit|withdrawal|credit|debit)/gi.test(processedText.substring(0, 2000));

    if (isFinancialDoc) {
      console.log('📊 Detected financial document - applying enhanced text processing');

      // Enhanced processing for financial documents
      processedText = processedText
        // Normalize line breaks but preserve structure
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Preserve table structure by maintaining spacing for financial data
        .replace(/[ ]{3,}/g, (match) => ' '.repeat(Math.min(match.length, 10)))
        // Ensure proper spacing around monetary amounts
        .replace(/(\$|€|£|¥)\s*(\d)/g, '$1$2')
        .replace(/(\d+\.\d{2})\s*(CR|DR|debit|credit)/gi, '$1 $2')
        // Preserve date formats common in bank statements
        .replace(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g, ' $1 ')
        .replace(/(\d{4}-\d{2}-\d{2})/g, ' $1 ')
        .replace(/(\d{2}-\d{2}-\d{4})/g, ' $1 ')
        // Ensure proper spacing around transaction descriptions
        .replace(/(\d+\.?\d*)\s*([A-Za-z])/g, '$1 $2')
        .replace(/([A-Za-z])\s*(\d+\.?\d*)/g, '$1 $2')
        // Preserve account numbers and reference numbers
        .replace(/([A-Z]{2,})\s*(\d{4,})/g, '$1 $2')
        // Clean up excessive whitespace while preserving financial structure
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/[ ]{2}/g, ' ')
        .trim();
    } else {
      // Standard text processing for non-financial documents
      processedText = processedText
        // Normalize line breaks but preserve structure
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Preserve multiple spaces that might indicate table columns
        .replace(/[ ]{2,}/g, (match) => ' '.repeat(Math.min(match.length, 8)))
        // Ensure proper spacing around numbers and dates
        .replace(/(\d+\.?\d*)\s*([A-Za-z])/g, '$1 $2')
        .replace(/([A-Za-z])\s*(\d+\.?\d*)/g, '$1 $2')
        // Preserve currency symbols and amounts
        .replace(/(\$|€|£|¥)\s*(\d)/g, '$1$2')
        // Clean up excessive whitespace while preserving structure
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    }

    console.log(`📊 Text processing: ${data.text.length} → ${processedText.length} characters`);
    if (onProgress) onProgress(90, 'Finalizing processing...');

    // Return both text and page count
    return {
      text: processedText,
      numPages: data.numpages,
      metadata: {
        title: data.info?.Title || null,
        author: data.info?.Author || null,
        creator: data.info?.Creator || null,
        producer: data.info?.Producer || null,
        creationDate: data.info?.CreationDate || null,
        // Add processing metadata
        processingMethod: 'enhanced-local',
        textLength: processedText.length,
        originalTextLength: data.text.length
      }
    };
  } catch (error) {
    console.error('Local PDF processing error:', error);
    throw new Error(`Failed to process PDF locally: ${error.message}`);
  }
}

/**
 * Process PDF using LlamaParse API (cloud processing)
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<object>} - Extracted text content with page information
 */
async function processPDFWithLlamaParse(filePath) {
  try {
    const apiKey = process.env.LLAMAPARSE_API_KEY;
    if (!apiKey) {
      throw new Error('LLAMAPARSE_API_KEY not configured');
    }

    // Read the PDF file
    const fileBuffer = await fs.readFile(filePath);

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'document.pdf',
      contentType: 'application/pdf'
    });

    console.log('🚀 Sending PDF to LlamaParse API...');

    // Send to LlamaParse API (correct endpoint)
    const response = await axios.post('https://api.cloud.llamaindex.ai/api/parsing/upload', formData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      timeout: 120000 // 2 minute timeout for large PDFs
    });

    // LlamaParse returns a job ID, we need to poll for results
    const jobId = response.data.id;
    if (!jobId) {
      throw new Error('No job ID returned from LlamaParse API');
    }

    console.log(`📋 LlamaParse job created: ${jobId}, polling for results...`);

    // Poll for results
    const result = await pollLlamaParseJob(apiKey, jobId);

    if (result && result.length > 0) {
      console.log(`📄 PDF processed with LlamaParse: ${result.length} characters`);

      // Get accurate page count using pdf-parse (just for metadata)
      let actualPages = 1; // fallback
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        actualPages = pdfData.numpages;
        console.log(`📊 Accurate page count from pdf-parse: ${actualPages} pages`);
      } catch (pageCountError) {
        console.warn('⚠️ Could not get accurate page count, using estimation');
        actualPages = Math.max(1, Math.ceil(result.length / 2000)); // Rough estimate as fallback
      }

      return {
        text: result,
        numPages: actualPages,
        metadata: {
          source: 'LlamaParse',
          processingMethod: 'cloud'
        }
      };
    } else {
      throw new Error('No content returned from LlamaParse API');
    }

  } catch (error) {
    console.error('LlamaParse processing error:', error);

    // Fallback to local processing if LlamaParse fails
    console.log('🔄 Falling back to local PDF processing...');
    return await processPDFLocal(filePath);
  }
}

/**
 * Poll LlamaParse job for completion and results
 * @param {string} apiKey - LlamaParse API key
 * @param {string} jobId - Job ID from LlamaParse
 * @returns {Promise<string>} - Extracted text content
 */
async function pollLlamaParseJob(apiKey, jobId) {
  const maxAttempts = 30; // 5 minutes max (10 second intervals)
  const pollInterval = 10000; // 10 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Polling LlamaParse job ${jobId} (attempt ${attempt}/${maxAttempts})...`);

      const response = await axios.get(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000
      });

      const status = response.data.status;
      console.log(`📊 Job status: ${status}`);

      if (status === 'SUCCESS') {
        // Job completed successfully, get the result
        const resultResponse = await axios.get(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        });

        return resultResponse.data.markdown || resultResponse.data.text || resultResponse.data;
      } else if (status === 'ERROR' || status === 'FAILED') {
        throw new Error(`LlamaParse job failed with status: ${status}`);
      } else if (status === 'PENDING' || status === 'RUNNING') {
        // Job still processing, wait and try again
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        } else {
          throw new Error('LlamaParse job timed out');
        }
      } else {
        throw new Error(`Unknown LlamaParse job status: ${status}`);
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log(`⚠️ Polling attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error('LlamaParse job polling exceeded maximum attempts');
}

/**
 * Main PDF processing function with fallback strategy and progress tracking
 * @param {string} filePath - Path to the PDF file
 * @param {object} options - Processing options
 * @param {function} options.onProgress - Progress callback function
 * @returns {Promise<object>} - Extracted text content with page information
 */
async function processPDF(filePath, options = {}) {
  const { onProgress } = options;

  try {
    if (onProgress) onProgress(0, 'Starting PDF processing...');

    // Check if LlamaParse API key is available
    if (process.env.LLAMAPARSE_API_KEY && process.env.LLAMAPARSE_API_KEY !== 'exaple-key') {
      console.log('🚀 Using LlamaParse for PDF processing...');
      if (onProgress) onProgress(20, 'Using cloud processing...');

      try {
        const result = await processPDFWithLlamaParse(filePath, options);
        if (onProgress) onProgress(100, 'Cloud processing completed');
        return result;
      } catch (llamaError) {
        console.warn('⚠️ LlamaParse failed, falling back to local processing:', llamaError.message);
        if (onProgress) onProgress(30, 'Falling back to local processing...');
      }
    }

    console.log('📄 Using local PDF processing...');
    if (onProgress) onProgress(40, 'Processing locally...');

    const result = await processPDFLocal(filePath, options);
    if (onProgress) onProgress(100, 'Local processing completed');
    return result;

  } catch (error) {
    console.error('PDF processing failed:', error);
    throw error;
  } finally {
    // Clean up uploaded file after processing
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Cleaned up temporary file: ${filePath}`);
    } catch (cleanupError) {
      console.warn(`⚠️ Failed to cleanup file ${filePath}:`, cleanupError.message);
    }
  }
}

/**
 * Chunk text into smaller pieces for vectorization
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Maximum characters per chunk
 * @param {number} overlap - Character overlap between chunks
 * @param {number} totalPages - Total number of pages in the document
 * @returns {Array<object>} - Array of text chunks with page information
 */
function chunkText(text, chunkSize = 1500, overlap = 300, totalPages = 1) {
  const chunks = [];
  let start = 0;

  // More conservative page estimation
  const avgCharsPerPage = Math.max(500, text.length / Math.max(totalPages, 1));

  console.log(`📊 Enhanced chunking: ${text.length} chars, ${totalPages} pages, ${Math.round(avgCharsPerPage)} chars/page`);

  // Enhanced financial document detection
  const financialKeywords = [
    'balance', 'transaction', 'account', 'statement', 'payment', 'deposit', 'withdrawal',
    'credit', 'debit', 'transfer', 'fee', 'interest', 'overdraft', 'available balance',
    'current balance', 'previous balance', 'beginning balance', 'ending balance',
    'account number', 'routing number', 'statement period', 'transaction date',
    'description', 'amount', 'running balance', 'merchant', 'payee', 'check number'
  ];

  const hasFinancialKeywords = financialKeywords.some(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );

  const hasMonetaryAmounts = /(\$|€|£|¥)\s*\d+\.\d{2}|\d+\.\d{2}\s*(CR|DR|debit|credit)/gi.test(text.substring(0, 3000));
  const hasDatePatterns = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}/g.test(text.substring(0, 2000));
  const hasAccountNumbers = /account\s*#?\s*\d{4,}|acct\s*#?\s*\d{4,}/gi.test(text.substring(0, 2000));

  const isFinancialDoc = hasFinancialKeywords && (hasMonetaryAmounts || hasDatePatterns || hasAccountNumbers);

  if (isFinancialDoc) {
    console.log('📊 Detected financial document - using enhanced chunking strategy');
    console.log(`   - Financial keywords: ${hasFinancialKeywords}`);
    console.log(`   - Monetary amounts: ${hasMonetaryAmounts}`);
    console.log(`   - Date patterns: ${hasDatePatterns}`);
    console.log(`   - Account numbers: ${hasAccountNumbers}`);

    chunkSize = 2500; // Larger chunks for financial data to preserve transaction context
    overlap = 500;    // More overlap to preserve transaction relationships
  }

  while (start < text.length) {
    let end = start + chunkSize;

    // Enhanced break point detection for financial documents
    if (end < text.length) {
      const breakPoints = [];

      // Look for natural break points
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const lastDoubleNewline = text.lastIndexOf('\n\n', end);

      // Enhanced break point detection for financial documents
      if (isFinancialDoc) {
        // Look for transaction date patterns (common in bank statements)
        const datePatterns = [
          /\d{1,2}\/\d{1,2}\/\d{2,4}/g,  // MM/DD/YYYY or M/D/YY
          /\d{4}-\d{2}-\d{2}/g,          // YYYY-MM-DD
          /\d{2}-\d{2}-\d{4}/g,          // DD-MM-YYYY
          /\d{2}\/\d{2}\/\d{4}/g         // DD/MM/YYYY
        ];

        datePatterns.forEach(pattern => {
          let match;
          const searchText = text.substring(Math.max(0, end - 600), end + 200);
          while ((match = pattern.exec(searchText)) !== null) {
            const actualPos = Math.max(0, end - 600) + match.index;
            if (actualPos > start + chunkSize * 0.2 && actualPos < end) {
              breakPoints.push(actualPos);
            }
          }
        });

        // Look for monetary amount patterns (transaction amounts)
        const amountPatterns = [
          /\$\d+\.\d{2}/gi,                    // $123.45
          /\d+\.\d{2}\s*(CR|DR)/gi,           // 123.45 CR/DR
          /\d+\.\d{2}\s*(debit|credit)/gi,    // 123.45 debit/credit
          /-?\$?\d{1,3}(,\d{3})*\.\d{2}/g     // -$1,234.56 or 1,234.56
        ];

        amountPatterns.forEach(pattern => {
          let match;
          const searchText = text.substring(Math.max(0, end - 400), end + 200);
          while ((match = pattern.exec(searchText)) !== null) {
            const actualPos = Math.max(0, end - 400) + match.index + match[0].length;
            if (actualPos > start + chunkSize * 0.3 && actualPos < end) {
              breakPoints.push(actualPos);
            }
          }
        });

        // Look for transaction description patterns
        const transactionPatterns = [
          /\n\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s+/g,  // New line with date
          /\n\s*[A-Z][A-Z\s&]+\s+\$?\d+\.\d{2}/g, // New line with merchant name and amount
          /\n\s*CHECK\s*#?\s*\d+/gi,               // Check transactions
          /\n\s*TRANSFER\s+/gi,                    // Transfer transactions
          /\n\s*DEPOSIT\s+/gi,                     // Deposit transactions
          /\n\s*WITHDRAWAL\s+/gi                   // Withdrawal transactions
        ];

        transactionPatterns.forEach(pattern => {
          let match;
          const searchText = text.substring(Math.max(0, end - 500), end + 100);
          while ((match = pattern.exec(searchText)) !== null) {
            const actualPos = Math.max(0, end - 500) + match.index;
            if (actualPos > start + chunkSize * 0.2 && actualPos < end) {
              breakPoints.push(actualPos);
            }
          }
        });
      }

      // Add standard break points
      if (lastDoubleNewline > start + chunkSize * 0.3) breakPoints.push(lastDoubleNewline + 2);
      if (lastNewline > start + chunkSize * 0.5) breakPoints.push(lastNewline + 1);
      if (lastPeriod > start + chunkSize * 0.5) breakPoints.push(lastPeriod + 1);

      // Choose the best break point
      if (breakPoints.length > 0) {
        // Prefer break points closer to the target end
        breakPoints.sort((a, b) => Math.abs(a - end) - Math.abs(b - end));
        end = breakPoints[0];
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      // Enhanced page estimation algorithm
      const chunkStart = start;
      const chunkEnd = end;
      const chunkMiddle = start + (end - start) / 2;

      // Calculate page estimates for start, middle, and end of chunk
      const startPageEstimate = Math.max(1, Math.floor(chunkStart / avgCharsPerPage) + 1);
      const middlePageEstimate = Math.max(1, Math.floor(chunkMiddle / avgCharsPerPage) + 1);
      const endPageEstimate = Math.max(1, Math.floor(chunkEnd / avgCharsPerPage) + 1);

      // Use the middle estimate as primary, but validate against start/end
      let estimatedPage = middlePageEstimate;

      // If chunk spans multiple pages, use the page where most content is
      if (startPageEstimate !== endPageEstimate) {
        // Calculate which page has more content in this chunk
        const startPageEnd = startPageEstimate * avgCharsPerPage;
        const endPageStart = (endPageEstimate - 1) * avgCharsPerPage;

        const contentInStartPage = Math.max(0, Math.min(startPageEnd, chunkEnd) - chunkStart);
        const contentInEndPage = Math.max(0, chunkEnd - Math.max(endPageStart, chunkStart));

        if (contentInEndPage > contentInStartPage) {
          estimatedPage = endPageEstimate;
        } else {
          estimatedPage = startPageEstimate;
        }
      }

      // Ensure we don't exceed actual page count
      estimatedPage = Math.min(estimatedPage, totalPages);
      estimatedPage = Math.max(1, estimatedPage);

      // Enhanced metadata for financial documents
      const chunkMetadata = {
        text: chunk,
        startChar: start,
        endChar: end,
        estimatedPage: estimatedPage,
        chunkIndex: chunks.length,
        // Enhanced financial document indicators
        containsAmounts: /\$\d+\.\d{2}|\d+\.\d{2}\s*(CR|DR)|(\$|€|£|¥)\s*\d{1,3}(,\d{3})*\.\d{2}/gi.test(chunk),
        containsDates: /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}/g.test(chunk),
        containsTransactions: /transaction|payment|deposit|withdrawal|transfer|check|debit|credit/gi.test(chunk),
        containsAccountInfo: /account\s*#?\s*\d{4,}|balance|statement\s+period/gi.test(chunk),
        containsMerchantInfo: /[A-Z][A-Z\s&]{3,}\s+\$?\d+\.\d{2}/g.test(chunk),
        isFinancialContent: isFinancialDoc,
        // Transaction count estimation
        transactionCount: (chunk.match(/\d{1,2}\/\d{1,2}\/\d{2,4}\s+.*?\$?\d+\.\d{2}/g) || []).length,
        // Balance information
        containsBalance: /balance|available|current|previous|beginning|ending/gi.test(chunk)
      };

      chunks.push(chunkMetadata);
    }

    start = end - overlap;
  }

  // Enhanced debugging: Log page distribution and chunk analysis
  const pageDistribution = chunks.reduce((acc, chunk) => {
    acc[chunk.estimatedPage] = (acc[chunk.estimatedPage] || 0) + 1;
    return acc;
  }, {});

  // Calculate financial content statistics
  const financialStats = {
    chunksWithAmounts: chunks.filter(c => c.containsAmounts).length,
    chunksWithDates: chunks.filter(c => c.containsDates).length,
    chunksWithTransactions: chunks.filter(c => c.containsTransactions).length,
    chunksWithAccountInfo: chunks.filter(c => c.containsAccountInfo).length,
    totalTransactions: chunks.reduce((sum, c) => sum + (c.transactionCount || 0), 0)
  };

  console.log(`📝 Text chunked into ${chunks.length} pieces with enhanced page estimates`);
  console.log(`📊 Page distribution:`, pageDistribution);
  console.log(`📄 Total pages: ${totalPages}, Avg chars per page: ${Math.round(avgCharsPerPage)}`);

  if (isFinancialDoc) {
    console.log(`💰 Financial content analysis:`, financialStats);
  }

  return chunks;
}

module.exports = {
  processPDF,
  processPDFLocal,
  processPDFWithLlamaParse,
  chunkText
};
