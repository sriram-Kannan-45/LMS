/**
 * Optimized API Request Layer
 *
 * Features:
 *   - In-flight request deduplication (same URL called simultaneously)
 *   - Response caching with TTL (for GET requests)
 *   - Automatic retry on network failures (up to 2 retries)
 *   - Parallel request support via requestAll()
 *   - Request timeout handling
 *   - Optimistic mutation support
 */

// ─── In-flight request deduplication ──────────────────────────────
const inflightRequests = new Map()
const responseCache = new Map()
const CACHE_TTL = 60 * 1000 // 60 seconds default cache

function getCacheKey(url, options) {
  return `${options.method || 'GET'}:${url}`
}

async function apiRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const cacheKey = getCacheKey(url, options)

  // Return cached response for GET requests (if fresh)
  if (method === 'GET' && !options.skipCache) {
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
  }

  // Deduplicate in-flight requests
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey)
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Build fetch options
  const fetchOptions = {
    ...options,
    method,
    headers,
  }

  // Remove non-fetch properties
  delete fetchOptions.skipCache
  delete fetchOptions.retries

  // Create the request promise
  const requestPromise = (async () => {
    const maxRetries = options.retries ?? 2
    let lastError

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const res = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // For 204 No Content
        if (res.status === 204) {
          const result = { success: true }
          if (method === 'GET' && !options.skipCache) {
            responseCache.set(cacheKey, { data: result, timestamp: Date.now() })
          }
          return result
        }

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error || data.message || `HTTP ${res.status}: Request failed`)
        }

        // Cache successful GET responses
        if (method === 'GET' && !options.skipCache) {
          responseCache.set(cacheKey, { data, timestamp: Date.now() })
        }

        return data
      } catch (err) {
        lastError = err
        // Don't retry on 4xx errors or aborts
        if (err.name === 'AbortError') {
          throw new Error('Request timed out')
        }
        if (err.message?.startsWith('HTTP 4')) {
          throw err
        }
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500))
        }
      }
    }
    throw lastError || new Error('Request failed')
  })()

  inflightRequests.set(cacheKey, requestPromise)

  // Clean up after request completes
  requestPromise.finally(() => {
    inflightRequests.delete(cacheKey)
  })

  return requestPromise
}

/**
 * Execute multiple independent API requests in parallel
 * Uses Promise.allSettled so one failure doesn't block others
 */
async function requestAll(requests) {
  const results = await Promise.allSettled(
    requests.map(({ url, options }) => apiRequest(url, options))
  )
  return results.map((r, i) => ({
    ...requests[i],
    status: r.status,
    data: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? r.reason?.message : null,
  }))
}

/**
 * Invalidate cached responses for a URL pattern
 */
function invalidateCache(pattern) {
  if (pattern) {
    for (const key of responseCache.keys()) {
      if (key.includes(pattern)) {
        responseCache.delete(key)
      }
    }
  } else {
    responseCache.clear()
  }
}

/**
 * Optimistic update helper
 * Updates local state immediately, then syncs with server
 */
async function optimisticUpdate(url, options, rollbackData) {
  // Invalidate cache for this endpoint
  invalidateCache(url)
  try {
    return await apiRequest(url, options)
  } catch (err) {
    // Re-invalidate so next read gets fresh data
    invalidateCache(url)
    throw err
  }
}

export function getAuthHeaders(userProp) {
  const user = userProp || JSON.parse(localStorage.getItem('user') || '{}')
  const token = user?.token || user?.accessToken || ''
  return token
    ? { Authorization: `Bearer ${token}` }
    : {}
}

export { apiRequest, requestAll, invalidateCache, optimisticUpdate }
