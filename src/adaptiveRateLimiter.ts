/**
 * Adaptive Rate Limiter for WarrantyDog
 * Intelligent rate limiting that learns from API responses and optimizes processing speed
 */

import type {
  VendorType,
  CircuitState,
  RateLimiterConfig,
  DetectedLimits,
  ResponseMetrics,
  RateLimitHit,
  RateLimiterStatus,
  RateLimitHeaders,
  IAdaptiveRateLimiter
} from './types/rateLimiting.js';

/**
 * Advanced Rate Limiter with adaptive learning capabilities
 */
export class AdaptiveRateLimiter implements IAdaptiveRateLimiter {
  public readonly vendor: VendorType;
  private readonly config: Required<RateLimiterConfig>;
  
  // Request tracking
  private requests: number[] = [];
  private responseMetrics: ResponseMetrics[] = [];
  private rateLimitHits: RateLimitHit[] = [];

  // Adaptive state
  private currentDelayMs: number;
  private detectedLimits: DetectedLimits;

  // Circuit breaker state
  private circuitState: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number | null = null;

  // Performance tracking
  private averageResponseTime: number = 1000;
  private successRate: number = 1.0;
  private lastOptimization: number = 0;

  constructor(vendor: VendorType, config: RateLimiterConfig = {}) {
    this.vendor = vendor;
    this.config = {
      // Base rate limits (conservative starting point)
      requestsPerMinute: config.requestsPerMinute ?? 60,
      requestsPerHour: config.requestsPerHour ?? 1000,

      // Adaptive settings
      minDelayMs: config.minDelayMs ?? 500,      // Minimum delay between requests
      maxDelayMs: config.maxDelayMs ?? 10000,    // Maximum delay between requests
      baseDelayMs: config.baseDelayMs ?? 2000,   // Starting delay

      // Learning parameters
      learningRate: config.learningRate ?? 0.1,  // How quickly to adapt
      safetyMargin: config.safetyMargin ?? 0.8,  // Use 80% of detected limits
      burstAllowance: config.burstAllowance ?? 5, // Allow small bursts

      // Circuit breaker settings
      failureThreshold: config.failureThreshold ?? 5,
      recoveryTimeMs: config.recoveryTimeMs ?? 30000
    };

    // Initialize adaptive state
    this.currentDelayMs = this.config.baseDelayMs;
    this.detectedLimits = {
      requestsPerMinute: null,
      requestsPerHour: null,
      burstSize: null
    };

    console.log(`[${this.vendor}] Adaptive Rate Limiter initialized with config:`, this.config);
  }

  /**
   * Check if we can make a request (with adaptive logic)
   */
  public canMakeRequest(): boolean {
    // Circuit breaker check
    if (this.circuitState === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.config.recoveryTimeMs) {
        this.circuitState = 'HALF_OPEN';
        console.log(`[${this.vendor}] Circuit breaker moving to HALF_OPEN state`);
      } else {
        return false;
      }
    }

    const now = Date.now();
    this.cleanOldRequests(now);

    // Check minute and hour limits
    const recentRequests = this.getRequestsInWindow(now, 60000); // Last minute
    const hourlyRequests = this.getRequestsInWindow(now, 3600000); // Last hour

    const minuteLimit = this.getEffectiveMinuteLimit();
    const hourLimit = this.getEffectiveHourLimit();

