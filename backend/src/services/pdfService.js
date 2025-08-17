const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Process PDF using pdf-parse (local processing)
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function processPDFLocal(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    console.log(`📄 PDF processed locally: ${data.numpages} pages, ${data.text.length} characters`);
    
    return data.text;
  } catch (error) {
    console.error('Local PDF processing error:', error);
    throw new Error(`Failed to process PDF locally: ${error.message}`);
  }
}

/**
 * Process PDF using LlamaParse API (cloud processing)
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted markdown content
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
      return result;
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
 * Main PDF processing function with fallback strategy
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function processPDF(filePath) {
  try {
    // Check if LlamaParse API key is available
    if (process.env.LLAMAPARSE_API_KEY) {
      console.log('🚀 Using LlamaParse for PDF processing...');
      return await processPDFWithLlamaParse(filePath);
    } else {
      console.log('📄 Using local PDF processing...');
      return await processPDFLocal(filePath);
    }
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
 * @returns {Array<string>} - Array of text chunks
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    
    // If we're not at the end, try to break at a sentence or paragraph
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
  }

  console.log(`📝 Text chunked into ${chunks.length} pieces`);
  return chunks;
}

module.exports = {
  processPDF,
  processPDFLocal,
  processPDFWithLlamaParse,
  chunkText
};
