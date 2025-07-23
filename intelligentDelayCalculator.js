/**
 * Intelligent Delay Calculator for WarrantyDog
 * Dynamic delay calculation based on API performance, rate limits, and processing context
 */

/**
 * Calculates optimal delays between API requests based on multiple factors
 */
class IntelligentDelayCalculator {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // Base delay settings
            minDelayMs: config.minDelayMs || 100,           // Minimum delay (burst mode)
            maxDelayMs: config.maxDelayMs || 30000,         // Maximum delay (recovery mode)
            baseDelayMs: config.baseDelayMs || 1000,        // Starting delay
            
            // Performance thresholds
            fastResponseThreshold: config.fastResponseThreshold || 800,     // Fast response time
            slowResponseThreshold: config.slowResponseThreshold || 3000,    // Slow response time
            
            // Rate limit thresholds
            rateLimitWarningThreshold: config.rateLimitWarningThreshold || 0.8,  // 80% of limit
            rateLimitDangerThreshold: config.rateLimitDangerThreshold || 0.95,   // 95% of limit
            
            // Adaptive parameters
            performanceWeight: config.performanceWeight || 0.4,     // Weight of performance factor
            rateLimitWeight: config.rateLimitWeight || 0.4,         // Weight of rate limit factor
            contextWeight: config.contextWeight || 0.2,             // Weight of context factor
            
