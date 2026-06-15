/**
 * Performance Monitoring Middleware
 *
 * Tracks request duration, logs slow endpoints (>500ms), and adds
 * Server-Timing headers for frontend diagnostics.
 *
 * Also handles:
 *   - Request timeout (30s for normal, 120s for AI endpoints)
 *   - Response compression headers
 *   - HTTP caching headers for GET requests
 */

const logger = require('../utils/logger');

// Track slow endpoints for optimization
const slowEndpointTracker = new Map();

function getSlowestEndpoints(limit = 10) {
  return [...slowEndpointTracker.entries()]
    .map(([key, data]) => ({ endpoint: key, ...data }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, limit);
}

function performanceMonitor(req, res, next) {
  const start = Date.now();

  // Attach start time for downstream use
  req._startTime = start;

  // Capture original end to inject timing
  const originalEnd = res.end;
  const chunks = [];

  res.end = function (...args) {
    const duration = Date.now() - start;
    const endpoint = `${req.method} ${req.route?.path || req.originalUrl}`;

    // Add Server-Timing header
    res.setHeader('Server-Timing', `total;dur=${duration}`);

    // Log slow requests (>500ms)
    if (duration > 500) {
      logger.warn('SLOW ENDPOINT', {
        endpoint,
        method: req.method,
        url: req.originalUrl,
        durationMs: duration,
        userId: req.user?.id || 'anonymous',
      });
    }

    // Track endpoint stats
    const key = `${req.method}:${req.originalUrl.split('?')[0]}`;
    if (!slowEndpointTracker.has(key)) {
      slowEndpointTracker.set(key, { count: 0, totalMs: 0, avgMs: 0, maxMs: 0 });
    }
    const stats = slowEndpointTracker.get(key);
    stats.count++;
    stats.totalMs += duration;
    stats.avgMs = Math.round(stats.totalMs / stats.count);
    stats.maxMs = Math.max(stats.maxMs, duration);

    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Request timeout middleware
 * Normal endpoints: 30s, AI endpoints: 120s
 */
function requestTimeout(req, res, next) {
  const isAIEndpoint = req.originalUrl.includes('/ai-quiz') ||
    req.originalUrl.includes('/ai/') ||
    req.originalUrl.includes('/coding/');

  const timeoutMs = isAIEndpoint ? 120000 : 30000;

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.error('REQUEST TIMEOUT', {
        url: req.originalUrl,
        method: req.method,
        timeoutMs,
      });
      res.status(503).json({
        error: 'Request timed out',
        timeoutMs,
      });
    }
  }, timeoutMs);

  res.on('finish', () => clearTimeout(timer));
  next();
}

/**
 * HTTP caching headers for GET responses
 * Cache static/data responses on CDN/browser for 5 minutes
 */
function cacheControl(maxAge = 300) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      // Don't cache authenticated user-specific data aggressively
      if (req.headers.authorization) {
        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      } else {
        res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge / 2}`);
      }
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}

/**
 * Response compression helper — sets Content-Encoding header
 * Actual compression is handled by express' compression middleware
 */
function compressionConfig() {
  return {
    level: 6,                    // Default compression level (good balance)
    memLevel: 8,                 // Memory level for compression
    threshold: 1024,             // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      // Compress JSON, text, JS, CSS
      return compression.filter(req, res);
    },
  };
}

module.exports = {
  performanceMonitor,
  requestTimeout,
  cacheControl,
  compressionConfig,
  getSlowestEndpoints,
};
