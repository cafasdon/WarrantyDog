/**
 * Concurrent Processor for WarrantyDog
 * Intelligent concurrent processing with adaptive throttling and rate limit management
 */

/**
 * Manages concurrent API requests with intelligent throttling
 */
class ConcurrentProcessor {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // Enhanced concurrency settings for cached responses
            maxConcurrency: config.maxConcurrency || 8,          // Increased for better throughput with caching
            minConcurrency: config.minConcurrency || 2,          // Higher minimum for efficiency
            initialConcurrency: config.initialConcurrency || 4,  // Start with higher concurrency
            
            // Adaptive settings
            performanceThreshold: config.performanceThreshold || 0.9,  // Success rate threshold
            responseTimeThreshold: config.responseTimeThreshold || 2000, // Response time threshold
            adaptationInterval: config.adaptationInterval || 30000,     // 30 seconds
            
            // Safety settings
            rateLimitBackoff: config.rateLimitBackoff || 0.5,    // Reduce concurrency on rate limits
            errorBackoff: config.errorBackoff || 0.7,            // Reduce concurrency on errors
            recoveryFactor: config.recoveryFactor || 1.2,        // Increase factor when recovering
            
            // Queue settings
            maxQueueSize: config.maxQueueSize || 1000,           // Maximum queue size
            queueTimeout: config.queueTimeout || 60000,          // Queue item timeout
            
