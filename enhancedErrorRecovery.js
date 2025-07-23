/**
 * Enhanced Error Recovery for WarrantyDog
 * Smart retry strategies with circuit breaker patterns and adaptive error handling
 */

/**
 * Circuit breaker states
 */
const CircuitState = {
    CLOSED: 'CLOSED',       // Normal operation
    OPEN: 'OPEN',           // Circuit is open, failing fast
    HALF_OPEN: 'HALF_OPEN'  // Testing if service has recovered
};

/**
 * Enhanced error recovery with circuit breaker and intelligent retry strategies
 */
class EnhancedErrorRecovery {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // Circuit breaker settings
            failureThreshold: config.failureThreshold || 5,           // Failures before opening circuit
            successThreshold: config.successThreshold || 3,           // Successes to close circuit
            timeoutMs: config.timeoutMs || 60000,                     // Circuit open timeout
            halfOpenMaxCalls: config.halfOpenMaxCalls || 3,           // Max calls in half-open state
            
            // Retry settings
            maxRetries: config.maxRetries || 3,                       // Maximum retry attempts
            baseDelayMs: config.baseDelayMs || 1000,                  // Base retry delay
            maxDelayMs: config.maxDelayMs || 30000,                   // Maximum retry delay
            backoffMultiplier: config.backoffMultiplier || 2,         // Exponential backoff multiplier
            jitterFactor: config.jitterFactor || 0.1,                // Random jitter factor
            
            // Error classification
            retryableErrors: config.retryableErrors || [
                'rate_limit_exceeded', 'timeout', 'network', 'temporary',
                '500', '502', '503', '504', '429'
            ],
            nonRetryableErrors: config.nonRetryableErrors || [
                '400', '401', '403', '404', 'invalid_key', 'unauthorized'
            ],
            
