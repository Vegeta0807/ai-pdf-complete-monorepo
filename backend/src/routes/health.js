const express = require('express');
const { ChromaClient } = require('chromadb');
const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      services: {
        api: 'healthy',
        chroma: 'unknown'
      }
    };

    // Check Chroma DB connection
    try {
      const client = new ChromaClient({
        path: process.env.CHROMA_URL || 'http://localhost:8000'
      });
      await client.heartbeat();
      health.services.chroma = 'healthy';
    } catch (error) {
      health.services.chroma = 'unhealthy';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = router;
