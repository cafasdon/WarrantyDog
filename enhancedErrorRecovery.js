/**
 * Enhanced Error Recovery for WarrantyDog
 * Advanced error handling with circuit breaker pattern and intelligent retry logic
 */

class EnhancedErrorRecovery {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            maxRetries: config.maxRetries || 3,
            baseRetryDelayMs: config.baseRetryDelayMs || 1000,
            maxRetryDelayMs: config.maxRetryDelayMs || 30000,
            timeoutMs: config.timeoutMs || 60000,
            
            // Circuit breaker settings
            failureThreshold: config.failureThreshold || 5,
            recoveryTimeMs: config.recoveryTimeMs || 120000, // 2 minutes for Dell API
            halfOpenMaxAttempts: config.halfOpenMaxAttempts || 3
        };

        // Circuit breaker state
        this.circuitState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenAttempts = 0;

        // Error tracking
        this.errorHistory = [];
        this.retryHistory = [];
    }

    /**
     * Execute request with error recovery
     */
    async executeWithRecovery(requestFunction, context = {}) {
        if (!this.canExecute()) {
            throw new Error(`Circuit breaker is OPEN. Service unavailable until ${new Date(this.lastFailureTime + this.config.recoveryTimeMs)}`);
        }

        let lastError = null;
        let attempt = 0;

        while (attempt <= this.config.maxRetries) {
            try {
                const result = await this.executeWithTimeout(requestFunction, context);
                
                // Success - handle circuit breaker state
                this.recordSuccess();
                
                return result;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                this.recordError(error, attempt);

                // Don't retry on certain error types
                if (!this.shouldRetry(error, attempt)) {
                    break;
                }

                // Calculate retry delay
                if (attempt <= this.config.maxRetries) {
                    const delay = this.calculateRetryDelay(attempt, error);
                    console.log(`[${this.vendor}] Retrying in ${delay}ms (attempt ${attempt}/${this.config.maxRetries})`);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        this.recordFailure(lastError);
        throw lastError;
    }

    /**
     * Execute request with timeout
     */
    async executeWithTimeout(requestFunction, context) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${this.config.timeoutMs}ms`));
            }, this.config.timeoutMs);

            try {
                const result = await requestFunction();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Check if request can be executed (circuit breaker)
     */
    canExecute() {
        const now = Date.now();

        switch (this.circuitState) {
            case 'CLOSED':
                return true;

            case 'OPEN':
                if (now - this.lastFailureTime >= this.config.recoveryTimeMs) {
                    this.circuitState = 'HALF_OPEN';
                    this.halfOpenAttempts = 0;
                    console.log(`[${this.vendor}] Circuit breaker moving to HALF_OPEN`);
                    return true;
                }
                return false;

            case 'HALF_OPEN':
                return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;

            default:
                return false;
        }
    }

    /**
     * Record successful request
     */
    recordSuccess() {
        if (this.circuitState === 'HALF_OPEN') {
            this.circuitState = 'CLOSED';
            this.failureCount = 0;
            this.halfOpenAttempts = 0;
            console.log(`[${this.vendor}] Circuit breaker CLOSED - service recovered`);
        }
    }

    /**
     * Record error for analysis
     */
    recordError(error, attempt) {
        this.errorHistory.push({
            timestamp: Date.now(),
            error: error.message,
            attempt: attempt,
            circuitState: this.circuitState
        });

        // Keep error history manageable
        if (this.errorHistory.length > 100) {
            this.errorHistory = this.errorHistory.slice(-100);
        }
    }

    /**
     * Record failure and update circuit breaker
     */
    recordFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.circuitState === 'HALF_OPEN') {
            this.circuitState = 'OPEN';
            console.log(`[${this.vendor}] Circuit breaker OPEN - half-open test failed`);
        } else if (this.failureCount >= this.config.failureThreshold && this.circuitState === 'CLOSED') {
            this.circuitState = 'OPEN';
            console.log(`[${this.vendor}] Circuit breaker OPEN - failure threshold reached (${this.failureCount})`);
        }

        if (this.circuitState === 'HALF_OPEN') {
            this.halfOpenAttempts++;
        }
    }

    /**
     * Determine if error should be retried
     */
    shouldRetry(error, attempt) {
        if (attempt > this.config.maxRetries) {
            return false;
        }

        // Don't retry certain error types
        const nonRetryablePatterns = [
            'authentication',
            'authorization',
            'invalid_api_key',
            'not_found',
            '404',
            '401',
            '403'
        ];

        const errorMessage = error.message.toLowerCase();
        const isNonRetryable = nonRetryablePatterns.some(pattern => 
            errorMessage.includes(pattern)
        );

        if (isNonRetryable) {
            console.log(`[${this.vendor}] Not retrying non-retryable error: ${error.message}`);
            return false;
        }

        return true;
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(attempt, error) {
        // Extract retry-after from rate limit errors
        if (this.isRateLimitError(error)) {
            const retryAfter = this.extractRetryAfter(error);
            if (retryAfter) {
                return Math.min(retryAfter * 1000, this.config.maxRetryDelayMs);
            }
        }

        // Exponential backoff
        const exponentialDelay = this.config.baseRetryDelayMs * Math.pow(2, attempt - 1);
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * exponentialDelay;
        
        const totalDelay = exponentialDelay + jitter;
        
        return Math.min(totalDelay, this.config.maxRetryDelayMs);
    }

    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        const rateLimitPatterns = ['429', 'rate_limit', 'too many requests'];
        return rateLimitPatterns.some(pattern => 
            error.message.toLowerCase().includes(pattern)
        );
    }

    /**
     * Extract retry-after value from error
     */
    extractRetryAfter(error) {
        const match = error.message.match(/retry.*?(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error recovery status
     */
    getStatus() {
        return {
            vendor: this.vendor,
            circuitState: this.circuitState,
            canExecute: this.canExecute(),
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            halfOpenAttempts: this.halfOpenAttempts,
            
            // Recent errors
            recentErrors: this.errorHistory.slice(-10),
            totalErrors: this.errorHistory.length,
            
            // Configuration
            config: this.config
        };
    }

    /**
     * Reset error recovery system
     */
    reset() {
        this.circuitState = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenAttempts = 0;
        this.errorHistory = [];
        this.retryHistory = [];

        console.log(`[${this.vendor}] Error recovery system reset`);
    }
}

export default EnhancedErrorRecovery;
