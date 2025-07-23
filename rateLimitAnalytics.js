/**
 * Rate Limit Analytics for WarrantyDog
 * Comprehensive monitoring and optimization dashboard for API rate limiting
 */

/**
 * Analytics engine for rate limit monitoring and optimization
 */
class RateLimitAnalytics {
    constructor(vendor, config = {}) {
        this.vendor = vendor;
        this.config = {
            // Analytics settings
            metricsRetentionMs: config.metricsRetentionMs || 86400000,    // 24 hours
            aggregationIntervalMs: config.aggregationIntervalMs || 60000, // 1 minute
            alertThresholds: {
                rateLimitHitRate: config.rateLimitHitRate || 0.05,        // 5% rate limit hits
                averageResponseTime: config.averageResponseTime || 3000,   // 3 seconds
                successRate: config.successRate || 0.9,                   // 90% success rate
                throughputDrop: config.throughputDrop || 0.3              // 30% throughput drop
            },
            
            // Optimization settings
            optimizationIntervalMs: config.optimizationIntervalMs || 300000, // 5 minutes
            learningWindowMs: config.learningWindowMs || 1800000,            // 30 minutes
            confidenceThreshold: config.confidenceThreshold || 0.8           // 80% confidence
        };

        // Metrics storage
        this.rawMetrics = [];
        this.aggregatedMetrics = [];
        this.alerts = [];
        this.optimizationRecommendations = [];
        
        // Real-time tracking
        this.currentWindow = {
            startTime: Date.now(),
            requests: 0,
            successes: 0,
            failures: 0,
            rateLimitHits: 0,
            totalResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0
        };
        
        // Optimization state
        this.lastOptimization = Date.now();
        this.optimizationHistory = [];
        
        // Start aggregation timer
        this.startAggregation();
    }

    /**
     * Record a single API request metric
     */
    recordMetric(metric) {
        const timestamp = Date.now();
        
        const enrichedMetric = {
            timestamp,
            vendor: this.vendor,
            success: metric.success,
            responseTime: metric.responseTime || 0,
            isRateLimitHit: metric.isRateLimitHit || false,
            errorType: metric.errorType || null,
            concurrency: metric.concurrency || 1,
            delayUsed: metric.delayUsed || 0,
            burstMode: metric.burstMode || false,
            retryAttempt: metric.retryAttempt || 0
        };
        
        // Add to raw metrics
        this.rawMetrics.push(enrichedMetric);
        
        // Update current window
        this.updateCurrentWindow(enrichedMetric);
        
        // Clean old metrics
        this.cleanOldMetrics();
        
        // Check for alerts
        this.checkAlerts(enrichedMetric);
    }

    /**
     * Update current aggregation window
     */
    updateCurrentWindow(metric) {
        this.currentWindow.requests++;
        
        if (metric.success) {
            this.currentWindow.successes++;
        } else {
            this.currentWindow.failures++;
        }
        
        if (metric.isRateLimitHit) {
            this.currentWindow.rateLimitHits++;
        }
        
        this.currentWindow.totalResponseTime += metric.responseTime;
        this.currentWindow.minResponseTime = Math.min(this.currentWindow.minResponseTime, metric.responseTime);
        this.currentWindow.maxResponseTime = Math.max(this.currentWindow.maxResponseTime, metric.responseTime);
    }

    /**
     * Start metrics aggregation timer
     */
    startAggregation() {
        setInterval(() => {
            this.aggregateCurrentWindow();
        }, this.config.aggregationIntervalMs);
        
        // Also start optimization timer
        setInterval(() => {
            this.generateOptimizationRecommendations();
        }, this.config.optimizationIntervalMs);
    }

