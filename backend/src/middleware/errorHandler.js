const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    message: err.message || 'Internal Server Error',
    statusCode: err.statusCode || 500
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      success: false,
      message,
      statusCode: 400
    };
  }

  // Duplicate key error
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = {
      success: false,
      message,
      statusCode: 400
    };
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      success: false,
      message,
      statusCode: 401
    };
  }

  // File upload error
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = {
      success: false,
      message,
      statusCode: 413
    };
  }

  // AI API errors
  if (err.response && err.response.status) {
    error = {
      success: false,
      message: `AI API Error: ${err.response.data?.error?.message || err.message}`,
      statusCode: err.response.status
    };
  }

  res.status(error.statusCode).json({
    success: error.success,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };
