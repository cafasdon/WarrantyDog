/**
 * Adaptive Rate Limiter for WarrantyDog
 * Intelligent rate limiting that learns from API responses and optimizes processing speed
 */

/**
 * Advanced Rate Limiter with adaptive learning capabilities
 */
class AdaptiveRateLimiter {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // Base rate limits (conservative starting point)
            requestsPerMinute: config.requestsPerMinute || 60,
            requestsPerHour: config.requestsPerHour || 1000,

            // Adaptive settings
            minDelayMs: config.minDelayMs || 500,      // Minimum delay between requests
            maxDelayMs: config.maxDelayMs || 10000,    // Maximum delay between requests
            baseDelayMs: config.baseDelayMs || 2000,   // Starting delay

            // Learning parameters
            learningRate: config.learningRate || 0.1,  // How quickly to adapt
            safetyMargin: config.safetyMargin || 0.8,  // Use 80% of detected limits
            burstAllowance: config.burstAllowance || 5, // Allow small bursts

            // Circuit breaker settings
            failureThreshold: config.failureThreshold || 5,
            recoveryTimeMs: config.recoveryTimeMs || 30000
        };

        // Request tracking
        this.requests = [];
        this.responseMetrics = [];
        this.rateLimitHits = [];

        // Adaptive state
        this.currentDelayMs = this.config.baseDelayMs;
        this.detectedLimits = {
            requestsPerMinute: null,
            requestsPerHour: null,
            burstSize: null
        };

        // Circuit breaker state
        this.circuitState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;

        // Performance tracking
        this.averageResponseTime = 1000;
        this.successRate = 1.0;
        this.lastOptimization = Date.now();
    }

    /**
     * Check if we can make a request (with adaptive logic)
     */
    canMakeRequest() {
        // Circuit breaker check
        if (this.circuitState === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.config.recoveryTimeMs) {
                this.circuitState = 'HALF_OPEN';
                console.log(`[${this.vendor}] Circuit breaker moving to HALF_OPEN state`);
            } else {
                return false;
            }
        }

        const now = Date.now();
        this.cleanOldRequests(now);

        // Use detected limits if available, otherwise fall back to config
        const minuteLimit = this.getEffectiveMinuteLimit();
        const hourLimit = this.getEffectiveHourLimit();

        const recentRequests = this.getRequestsInWindow(now, 60000);
        const hourlyRequests = this.getRequestsInWindow(now, 3600000);

        // Check burst allowance
        const canBurst = this.canUseBurstAllowance(recentRequests);

        const withinLimits = recentRequests.length < minuteLimit &&
                           hourlyRequests.length < hourLimit;

        return withinLimits || canBurst;
    }

    /**
     * Record a successful request and learn from the response
     */
    recordRequest(responseMetrics = {}) {
        const now = Date.now();
        this.requests.push(now);

        // Record response metrics for learning
        const metrics = {
            timestamp: now,
            responseTime: responseMetrics.responseTime || 1000,
            rateLimitHeaders: responseMetrics.rateLimitHeaders || {},
            success: responseMetrics.success !== false
        };

        this.responseMetrics.push(metrics);

        // Learn from rate limit headers
        this.learnFromHeaders(metrics.rateLimitHeaders);

        // Update performance metrics
        this.updatePerformanceMetrics(metrics);

        // Circuit breaker success handling
        if (metrics.success) {
            if (this.circuitState === 'HALF_OPEN') {
                this.circuitState = 'CLOSED';
                this.failureCount = 0;
                console.log(`[${this.vendor}] Circuit breaker CLOSED - service recovered`);
            }
        }

        // Adaptive optimization
        this.optimizeDelayIfNeeded();
    }

    /**
     * Record a rate limit hit for learning
     */
    recordRateLimitHit(retryAfterSeconds = null) {
        const now = Date.now();
        this.rateLimitHits.push({
            timestamp: now,
            retryAfter: retryAfterSeconds,
            requestsInLastMinute: this.getRequestsInWindow(now, 60000).length,
            requestsInLastHour: this.getRequestsInWindow(now, 3600000).length
        });

        // Learn from rate limit hit
        this.learnFromRateLimitHit();

        // Increase delay to prevent future hits
        this.increaseDelay();

        // Circuit breaker failure handling
        this.handleFailure();
    }

    /**
     * Record a failure for circuit breaker
     */
    recordFailure(error) {
        this.handleFailure();

        // Increase delay for non-rate-limit failures too
        if (!this.isRateLimitError(error)) {
            this.increaseDelay(0.5); // Smaller increase for non-rate-limit errors
        }
    }

    /**
     * Get the optimal delay before next request
     */
    getOptimalDelay() {
        // Circuit breaker check
        if (this.circuitState === 'OPEN') {
            return this.config.recoveryTimeMs;
        }

        // Base delay with adaptive adjustments
        let delay = this.currentDelayMs;

        // Adjust based on recent performance
        if (this.successRate < 0.9) {
            delay *= 1.5; // Increase delay if success rate is low
        } else if (this.successRate > 0.98 && this.averageResponseTime < 2000) {
            delay *= 0.9; // Decrease delay if performing well
        }

        // Adjust based on current load
        const recentRequests = this.getRequestsInWindow(Date.now(), 60000);
        const loadFactor = recentRequests.length / this.getEffectiveMinuteLimit();

        if (loadFactor > 0.8) {
            delay *= (1 + loadFactor); // Increase delay as we approach limits
        }

        // Ensure delay is within bounds
        return Math.max(this.config.minDelayMs,
               Math.min(this.config.maxDelayMs, delay));
    }

    /**
     * Learn from Dell API rate limit headers
     */
    learnFromHeaders(headers) {
        if (!headers) return;

        // Common Dell API rate limit headers
        const remaining = headers['x-ratelimit-remaining'] ||
                         headers['x-rate-limit-remaining'] ||
                         headers['ratelimit-remaining'];

        const limit = headers['x-ratelimit-limit'] ||
                     headers['x-rate-limit-limit'] ||
                     headers['ratelimit-limit'];

        const reset = headers['x-ratelimit-reset'] ||
                     headers['x-rate-limit-reset'] ||
                     headers['ratelimit-reset'];

        if (limit && !isNaN(parseInt(limit))) {
            const detectedLimit = parseInt(limit);

            // Determine if this is per-minute or per-hour limit based on reset time
            if (reset) {
                const resetTime = parseInt(reset);
                const now = Math.floor(Date.now() / 1000);
                const timeWindow = resetTime - now;

                if (timeWindow <= 60) {
                    this.detectedLimits.requestsPerMinute = detectedLimit;
                } else if (timeWindow <= 3600) {
                    this.detectedLimits.requestsPerHour = detectedLimit;
                }
            }
        }

        // If no headers are provided (common with Dell API), be more conservative
        if (!remaining && !limit && !reset) {
            // Dell API doesn't provide rate limit headers, so we need to be very conservative
            if (!this.detectedLimits.requestsPerMinute) {
                this.detectedLimits.requestsPerMinute = 5; // Very conservative starting point
            }
        }

        console.log(`[${this.vendor}] Learned from headers:`, {
            remaining,
            limit,
            reset,
            detectedLimits: this.detectedLimits
        });
    }

    /**
     * Learn from rate limit hits to detect actual limits
     */
    learnFromRateLimitHit() {
        const recentHits = this.rateLimitHits.filter(
            hit => Date.now() - hit.timestamp < 300000 // Last 5 minutes
        );

        if (recentHits.length >= 2) {
            // Analyze patterns in rate limit hits
            const avgRequestsPerMinute = recentHits.reduce(
                (sum, hit) => sum + hit.requestsInLastMinute, 0
            ) / recentHits.length;

            // Update detected limits with safety margin
            this.detectedLimits.requestsPerMinute = Math.floor(
                avgRequestsPerMinute * this.config.safetyMargin
            );

            console.log(`[${this.vendor}] Detected minute limit: ${this.detectedLimits.requestsPerMinute}`);
        }
    }

    /**
     * Get effective minute limit (detected or configured)
     */
    getEffectiveMinuteLimit() {
        return this.detectedLimits.requestsPerMinute || this.config.requestsPerMinute;
    }

    /**
     * Get effective hour limit (detected or configured)
     */
    getEffectiveHourLimit() {
        return this.detectedLimits.requestsPerHour || this.config.requestsPerHour;
    }

    /**
     * Check if burst allowance can be used
     */
    canUseBurstAllowance(recentRequests) {
        const burstWindow = 10000; // 10 seconds
        const veryRecentRequests = this.getRequestsInWindow(Date.now(), burstWindow);

        return veryRecentRequests.length < this.config.burstAllowance &&
               recentRequests.length < this.getEffectiveMinuteLimit() + this.config.burstAllowance;
    }

    /**
     * Get requests in a time window
     */
    getRequestsInWindow(now, windowMs) {
        return this.requests.filter(time => now - time < windowMs);
    }

    /**
     * Clean old request records
     */
    cleanOldRequests(now) {
        const oneHourAgo = now - 3600000;
        this.requests = this.requests.filter(time => time > oneHourAgo);
        this.responseMetrics = this.responseMetrics.filter(
            metric => metric.timestamp > oneHourAgo
        );
        this.rateLimitHits = this.rateLimitHits.filter(
            hit => hit.timestamp > oneHourAgo
        );
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(metrics) {
        // Update average response time with exponential moving average
        this.averageResponseTime = this.averageResponseTime * 0.9 + metrics.responseTime * 0.1;

        // Update success rate
        const recentMetrics = this.responseMetrics.slice(-20); // Last 20 requests
        const successCount = recentMetrics.filter(m => m.success).length;
        this.successRate = recentMetrics.length > 0 ? successCount / recentMetrics.length : 1.0;
    }

    /**
     * Optimize delay based on performance
     */
    optimizeDelayIfNeeded() {
        const now = Date.now();
        if (now - this.lastOptimization < 30000) return; // Optimize every 30 seconds max

        const oldDelay = this.currentDelayMs;

        // Decrease delay if performing well
        if (this.successRate > 0.95 && this.averageResponseTime < 2000) {
            this.currentDelayMs = Math.max(
                this.config.minDelayMs,
                this.currentDelayMs * 0.9
            );
        }

        // Increase delay if having issues
        else if (this.successRate < 0.9 || this.averageResponseTime > 5000) {
            this.currentDelayMs = Math.min(
                this.config.maxDelayMs,
                this.currentDelayMs * 1.2
            );
        }

        if (oldDelay !== this.currentDelayMs) {
            console.log(`[${this.vendor}] Optimized delay: ${oldDelay}ms → ${this.currentDelayMs}ms (success: ${(this.successRate * 100).toFixed(1)}%, avg response: ${this.averageResponseTime.toFixed(0)}ms)`);
        }

        this.lastOptimization = now;
    }

    /**
     * Increase delay after rate limit or failure
     */
    increaseDelay(factor = 1.0) {
        const oldDelay = this.currentDelayMs;
        this.currentDelayMs = Math.min(
            this.config.maxDelayMs,
            this.currentDelayMs * (1.5 * factor)
        );

        console.log(`[${this.vendor}] Increased delay: ${oldDelay}ms → ${this.currentDelayMs}ms`);
    }

    /**
     * Handle failure for circuit breaker
     */
    handleFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.config.failureThreshold && this.circuitState === 'CLOSED') {
            this.circuitState = 'OPEN';
            console.log(`[${this.vendor}] Circuit breaker OPEN - too many failures (${this.failureCount})`);
        }
    }

    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        if (!error || !error.message) return false;

        const rateLimitPatterns = [
            'rate_limit_exceeded',
            '429',
            'too many requests',
            'rate limit'
        ];

        return rateLimitPatterns.some(pattern =>
            error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Get comprehensive status for monitoring
     */
    getStatus() {
        const now = Date.now();
        return {
            vendor: this.vendor,
            circuitState: this.circuitState,
            canMakeRequest: this.canMakeRequest(),
            currentDelayMs: this.currentDelayMs,
            optimalDelayMs: this.getOptimalDelay(),

            // Performance metrics
            successRate: this.successRate,
            averageResponseTime: this.averageResponseTime,
            failureCount: this.failureCount,

            // Rate limit status
            requestsInLastMinute: this.getRequestsInWindow(now, 60000).length,
            requestsInLastHour: this.getRequestsInWindow(now, 3600000).length,
            effectiveMinuteLimit: this.getEffectiveMinuteLimit(),
            effectiveHourLimit: this.getEffectiveHourLimit(),

            // Detected limits
            detectedLimits: this.detectedLimits,
            rateLimitHits: this.rateLimitHits.length,

            // Timing
            lastOptimization: this.lastOptimization,
            lastFailureTime: this.lastFailureTime
        };
    }

    /**
     * Reset circuit breaker (manual recovery)
     */
    resetCircuitBreaker() {
        this.circuitState = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
        console.log(`[${this.vendor}] Circuit breaker manually reset`);
    }
}

export default AdaptiveRateLimiter;
