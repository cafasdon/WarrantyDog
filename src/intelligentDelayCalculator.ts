/**
 * Intelligent Delay Calculator for WarrantyDog
 * Calculates optimal delays between API requests based on performance data
 */

import type {
  VendorType,
  CircuitState,
  DelayCalculatorConfig,
  DelayCalculation,
  ResponseMetrics,
  IDelayCalculator
} from './types/rateLimiting.js';

interface DelayContext {
  vendor: VendorType;
  consecutiveFailures: number;
  lastResponseTime: number;
  rateLimitHit: boolean;
  retryAfter?: number;
  circuitState?: CircuitState;
  requestsInLastMinute?: number;
  minuteLimit?: number;
}

export class IntelligentDelayCalculator implements IDelayCalculator {
  public readonly vendor: VendorType;
  private readonly config: Required<DelayCalculatorConfig>;

  // Current state
  private currentBaseDelay: number;
  private adaptiveMultiplier: number;

  // Performance tracking
  private responseHistory: ResponseMetrics[] = [];
  private recentSuccessRate: number = 1.0;
  private averageResponseTime: number = 1000;
  private lastCalculation: number = Date.now();

  constructor(vendor: VendorType, config: DelayCalculatorConfig = {}) {
    this.vendor = vendor;
    this.config = {
      baseDelayMs: config.baseDelayMs ?? 2000,
      minDelayMs: config.minDelayMs ?? 500,
      maxDelayMs: config.maxDelayMs ?? 10000,
      exponentialBackoffFactor: config.exponentialBackoffFactor ?? 2.0,
      jitterFactor: config.jitterFactor ?? 0.1,
      adaptiveAdjustment: config.adaptiveAdjustment ?? true
    };

    this.currentBaseDelay = this.config.baseDelayMs;
    this.adaptiveMultiplier = 1.0;

    console.log(`[${this.vendor}] Intelligent Delay Calculator initialized with config:`, this.config);
  }

  /**
   * Calculate optimal delay based on current conditions
   */
  public calculateDelay(context: DelayContext): DelayCalculation {
    const factors = {
      base: this.currentBaseDelay,
      backoff: 1.0,
      jitter: 0,
      adaptive: this.adaptiveMultiplier,
      rateLimitPenalty: 1.0
    };

    let delay = this.currentBaseDelay * this.adaptiveMultiplier;
    let reason = 'base delay';

    // Handle rate limit hits with retry-after
    if (context.rateLimitHit && context.retryAfter) {
      delay = Math.max(delay, context.retryAfter * 1000);
      factors.rateLimitPenalty = context.retryAfter;
      reason = `rate limit (retry after ${context.retryAfter}s)`;
    }

    // Apply exponential backoff for consecutive failures
    if (context.consecutiveFailures > 0) {
      const backoffMultiplier = Math.pow(this.config.exponentialBackoffFactor, context.consecutiveFailures);
      delay *= backoffMultiplier;
      factors.backoff = backoffMultiplier;
      reason = `exponential backoff (${context.consecutiveFailures} failures)`;
    }

    // Adjust based on circuit breaker state
    if (context.circuitState === 'OPEN') {
      delay *= 3.0;
      factors.adaptive *= 3.0;
      reason = 'circuit breaker open';
    } else if (context.circuitState === 'HALF_OPEN') {
      delay *= 1.5;
      factors.adaptive *= 1.5;
      reason = 'circuit breaker half-open';
    }

    // Adjust based on recent performance
    if (this.recentSuccessRate < 0.9) {
      delay *= 1.5;
      factors.adaptive *= 1.5;
      reason = `poor success rate (${(this.recentSuccessRate * 100).toFixed(1)}%)`;
    } else if (this.recentSuccessRate > 0.95 && this.averageResponseTime < 2000) {
      delay *= 0.8;
      factors.adaptive *= 0.8;
      reason = 'good performance';
    }

    // Adjust based on current load
    if (context.requestsInLastMinute && context.minuteLimit) {
      const loadFactor = context.requestsInLastMinute / context.minuteLimit;
      if (loadFactor > 0.8) {
        const loadMultiplier = 1 + (loadFactor - 0.8) * 2;
        delay *= loadMultiplier;
        factors.adaptive *= loadMultiplier;
        reason = `high load (${(loadFactor * 100).toFixed(1)}%)`;
      }
    }

    // Add jitter to prevent thundering herd
    if (this.config.jitterFactor > 0) {
      const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5);
      delay += jitter;
      factors.jitter = jitter;
    }

