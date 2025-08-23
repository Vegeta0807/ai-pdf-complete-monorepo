const Joi = require('joi');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// PDF upload validation with page count check
const uploadValidation = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are allowed'
    });
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(413).json({
      success: false,
      message: `File size exceeds limit of ${(maxSize / 1024 / 1024).toFixed(1)}MB`
    });
  }

  // Early page count validation
  try {
    const maxPages = parseInt(process.env.MAX_PAGES) || 50;
    const dataBuffer = await fs.readFile(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    console.log(`📄 Page validation: ${pdfData.numpages} pages (limit: ${maxPages})`);

    if (pdfData.numpages > maxPages) {
      return res.status(413).json({
        success: false,
        message: `PDF has ${pdfData.numpages} pages. Maximum allowed is ${maxPages} pages.`,
        errorCode: 'PAGE_LIMIT_EXCEEDED',
        data: {
          actualPages: pdfData.numpages,
          maxPages: maxPages
        }
      });
    }

    // Add page count to request for later use
    req.pdfPageCount = pdfData.numpages;
    req.isLargeDocument = pdfData.numpages >= (parseInt(process.env.LARGE_DOC_THRESHOLD) || 20);

  } catch (error) {
    console.error('Page count validation error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid PDF file or corrupted document',
      errorCode: 'PDF_VALIDATION_FAILED'
    });
  }

  next();
};

// Chat message validation schema
const chatSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required().messages({
    'string.empty': 'Message cannot be empty',
    'string.min': 'Message must be at least 1 character long',
    'string.max': 'Message cannot exceed 1000 characters',
    'any.required': 'Message is required'
  }),
  documentId: Joi.string().uuid().required().messages({
    'string.guid': 'Document ID must be a valid UUID',
    'any.required': 'Document ID is required'
  }),
  conversationHistory: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required(),
      timestamp: Joi.date().iso()
    })
  ).max(20).optional().messages({
    'array.max': 'Conversation history cannot exceed 20 messages'
  })
});

const chatValidation = validate(chatSchema);

// Document ID validation schema
const documentIdSchema = Joi.object({
  documentId: Joi.string().uuid().required().messages({
    'string.guid': 'Document ID must be a valid UUID',
    'any.required': 'Document ID is required'
  })
});

const documentIdValidation = validate(documentIdSchema);

module.exports = {
  validate,
  uploadValidation,
  chatValidation,
  documentIdValidation
};
