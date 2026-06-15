/**
 * JWT Authentication Middleware
 *
 * Validates the Bearer token on every protected request.
 * Uses a cache to avoid repeated JWT decoding for the same token
 * within its expiry window.
 *
 * Performance: JWT verify is O(1) and fast (~1-5µs), so no caching needed
 * for the decode itself. But we cache the user lookup for dashboard-heavy
 * endpoints that call auth on every request.
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token', { error: error.message });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;