    /**
     * Aggregate current window into historical metrics
     */
    aggregateCurrentWindow() {
        if (this.currentWindow.requests === 0) return;
        
        const aggregated = {
            timestamp: this.currentWindow.startTime,
            duration: Date.now() - this.currentWindow.startTime,
            totalRequests: this.currentWindow.requests,
            successfulRequests: this.currentWindow.successes,
            failedRequests: this.currentWindow.failures,
            rateLimitHits: this.currentWindow.rateLimitHits,
            
            // Calculated metrics
            successRate: this.currentWindow.successes / this.currentWindow.requests,
            rateLimitHitRate: this.currentWindow.rateLimitHits / this.currentWindow.requests,
            averageResponseTime: this.currentWindow.totalResponseTime / this.currentWindow.requests,
            minResponseTime: this.currentWindow.minResponseTime === Infinity ? 0 : this.currentWindow.minResponseTime,
            maxResponseTime: this.currentWindow.maxResponseTime,
            throughput: this.currentWindow.requests / (this.config.aggregationIntervalMs / 1000)
        };
        
        this.aggregatedMetrics.push(aggregated);
        
        // Reset current window
        this.currentWindow = {
            startTime: Date.now(),
            requests: 0,
            successes: 0,
            failures: 0,
            rateLimitHits: 0,
            totalResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0
        };
        
        console.log(`[${this.vendor}] Aggregated metrics: ${aggregated.totalRequests} requests, ${(aggregated.successRate * 100).toFixed(1)}% success, ${aggregated.averageResponseTime.toFixed(0)}ms avg response`);
    }

    /**
     * Generate optimization recommendations
     */
    generateOptimizationRecommendations() {
        const now = Date.now();
        if (now - this.lastOptimization < this.config.optimizationIntervalMs) {
            return;
        }

        const recentMetrics = this.getRecentMetrics(this.config.learningWindowMs);
        if (recentMetrics.length === 0) return;

        const analysis = this.analyzePerformance(recentMetrics);
        const recommendations = this.generateRecommendations(analysis);
        
        if (recommendations.length > 0) {
            this.optimizationRecommendations.push({
                timestamp: now,
                analysis,
                recommendations,
                confidence: analysis.confidence
            });
            
            console.log(`[${this.vendor}] Generated ${recommendations.length} optimization recommendations`);
        }

        this.lastOptimization = now;
    }

    /**
     * Analyze performance from recent metrics
     */
    analyzePerformance(metrics) {
        const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
        const totalSuccesses = metrics.reduce((sum, m) => sum + m.successfulRequests, 0);
        const totalRateLimitHits = metrics.reduce((sum, m) => sum + m.rateLimitHits, 0);
        const avgResponseTime = metrics.reduce((sum, m) => sum + m.averageResponseTime * m.totalRequests, 0) / totalRequests;
        const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
        
        const analysis = {
            timeWindow: this.config.learningWindowMs,
            totalRequests,
            overallSuccessRate: totalRequests > 0 ? totalSuccesses / totalRequests : 1,
            overallRateLimitHitRate: totalRequests > 0 ? totalRateLimitHits / totalRequests : 0,
            averageResponseTime: avgResponseTime || 0,
            averageThroughput: avgThroughput,
            confidence: Math.min(1.0, totalRequests / 100), // Higher confidence with more data
            
            // Trend analysis
            trends: this.analyzeTrends(metrics),
            
            // Performance classification
            performanceClass: this.classifyPerformance(totalSuccesses / totalRequests, avgResponseTime, totalRateLimitHits / totalRequests)
        };
        
        return analysis;
    }

    /**
     * Analyze trends in metrics
     */
    analyzeTrends(metrics) {
        if (metrics.length < 3) return {};
        
        const recent = metrics.slice(-Math.floor(metrics.length / 3));
        const older = metrics.slice(0, Math.floor(metrics.length / 3));
        
        const recentAvgSuccess = recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
        const olderAvgSuccess = older.reduce((sum, m) => sum + m.successRate, 0) / older.length;
        
        const recentAvgResponse = recent.reduce((sum, m) => sum + m.averageResponseTime, 0) / recent.length;
        const olderAvgResponse = older.reduce((sum, m) => sum + m.averageResponseTime, 0) / older.length;
        
        const recentAvgThroughput = recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length;
        const olderAvgThroughput = older.reduce((sum, m) => sum + m.throughput, 0) / older.length;
        
        return {
            successRateTrend: recentAvgSuccess - olderAvgSuccess,
            responseTimeTrend: recentAvgResponse - olderAvgResponse,
            throughputTrend: recentAvgThroughput - olderAvgThroughput
        };
    }

