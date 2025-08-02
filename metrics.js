/*
 * Copyright 2025 Rodrigo Quintian (cafasdon)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Application Metrics Tracking for WarrantyDog
 * 
 * Tracks and exposes operational metrics including:
 * - Request counts and response times
 * - API endpoint usage statistics
 * - Vendor API call metrics
 * - System resource usage
 * - Error rates and patterns
 */

class MetricsCollector {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            requests: {
                total: 0,
                byMethod: {},
                byEndpoint: {},
                byStatusCode: {}
            },
            responseTimes: {
                total: 0,
                count: 0,
                min: Infinity,
                max: 0,
                buckets: {
                    '0-100ms': 0,
                    '100-500ms': 0,
                    '500ms-1s': 0,
                    '1s-5s': 0,
                    '5s+': 0
                }
            },
            vendorApis: {
                dell: {
                    calls: 0,
                    errors: 0,
                    totalResponseTime: 0,
                    rateLimits: 0
                },
                lenovo: {
                    calls: 0,
                    errors: 0,
                    totalResponseTime: 0,
                    rateLimits: 0
                }
            },
            database: {
                queries: 0,
                errors: 0,
                totalQueryTime: 0
            },
            sessions: {
                created: 0,
                completed: 0,
                active: 0
            },
            errors: {
                total: 0,
                byType: {},
                byEndpoint: {}
            },
            rateLimiting: {
                blocked: 0,
                byIp: {}
            }
        };
    }

    /**
     * Record an HTTP request
     */
    recordRequest(method, endpoint, statusCode, responseTime, ip) {
        this.metrics.requests.total++;
        
        // By method
        this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
        
        // By endpoint (normalize to remove parameters)
        const normalizedEndpoint = this.normalizeEndpoint(endpoint);
        this.metrics.requests.byEndpoint[normalizedEndpoint] = (this.metrics.requests.byEndpoint[normalizedEndpoint] || 0) + 1;
        
        // By status code
        this.metrics.requests.byStatusCode[statusCode] = (this.metrics.requests.byStatusCode[statusCode] || 0) + 1;
        
        // Response time tracking
        if (responseTime !== undefined) {
            this.recordResponseTime(responseTime);
        }

        // Error tracking
        if (statusCode >= 400) {
            this.recordError(statusCode, normalizedEndpoint);
        }
    }

    /**
     * Record response time metrics
     */
    recordResponseTime(responseTime) {
        this.metrics.responseTimes.total += responseTime;
        this.metrics.responseTimes.count++;
        this.metrics.responseTimes.min = Math.min(this.metrics.responseTimes.min, responseTime);
        this.metrics.responseTimes.max = Math.max(this.metrics.responseTimes.max, responseTime);

        // Response time buckets
        if (responseTime < 100) {
            this.metrics.responseTimes.buckets['0-100ms']++;
        } else if (responseTime < 500) {
            this.metrics.responseTimes.buckets['100-500ms']++;
        } else if (responseTime < 1000) {
            this.metrics.responseTimes.buckets['500ms-1s']++;
        } else if (responseTime < 5000) {
            this.metrics.responseTimes.buckets['1s-5s']++;
        } else {
            this.metrics.responseTimes.buckets['5s+']++;
        }
    }

    /**
     * Record vendor API call
     */
    recordVendorApiCall(vendor, responseTime, isError = false, isRateLimit = false) {
        const vendorMetrics = this.metrics.vendorApis[vendor.toLowerCase()];
        if (vendorMetrics) {
            vendorMetrics.calls++;
            if (responseTime) {
                vendorMetrics.totalResponseTime += responseTime;
            }
            if (isError) {
                vendorMetrics.errors++;
            }
            if (isRateLimit) {
                vendorMetrics.rateLimits++;
            }
        }
    }

    /**
     * Record database operation
     */
    recordDatabaseOperation(queryTime, isError = false) {
        this.metrics.database.queries++;
        if (queryTime) {
            this.metrics.database.totalQueryTime += queryTime;
        }
        if (isError) {
            this.metrics.database.errors++;
        }
    }

    /**
     * Record session activity
     */
    recordSessionCreated() {
        this.metrics.sessions.created++;
        this.metrics.sessions.active++;
    }

    recordSessionCompleted() {
        this.metrics.sessions.completed++;
        this.metrics.sessions.active = Math.max(0, this.metrics.sessions.active - 1);
    }

    /**
     * Record rate limiting event
     */
    recordRateLimitBlocked(ip) {
        this.metrics.rateLimiting.blocked++;
        this.metrics.rateLimiting.byIp[ip] = (this.metrics.rateLimiting.byIp[ip] || 0) + 1;
    }

    /**
     * Record error
     */
    recordError(statusCode, endpoint) {
        this.metrics.errors.total++;
        
        const errorType = this.getErrorType(statusCode);
        this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
        this.metrics.errors.byEndpoint[endpoint] = (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;
    }

    /**
     * Normalize endpoint for metrics (remove parameters)
     */
    normalizeEndpoint(endpoint) {
        return endpoint
            .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')  // UUIDs
            .replace(/\/\d+/g, '/:id')               // Numeric IDs
            .replace(/\/[A-Z0-9]{7,}/g, '/:serial') // Service tags
            .replace(/\?.*$/, '');                   // Query parameters
    }

    /**
     * Get error type from status code
     */
    getErrorType(statusCode) {
        if (statusCode >= 400 && statusCode < 500) {
            return 'client_error';
        } else if (statusCode >= 500) {
            return 'server_error';
        }
        return 'unknown_error';
    }

    /**
     * Get current metrics snapshot
     */
    getMetrics() {
        const now = Date.now();
        const uptime = now - this.startTime;
        const memoryUsage = process.memoryUsage();

        return {
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: Math.floor(uptime / 1000),
                human: this.formatUptime(uptime)
            },
            requests: {
                ...this.metrics.requests,
                rate: this.calculateRate(this.metrics.requests.total, uptime)
            },
            responseTimes: {
                ...this.metrics.responseTimes,
                average: this.metrics.responseTimes.count > 0 
                    ? Math.round(this.metrics.responseTimes.total / this.metrics.responseTimes.count)
                    : 0,
                min: this.metrics.responseTimes.min === Infinity ? 0 : this.metrics.responseTimes.min
            },
            vendorApis: {
                dell: {
                    ...this.metrics.vendorApis.dell,
                    averageResponseTime: this.metrics.vendorApis.dell.calls > 0
                        ? Math.round(this.metrics.vendorApis.dell.totalResponseTime / this.metrics.vendorApis.dell.calls)
                        : 0,
                    errorRate: this.metrics.vendorApis.dell.calls > 0
                        ? Math.round((this.metrics.vendorApis.dell.errors / this.metrics.vendorApis.dell.calls) * 100)
                        : 0
                },
                lenovo: {
                    ...this.metrics.vendorApis.lenovo,
                    averageResponseTime: this.metrics.vendorApis.lenovo.calls > 0
                        ? Math.round(this.metrics.vendorApis.lenovo.totalResponseTime / this.metrics.vendorApis.lenovo.calls)
                        : 0,
                    errorRate: this.metrics.vendorApis.lenovo.calls > 0
                        ? Math.round((this.metrics.vendorApis.lenovo.errors / this.metrics.vendorApis.lenovo.calls) * 100)
                        : 0
                }
            },
            database: {
                ...this.metrics.database,
                averageQueryTime: this.metrics.database.queries > 0
                    ? Math.round(this.metrics.database.totalQueryTime / this.metrics.database.queries)
                    : 0,
                errorRate: this.metrics.database.queries > 0
                    ? Math.round((this.metrics.database.errors / this.metrics.database.queries) * 100)
                    : 0
            },
            sessions: this.metrics.sessions,
            errors: {
                ...this.metrics.errors,
                rate: this.calculateRate(this.metrics.errors.total, uptime)
            },
            rateLimiting: this.metrics.rateLimiting,
            system: {
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                    external: Math.round(memoryUsage.external / 1024 / 1024) // MB
                },
                cpu: {
                    usage: process.cpuUsage()
                },
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
    }

    /**
     * Calculate rate per minute
     */
    calculateRate(count, uptimeMs) {
        const minutes = uptimeMs / (1000 * 60);
        return minutes > 0 ? Math.round((count / minutes) * 100) / 100 : 0;
    }

    /**
     * Format uptime in human readable format
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Reset metrics (useful for testing)
     */
    reset() {
        this.startTime = Date.now();
        this.metrics = {
            requests: { total: 0, byMethod: {}, byEndpoint: {}, byStatusCode: {} },
            responseTimes: { total: 0, count: 0, min: Infinity, max: 0, buckets: { '0-100ms': 0, '100-500ms': 0, '500ms-1s': 0, '1s-5s': 0, '5s+': 0 } },
            vendorApis: { dell: { calls: 0, errors: 0, totalResponseTime: 0, rateLimits: 0 }, lenovo: { calls: 0, errors: 0, totalResponseTime: 0, rateLimits: 0 } },
            database: { queries: 0, errors: 0, totalQueryTime: 0 },
            sessions: { created: 0, completed: 0, active: 0 },
            errors: { total: 0, byType: {}, byEndpoint: {} },
            rateLimiting: { blocked: 0, byIp: {} }
        };
    }
}

// Export singleton instance
export default new MetricsCollector();