            // Adaptive settings
            adaptiveRetry: config.adaptiveRetry || true,              // Enable adaptive retry logic
            learningWindowMs: config.learningWindowMs || 300000,      // 5 minutes learning window
            successRateThreshold: config.successRateThreshold || 0.7  // Threshold for adaptive adjustments
        };

        // Circuit breaker state
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.halfOpenCalls = 0;
        
        // Error tracking
        this.errorHistory = [];
        this.retryHistory = [];
        this.recoveryAttempts = [];
        
        // Adaptive state
        this.adaptiveMultipliers = new Map(); // Error type -> retry multiplier
        this.errorPatterns = new Map();       // Error pattern -> success rate
        
        // Performance tracking
        this.performanceMetrics = {
            totalAttempts: 0,
            successfulAttempts: 0,
            retriedAttempts: 0,
            circuitOpenEvents: 0,
            averageRecoveryTime: 0
        };
    }

    /**
     * Execute a function with error recovery and circuit breaker protection
     */
    async executeWithRecovery(operation, context = {}) {
        // Check circuit breaker state
        if (!this.canExecute()) {
            throw new Error(`Circuit breaker is ${this.circuitState}. Service temporarily unavailable.`);
        }

        const startTime = Date.now();
        let lastError = null;
        let attempt = 0;

        while (attempt <= this.config.maxRetries) {
            try {
                // Execute the operation
                const result = await this.executeOperation(operation, context, attempt);
                
                // Record success
                this.recordSuccess(Date.now() - startTime, attempt);
                
                return result;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                // Record failure
                this.recordFailure(error, attempt);
                
                // Check if error is retryable
                if (!this.isRetryable(error) || attempt > this.config.maxRetries) {
                    break;
                }
                
                // Calculate retry delay
                const delay = this.calculateRetryDelay(error, attempt, context);
                
                console.log(`[${this.vendor}] Retry attempt ${attempt}/${this.config.maxRetries} after ${delay}ms delay. Error: ${error.message}`);
                
                // Wait before retry
                await this.sleep(delay);
            }
        }

        // All retries exhausted
        this.recordFinalFailure(lastError, attempt - 1);
        throw lastError;
    }

    /**
     * Check if operation can be executed based on circuit breaker state
     */
    canExecute() {
        switch (this.circuitState) {
            case CircuitState.CLOSED:
                return true;
                
            case CircuitState.OPEN:
                // Check if timeout has passed
                if (Date.now() - this.lastFailureTime > this.config.timeoutMs) {
                    this.transitionToHalfOpen();
                    return true;
                }
                return false;
                
            case CircuitState.HALF_OPEN:
                // Allow limited calls to test recovery
                return this.halfOpenCalls < this.config.halfOpenMaxCalls;
                
            default:
                return false;
        }
    }

    /**
     * Execute the operation with monitoring
     */
    async executeOperation(operation, context, attempt) {
        this.performanceMetrics.totalAttempts++;
        
        if (attempt > 0) {
            this.performanceMetrics.retriedAttempts++;
        }
        
        if (this.circuitState === CircuitState.HALF_OPEN) {
            this.halfOpenCalls++;
        }
        
        return await operation(context);
    }

    /**
     * Record successful operation
     */
    recordSuccess(duration, attempt) {
        this.performanceMetrics.successfulAttempts++;
        
        // Circuit breaker success handling
        if (this.circuitState === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.config.successThreshold) {
                this.transitionToClosed();
            }
        } else if (this.circuitState === CircuitState.CLOSED) {
            // Reset failure count on success
            this.failureCount = 0;
        }
        
        // Record for adaptive learning
        if (attempt > 0) {
            this.retryHistory.push({
                timestamp: Date.now(),
                attempts: attempt,
                success: true,
                duration
            });
        }
        
        // Update recovery metrics
        if (this.lastFailureTime) {
            const recoveryTime = Date.now() - this.lastFailureTime;
            this.updateAverageRecoveryTime(recoveryTime);
            this.lastFailureTime = null;
        }
    }

    /**
     * Record failed operation
     */
    recordFailure(error, attempt) {
        const errorRecord = {
            timestamp: Date.now(),
            error: error.message,
            errorType: this.classifyError(error),
            attempt,
            circuitState: this.circuitState
        };
        
        this.errorHistory.push(errorRecord);
        this.lastFailureTime = Date.now();
        
        // Circuit breaker failure handling
        if (this.circuitState === CircuitState.CLOSED) {
            this.failureCount++;
            if (this.failureCount >= this.config.failureThreshold) {
                this.transitionToOpen();
            }
        } else if (this.circuitState === CircuitState.HALF_OPEN) {
            // Failure in half-open state - go back to open
            this.transitionToOpen();
        }
        
        // Learn from error patterns
        this.learnFromError(error, attempt);
        
        // Keep error history manageable
        if (this.errorHistory.length > 100) {
            this.errorHistory = this.errorHistory.slice(-50);
        }
    }

    /**
     * Record final failure after all retries exhausted
     */
    recordFinalFailure(error, totalAttempts) {
        this.retryHistory.push({
            timestamp: Date.now(),
            attempts: totalAttempts,
            success: false,
            finalError: error.message
        });
        
        console.log(`[${this.vendor}] Final failure after ${totalAttempts} attempts: ${error.message}`);
    }

    /**
     * Transition circuit breaker to OPEN state
     */
    transitionToOpen() {
        console.log(`[${this.vendor}] Circuit breaker OPEN - ${this.failureCount} failures detected`);
        
        this.circuitState = CircuitState.OPEN;
        this.performanceMetrics.circuitOpenEvents++;
        this.lastFailureTime = Date.now();
        this.halfOpenCalls = 0;
    }

    /**
     * Transition circuit breaker to HALF_OPEN state
     */
    transitionToHalfOpen() {
        console.log(`[${this.vendor}] Circuit breaker HALF_OPEN - testing service recovery`);
        
        this.circuitState = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.halfOpenCalls = 0;
    }

    /**
     * Transition circuit breaker to CLOSED state
     */
    transitionToClosed() {
        console.log(`[${this.vendor}] Circuit breaker CLOSED - service recovered`);
        
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenCalls = 0;
    }

    /**
     * Check if error is retryable
     */
    isRetryable(error) {
        const errorMessage = error.message.toLowerCase();
        
        // Check non-retryable errors first
        if (this.config.nonRetryableErrors.some(pattern => 
            errorMessage.includes(pattern.toLowerCase()))) {
            return false;
        }
        
        // Check retryable errors
        return this.config.retryableErrors.some(pattern => 
            errorMessage.includes(pattern.toLowerCase()));
    }

    /**
     * Calculate intelligent retry delay
     */
    calculateRetryDelay(error, attempt, context = {}) {
        let delay = this.config.baseDelayMs;
        
        // Exponential backoff
        delay *= Math.pow(this.config.backoffMultiplier, attempt - 1);
        
        // Apply adaptive multiplier based on error type
        const errorType = this.classifyError(error);
        const adaptiveMultiplier = this.adaptiveMultipliers.get(errorType) || 1.0;
        delay *= adaptiveMultiplier;
        
        // Special handling for rate limit errors
        if (this.isRateLimitError(error)) {
            const retryAfter = this.extractRetryAfter(error);
            if (retryAfter) {
                delay = Math.max(delay, retryAfter * 1000);
            } else {
                delay *= 2; // Double delay for rate limits without retry-after
            }
        }
        
        // Context-based adjustments
        if (context.isRetryMode) {
            delay *= 1.5; // Be more conservative in retry mode
        }
        
        if (context.circuitState === CircuitState.HALF_OPEN) {
            delay *= 2; // Be extra careful when testing recovery
        }
        
        // Add jitter to prevent thundering herd
        const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5);
        delay += jitter;
        
        // Ensure within bounds
        return Math.max(this.config.baseDelayMs, 
               Math.min(this.config.maxDelayMs, Math.round(delay)));
    }

    /**
     * Classify error type for adaptive learning
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('rate_limit') || message.includes('429')) {
            return 'rate_limit';
        } else if (message.includes('timeout')) {
            return 'timeout';
        } else if (message.includes('network') || message.includes('connection')) {
            return 'network';
        } else if (message.includes('500') || message.includes('502') || 
                   message.includes('503') || message.includes('504')) {
            return 'server_error';
        } else if (message.includes('401') || message.includes('403')) {
            return 'auth_error';
        } else {
            return 'unknown';
        }
    }

    /**
     * Learn from error patterns to improve retry strategies
     */
    learnFromError(error, attempt) {
        if (!this.config.adaptiveRetry) return;
        
        const errorType = this.classifyError(error);
        
        // Track error pattern success rates
        const recentHistory = this.retryHistory.filter(
            h => Date.now() - h.timestamp < this.config.learningWindowMs
        );
        
        const typeHistory = recentHistory.filter(h => 
            this.errorHistory.some(e => 
                this.classifyError({ message: e.error }) === errorType &&
                Math.abs(e.timestamp - h.timestamp) < 5000
            )
        );
        
        if (typeHistory.length >= 5) {
            const successRate = typeHistory.filter(h => h.success).length / typeHistory.length;
            this.errorPatterns.set(errorType, successRate);
            
            // Adjust adaptive multiplier based on success rate
            let multiplier = this.adaptiveMultipliers.get(errorType) || 1.0;
            
            if (successRate < this.config.successRateThreshold) {
                multiplier = Math.min(3.0, multiplier * 1.2); // Increase delay
            } else if (successRate > 0.9) {
                multiplier = Math.max(0.5, multiplier * 0.9); // Decrease delay
            }
            
            this.adaptiveMultipliers.set(errorType, multiplier);
            
            console.log(`[${this.vendor}] Learned from ${errorType} errors: ${(successRate * 100).toFixed(1)}% success rate, multiplier: ${multiplier.toFixed(2)}`);
        }
    }

    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        const message = error.message.toLowerCase();
        return message.includes('rate_limit') || 
               message.includes('429') || 
               message.includes('too many requests');
    }

    /**
     * Extract retry-after value from error
     */
    extractRetryAfter(error) {
        if (!error.retryAfter) return null;
        
        const retryAfter = parseInt(error.retryAfter);
        return isNaN(retryAfter) ? null : retryAfter;
    }

    /**
     * Update average recovery time
     */
    updateAverageRecoveryTime(recoveryTime) {
        if (this.performanceMetrics.averageRecoveryTime === 0) {
            this.performanceMetrics.averageRecoveryTime = recoveryTime;
        } else {
            this.performanceMetrics.averageRecoveryTime = 
                this.performanceMetrics.averageRecoveryTime * 0.8 + recoveryTime * 0.2;
        }
    }

    /**
     * Get comprehensive recovery status
     */
    getStatus() {
        const recentErrors = this.errorHistory.filter(
            e => Date.now() - e.timestamp < 300000 // Last 5 minutes
        );
        
        const recentRetries = this.retryHistory.filter(
            r => Date.now() - r.timestamp < 300000
        );
        
        return {
            vendor: this.vendor,
            circuitState: this.circuitState,
            canExecute: this.canExecute(),
            
            // Circuit breaker state
            failureCount: this.failureCount,
            successCount: this.successCount,
            halfOpenCalls: this.halfOpenCalls,
            lastFailureTime: this.lastFailureTime,
            
            // Performance metrics
            performanceMetrics: { ...this.performanceMetrics },
            
            // Recent activity
            recentErrors: recentErrors.length,
            recentRetries: recentRetries.length,
            recentSuccessRate: recentRetries.length > 0 ? 
                recentRetries.filter(r => r.success).length / recentRetries.length : 1.0,
            
            // Adaptive learning
            errorPatterns: Object.fromEntries(this.errorPatterns),
            adaptiveMultipliers: Object.fromEntries(this.adaptiveMultipliers),
            
            // Configuration
            config: { ...this.config }
        };
    }

    /**
     * Manually reset circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenCalls = 0;
        this.lastFailureTime = null;
        
        console.log(`[${this.vendor}] Circuit breaker manually reset`);
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset all recovery state
     */
    reset() {
        this.resetCircuitBreaker();
        this.errorHistory = [];
        this.retryHistory = [];
        this.recoveryAttempts = [];
        this.adaptiveMultipliers.clear();
        this.errorPatterns.clear();
        this.performanceMetrics = {
            totalAttempts: 0,
            successfulAttempts: 0,
            retriedAttempts: 0,
            circuitOpenEvents: 0,
            averageRecoveryTime: 0
        };
        
        console.log(`[${this.vendor}] Error recovery system reset`);
    }
}

export { EnhancedErrorRecovery, CircuitState };
