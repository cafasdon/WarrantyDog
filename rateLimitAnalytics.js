/**
 * Rate Limit Analytics for WarrantyDog
 * Comprehensive analytics and monitoring for rate limiting performance
 */

class RateLimitAnalytics {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            maxHistorySize: config.maxHistorySize || 1000,
            analysisWindowMs: config.analysisWindowMs || 300000, // 5 minutes
            recommendationThreshold: config.recommendationThreshold || 0.7
        };

        // Metrics storage
        this.metrics = [];
        this.recommendations = [];
        this.lastAnalysis = null;
    }

    /**
     * Record a metric event
     */
    recordMetric(metric) {
        const timestamp = Date.now();
        
        this.metrics.push({
            timestamp: timestamp,
            success: metric.success,
            responseTime: metric.responseTime,
            isRateLimitHit: metric.isRateLimitHit || false,
            errorType: metric.errorType || null,
            concurrency: metric.concurrency || 1,
            delayUsed: metric.delayUsed || 0,
            burstMode: metric.burstMode || false
        });

        // Keep metrics within size limit
        if (this.metrics.length > this.config.maxHistorySize) {
            this.metrics = this.metrics.slice(-this.config.maxHistorySize);
        }
    }

    /**
     * Get comprehensive dashboard data
     */
    getDashboardData() {
        const now = Date.now();
        const recentMetrics = this.getRecentMetrics(this.config.analysisWindowMs);
        
        if (recentMetrics.length === 0) {
            return this.getEmptyDashboard();
        }

        const analysis = this.analyzeMetrics(recentMetrics);
        const recommendations = this.generateRecommendations(analysis);

        return {
            vendor: this.vendor,
            timestamp: now,
            analysisWindow: this.config.analysisWindowMs,
            
            // Current analysis
            currentAnalysis: analysis,
            
            // Recommendations
            latestRecommendations: recommendations,
            
            // Historical data
            totalMetrics: this.metrics.length,
            oldestMetric: this.metrics.length > 0 ? this.metrics[0].timestamp : null,
            
            // Raw data (limited)
            recentMetrics: recentMetrics.slice(-20) // Last 20 for debugging
        };
    }

    /**
     * Analyze metrics for patterns and performance
     */
    analyzeMetrics(metrics) {
        const totalRequests = metrics.length;
        const successfulRequests = metrics.filter(m => m.success).length;
        const rateLimitHits = metrics.filter(m => m.isRateLimitHit).length;
        
        const responseTimes = metrics.map(m => m.responseTime);
        const averageResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
        
        const delays = metrics.map(m => m.delayUsed);
        const averageDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;

        return {
            totalRequests: totalRequests,
            successfulRequests: successfulRequests,
            failedRequests: totalRequests - successfulRequests,
            overallSuccessRate: successfulRequests / totalRequests,
            
            // Rate limiting
            rateLimitHits: rateLimitHits,
            rateLimitHitRate: rateLimitHits / totalRequests,
            
            // Performance
            averageResponseTime: averageResponseTime,
            minResponseTime: Math.min(...responseTimes),
            maxResponseTime: Math.max(...responseTimes),
            
            // Efficiency
            averageDelay: averageDelay,
            totalProcessingTime: responseTimes.reduce((sum, rt) => sum + rt, 0),
            totalDelayTime: delays.reduce((sum, d) => sum + d, 0),
            
            // Patterns
            burstModeUsage: metrics.filter(m => m.burstMode).length / totalRequests,
            errorPatterns: this.analyzeErrorPatterns(metrics)
        };
    }

    /**
     * Analyze error patterns
     */
    analyzeErrorPatterns(metrics) {
        const errors = metrics.filter(m => !m.success);
        const errorTypes = {};
        
        errors.forEach(error => {
            const type = error.errorType || 'unknown';
            errorTypes[type] = (errorTypes[type] || 0) + 1;
        });

        return {
            totalErrors: errors.length,
            errorTypes: errorTypes,
            mostCommonError: Object.keys(errorTypes).reduce((a, b) => 
                errorTypes[a] > errorTypes[b] ? a : b, 'none')
        };
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        // Rate limit recommendations
        if (analysis.rateLimitHitRate > 0.1) {
            recommendations.push({
                type: 'rate_limit',
                severity: 'high',
                confidence: 0.9,
                title: 'High Rate Limit Hit Rate',
                description: `${(analysis.rateLimitHitRate * 100).toFixed(1)}% of requests are hitting rate limits`,
                recommendations: [
                    { action: 'increase_delay', title: 'Increase delays between requests' },
                    { action: 'reduce_concurrency', title: 'Reduce concurrent processing' }
                ]
            });
        }

        // Performance recommendations
        if (analysis.averageResponseTime > 5000) {
            recommendations.push({
                type: 'response_time',
                severity: 'medium',
                confidence: 0.8,
                title: 'Slow Response Times',
                description: `Average response time is ${analysis.averageResponseTime.toFixed(0)}ms`,
                recommendations: [
                    { action: 'reduce_concurrency', title: 'Reduce concurrent requests' },
                    { action: 'increase_delay', title: 'Add more delay between requests' }
                ]
            });
        }

        // Efficiency recommendations
        if (analysis.overallSuccessRate > 0.95 && analysis.averageResponseTime < 2000) {
            recommendations.push({
                type: 'throughput',
                severity: 'low',
                confidence: 0.7,
                title: 'Optimization Opportunity',
                description: 'System is performing well, consider optimizing for higher throughput',
                recommendations: [
                    { action: 'decrease_delay', title: 'Reduce delays slightly' },
                    { action: 'increase_concurrency', title: 'Consider increasing concurrency' }
                ]
            });
        }

        return recommendations;
    }

    /**
     * Get recent metrics within time window
     */
    getRecentMetrics(windowMs) {
        const cutoff = Date.now() - windowMs;
        return this.metrics.filter(m => m.timestamp > cutoff);
    }

    /**
     * Get empty dashboard for when no data is available
     */
    getEmptyDashboard() {
        return {
            vendor: this.vendor,
            timestamp: Date.now(),
            analysisWindow: this.config.analysisWindowMs,
            currentAnalysis: null,
            latestRecommendations: [],
            totalMetrics: 0,
            oldestMetric: null,
            recentMetrics: []
        };
    }

    /**
     * Reset analytics
     */
    reset() {
        this.metrics = [];
        this.recommendations = [];
        this.lastAnalysis = null;
        
        console.log(`[${this.vendor}] Analytics reset`);
    }
}

export default RateLimitAnalytics;
