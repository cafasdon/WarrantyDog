/**
 * WarrantyDog Rate Limiting Type Definitions
 * Type safety for adaptive rate limiting and intelligent processing
 */

export type VendorType = 'dell' | 'lenovo' | 'hp' | 'microsoft' | 'asus' | 'unknown';
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface RateLimiterConfig {
  // Base rate limits (conservative starting point)
  requestsPerMinute?: number;
  requestsPerHour?: number;

  // Adaptive settings
  minDelayMs?: number;      // Minimum delay between requests
  maxDelayMs?: number;      // Maximum delay between requests
  baseDelayMs?: number;     // Starting delay

  // Learning parameters
  learningRate?: number;    // How quickly to adapt
  safetyMargin?: number;    // Use percentage of detected limits
  burstAllowance?: number;  // Allow small bursts

  // Circuit breaker settings
  failureThreshold?: number;
  recoveryTimeMs?: number;
}

export interface DetectedLimits {
  requestsPerMinute: number | null;
  requestsPerHour: number | null;
  burstSize: number | null;
}

export interface ResponseMetrics {
  timestamp: number;
  responseTime: number;
  success: boolean;
  statusCode?: number;
  rateLimited?: boolean;
  retryAfter?: number;
}

export interface RateLimitHit {
  timestamp: number;
  retryAfter: number | null;
  requestsInLastMinute: number;
  requestsInLastHour: number;
}

export interface RateLimiterStatus {
  vendor: VendorType;
  circuitState: CircuitState;
  canMakeRequest: boolean;
  currentDelayMs: number;
  successRate: number;
  averageResponseTime: number;
  requestsInLastMinute: number;
  requestsInLastHour: number;
  detectedLimits: DetectedLimits;
  failureCount: number;
  lastFailureTime: number | null;
  rateLimitHits: number;
}

export interface BurstManagerConfig {
  maxBurstSize?: number;
  burstWindowMs?: number;
  cooldownMs?: number;
  adaptiveBurst?: boolean;
}

export interface BurstState {
  currentBurstSize: number;
  burstStartTime: number | null;
  lastRequestTime: number | null;
  inCooldown: boolean;
  cooldownStartTime: number | null;
}

export interface DelayCalculatorConfig {
  baseDelayMs?: number;
  maxDelayMs?: number;
  minDelayMs?: number;
  exponentialBackoffFactor?: number;
  jitterFactor?: number;
  adaptiveAdjustment?: boolean;
}

export interface DelayCalculation {
  delayMs: number;
  reason: string;
  factors: {
    base: number;
    backoff: number;
    jitter: number;
    adaptive: number;
    rateLimitPenalty: number;
  };
}

export interface ProcessorConfig {
  maxConcurrency?: number;
  batchSize?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  priorityQueue?: boolean;
}

export interface ProcessingTask<T = unknown> {
  id: string;
  vendor: VendorType;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lastAttemptAt: number | null;
  error: Error | null;
  result: unknown | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export interface ProcessorMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  processingTasks: number;
  averageProcessingTime: number;
  successRate: number;
  throughputPerMinute: number;
  vendorBreakdown: Record<VendorType, {
    total: number;
    completed: number;
    failed: number;
    averageTime: number;
  }>;
}

export interface ErrorRecoveryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  exponentialBackoff?: boolean;
  jitterEnabled?: boolean;
  circuitBreakerEnabled?: boolean;
  fallbackStrategy?: 'skip' | 'retry_later' | 'manual_intervention';
}

export interface RecoveryAttempt {
  attemptNumber: number;
  timestamp: number;
  error: Error;
  delayMs: number;
  strategy: string;
  success: boolean;
}

export interface AnalyticsData {
  vendor: VendorType;
  timeWindow: {
    start: number;
    end: number;
    durationMs: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
  };
  timing: {
    averageResponseTime: number;
    medianResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  rateLimiting: {
    hitsDetected: number;
    adaptiveDelayMs: number;
    circuitBreakerTrips: number;
    burstUsage: number;
  };
  efficiency: {
    throughputPerMinute: number;
    utilizationRate: number;
    wastedCapacity: number;
    optimizationScore: number;
  };
}

export interface RateLimitHeaders {
  'x-ratelimit-limit'?: string;
  'x-ratelimit-remaining'?: string;
  'x-ratelimit-reset'?: string;
  'x-rate-limit-limit'?: string;
  'x-rate-limit-remaining'?: string;
  'x-rate-limit-reset'?: string;
  'ratelimit-limit'?: string;
  'ratelimit-remaining'?: string;
  'ratelimit-reset'?: string;
  'retry-after'?: string;
  [key: string]: string | undefined;
}

// Utility types
export type RateLimiterEventType = 
  | 'request_made'
  | 'rate_limit_hit'
  | 'circuit_breaker_open'
  | 'circuit_breaker_closed'
  | 'delay_optimized'
  | 'burst_started'
  | 'burst_ended'
  | 'recovery_attempt'
  | 'limits_detected';

export interface RateLimiterEvent {
  type: RateLimiterEventType;
  vendor: VendorType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type EventCallback = (event: RateLimiterEvent) => void;

// Interface definitions for the main classes
export interface IAdaptiveRateLimiter {
  vendor: VendorType;
  canMakeRequest(): boolean;
  recordRequest(responseMetrics?: Partial<ResponseMetrics>): void;
  recordRateLimitHit(retryAfterSeconds?: number | null): void;
  recordFailure(error: Error): void;
  getOptimalDelay(): number;
  learnFromHeaders(headers: RateLimitHeaders): void;
  getStatus(): RateLimiterStatus;
  resetCircuitBreaker(): void;
}

export interface IBurstManager {
  canMakeBurstRequest(): boolean;
  recordBurstRequest(): void;
  getBurstState(): BurstState;
  resetBurst(): void;
}

export interface IDelayCalculator {
  calculateDelay(context: {
    vendor: VendorType;
    consecutiveFailures: number;
    lastResponseTime: number;
    rateLimitHit: boolean;
    retryAfter?: number;
  }): DelayCalculation;
  optimizeDelay(metrics: ResponseMetrics[]): number;
}

export interface IConcurrentProcessor<T> {
  addTask(task: Omit<ProcessingTask<T>, 'id' | 'createdAt' | 'attempts' | 'lastAttemptAt' | 'error' | 'result' | 'status'>): string;
  cancelTask(taskId: string): boolean;
  getMetrics(): ProcessorMetrics;
  start(): void;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
}

export interface IErrorRecovery {
  shouldRetry(error: Error, attemptNumber: number): boolean;
  getRetryDelay(attemptNumber: number, error: Error): number;
  recordRecoveryAttempt(attempt: RecoveryAttempt): void;
  getRecoveryStrategy(error: Error): string;
}

export interface IRateLimitAnalytics {
  recordEvent(event: RateLimiterEvent): void;
  getAnalytics(vendor: VendorType, timeWindowMs: number): AnalyticsData;
  generateReport(vendors: VendorType[], timeWindowMs: number): Record<VendorType, AnalyticsData>;
  exportData(format: 'json' | 'csv'): string;
}
