/**
 * Dynamic Burst Manager for WarrantyDog
 * Intelligent burst detection and management for Dell API optimization
 */

/**
 * Manages burst allowances and dynamic burst detection
 */
class BurstManager {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // Burst detection settings
            detectionWindowMs: config.detectionWindowMs || 60000,    // 1 minute window
            minBurstSize: config.minBurstSize || 3,                  // Minimum burst size to detect
            maxBurstSize: config.maxBurstSize || 20,                 // Maximum allowed burst
            burstCooldownMs: config.burstCooldownMs || 30000,        // Cooldown between bursts
            
            // Learning parameters
            confidenceThreshold: config.confidenceThreshold || 0.8,  // Confidence needed to use detected burst
            learningPeriodMs: config.learningPeriodMs || 300000,     // 5 minutes learning period
            
            // Safety settings
            conservativeMode: config.conservativeMode || false,      // Start conservative
            safetyMargin: config.safetyMargin || 0.8                // Use 80% of detected burst capacity
        };

        // Burst tracking
        this.burstHistory = [];
        this.successfulBursts = [];
        this.failedBursts = [];
        
        // Dynamic burst state
        this.detectedBurstSize = null;
        this.burstConfidence = 0;
        this.lastBurstTime = null;
        this.currentBurstCount = 0;
        this.burstStartTime = null;
        
        // Learning state
        this.learningStartTime = Date.now();
        this.isLearning = true;
    }

    /**
     * Check if a burst can be initiated
     */
    canStartBurst(requestsInLastMinute, minuteLimit) {
        const now = Date.now();
        
        // Check cooldown period
        if (this.lastBurstTime && (now - this.lastBurstTime) < this.config.burstCooldownMs) {
            return {
                allowed: false,
                reason: 'burst_cooldown',
                waitTime: this.config.burstCooldownMs - (now - this.lastBurstTime)
            };
        }

        // Check if we're already in a burst
        if (this.isInBurst()) {
            return {
                allowed: false,
                reason: 'already_in_burst',
                currentBurstCount: this.currentBurstCount
            };
        }

        // Conservative mode check
        if (this.config.conservativeMode && !this.hasHighConfidence()) {
            return {
                allowed: false,
                reason: 'conservative_mode',
                confidence: this.burstConfidence
            };
        }

        // Check if we're close to the minute limit
        const remainingCapacity = minuteLimit - requestsInLastMinute;
        const burstSize = this.getEffectiveBurstSize();
        
        if (remainingCapacity < burstSize) {
            return {
                allowed: false,
                reason: 'insufficient_capacity',
                remainingCapacity,
                requiredCapacity: burstSize
            };
        }

        // Check burst opportunity (API seems responsive)
        const recentPerformance = this.getRecentPerformance();
        if (recentPerformance.averageResponseTime > 3000) {
            return {
                allowed: false,
                reason: 'poor_performance',
                averageResponseTime: recentPerformance.averageResponseTime
            };
        }

        return {
            allowed: true,
            burstSize: burstSize,
            confidence: this.burstConfidence
        };
    }

    /**
     * Start a new burst
     */
    startBurst() {
        const now = Date.now();
        this.burstStartTime = now;
        this.currentBurstCount = 0;
        
        console.log(`[${this.vendor}] Starting burst (size: ${this.getEffectiveBurstSize()}, confidence: ${(this.burstConfidence * 100).toFixed(1)}%)`);
        
        return {
            burstId: `burst_${now}`,
            maxSize: this.getEffectiveBurstSize(),
            startTime: now
        };
    }

    /**
     * Record a request within a burst
     */
    recordBurstRequest(success = true, responseTime = null) {
        if (!this.isInBurst()) return;

        this.currentBurstCount++;
        
        const burstRequest = {
            timestamp: Date.now(),
            success,
            responseTime,
            burstPosition: this.currentBurstCount
        };

        // Add to current burst tracking
        if (!this.currentBurst) {
            this.currentBurst = {
                startTime: this.burstStartTime,
                requests: []
            };
        }
        
        this.currentBurst.requests.push(burstRequest);
        
        console.log(`[${this.vendor}] Burst request ${this.currentBurstCount}/${this.getEffectiveBurstSize()} - ${success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * End current burst and analyze results
     */
    endBurst(reason = 'completed') {
        if (!this.isInBurst()) return;

        const now = Date.now();
        const burstDuration = now - this.burstStartTime;
        
        const burstResult = {
            startTime: this.burstStartTime,
            endTime: now,
            duration: burstDuration,
            requestCount: this.currentBurstCount,
            maxSize: this.getEffectiveBurstSize(),
            reason,
            requests: this.currentBurst ? this.currentBurst.requests : [],
            success: reason === 'completed' || reason === 'rate_limit_safe'
        };

        // Analyze burst performance
        const analysis = this.analyzeBurstPerformance(burstResult);
        burstResult.analysis = analysis;

        // Store in history
        this.burstHistory.push(burstResult);
        
        if (burstResult.success) {
            this.successfulBursts.push(burstResult);
        } else {
            this.failedBursts.push(burstResult);
        }

        // Learn from this burst
        this.learnFromBurst(burstResult);

        // Reset burst state
        this.lastBurstTime = now;
        this.burstStartTime = null;
        this.currentBurstCount = 0;
        this.currentBurst = null;

        console.log(`[${this.vendor}] Burst ended: ${reason} (${this.currentBurstCount} requests in ${burstDuration}ms)`);
        
        return burstResult;
    }

    /**
     * Check if currently in a burst
     */
    isInBurst() {
        return this.burstStartTime !== null;
    }

    /**
     * Get effective burst size based on detection and confidence
     */
    getEffectiveBurstSize() {
        if (this.detectedBurstSize && this.hasHighConfidence()) {
            return Math.floor(this.detectedBurstSize * this.config.safetyMargin);
        }
        
        // Conservative fallback
        return this.config.minBurstSize;
    }

    /**
     * Check if we have high confidence in burst detection
     */
    hasHighConfidence() {
        return this.burstConfidence >= this.config.confidenceThreshold;
    }

    /**
     * Learn from successful API responses to detect burst patterns
     */
    learnBurstCapacity(consecutiveSuccesses, responseMetrics) {
        if (!this.isLearning) return;

        // Look for patterns in consecutive successful requests
        if (consecutiveSuccesses >= this.config.minBurstSize) {
            const avgResponseTime = responseMetrics.reduce((sum, m) => sum + m.responseTime, 0) / responseMetrics.length;
            
            // Good performance indicates burst capacity
            if (avgResponseTime < 2000) {
                this.updateBurstDetection(consecutiveSuccesses, true);
            }
        }
    }

    /**
     * Learn from rate limit hits during bursts
     */
    learnFromRateLimitHit(requestsInBurst) {
        // Rate limit hit during burst - learn the limit
        if (requestsInBurst > 0) {
            this.updateBurstDetection(requestsInBurst - 1, false);
        }
    }

    /**
     * Update burst size detection based on observations
     */
    updateBurstDetection(observedSize, wasSuccessful) {
        const weight = wasSuccessful ? 0.2 : 0.4; // Failed bursts teach us more about limits
        
        if (this.detectedBurstSize === null) {
            this.detectedBurstSize = observedSize;
            this.burstConfidence = 0.3;
        } else {
            // Exponential moving average
            this.detectedBurstSize = this.detectedBurstSize * (1 - weight) + observedSize * weight;
            
            // Increase confidence with more observations
            this.burstConfidence = Math.min(1.0, this.burstConfidence + 0.1);
        }

        // Cap at maximum allowed burst size
        this.detectedBurstSize = Math.min(this.config.maxBurstSize, this.detectedBurstSize);
        
        console.log(`[${this.vendor}] Updated burst detection: size=${this.detectedBurstSize.toFixed(1)}, confidence=${(this.burstConfidence * 100).toFixed(1)}%`);
    }

    /**
     * Analyze burst performance
     */
    analyzeBurstPerformance(burstResult) {
        const requests = burstResult.requests;
        if (requests.length === 0) return {};

        const successCount = requests.filter(r => r.success).length;
        const successRate = successCount / requests.length;
        const avgResponseTime = requests.reduce((sum, r) => sum + (r.responseTime || 1000), 0) / requests.length;
        
        const analysis = {
            successRate,
            avgResponseTime,
            efficiency: successRate * (2000 / Math.max(avgResponseTime, 500)), // Efficiency score
            recommendedSize: this.calculateRecommendedBurstSize(burstResult)
        };

        return analysis;
    }

    /**
     * Calculate recommended burst size based on performance
     */
    calculateRecommendedBurstSize(burstResult) {
        const analysis = burstResult.analysis || {};
        
        if (analysis.successRate > 0.9 && analysis.avgResponseTime < 1500) {
            // Excellent performance - can increase burst size
            return Math.min(this.config.maxBurstSize, burstResult.requestCount + 2);
        } else if (analysis.successRate < 0.7 || analysis.avgResponseTime > 3000) {
            // Poor performance - decrease burst size
            return Math.max(this.config.minBurstSize, burstResult.requestCount - 2);
        }
        
        // Maintain current size
        return burstResult.requestCount;
    }

    /**
     * Learn from completed burst
     */
    learnFromBurst(burstResult) {
        if (!burstResult.analysis) return;

        const recommendedSize = burstResult.analysis.recommendedSize;
        if (recommendedSize !== burstResult.requestCount) {
            this.updateBurstDetection(recommendedSize, burstResult.success);
        }

        // Update learning state
        const now = Date.now();
        if (now - this.learningStartTime > this.config.learningPeriodMs) {
            this.isLearning = false;
            console.log(`[${this.vendor}] Burst learning period completed`);
        }
    }

    /**
     * Get recent performance metrics
     */
    getRecentPerformance() {
        const recentBursts = this.burstHistory.filter(
            burst => Date.now() - burst.endTime < 300000 // Last 5 minutes
        );

        if (recentBursts.length === 0) {
            return { averageResponseTime: 1000, successRate: 1.0 };
        }

        const totalRequests = recentBursts.reduce((sum, burst) => sum + burst.requests.length, 0);
        const successfulRequests = recentBursts.reduce(
            (sum, burst) => sum + burst.requests.filter(r => r.success).length, 0
        );
        
        const totalResponseTime = recentBursts.reduce(
            (sum, burst) => sum + burst.requests.reduce((s, r) => s + (r.responseTime || 1000), 0), 0
        );

        return {
            averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 1000,
            successRate: totalRequests > 0 ? successfulRequests / totalRequests : 1.0
        };
    }

    /**
     * Get comprehensive burst status
     */
    getStatus() {
        return {
            vendor: this.vendor,
            isInBurst: this.isInBurst(),
            currentBurstCount: this.currentBurstCount,
            burstStartTime: this.burstStartTime,
            
            // Detection state
            detectedBurstSize: this.detectedBurstSize,
            effectiveBurstSize: this.getEffectiveBurstSize(),
            burstConfidence: this.burstConfidence,
            hasHighConfidence: this.hasHighConfidence(),
            
            // Learning state
            isLearning: this.isLearning,
            learningProgress: Math.min(1.0, (Date.now() - this.learningStartTime) / this.config.learningPeriodMs),
            
            // History
            totalBursts: this.burstHistory.length,
            successfulBursts: this.successfulBursts.length,
            failedBursts: this.failedBursts.length,
            
            // Performance
            recentPerformance: this.getRecentPerformance(),
            
            // Timing
            lastBurstTime: this.lastBurstTime,
            cooldownRemaining: this.lastBurstTime ? 
                Math.max(0, this.config.burstCooldownMs - (Date.now() - this.lastBurstTime)) : 0
        };
    }

    /**
     * Reset burst detection (for testing or manual reset)
     */
    resetDetection() {
        this.detectedBurstSize = null;
        this.burstConfidence = 0;
        this.isLearning = true;
        this.learningStartTime = Date.now();
        console.log(`[${this.vendor}] Burst detection reset`);
    }

    /**
     * Enable/disable conservative mode
     */
    setConservativeMode(enabled) {
        this.config.conservativeMode = enabled;
        console.log(`[${this.vendor}] Conservative mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}

export default BurstManager;
