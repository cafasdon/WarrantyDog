/**
 * Burst Manager for WarrantyDog
 * Manages burst processing capabilities for API requests
 */

class BurstManager {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            maxBurstSize: config.maxBurstSize || 10,
            burstWindowMs: config.burstWindowMs || 30000, // 30 seconds
            cooldownMs: config.cooldownMs || 60000, // 1 minute
            conservativeMode: config.conservativeMode || false
        };

        // Burst state
        this.isInBurstMode = false;
        this.burstStartTime = null;
        this.burstRequestCount = 0;
        this.lastBurstEnd = null;

        // Performance tracking
        this.burstHistory = [];
        this.successfulBursts = 0;
        this.failedBursts = 0;
    }

    /**
     * Check if a burst can be started
     */
    canStartBurst(currentRequests, minuteLimit) {
        // Don't start burst if already in burst mode
        if (this.isInBurstMode) {
            return { allowed: false, reason: 'Already in burst mode' };
        }

        // Don't start burst in conservative mode
        if (this.config.conservativeMode) {
            return { allowed: false, reason: 'Conservative mode enabled' };
        }

        // Check cooldown period
        if (this.lastBurstEnd && Date.now() - this.lastBurstEnd < this.config.cooldownMs) {
            return { allowed: false, reason: 'Cooldown period active' };
        }

        // Check if we have room for burst
        const remainingCapacity = minuteLimit - currentRequests;
        const burstSize = Math.min(this.config.maxBurstSize, Math.floor(remainingCapacity * 0.5));

        if (burstSize < 3) {
            return { allowed: false, reason: 'Insufficient capacity for meaningful burst' };
        }

        return {
            allowed: true,
            burstSize: burstSize,
            reason: `Burst of ${burstSize} requests approved`
        };
    }

    /**
     * Start a burst processing session
     */
    startBurst() {
        if (this.isInBurstMode) {
            console.warn(`[${this.vendor}] Attempted to start burst while already in burst mode`);
            return false;
        }

        this.isInBurstMode = true;
        this.burstStartTime = Date.now();
        this.burstRequestCount = 0;

        console.log(`[${this.vendor}] Burst mode started`);
        return true;
    }

    /**
     * End burst processing session
     */
    endBurst(reason = 'completed') {
        if (!this.isInBurstMode) {
            return false;
        }

        const duration = Date.now() - this.burstStartTime;
        const burstData = {
            startTime: this.burstStartTime,
            endTime: Date.now(),
            duration: duration,
            requestCount: this.burstRequestCount,
            reason: reason,
            successful: reason === 'completed'
        };

        this.burstHistory.push(burstData);

        if (reason === 'completed') {
            this.successfulBursts++;
        } else {
            this.failedBursts++;
        }

        this.isInBurstMode = false;
        this.lastBurstEnd = Date.now();
        this.burstStartTime = null;
        this.burstRequestCount = 0;

        console.log(`[${this.vendor}] Burst mode ended: ${reason} (${duration}ms, ${burstData.requestCount} requests)`);
        return true;
    }

    /**
     * Record a request during burst mode
     */
    recordBurstRequest(success, responseTime) {
        if (!this.isInBurstMode) {
            return false;
        }

        this.burstRequestCount++;

        // Auto-end burst if it's taking too long
        if (Date.now() - this.burstStartTime > this.config.burstWindowMs) {
            this.endBurst('timeout');
        }

        return true;
    }

    /**
     * Set conservative mode
     */
    setConservativeMode(enabled) {
        this.config.conservativeMode = enabled;
        
        if (enabled && this.isInBurstMode) {
            this.endBurst('conservative_mode_enabled');
        }

        console.log(`[${this.vendor}] Conservative mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get burst manager status
     */
    getStatus() {
        return {
            vendor: this.vendor,
            isInBurstMode: this.isInBurstMode,
            burstStartTime: this.burstStartTime,
            burstRequestCount: this.burstRequestCount,
            lastBurstEnd: this.lastBurstEnd,
            conservativeMode: this.config.conservativeMode,
            
            // Statistics
            totalBursts: this.successfulBursts + this.failedBursts,
            successfulBursts: this.successfulBursts,
            failedBursts: this.failedBursts,
            successRate: this.getTotalBursts() > 0 ? this.successfulBursts / this.getTotalBursts() : 1.0,
            
            // Recent performance
            recentBursts: this.burstHistory.slice(-5),
            config: this.config
        };
    }

    /**
     * Get total number of bursts
     */
    getTotalBursts() {
        return this.successfulBursts + this.failedBursts;
    }

    /**
     * Reset burst detection
     */
    resetDetection() {
        this.isInBurstMode = false;
        this.burstStartTime = null;
        this.burstRequestCount = 0;
        this.lastBurstEnd = null;
        this.burstHistory = [];
        this.successfulBursts = 0;
        this.failedBursts = 0;

        console.log(`[${this.vendor}] Burst manager reset`);
    }
}

export default BurstManager;
