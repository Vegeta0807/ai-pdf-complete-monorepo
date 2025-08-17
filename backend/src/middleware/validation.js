const Joi = require('joi');

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

// PDF upload validation
const uploadValidation = (req, res, next) => {
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
