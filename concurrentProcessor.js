/**
 * Concurrent Processor for WarrantyDog
 * Manages concurrent processing of multiple devices with intelligent throttling
 */

class ConcurrentProcessor {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            maxConcurrency: config.maxConcurrency || 3,
            minConcurrency: config.minConcurrency || 1,
            adaptiveConcurrency: config.adaptiveConcurrency !== false,
            batchSize: config.batchSize || 10
        };

        // Processing state
        this.currentConcurrency = this.config.minConcurrency;
        this.activeRequests = 0;
        this.isProcessing = false;
        this.processingQueue = [];

        // Performance tracking
        this.processedCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
        this.averageProcessingTime = 1000;
        this.lastOptimization = Date.now();
    }

    /**
     * Start processing devices with intelligent concurrency
     */
    async startProcessing(devices, processingFunction) {
        if (this.isProcessing) {
            throw new Error('Processor is already running');
        }

        this.isProcessing = true;
        this.processingQueue = [...devices];
        this.resetCounters();

        console.log(`[${this.vendor}] Starting concurrent processing of ${devices.length} devices (concurrency: ${this.currentConcurrency})`);

        const results = [];
        const workers = [];

        // Start worker promises
        for (let i = 0; i < this.currentConcurrency; i++) {
            workers.push(this.worker(processingFunction, results));
        }

        // Wait for all workers to complete
        await Promise.all(workers);

        this.isProcessing = false;
        
        console.log(`[${this.vendor}] Processing completed: ${this.successCount}/${this.processedCount} successful`);
        
        return results;
    }

    /**
     * Worker function that processes items from the queue
     */
    async worker(processingFunction, results) {
        while (this.processingQueue.length > 0 && this.isProcessing) {
            const device = this.processingQueue.shift();
            if (!device) break;

            this.activeRequests++;
            const startTime = Date.now();

            try {
                const result = await processingFunction(device);
                results.push(result);
                
                this.recordSuccess(Date.now() - startTime);
            } catch (error) {
                results.push({
                    error: error.message,
                    device: device,
                    success: false
                });
                
                this.recordFailure(Date.now() - startTime);
            } finally {
                this.activeRequests--;
                this.processedCount++;
            }

            // Adaptive concurrency adjustment
            if (this.config.adaptiveConcurrency) {
                this.adjustConcurrencyIfNeeded();
            }
        }
    }

    /**
     * Record successful processing
     */
    recordSuccess(processingTime) {
        this.successCount++;
        this.updateAverageProcessingTime(processingTime);
    }

    /**
     * Record failed processing
     */
    recordFailure(processingTime) {
        this.failureCount++;
        this.updateAverageProcessingTime(processingTime);
    }

    /**
     * Update average processing time
     */
    updateAverageProcessingTime(processingTime) {
        this.averageProcessingTime = this.averageProcessingTime * 0.9 + processingTime * 0.1;
    }

    /**
     * Adjust concurrency based on performance
     */
    adjustConcurrencyIfNeeded() {
        const now = Date.now();
        if (now - this.lastOptimization < 10000) return; // Adjust every 10 seconds max

        const successRate = this.processedCount > 0 ? this.successCount / this.processedCount : 1.0;

        // Increase concurrency if performing well
        if (successRate > 0.95 && this.averageProcessingTime < 3000 && this.currentConcurrency < this.config.maxConcurrency) {
            this.currentConcurrency = Math.min(this.config.maxConcurrency, this.currentConcurrency + 1);
            console.log(`[${this.vendor}] Increased concurrency to ${this.currentConcurrency}`);
        }
        
        // Decrease concurrency if having issues
        else if ((successRate < 0.8 || this.averageProcessingTime > 8000) && this.currentConcurrency > this.config.minConcurrency) {
            this.currentConcurrency = Math.max(this.config.minConcurrency, this.currentConcurrency - 1);
            console.log(`[${this.vendor}] Decreased concurrency to ${this.currentConcurrency}`);
        }

        this.lastOptimization = now;
    }

    /**
     * Stop processing
     */
    stop() {
        this.isProcessing = false;
        console.log(`[${this.vendor}] Processing stopped`);
    }

    /**
     * Reset counters
     */
    resetCounters() {
        this.processedCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
        this.averageProcessingTime = 1000;
        this.activeRequests = 0;
    }

    /**
     * Get processor status
     */
    getStatus() {
        const successRate = this.processedCount > 0 ? this.successCount / this.processedCount : 1.0;
        
        return {
            vendor: this.vendor,
            isProcessing: this.isProcessing,
            currentConcurrency: this.currentConcurrency,
            activeRequests: this.activeRequests,
            queueLength: this.processingQueue.length,
            
            // Performance metrics
            processedCount: this.processedCount,
            successCount: this.successCount,
            failureCount: this.failureCount,
            successRate: successRate,
            averageProcessingTime: this.averageProcessingTime,
            
            // Configuration
            config: this.config,
            lastOptimization: this.lastOptimization
        };
    }

    /**
     * Reset processor
     */
    reset() {
        this.stop();
        this.currentConcurrency = this.config.minConcurrency;
        this.processingQueue = [];
        this.resetCounters();
        this.lastOptimization = Date.now();

        console.log(`[${this.vendor}] Concurrent processor reset`);
    }
}

export default ConcurrentProcessor;