    // Ensure delay is within bounds
    delay = Math.max(this.config.minDelayMs, Math.min(this.config.maxDelayMs, delay));

    return {
      delayMs: Math.round(delay),
      reason,
      factors
    };
  }

  /**
   * Optimize delay based on performance metrics
   */
  public optimizeDelay(metrics: ResponseMetrics[]): number {
    if (metrics.length === 0) {
      return this.currentBaseDelay;
    }

    // Update performance tracking
    this.updatePerformanceMetrics(metrics);

    // Adaptive adjustment based on performance
    if (this.config.adaptiveAdjustment) {
      this.adjustBaseDelay();
    }

    return this.currentBaseDelay;
  }

  /**
   * Record response metrics for learning
   */
  public recordResponse(metrics: ResponseMetrics): void {
    this.responseHistory.push(metrics);

    // Keep only recent history
    const maxHistory = 100;
    if (this.responseHistory.length > maxHistory) {
      this.responseHistory = this.responseHistory.slice(-maxHistory);
    }

    // Update performance metrics
    this.updatePerformanceMetrics([metrics]);
  }

  /**
   * Get current delay calculator status
   */
  public getStatus(): {
    vendor: VendorType;
    currentBaseDelay: number;
    adaptiveMultiplier: number;
    recentSuccessRate: number;
    averageResponseTime: number;
    responseHistorySize: number;
  } {
    return {
      vendor: this.vendor,
      currentBaseDelay: this.currentBaseDelay,
      adaptiveMultiplier: this.adaptiveMultiplier,
      recentSuccessRate: this.recentSuccessRate,
      averageResponseTime: this.averageResponseTime,
      responseHistorySize: this.responseHistory.length
    };
  }

  /**
   * Reset delay calculator to initial state
   */
  public reset(): void {
    this.currentBaseDelay = this.config.baseDelayMs;
    this.adaptiveMultiplier = 1.0;
    this.responseHistory = [];
    this.recentSuccessRate = 1.0;
    this.averageResponseTime = 1000;
    this.lastCalculation = Date.now();
    console.log(`[${this.vendor}] Delay calculator reset to initial state`);
  }

  /**
   * Update performance metrics from response data
   */
  private updatePerformanceMetrics(newMetrics: ResponseMetrics[]): void {
    if (newMetrics.length === 0) return;

    // Update average response time with exponential moving average
    const avgResponseTime = newMetrics.reduce((sum, m) => sum + m.responseTime, 0) / newMetrics.length;
    this.averageResponseTime = this.averageResponseTime * 0.9 + avgResponseTime * 0.1;

    // Update success rate from recent history
    const recentMetrics = this.responseHistory.slice(-20); // Last 20 requests
    if (recentMetrics.length > 0) {
      this.recentSuccessRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    }
  }

  /**
   * Adjust base delay based on performance
   */
  private adjustBaseDelay(): void {
    const now = Date.now();
    if (now - this.lastCalculation < 30000) return; // Adjust every 30 seconds max

    const oldDelay = this.currentBaseDelay;

    // Decrease delay if performing well
    if (this.recentSuccessRate > 0.95 && this.averageResponseTime < 2000) {
      this.currentBaseDelay = Math.max(
        this.config.minDelayMs,
        this.currentBaseDelay * 0.9
      );
    }
    // Increase delay if performing poorly
    else if (this.recentSuccessRate < 0.8 || this.averageResponseTime > 5000) {
      this.currentBaseDelay = Math.min(
        this.config.maxDelayMs,
        this.currentBaseDelay * 1.1
      );
    }

    if (oldDelay !== this.currentBaseDelay) {
      console.log(`[${this.vendor}] Adjusted base delay: ${oldDelay}ms → ${this.currentBaseDelay}ms`);
    }

    this.lastCalculation = now;
  }
}

export default IntelligentDelayCalculator;
