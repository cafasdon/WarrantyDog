/**
 * Intelligent Delay Calculator for WarrantyDog
 * Calculates optimal delays between API requests based on performance data
 */

class IntelligentDelayCalculator {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            baseDelayMs: config.baseDelayMs || 2000,
            minDelayMs: config.minDelayMs || 500,
            maxDelayMs: config.maxDelayMs || 10000,
            adaptiveMultiplier: config.adaptiveMultiplier || 1.0,
            learningRate: config.learningRate || 0.1
        };

        // Current state
        this.currentBaseDelay = this.config.baseDelayMs;
        this.adaptiveMultiplier = this.config.adaptiveMultiplier;

        // Performance tracking
        this.responseHistory = [];
        this.recentSuccessRate = 1.0;
        this.averageResponseTime = 1000;
        this.lastCalculation = Date.now();
    }

    /**
     * Calculate optimal delay based on current conditions
     */
    calculateDelay(context = {}) {
        let delay = this.currentBaseDelay * this.adaptiveMultiplier;

        // Adjust based on circuit breaker state
        if (context.circuitState === 'OPEN') {
            delay *= 3.0;
        } else if (context.circuitState === 'HALF_OPEN') {
            delay *= 1.5;
        }

        // Adjust based on recent performance
        if (this.recentSuccessRate < 0.9) {
            delay *= 1.5;
        } else if (this.recentSuccessRate > 0.95 && this.averageResponseTime < 2000) {
            delay *= 0.8;
        }

        // Adjust based on current load
        if (context.requestsInLastMinute && context.minuteLimit) {
            const loadFactor = context.requestsInLastMinute / context.minuteLimit;
            if (loadFactor > 0.8) {
                delay *= (1 + loadFactor);
            }
        }

        // Ensure delay is within bounds
        return Math.max(this.config.minDelayMs, Math.min(this.config.maxDelayMs, delay));
    }

    /**
     * Get delay for specific scenarios
     */
    getScenarioDelay(scenario) {
        switch (scenario) {
            case 'burst_start':
                return Math.max(this.config.minDelayMs, this.currentBaseDelay * 0.5);
            case 'rate_limit_recovery':
                return this.config.maxDelayMs;
            case 'circuit_breaker_recovery':
                return this.currentBaseDelay * 2;
            case 'normal':
            default:
                return this.calculateDelay();
        }
    }

    /**
     * Record response for learning
     */
    recordResponse(responseTime, success, error = null) {
        const now = Date.now();
        
        this.responseHistory.push({
            timestamp: now,
            responseTime: responseTime,
            success: success,
            error: error
        });

        // Keep only recent history (last 50 responses)
        if (this.responseHistory.length > 50) {
            this.responseHistory = this.responseHistory.slice(-50);
        }

        // Update metrics
        this.updateMetrics();

        // Adaptive learning
        this.adaptDelayBasedOnPerformance(success, responseTime);
    }

    /**
     * Update performance metrics
     */
    updateMetrics() {
        if (this.responseHistory.length === 0) return;

        // Calculate recent success rate (last 20 responses)
        const recentResponses = this.responseHistory.slice(-20);
        const successCount = recentResponses.filter(r => r.success).length;
        this.recentSuccessRate = successCount / recentResponses.length;

        // Calculate average response time
        const totalResponseTime = recentResponses.reduce((sum, r) => sum + r.responseTime, 0);
        this.averageResponseTime = totalResponseTime / recentResponses.length;
    }

    /**
     * Adapt delay based on performance
     */
    adaptDelayBasedOnPerformance(success, responseTime) {
        const learningRate = this.config.learningRate;

        if (success) {
            // Successful request - potentially decrease delay
            if (responseTime < 2000 && this.recentSuccessRate > 0.95) {
                this.adaptiveMultiplier = Math.max(0.5, this.adaptiveMultiplier * (1 - learningRate * 0.5));
            }
        } else {
            // Failed request - increase delay
            this.adaptiveMultiplier = Math.min(3.0, this.adaptiveMultiplier * (1 + learningRate));
        }

        console.log(`[${this.vendor}] Delay adapted: multiplier=${this.adaptiveMultiplier.toFixed(2)}, success=${success}, responseTime=${responseTime}ms`);
    }

    /**
     * Get calculator status
     */
    getStatus() {
        return {
            vendor: this.vendor,
            currentBaseDelay: this.currentBaseDelay,
            adaptiveMultiplier: this.adaptiveMultiplier,
            recentSuccessRate: this.recentSuccessRate,
            averageResponseTime: this.averageResponseTime,
            
            // Current calculations
            currentOptimalDelay: this.calculateDelay(),
            
            // Configuration
            config: this.config,
            
            // History
            responseHistoryLength: this.responseHistory.length,
            lastCalculation: this.lastCalculation
        };
    }

    /**
     * Reset calculator
     */
    reset() {
        this.currentBaseDelay = this.config.baseDelayMs;
        this.adaptiveMultiplier = this.config.adaptiveMultiplier;
        this.responseHistory = [];
        this.recentSuccessRate = 1.0;
        this.averageResponseTime = 1000;
        this.lastCalculation = Date.now();

        console.log(`[${this.vendor}] Delay calculator reset`);
    }
}

export default IntelligentDelayCalculator;