    /**
     * Classify overall performance
     */
    classifyPerformance(successRate, avgResponseTime, rateLimitHitRate) {
        if (successRate > 0.95 && avgResponseTime < 1500 && rateLimitHitRate < 0.01) {
            return 'excellent';
        } else if (successRate > 0.9 && avgResponseTime < 2500 && rateLimitHitRate < 0.05) {
            return 'good';
        } else if (successRate > 0.8 && avgResponseTime < 4000 && rateLimitHitRate < 0.1) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    /**
     * Generate specific recommendations based on analysis
     */
    generateRecommendations(analysis) {
        const recommendations = [];
        
        // Rate limit recommendations
        if (analysis.overallRateLimitHitRate > this.config.alertThresholds.rateLimitHitRate) {
            recommendations.push({
                type: 'rate_limit',
                priority: 'high',
                title: 'Reduce Rate Limit Hits',
                description: `Rate limit hit rate is ${(analysis.overallRateLimitHitRate * 100).toFixed(1)}%, which is above the ${(this.config.alertThresholds.rateLimitHitRate * 100).toFixed(1)}% threshold`,
                actions: [
                    'Increase delays between requests',
                    'Reduce concurrent request count',
                    'Implement more conservative burst handling'
                ]
            });
        }
        
        // Response time recommendations
        if (analysis.averageResponseTime > this.config.alertThresholds.averageResponseTime) {
            recommendations.push({
                type: 'response_time',
                priority: 'medium',
                title: 'Improve Response Times',
                description: `Average response time is ${analysis.averageResponseTime.toFixed(0)}ms, which is above the ${this.config.alertThresholds.averageResponseTime}ms threshold`,
                actions: [
                    'Reduce concurrent requests during peak times',
                    'Implement circuit breaker for failing endpoints',
                    'Add request timeout handling'
                ]
            });
        }
        
        // Success rate recommendations
        if (analysis.overallSuccessRate < this.config.alertThresholds.successRate) {
            recommendations.push({
                type: 'success_rate',
                priority: 'high',
                title: 'Improve Success Rate',
                description: `Success rate is ${(analysis.overallSuccessRate * 100).toFixed(1)}%, which is below the ${(this.config.alertThresholds.successRate * 100).toFixed(1)}% threshold`,
                actions: [
                    'Implement better retry logic',
                    'Add error classification and handling',
                    'Increase delays for error recovery'
                ]
            });
        }
        
        // Throughput optimization
        if (analysis.performanceClass === 'excellent' && analysis.trends.throughputTrend >= 0) {
            recommendations.push({
                type: 'throughput',
                priority: 'low',
                title: 'Optimize Throughput',
                description: 'Performance is excellent, consider optimizing for higher throughput',
                actions: [
                    'Gradually increase concurrency',
                    'Reduce delays between requests',
                    'Enable more aggressive burst mode'
                ]
            });
        }
        
        return recommendations;
    }

    /**
     * Check for real-time alerts
     */
    checkAlerts(metric) {
        const recentMetrics = this.getRecentMetrics(300000); // Last 5 minutes
        if (recentMetrics.length === 0) return;
        
        const latest = recentMetrics[recentMetrics.length - 1];
        
        // Rate limit alert
        if (latest.rateLimitHitRate > this.config.alertThresholds.rateLimitHitRate) {
            this.addAlert('rate_limit_high', 'warning', 
                `Rate limit hit rate is ${(latest.rateLimitHitRate * 100).toFixed(1)}%`);
        }
        
        // Response time alert
        if (latest.averageResponseTime > this.config.alertThresholds.averageResponseTime) {
            this.addAlert('response_time_high', 'warning',
                `Average response time is ${latest.averageResponseTime.toFixed(0)}ms`);
        }
        
        // Success rate alert
        if (latest.successRate < this.config.alertThresholds.successRate) {
            this.addAlert('success_rate_low', 'error',
                `Success rate dropped to ${(latest.successRate * 100).toFixed(1)}%`);
        }
    }

    /**
     * Add an alert
     */
    addAlert(type, severity, message) {
        const alert = {
            timestamp: Date.now(),
            type,
            severity,
            message,
            vendor: this.vendor
        };
        
        this.alerts.push(alert);
        
        // Keep only recent alerts
        const oneHourAgo = Date.now() - 3600000;
        this.alerts = this.alerts.filter(a => a.timestamp > oneHourAgo);
        
        console.log(`[${this.vendor}] ALERT [${severity.toUpperCase()}]: ${message}`);
    }

    /**
     * Get recent metrics within time window
     */
    getRecentMetrics(timeWindowMs) {
        const cutoff = Date.now() - timeWindowMs;
        return this.aggregatedMetrics.filter(m => m.timestamp > cutoff);
    }

    /**
     * Clean old metrics to prevent memory bloat
     */
    cleanOldMetrics() {
        const cutoff = Date.now() - this.config.metricsRetentionMs;
        
        this.rawMetrics = this.rawMetrics.filter(m => m.timestamp > cutoff);
        this.aggregatedMetrics = this.aggregatedMetrics.filter(m => m.timestamp > cutoff);
        
        // Clean old optimization recommendations
        this.optimizationRecommendations = this.optimizationRecommendations.filter(
            r => r.timestamp > cutoff
        );
    }

    /**
     * Get comprehensive analytics dashboard data
     */
    getDashboardData() {
        const recentMetrics = this.getRecentMetrics(3600000); // Last hour
        const currentAnalysis = recentMetrics.length > 0 ? this.analyzePerformance(recentMetrics) : null;
        
        return {
            vendor: this.vendor,
            timestamp: Date.now(),
            
            // Current status
            currentWindow: { ...this.currentWindow },
            
            // Recent performance
            recentMetrics: recentMetrics.slice(-12), // Last 12 aggregation windows
            currentAnalysis,
            
            // Alerts and recommendations
            activeAlerts: this.alerts.slice(-10),
            latestRecommendations: this.optimizationRecommendations.slice(-5),
            
            // Summary statistics
            summary: this.generateSummaryStats(recentMetrics),
            
            // Configuration
            config: { ...this.config }
        };
    }

    /**
     * Generate summary statistics
     */
    generateSummaryStats(metrics) {
        if (metrics.length === 0) return {};
        
        const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
        const totalSuccesses = metrics.reduce((sum, m) => sum + m.successfulRequests, 0);
        const totalRateLimitHits = metrics.reduce((sum, m) => sum + m.rateLimitHits, 0);
        
        return {
            totalRequests,
            overallSuccessRate: totalRequests > 0 ? totalSuccesses / totalRequests : 1,
            overallRateLimitHitRate: totalRequests > 0 ? totalRateLimitHits / totalRequests : 0,
            averageThroughput: metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length,
            peakThroughput: Math.max(...metrics.map(m => m.throughput)),
            alertCount: this.alerts.length,
            recommendationCount: this.optimizationRecommendations.length
        };
    }

    /**
     * Export analytics data for external analysis
     */
    exportData(format = 'json') {
        const data = {
            vendor: this.vendor,
            exportTimestamp: Date.now(),
            rawMetrics: this.rawMetrics,
            aggregatedMetrics: this.aggregatedMetrics,
            alerts: this.alerts,
            optimizationRecommendations: this.optimizationRecommendations,
            config: this.config
        };
        
        if (format === 'csv') {
            return this.convertToCSV(data.aggregatedMetrics);
        }
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Convert metrics to CSV format
     */
    convertToCSV(metrics) {
        if (metrics.length === 0) return '';
        
        const headers = Object.keys(metrics[0]).join(',');
        const rows = metrics.map(m => Object.values(m).join(','));
        
        return [headers, ...rows].join('\n');
    }

    /**
     * Reset analytics data
     */
    reset() {
        this.rawMetrics = [];
        this.aggregatedMetrics = [];
        this.alerts = [];
        this.optimizationRecommendations = [];
        this.currentWindow = {
            startTime: Date.now(),
            requests: 0,
            successes: 0,
            failures: 0,
            rateLimitHits: 0,
            totalResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0
        };
        
        console.log(`[${this.vendor}] Analytics data reset`);
    }
}

export default RateLimitAnalytics;