    // Check if we're within limits
    if (recentRequests.length >= minuteLimit || hourlyRequests.length >= hourLimit) {
      // Check if we can use burst allowance
      if (this.canUseBurstAllowance(recentRequests)) {
        console.log(`[${this.vendor}] Using burst allowance (${recentRequests.length}/${minuteLimit})`);
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record a successful request and learn from the response
   */
  public recordRequest(responseMetrics: Partial<ResponseMetrics> = {}): void {
    const now = Date.now();
    this.requests.push(now);

    // Record response metrics for learning
    const metrics: ResponseMetrics = {
      timestamp: now,
      responseTime: responseMetrics.responseTime ?? 1000,
      success: responseMetrics.success ?? true,
      statusCode: responseMetrics.statusCode,
      rateLimited: responseMetrics.rateLimited ?? false,
      retryAfter: responseMetrics.retryAfter
    };

    this.responseMetrics.push(metrics);

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

    // Optimize delay if needed
    this.optimizeDelayIfNeeded();
  }

  /**
   * Record a rate limit hit for learning
   */
  public recordRateLimitHit(retryAfterSeconds: number | null = null): void {
    const now = Date.now();
    const hit: RateLimitHit = {
      timestamp: now,
      retryAfter: retryAfterSeconds,
      requestsInLastMinute: this.getRequestsInWindow(now, 60000).length,
      requestsInLastHour: this.getRequestsInWindow(now, 3600000).length
    };

    this.rateLimitHits.push(hit);

    // Learn from this rate limit hit
    this.learnFromRateLimitHit();

    // Increase delay significantly
    this.increaseDelay(2.0);

    console.log(`[${this.vendor}] Rate limit hit recorded. Retry after: ${retryAfterSeconds}s, New delay: ${this.currentDelayMs}ms`);
  }

  /**
   * Record a failure for circuit breaker
   */
  public recordFailure(error: Error): void {
    this.handleFailure();

    // Increase delay for non-rate-limit failures too
    if (!this.isRateLimitError(error)) {
      this.increaseDelay(0.5); // Smaller increase for non-rate-limit errors
    }
  }

  /**
   * Get the optimal delay before next request
   */
  public getOptimalDelay(): number {
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
    return Math.max(this.config.minDelayMs, Math.min(this.config.maxDelayMs, delay));
  }

  /**
   * Learn from API rate limit headers
   */
  public learnFromHeaders(headers: RateLimitHeaders): void {
    if (!headers) return;

    // Common API rate limit headers
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

    // If no headers are provided (common with some APIs), be more conservative
    if (!remaining && !limit && !reset) {
      // API doesn't provide rate limit headers, so we need to be very conservative
      if (!this.detectedLimits.requestsPerMinute) {
        this.detectedLimits.requestsPerMinute = 5; // Very conservative starting point
      }
    }

    console.log(`[${this.vendor}] Learned from headers:`, {
      limit,
      remaining,
      reset,
      detectedLimits: this.detectedLimits
    });
  }

  /**
   * Get comprehensive status for monitoring
   */
  public getStatus(): RateLimiterStatus {
    const now = Date.now();
    return {
      vendor: this.vendor,
      circuitState: this.circuitState,
      canMakeRequest: this.canMakeRequest(),
      currentDelayMs: this.currentDelayMs,
      successRate: this.successRate,
      averageResponseTime: this.averageResponseTime,
      requestsInLastMinute: this.getRequestsInWindow(now, 60000).length,
      requestsInLastHour: this.getRequestsInWindow(now, 3600000).length,
      detectedLimits: { ...this.detectedLimits },
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      rateLimitHits: this.rateLimitHits.length
    };
  }

  /**
   * Reset circuit breaker (manual recovery)
   */
  public resetCircuitBreaker(): void {
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    console.log(`[${this.vendor}] Circuit breaker manually reset`);
  }

  /**
   * Learn from rate limit hits to detect actual limits
   */
  private learnFromRateLimitHit(): void {
    const recentHits = this.rateLimitHits.filter(
      hit => Date.now() - hit.timestamp < 300000 // Last 5 minutes
    );

    if (recentHits.length >= 2) {
      // Analyze patterns in rate limit hits
      const avgRequestsPerMinute = recentHits.reduce(
        (sum, hit) => sum + hit.requestsInLastMinute, 0
      ) / recentHits.length;

      // Update detected limits with safety margin
      this.detectedLimits.requestsPerMinute = Math.floor(avgRequestsPerMinute * this.config.safetyMargin);

      console.log(`[${this.vendor}] Learned from rate limit pattern: ${this.detectedLimits.requestsPerMinute} req/min`);
    }
  }

  /**
   * Get effective minute limit (detected or configured)
   */
  private getEffectiveMinuteLimit(): number {
    return this.detectedLimits.requestsPerMinute ?? this.config.requestsPerMinute;
  }

  /**
   * Get effective hour limit (detected or configured)
   */
  private getEffectiveHourLimit(): number {
    return this.detectedLimits.requestsPerHour ?? this.config.requestsPerHour;
  }

  /**
   * Check if burst allowance can be used
   */
  private canUseBurstAllowance(recentRequests: number[]): boolean {
    const burstWindow = 10000; // 10 seconds
    const veryRecentRequests = this.getRequestsInWindow(Date.now(), burstWindow);

    return veryRecentRequests.length < this.config.burstAllowance &&
           recentRequests.length < this.getEffectiveMinuteLimit() + this.config.burstAllowance;
  }

  /**
   * Get requests in a time window
   */
  private getRequestsInWindow(now: number, windowMs: number): number[] {
    return this.requests.filter(time => now - time < windowMs);
  }

  /**
   * Clean old request records
   */
  private cleanOldRequests(now: number): void {
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
  private updatePerformanceMetrics(metrics: ResponseMetrics): void {
    // Update average response time with exponential moving average
    this.averageResponseTime = this.averageResponseTime * 0.9 + metrics.responseTime * 0.1;

    // Update success rate
    const recentMetrics = this.responseMetrics.slice(-20); // Last 20 requests
    this.successRate = recentMetrics.filter(m => m.success).length / Math.max(recentMetrics.length, 1);
  }

  /**
   * Optimize delay based on performance
   */
  private optimizeDelayIfNeeded(): void {
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
    // Increase delay if performing poorly
    else if (this.successRate < 0.8 || this.averageResponseTime > 5000) {
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
  private increaseDelay(factor: number = 1.0): void {
    const oldDelay = this.currentDelayMs;
    this.currentDelayMs = Math.min(
      this.config.maxDelayMs,
      this.currentDelayMs * (1.5 * factor)
    );
    console.log(`[${this.vendor}] Increased delay: ${oldDelay}ms → ${this.currentDelayMs}ms (factor: ${factor})`);
  }

  /**
   * Handle failure for circuit breaker
   */
  private handleFailure(): void {
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
  private isRateLimitError(error: Error): boolean {
    if (!error || !error.message) return false;

    const rateLimitPatterns = [
      'rate_limit_exceeded',
      '429',
      'too many requests',
      'rate limit',
      'quota exceeded'
    ];

    return rateLimitPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern)
    );
  }
}

export default AdaptiveRateLimiter;
