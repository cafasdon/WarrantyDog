/**
 * Intelligent Rate Limiting System for WarrantyDog
 * Unified system that integrates adaptive rate limiting, burst management, 
 * intelligent delays, concurrent processing, analytics, and error recovery
 */

import AdaptiveRateLimiter from './adaptiveRateLimiter.js';
import BurstManager from './burstManager.js';
import IntelligentDelayCalculator from './intelligentDelayCalculator.js';
import ConcurrentProcessor from './concurrentProcessor.js';
import RateLimitAnalytics from './rateLimitAnalytics.js';
import { EnhancedErrorRecovery } from './enhancedErrorRecovery.js';

/**
 * Master intelligent rate limiting system
 */
class IntelligentRateLimitingSystem {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // System-wide settings
            enabled: config.enabled !== false,
            mode: config.mode || 'adaptive', // 'conservative', 'adaptive', 'aggressive'
            
            // Component configurations
            rateLimiter: config.rateLimiter || {},
            burstManager: config.burstManager || {},
            delayCalculator: config.delayCalculator || {},
            concurrentProcessor: config.concurrentProcessor || {},
            analytics: config.analytics || {},
            errorRecovery: config.errorRecovery || {},
            
            // Integration settings
            optimizationIntervalMs: config.optimizationIntervalMs || 60000,  // 1 minute
            coordinationEnabled: config.coordinationEnabled !== false,
            learningEnabled: config.learningEnabled !== false
        };

        // Initialize components
        this.rateLimiter = new AdaptiveRateLimiter(vendor, this.config.rateLimiter);
        this.burstManager = new BurstManager(vendor, this.config.burstManager);
        this.delayCalculator = new IntelligentDelayCalculator(vendor, this.config.delayCalculator);
        this.concurrentProcessor = new ConcurrentProcessor(vendor, this.config.concurrentProcessor);
        this.analytics = new RateLimitAnalytics(vendor, this.config.analytics);
        this.errorRecovery = new EnhancedErrorRecovery(vendor, this.config.errorRecovery);
        
        // System state
        this.isInitialized = false;
        this.currentMode = this.config.mode;
        this.lastOptimization = Date.now();
        
        // Performance tracking
        this.systemMetrics = {
            totalRequests: 0,
            optimizedRequests: 0,
            rateLimitHitsPrevented: 0,
            averageOptimizationGain: 0
        };
        
        // Start optimization loop
        this.startOptimizationLoop();
    }

    /**
     * Initialize the system
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log(`[${this.vendor}] Initializing Intelligent Rate Limiting System in ${this.currentMode} mode`);
        
        // Apply mode-specific configurations
        this.applyModeConfiguration();
        
        this.isInitialized = true;
        console.log(`[${this.vendor}] Intelligent Rate Limiting System initialized`);
    }

    /**
     * Execute a single API request with full intelligent rate limiting
     */
    async executeRequest(requestFunction, context = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        try {
            // Pre-request analysis and optimization
            const requestPlan = await this.planRequest(context);
            
            // Execute with error recovery
            const result = await this.errorRecovery.executeWithRecovery(async () => {
                return await this.executeOptimizedRequest(requestFunction, requestPlan, context);
            }, context);
            
            // Post-request learning and analytics
            const responseTime = Date.now() - startTime;
            await this.recordSuccess(requestId, responseTime, requestPlan, context);
            
            return result;
            
        } catch (error) {
            // Record failure for learning
            const responseTime = Date.now() - startTime;
            await this.recordFailure(requestId, error, responseTime, context);
            throw error;
        }
    }

    /**
     * Process multiple devices with intelligent concurrent processing
     */
    async processDevices(devices, processingFunction, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log(`[${this.vendor}] Starting intelligent processing of ${devices.length} devices`);
        
        // Create optimized processing function
        const optimizedProcessingFunction = async (device) => {
            return await this.executeRequest(
                () => processingFunction(device),
                { device, isProcessing: true, ...options }
            );
        };
        
        // Use concurrent processor with intelligent throttling
        return await this.concurrentProcessor.startProcessing(devices, optimizedProcessingFunction);
    }

    /**
     * Plan optimal request execution strategy
     */
    async planRequest(context = {}) {
        const plan = {
            timestamp: Date.now(),
            canProceed: false,
            strategy: 'wait',
            delayMs: 0,
            useBurst: false,
            concurrencyLevel: 1,
            reasoning: []
        };

        // Check circuit breaker
        if (!this.errorRecovery.canExecute()) {
            plan.strategy = 'circuit_open';
            plan.delayMs = this.errorRecovery.config.timeoutMs;
            plan.reasoning.push('Circuit breaker is open');
            return plan;
        }

        // Check rate limiter
        if (!this.rateLimiter.canMakeRequest()) {
            plan.strategy = 'rate_limited';
            plan.delayMs = this.rateLimiter.getOptimalDelay();
            plan.reasoning.push('Rate limit reached');
            return plan;
        }

        // Check burst opportunity
        const burstCheck = this.burstManager.canStartBurst(
            context.requestsInLastMinute || 0,
            context.minuteLimit || 60
        );
        
        if (burstCheck.allowed && this.shouldUseBurst(context)) {
            plan.useBurst = true;
            plan.strategy = 'burst';
            plan.delayMs = this.delayCalculator.getScenarioDelay('burst_start');
            plan.reasoning.push(`Burst mode (size: ${burstCheck.burstSize})`);
        } else {
            plan.strategy = 'normal';
            plan.delayMs = this.delayCalculator.calculateDelay({
                ...context,
                circuitState: this.errorRecovery.circuitState
            });
            plan.reasoning.push('Normal processing');
        }

        plan.canProceed = true;
        return plan;
    }

    /**
     * Execute request with optimized strategy
     */
    async executeOptimizedRequest(requestFunction, plan, context) {
        // Apply pre-request delay
        if (plan.delayMs > 0) {
            await this.sleep(plan.delayMs);
        }

        // Start burst if planned
        if (plan.useBurst) {
            this.burstManager.startBurst();
        }

        // Record request with rate limiter
        const responseMetrics = {
            responseTime: 0,
            rateLimitHeaders: {},
            success: true
        };

        const requestStart = Date.now();
        
        try {
            // Execute the actual request
            const result = await requestFunction();
            
            responseMetrics.responseTime = Date.now() - requestStart;
            responseMetrics.rateLimitHeaders = this.extractRateLimitHeaders(result);
            
            return result;
            
        } catch (error) {
            responseMetrics.responseTime = Date.now() - requestStart;
            responseMetrics.success = false;
            
            // Handle rate limit hits
            if (this.isRateLimitError(error)) {
                this.rateLimiter.recordRateLimitHit(this.extractRetryAfter(error));
                
                if (plan.useBurst) {
                    this.burstManager.endBurst('rate_limit_hit');
                }
            }
            
            throw error;
            
        } finally {
            // Record request metrics
            this.rateLimiter.recordRequest(responseMetrics);
            
            if (plan.useBurst) {
                this.burstManager.recordBurstRequest(responseMetrics.success, responseMetrics.responseTime);
            }
        }
    }

    /**
     * Record successful request for learning
     */
    async recordSuccess(requestId, responseTime, plan, context) {
        this.systemMetrics.totalRequests++;
        this.systemMetrics.optimizedRequests++;
        
        // Record with delay calculator
        this.delayCalculator.recordResponse(responseTime, true);
        
        // Record with analytics
        this.analytics.recordMetric({
            success: true,
            responseTime,
            isRateLimitHit: false,
            concurrency: plan.concurrencyLevel,
            delayUsed: plan.delayMs,
            burstMode: plan.useBurst
        });
        
        // End burst if active
        if (plan.useBurst && this.burstManager.isInBurst()) {
            this.burstManager.endBurst('completed');
        }
        
        console.log(`[${this.vendor}] Request ${requestId} succeeded in ${responseTime}ms (strategy: ${plan.strategy})`);
    }

    /**
     * Record failed request for learning
     */
    async recordFailure(requestId, error, responseTime, context) {
        this.systemMetrics.totalRequests++;
        
        // Record with delay calculator
        this.delayCalculator.recordResponse(responseTime, false, error);
        
        // Record with analytics
        this.analytics.recordMetric({
            success: false,
            responseTime,
            isRateLimitHit: this.isRateLimitError(error),
            errorType: this.classifyError(error),
            concurrency: context.concurrency || 1,
            delayUsed: context.delayUsed || 0
        });
        
        console.log(`[${this.vendor}] Request ${requestId} failed after ${responseTime}ms: ${error.message}`);
    }

    /**
     * Determine if burst mode should be used
     */
    shouldUseBurst(context) {
        // Don't use burst in retry mode
        if (context.isRetryMode) return false;
        
        // Don't use burst if circuit breaker is not fully closed
        if (this.errorRecovery.circuitState !== 'CLOSED') return false;
        
        // Use burst for batch processing with good performance
        const performance = this.analytics.getCurrentPerformance();
        return performance.successRate > 0.9 && performance.averageResponseTime < 2000;
    }

    /**
     * Start optimization loop
     */
    startOptimizationLoop() {
        setInterval(() => {
            this.optimizeSystem();
        }, this.config.optimizationIntervalMs);
    }

    /**
     * Optimize system based on current performance
     */
    optimizeSystem() {
        if (!this.config.coordinationEnabled) return;
        
        const now = Date.now();
        if (now - this.lastOptimization < this.config.optimizationIntervalMs) return;
        
        // Get analytics recommendations
        const dashboardData = this.analytics.getDashboardData();
        const recommendations = dashboardData.latestRecommendations;
        
        if (recommendations.length > 0) {
            this.applyOptimizations(recommendations);
        }
        
        // Coordinate components
        this.coordinateComponents();
        
        this.lastOptimization = now;
    }

    /**
     * Apply optimization recommendations
     */
    applyOptimizations(recommendations) {
        recommendations.forEach(rec => {
            if (rec.confidence < 0.7) return; // Only apply high-confidence recommendations
            
            console.log(`[${this.vendor}] Applying optimization: ${rec.recommendations[0]?.title}`);
            
            rec.recommendations.forEach(recommendation => {
                switch (recommendation.type) {
                    case 'rate_limit':
                        this.rateLimiter.increaseDelay(1.2);
                        break;
                    case 'response_time':
                        this.concurrentProcessor.currentConcurrency = Math.max(1, 
                            Math.floor(this.concurrentProcessor.currentConcurrency * 0.8));
                        break;
                    case 'throughput':
                        if (this.currentMode === 'adaptive') {
                            this.delayCalculator.currentBaseDelay *= 0.9;
                        }
                        break;
                }
            });
        });
    }

    /**
     * Coordinate components for optimal performance
     */
    coordinateComponents() {
        // Share performance data between components
        const rateLimiterStatus = this.rateLimiter.getStatus();
        const burstStatus = this.burstManager.getStatus();
        const delayStatus = this.delayCalculator.getStatus();
        
        // Adjust delay calculator based on rate limiter performance
        if (rateLimiterStatus.successRate < 0.9) {
            this.delayCalculator.adaptiveMultiplier *= 1.1;
        } else if (rateLimiterStatus.successRate > 0.95) {
            this.delayCalculator.adaptiveMultiplier *= 0.95;
        }
        
        // Adjust burst manager based on overall performance
        if (delayStatus.recentSuccessRate < 0.8) {
            this.burstManager.setConservativeMode(true);
        } else if (delayStatus.recentSuccessRate > 0.95) {
            this.burstManager.setConservativeMode(false);
        }
    }

    /**
     * Apply mode-specific configurations
     */
    applyModeConfiguration() {
        switch (this.currentMode) {
            case 'conservative':
                this.rateLimiter.config.safetyMargin = 0.6;
                this.delayCalculator.config.baseDelayMs = 3000;
                this.concurrentProcessor.config.maxConcurrency = 1;
                this.burstManager.setConservativeMode(true);
                break;
                
            case 'aggressive':
                this.rateLimiter.config.safetyMargin = 0.95;
                this.delayCalculator.config.baseDelayMs = 500;
                this.concurrentProcessor.config.maxConcurrency = 5;
                this.burstManager.setConservativeMode(false);
                break;
                
            case 'adaptive':
            default:
                // Use default configurations with adaptive learning
                break;
        }
    }

    /**
     * Extract rate limit headers from response
     */
    extractRateLimitHeaders(response) {
        if (!response || !response.headers) return {};
        
        const headers = {};
        const rateLimitHeaderNames = [
            'x-ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-reset',
            'x-rate-limit-remaining', 'x-rate-limit-limit', 'x-rate-limit-reset',
            'ratelimit-remaining', 'ratelimit-limit', 'ratelimit-reset'
        ];
        
        rateLimitHeaderNames.forEach(name => {
            if (response.headers[name]) {
                headers[name] = response.headers[name];
            }
        });
        
        return headers;
    }

    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        if (!error || !error.message) return false;
        
        const rateLimitPatterns = [
            'rate_limit_exceeded', '429', 'too many requests', 'rate limit'
        ];
        
        return rateLimitPatterns.some(pattern =>
            error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Extract retry-after value from error
     */
    extractRetryAfter(error) {
        if (error.retryAfter) return parseInt(error.retryAfter);
        
        const match = error.message.match(/retry.*?(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Classify error type
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('rate_limit') || message.includes('429')) return 'rate_limit';
        if (message.includes('timeout')) return 'timeout';
        if (message.includes('network')) return 'network';
        if (message.includes('500') || message.includes('502') || 
            message.includes('503') || message.includes('504')) return 'server_error';
        
        return 'unknown';
    }

    /**
     * Get comprehensive system status
     */
    getSystemStatus() {
        return {
            vendor: this.vendor,
            isInitialized: this.isInitialized,
            currentMode: this.currentMode,
            systemMetrics: { ...this.systemMetrics },
            
            // Component statuses
            rateLimiter: this.rateLimiter.getStatus(),
            burstManager: this.burstManager.getStatus(),
            delayCalculator: this.delayCalculator.getStatus(),
            concurrentProcessor: this.concurrentProcessor.getStatus(),
            analytics: this.analytics.getDashboardData(),
            errorRecovery: this.errorRecovery.getStatus(),
            
            // System coordination
            lastOptimization: this.lastOptimization,
            config: { ...this.config }
        };
    }

    /**
     * Change system mode
     */
    setMode(mode) {
        if (['conservative', 'adaptive', 'aggressive'].includes(mode)) {
            this.currentMode = mode;
            this.applyModeConfiguration();
            console.log(`[${this.vendor}] Switched to ${mode} mode`);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset entire system
     */
    reset() {
        this.rateLimiter.resetCircuitBreaker();
        this.burstManager.resetDetection();
        this.delayCalculator.reset();
        this.concurrentProcessor.reset();
        this.analytics.reset();
        this.errorRecovery.reset();
        
        this.systemMetrics = {
            totalRequests: 0,
            optimizedRequests: 0,
            rateLimitHitsPrevented: 0,
            averageOptimizationGain: 0
        };
        
        console.log(`[${this.vendor}] Intelligent Rate Limiting System reset`);
    }
}

export default IntelligentRateLimitingSystem;