            // Learning parameters
            adaptationRate: config.adaptationRate || 0.1,           // How quickly to adapt
            smoothingFactor: config.smoothingFactor || 0.8          // Smoothing for moving averages
        };

        // Performance tracking
        this.responseTimeHistory = [];
        this.successRateHistory = [];
        this.delayHistory = [];
        
        // Current state
        this.currentBaseDelay = this.config.baseDelayMs;
        this.lastCalculatedDelay = this.config.baseDelayMs;
        this.adaptiveMultiplier = 1.0;
        
        // Context tracking
        this.processingContext = {
            totalDevices: 0,
            processedDevices: 0,
            consecutiveSuccesses: 0,
            consecutiveFailures: 0,
            isRetryMode: false,
            isBurstMode: false
        };
    }

    /**
     * Calculate optimal delay based on current conditions
     */
    calculateDelay(context = {}) {
        // Update processing context
        this.updateContext(context);
        
        // Calculate delay factors
        const performanceFactor = this.calculatePerformanceFactor();
        const rateLimitFactor = this.calculateRateLimitFactor(context);
        const contextFactor = this.calculateContextFactor();
        
        // Weighted combination of factors
        const combinedFactor = (
            performanceFactor * this.config.performanceWeight +
            rateLimitFactor * this.config.rateLimitWeight +
            contextFactor * this.config.contextWeight
        );
        
        // Apply to base delay
        let calculatedDelay = this.currentBaseDelay * combinedFactor;
        
        // Apply adaptive multiplier
        calculatedDelay *= this.adaptiveMultiplier;
        
        // Apply context-specific adjustments
        calculatedDelay = this.applyContextAdjustments(calculatedDelay, context);
        
        // Ensure within bounds
        calculatedDelay = Math.max(this.config.minDelayMs, 
                         Math.min(this.config.maxDelayMs, calculatedDelay));
        
        // Store for learning
        this.lastCalculatedDelay = calculatedDelay;
        this.delayHistory.push({
            timestamp: Date.now(),
            delay: calculatedDelay,
            factors: { performanceFactor, rateLimitFactor, contextFactor },
            context: { ...context }
        });
        
        // Keep history manageable
        if (this.delayHistory.length > 100) {
            this.delayHistory = this.delayHistory.slice(-50);
        }
        
        return Math.round(calculatedDelay);
    }

    /**
     * Calculate performance factor based on recent API performance
     */
    calculatePerformanceFactor() {
        if (this.responseTimeHistory.length === 0) return 1.0;
        
        // Get recent response times (last 10 requests)
        const recentResponses = this.responseTimeHistory.slice(-10);
        const avgResponseTime = recentResponses.reduce((sum, rt) => sum + rt, 0) / recentResponses.length;
        
        // Get recent success rate
        const recentSuccesses = this.successRateHistory.slice(-10);
        const successRate = recentSuccesses.length > 0 ? 
            recentSuccesses.reduce((sum, s) => sum + s, 0) / recentSuccesses.length : 1.0;
        
        let performanceFactor = 1.0;
        
        // Adjust based on response time
        if (avgResponseTime < this.config.fastResponseThreshold) {
            performanceFactor *= 0.7; // Decrease delay for fast responses
        } else if (avgResponseTime > this.config.slowResponseThreshold) {
            performanceFactor *= 1.5; // Increase delay for slow responses
        }
        
        // Adjust based on success rate
        if (successRate > 0.95) {
            performanceFactor *= 0.8; // Decrease delay for high success rate
        } else if (successRate < 0.8) {
            performanceFactor *= 1.3; // Increase delay for low success rate
        }
        
        return Math.max(0.3, Math.min(2.0, performanceFactor));
    }

    /**
     * Calculate rate limit factor based on current usage
     */
    calculateRateLimitFactor(context) {
        const { requestsInLastMinute = 0, minuteLimit = 60 } = context;
        
        if (minuteLimit === 0) return 1.0;
        
        const usageRatio = requestsInLastMinute / minuteLimit;
        let rateLimitFactor = 1.0;
        
        if (usageRatio > this.config.rateLimitDangerThreshold) {
            // Very close to limit - significantly increase delay
            rateLimitFactor = 2.5;
        } else if (usageRatio > this.config.rateLimitWarningThreshold) {
            // Approaching limit - moderately increase delay
            rateLimitFactor = 1.5;
        } else if (usageRatio < 0.3) {
            // Well below limit - can decrease delay
            rateLimitFactor = 0.7;
        }
        
        return rateLimitFactor;
    }

    /**
     * Calculate context factor based on processing situation
     */
    calculateContextFactor() {
        let contextFactor = 1.0;
        
        // Burst mode - minimize delays
        if (this.processingContext.isBurstMode) {
            contextFactor *= 0.3;
        }
        
        // Retry mode - be more conservative
        if (this.processingContext.isRetryMode) {
            contextFactor *= 1.4;
        }
        
        // Consecutive successes - can be more aggressive
        if (this.processingContext.consecutiveSuccesses > 5) {
            contextFactor *= 0.8;
        }
        
        // Consecutive failures - be more conservative
        if (this.processingContext.consecutiveFailures > 2) {
            contextFactor *= 1.6;
        }
        
        // Progress-based adjustment
        const progressRatio = this.processingContext.totalDevices > 0 ? 
            this.processingContext.processedDevices / this.processingContext.totalDevices : 0;
        
        if (progressRatio > 0.8) {
            // Near completion - can be more aggressive to finish quickly
            contextFactor *= 0.9;
        } else if (progressRatio < 0.1) {
            // Just starting - be more conservative
            contextFactor *= 1.1;
        }
        
        return Math.max(0.2, Math.min(3.0, contextFactor));
    }

    /**
     * Apply context-specific adjustments
     */
    applyContextAdjustments(delay, context) {
        // Time-of-day adjustment (if API has known patterns)
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 17) {
            // Business hours - API might be busier
            delay *= 1.1;
        }
        
        // Error recovery adjustment
        if (context.lastError && this.isRateLimitError(context.lastError)) {
            // Recent rate limit hit - be extra conservative
            delay *= 2.0;
        }
        
        // Circuit breaker state adjustment
        if (context.circuitState === 'HALF_OPEN') {
            // Testing recovery - be conservative
            delay *= 1.5;
        } else if (context.circuitState === 'OPEN') {
            // Circuit open - maximum delay
            delay = this.config.maxDelayMs;
        }
        
        return delay;
    }

    /**
     * Record API response for learning
     */
    recordResponse(responseTime, success, error = null) {
        // Update response time history
        this.responseTimeHistory.push(responseTime);
        if (this.responseTimeHistory.length > 50) {
            this.responseTimeHistory = this.responseTimeHistory.slice(-25);
        }
        
        // Update success rate history
        this.successRateHistory.push(success ? 1 : 0);
        if (this.successRateHistory.length > 50) {
            this.successRateHistory = this.successRateHistory.slice(-25);
        }
        
        // Update consecutive counters
        if (success) {
            this.processingContext.consecutiveSuccesses++;
            this.processingContext.consecutiveFailures = 0;
        } else {
            this.processingContext.consecutiveFailures++;
            this.processingContext.consecutiveSuccesses = 0;
        }
        
        // Learn from the response
        this.learnFromResponse(responseTime, success, error);
    }

    /**
     * Learn and adapt from API responses
     */
    learnFromResponse(responseTime, success, error) {
        // Calculate effectiveness of last delay
        const lastDelayEntry = this.delayHistory[this.delayHistory.length - 1];
        if (!lastDelayEntry) return;
        
        const delayEffectiveness = this.calculateDelayEffectiveness(
            lastDelayEntry.delay, responseTime, success
        );
        
        // Adapt base delay based on effectiveness
        if (delayEffectiveness > 1.2) {
            // Delay was too conservative - can reduce base delay
            this.currentBaseDelay = Math.max(
                this.config.minDelayMs,
                this.currentBaseDelay * (1 - this.config.adaptationRate)
            );
        } else if (delayEffectiveness < 0.8) {
            // Delay was too aggressive - increase base delay
            this.currentBaseDelay = Math.min(
                this.config.maxDelayMs,
                this.currentBaseDelay * (1 + this.config.adaptationRate)
            );
        }
        
        // Adapt multiplier based on recent performance
        const recentSuccessRate = this.getRecentSuccessRate();
        if (recentSuccessRate > 0.95) {
            this.adaptiveMultiplier = Math.max(0.5, this.adaptiveMultiplier * 0.95);
        } else if (recentSuccessRate < 0.8) {
            this.adaptiveMultiplier = Math.min(2.0, this.adaptiveMultiplier * 1.05);
        }
    }

    /**
     * Calculate how effective the last delay was
     */
    calculateDelayEffectiveness(delay, responseTime, success) {
        // Effectiveness is based on achieving good performance with minimal delay
        const responseScore = Math.max(0, 2000 - responseTime) / 2000; // 0-1 score
        const successScore = success ? 1 : 0;
        const delayScore = Math.max(0, this.config.maxDelayMs - delay) / this.config.maxDelayMs; // 0-1 score
        
        // Combined effectiveness (higher is better)
        return (responseScore * 0.4 + successScore * 0.4 + delayScore * 0.2) * 2;
    }

    /**
     * Get recent success rate
     */
    getRecentSuccessRate() {
        const recentSuccesses = this.successRateHistory.slice(-10);
        return recentSuccesses.length > 0 ? 
            recentSuccesses.reduce((sum, s) => sum + s, 0) / recentSuccesses.length : 1.0;
    }

    /**
     * Update processing context
     */
    updateContext(context) {
        Object.assign(this.processingContext, context);
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
     * Get delay recommendation for specific scenarios
     */
    getScenarioDelay(scenario) {
        const scenarios = {
            'burst_start': this.config.minDelayMs,
            'burst_continue': this.config.minDelayMs * 0.5,
            'normal_processing': this.calculateDelay(),
            'retry_after_failure': this.calculateDelay({ isRetryMode: true }) * 1.5,
            'rate_limit_recovery': this.config.maxDelayMs * 0.3,
            'circuit_breaker_test': this.config.baseDelayMs * 2
        };
        
        return scenarios[scenario] || this.calculateDelay();
    }

    /**
     * Get comprehensive status for monitoring
     */
    getStatus() {
        return {
            vendor: this.vendor,
            currentBaseDelay: this.currentBaseDelay,
            lastCalculatedDelay: this.lastCalculatedDelay,
            adaptiveMultiplier: this.adaptiveMultiplier,
            
            // Performance metrics
            averageResponseTime: this.responseTimeHistory.length > 0 ? 
                this.responseTimeHistory.reduce((sum, rt) => sum + rt, 0) / this.responseTimeHistory.length : 0,
            recentSuccessRate: this.getRecentSuccessRate(),
            
            // Context
            processingContext: { ...this.processingContext },
            
            // History sizes
            responseHistorySize: this.responseTimeHistory.length,
            successHistorySize: this.successRateHistory.length,
            delayHistorySize: this.delayHistory.length,
            
            // Configuration
            config: { ...this.config }
        };
    }

    /**
     * Reset learning state
     */
    reset() {
        this.responseTimeHistory = [];
        this.successRateHistory = [];
        this.delayHistory = [];
        this.currentBaseDelay = this.config.baseDelayMs;
        this.adaptiveMultiplier = 1.0;
        this.processingContext = {
            totalDevices: 0,
            processedDevices: 0,
            consecutiveSuccesses: 0,
            consecutiveFailures: 0,
            isRetryMode: false,
            isBurstMode: false
        };
        
        console.log(`[${this.vendor}] Delay calculator reset`);
    }
}

export default IntelligentDelayCalculator;