            // Monitoring
            metricsWindow: config.metricsWindow || 300000        // 5 minutes metrics window
        };

        // Concurrency state
        this.currentConcurrency = this.config.initialConcurrency;
        this.activeRequests = new Map();
        this.requestQueue = [];
        
        // Performance tracking with cache metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            rateLimitHits: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 1000,
            throughput: 0,
            cacheHitRate: 0
        };
        
        // Adaptive state
        this.lastAdaptation = Date.now();
        this.performanceHistory = [];
        this.concurrencyHistory = [];
        
        // Processing state
        this.isProcessing = false;
        this.isPaused = false;
        this.processingStartTime = null;
    }

    /**
     * Check cache for existing warranty data
     */
    async checkCache(device) {
        try {
            const response = await fetch('/api/cached-warranty', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vendor: this.vendor,
                    serviceTag: device.serialNumber,
                    maxAgeHours: 24
                })
            });

            if (response.ok) {
                const cachedData = await response.json();
                if (cachedData.found && cachedData.parsedData) {
                    this.metrics.cacheHits++;
                    return JSON.parse(cachedData.parsedData);
                }
            }

            this.metrics.cacheMisses++;
            return null;
        } catch (error) {
            console.error(`Cache check failed for ${device.serialNumber}:`, error);
            this.metrics.cacheMisses++;
            return null;
        }
    }

    /**
     * Start concurrent processing with cache integration
     */
    async startProcessing(devices, processingFunction) {
        if (this.isProcessing) {
            throw new Error('Processing already in progress');
        }

        this.isProcessing = true;
        this.isPaused = false;
        this.processingStartTime = Date.now();

        // Pre-filter devices through cache
        console.log(`[${this.vendor}] Checking cache for ${devices.length} devices...`);
        const uncachedDevices = [];
        const cachedResults = new Map();

        for (const device of devices) {
            const cachedResult = await this.checkCache(device);
            if (cachedResult) {
                cachedResults.set(device.serialNumber, cachedResult);
                console.log(`[${this.vendor}] Cache hit for ${device.serialNumber}`);
            } else {
                uncachedDevices.push(device);
            }
        }

        console.log(`[${this.vendor}] Cache results: ${cachedResults.size} hits, ${uncachedDevices.length} misses`);

        // Initialize queue with uncached devices only
        this.requestQueue = uncachedDevices.map((device, index) => ({
            id: `device_${index}`,
            device,
            addedAt: Date.now(),
            attempts: 0,
            maxAttempts: 3
        }));

        console.log(`[${this.vendor}] Starting concurrent processing: ${uncachedDevices.length} devices (${cachedResults.size} from cache), concurrency: ${this.currentConcurrency}`);

        try {
            // Process uncached devices
            const apiResults = await this.processQueue(processingFunction);

            // Combine cached and API results
            const allResults = new Map([...cachedResults, ...apiResults]);
            return allResults;
        } finally {
            this.isProcessing = false;
            this.updateCacheMetrics();
        }
    }

    /**
     * Update cache hit rate metrics
     */
    updateCacheMetrics() {
        const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
        this.metrics.cacheHitRate = totalCacheRequests > 0 ?
            (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;
    }

    /**
     * Process the request queue with adaptive concurrency
     */
    async processQueue(processingFunction) {
        const workers = [];
        const results = new Map();

        // Start initial workers
        for (let i = 0; i < this.currentConcurrency; i++) {
            workers.push(this.createWorker(i, processingFunction, results));
        }

        // Monitor and adapt concurrency
        const adaptationInterval = setInterval(() => {
            if (!this.isProcessing) {
                clearInterval(adaptationInterval);
                return;
            }
            this.adaptConcurrency(workers, processingFunction, results);
        }, this.config.adaptationInterval);

        // Wait for all workers to complete
        await Promise.all(workers);
        clearInterval(adaptationInterval);

        console.log(`[${this.vendor}] Concurrent processing completed`);
        return results;
    }

    /**
     * Create a worker to process queue items
     */
    async createWorker(workerId, processingFunction, results) {
        console.log(`[${this.vendor}] Worker ${workerId} started`);
        
        while (this.isProcessing && !this.isPaused) {
            // Get next item from queue
            const queueItem = this.getNextQueueItem();
            if (!queueItem) {
                // No more items, wait a bit and check again
                await this.sleep(100);
                continue;
            }

            // Check if we should process this item (concurrency control)
            if (this.activeRequests.size >= this.currentConcurrency) {
                // Put item back in queue and wait
                this.requestQueue.unshift(queueItem);
                await this.sleep(50);
                continue;
            }

            // Process the item
            await this.processQueueItem(queueItem, processingFunction, results);
        }
        
        console.log(`[${this.vendor}] Worker ${workerId} finished`);
    }

    /**
     * Get next item from queue
     */
    getNextQueueItem() {
        // Remove expired items
        const now = Date.now();
        this.requestQueue = this.requestQueue.filter(
            item => now - item.addedAt < this.config.queueTimeout
        );

        // Get next item
        return this.requestQueue.shift();
    }

    /**
     * Process a single queue item
     */
    async processQueueItem(queueItem, processingFunction, results) {
        const requestId = `${queueItem.id}_${Date.now()}`;
        const startTime = Date.now();

        // Track active request
        this.activeRequests.set(requestId, {
            queueItem,
            startTime,
            workerId: requestId
        });

        try {
            // Execute the processing function
            const result = await processingFunction(queueItem.device);

            // Store result
            if (result && queueItem.device.serialNumber) {
                results.set(queueItem.device.serialNumber, result);
            }
            
            // Record success
            const responseTime = Date.now() - startTime;
            this.recordSuccess(responseTime);
            
            return result;
            
        } catch (error) {
            // Record failure
            const responseTime = Date.now() - startTime;
            this.recordFailure(error, responseTime);
            
            // Handle retry logic
            if (this.shouldRetry(queueItem, error)) {
                queueItem.attempts++;
                queueItem.addedAt = Date.now();
                this.requestQueue.push(queueItem);
                console.log(`[${this.vendor}] Retrying ${queueItem.id} (attempt ${queueItem.attempts}/${queueItem.maxAttempts})`);
            }
            
            throw error;
            
        } finally {
            // Remove from active requests
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Adapt concurrency based on performance
     */
    adaptConcurrency(workers, processingFunction, results) {
        const now = Date.now();
        if (now - this.lastAdaptation < this.config.adaptationInterval) {
            return;
        }

        const currentPerformance = this.getCurrentPerformance();
        this.performanceHistory.push({
            timestamp: now,
            concurrency: this.currentConcurrency,
            performance: currentPerformance
        });

        // Keep history manageable
        if (this.performanceHistory.length > 20) {
            this.performanceHistory = this.performanceHistory.slice(-10);
        }

        const newConcurrency = this.calculateOptimalConcurrency(currentPerformance);
        
        if (newConcurrency !== this.currentConcurrency) {
            this.adjustConcurrency(newConcurrency, workers, processingFunction, results);
        }

        this.lastAdaptation = now;
    }

    /**
     * Calculate optimal concurrency based on performance
     */
    calculateOptimalConcurrency(performance) {
        let newConcurrency = this.currentConcurrency;
        
        // Decrease concurrency if performance is poor
        if (performance.successRate < this.config.performanceThreshold ||
            performance.averageResponseTime > this.config.responseTimeThreshold ||
            performance.rateLimitRate > 0.1) {
            
            newConcurrency = Math.max(
                this.config.minConcurrency,
                Math.floor(this.currentConcurrency * this.config.errorBackoff)
            );
        }
        
        // Increase concurrency if performance is good
        else if (performance.successRate > 0.95 &&
                 performance.averageResponseTime < this.config.responseTimeThreshold * 0.7 &&
                 performance.rateLimitRate === 0) {
            
            newConcurrency = Math.min(
                this.config.maxConcurrency,
                Math.ceil(this.currentConcurrency * this.config.recoveryFactor)
            );
        }
        
        return newConcurrency;
    }

    /**
     * Adjust concurrency by adding or removing workers
     */
    adjustConcurrency(newConcurrency, workers, processingFunction, results) {
        const oldConcurrency = this.currentConcurrency;
        this.currentConcurrency = newConcurrency;
        
        console.log(`[${this.vendor}] Adjusting concurrency: ${oldConcurrency} → ${newConcurrency}`);
        
        // Add workers if increasing concurrency
        if (newConcurrency > oldConcurrency) {
            const workersToAdd = newConcurrency - oldConcurrency;
            for (let i = 0; i < workersToAdd; i++) {
                const workerId = workers.length + i;
                workers.push(this.createWorker(workerId, processingFunction, results));
            }
        }
        
        // Note: We don't actively remove workers when decreasing concurrency
        // They will naturally finish and not restart due to the concurrency check
        
        this.concurrencyHistory.push({
            timestamp: Date.now(),
            oldConcurrency,
            newConcurrency,
            reason: this.getAdjustmentReason()
        });
    }

    /**
     * Get reason for concurrency adjustment
     */
    getAdjustmentReason() {
        const performance = this.getCurrentPerformance();
        
        if (performance.rateLimitRate > 0.1) return 'rate_limits';
        if (performance.successRate < 0.9) return 'low_success_rate';
        if (performance.averageResponseTime > this.config.responseTimeThreshold) return 'slow_responses';
        if (performance.successRate > 0.95 && performance.averageResponseTime < 1000) return 'good_performance';
        
        return 'adaptive_optimization';
    }

    /**
     * Record successful request
     */
    recordSuccess(responseTime) {
        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        this.updateAverageResponseTime(responseTime);
        this.updateThroughput();
    }

    /**
     * Record failed request
     */
    recordFailure(error, responseTime) {
        this.metrics.totalRequests++;
        this.metrics.failedRequests++;
        
        if (this.isRateLimitError(error)) {
            this.metrics.rateLimitHits++;
        }
        
        this.updateAverageResponseTime(responseTime);
        this.updateThroughput();
    }

    /**
     * Update average response time with exponential moving average
     */
    updateAverageResponseTime(responseTime) {
        this.metrics.averageResponseTime = 
            this.metrics.averageResponseTime * 0.9 + responseTime * 0.1;
    }

    /**
     * Update throughput calculation
     */
    updateThroughput() {
        if (!this.processingStartTime) return;
        
        const elapsedSeconds = (Date.now() - this.processingStartTime) / 1000;
        this.metrics.throughput = this.metrics.totalRequests / elapsedSeconds;
    }

    /**
     * Get current performance metrics
     */
    getCurrentPerformance() {
        const total = this.metrics.totalRequests;
        
        return {
            successRate: total > 0 ? this.metrics.successfulRequests / total : 1.0,
            averageResponseTime: this.metrics.averageResponseTime,
            rateLimitRate: total > 0 ? this.metrics.rateLimitHits / total : 0,
            throughput: this.metrics.throughput,
            activeRequests: this.activeRequests.size,
            queueSize: this.requestQueue.length
        };
    }

    /**
     * Check if should retry a failed request
     */
    shouldRetry(queueItem, error) {
        if (queueItem.attempts >= queueItem.maxAttempts) {
            return false;
        }
        
        // Always retry rate limit errors
        if (this.isRateLimitError(error)) {
            return true;
        }
        
        // Retry certain network errors
        const retryablePatterns = ['timeout', 'network', '500', '502', '503', '504'];
        return retryablePatterns.some(pattern =>
            error.message && error.message.toLowerCase().includes(pattern)
        );
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
     * Pause processing
     */
    pause() {
        this.isPaused = true;
        console.log(`[${this.vendor}] Processing paused`);
    }

    /**
     * Resume processing
     */
    resume() {
        this.isPaused = false;
        console.log(`[${this.vendor}] Processing resumed`);
    }

    /**
     * Stop processing
     */
    stop() {
        this.isProcessing = false;
        this.isPaused = false;
        console.log(`[${this.vendor}] Processing stopped`);
    }

    /**
     * Get comprehensive status
     */
    getStatus() {
        return {
            vendor: this.vendor,
            isProcessing: this.isProcessing,
            isPaused: this.isPaused,
            currentConcurrency: this.currentConcurrency,
            
            // Queue status
            queueSize: this.requestQueue.length,
            activeRequests: this.activeRequests.size,
            
            // Performance
            metrics: { ...this.metrics },
            currentPerformance: this.getCurrentPerformance(),
            
            // History
            performanceHistory: this.performanceHistory.slice(-5),
            concurrencyHistory: this.concurrencyHistory.slice(-5),
            
            // Configuration
            config: { ...this.config }
        };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset processor state
     */
    reset() {
        this.stop();
        this.currentConcurrency = this.config.initialConcurrency;
        this.activeRequests.clear();
        this.requestQueue = [];
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            rateLimitHits: 0,
            averageResponseTime: 1000,
            throughput: 0
        };
        this.performanceHistory = [];
        this.concurrencyHistory = [];
        
        console.log(`[${this.vendor}] Processor reset`);
    }
}

export default ConcurrentProcessor;
