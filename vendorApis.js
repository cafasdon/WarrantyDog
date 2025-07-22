/**
 * WarrantyDog Vendor API Implementations
 *
 * This module provides warranty lookup functionality for various hardware vendors.
 * Currently supports Dell with plans for Lenovo and HP integration.
 *
 * Features:
 * - Rate limiting to respect API quotas
 * - Error handling and retry logic
 * - API key management via localStorage
 * - Standardized response format across vendors
 */

// Rate limiting configuration
const RATE_LIMITS = {
    dell: {
        requestsPerMinute: 60,
        requestsPerHour: 1000
    },
    lenovo: {
        requestsPerMinute: 30,
        requestsPerHour: 500
    },
    hp: {
        requestsPerMinute: 40,
        requestsPerHour: 800
    }
};

// Rate limiter class to manage API call frequency
class RateLimiter {
    constructor(vendor) {
        this.vendor = vendor;
        this.requests = [];
        this.config = RATE_LIMITS[vendor] || { requestsPerMinute: 30, requestsPerHour: 500 };
    }

    canMakeRequest() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const oneHourAgo = now - 3600000;

        // Clean old requests
        this.requests = this.requests.filter(time => time > oneHourAgo);

        const recentRequests = this.requests.filter(time => time > oneMinuteAgo);

        return recentRequests.length < this.config.requestsPerMinute &&
               this.requests.length < this.config.requestsPerHour;
    }

    recordRequest() {
        this.requests.push(Date.now());
    }

    getWaitTime() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentRequests = this.requests.filter(time => time > oneMinuteAgo);

        if (recentRequests.length >= this.config.requestsPerMinute) {
            const oldestRecent = Math.min(...recentRequests);
            return Math.max(0, 60000 - (now - oldestRecent));
        }
        return 0;
    }
}

// Initialize rate limiters for each vendor
const rateLimiters = {
    dell: new RateLimiter('dell'),
    lenovo: new RateLimiter('lenovo'),
    hp: new RateLimiter('hp')
};

/**
 * Dell API Implementation
 * Uses Dell's official warranty API to lookup device warranty information
 */
class DellAPI {
    constructor() {
        this.baseUrl = 'https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5';
        this.rateLimiter = rateLimiters.dell;
    }

    /**
     * Get API key from localStorage
     */
    getApiKey() {
        const key = localStorage.getItem('dell_api_key');
        if (!key) {
            throw new Error('Dell API key not configured. Please set your API key in the configuration modal.');
        }
        return key;
    }

    /**
     * Lookup warranty information for a Dell service tag
     * @param {string} serviceTag - Dell service tag
     * @returns {Promise<Object>} Warranty information
     */
    async lookupWarranty(serviceTag) {
        if (!this.rateLimiter.canMakeRequest()) {
            const waitTime = this.rateLimiter.getWaitTime();
            throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }

        try {
            const apiKey = this.getApiKey();

            // Use backend proxy to avoid CORS issues
            const proxyUrl = `/api/dell/warranty/${serviceTag}`;

            console.log('Dell API Request via proxy:', proxyUrl);
            console.log('API Key length:', apiKey.length);

            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'X-Dell-Api-Key': apiKey,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            this.rateLimiter.recordRequest();

            console.log('Dell API Response Status:', response.status);
            console.log('Dell API Response Headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorMessage = await this.handleErrorResponse(response);
                console.error('Dell API Error Response:', errorMessage);
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Dell API Response Data:', data);
            return this.parseWarrantyResponse(data, serviceTag);

        } catch (error) {
            console.error('Dell API Error:', error);

            // Handle CORS errors specifically
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                throw new Error('Dell API blocked by CORS policy. This is a browser limitation. Consider using a proxy server or backend service for production use.');
            }

            throw error;
        }
    }



    /**
     * Handle API error responses
     */
    async handleErrorResponse(response) {
        const status = response.status;
        let errorMessage = `Dell API Error (${status})`;

        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
            // If we can't parse error JSON, use status text
            errorMessage = response.statusText || errorMessage;
        }

        switch (status) {
            case 401:
                return 'Invalid Dell API key. Please check your API key configuration.';
            case 404:
                return 'Service tag not found in Dell database.';
            case 429:
                return 'Dell API rate limit exceeded. Please wait before making more requests.';
            case 500:
                return 'Dell API server error. Please try again later.';
            default:
                return errorMessage;
        }
    }

    /**
     * Parse Dell API warranty response into standardized format
     */
    parseWarrantyResponse(data, serviceTag) {
        try {
            if (!data || !data.length) {
                return {
                    serviceTag: serviceTag,
                    vendor: 'Dell',
                    status: 'not_found',
                    message: 'No warranty information found for this service tag'
                };
            }

            const device = data[0];
            const entitlements = device.entitlements || [];

            // Find the primary warranty (usually the longest or most comprehensive)
            const primaryWarranty = entitlements.reduce((primary, current) => {
                if (!primary) return current;

                const currentEnd = new Date(current.endDate);
                const primaryEnd = new Date(primary.endDate);

                return currentEnd > primaryEnd ? current : primary;
            }, null);

            if (!primaryWarranty) {
                return {
                    serviceTag: serviceTag,
                    vendor: 'Dell',
                    status: 'no_warranty',
                    message: 'No active warranty found'
                };
            }

            const startDate = new Date(primaryWarranty.startDate);
            const endDate = new Date(primaryWarranty.endDate);
            const now = new Date();

            const isActive = now >= startDate && now <= endDate;
            const daysRemaining = isActive ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : 0;

            return {
                serviceTag: serviceTag,
                vendor: 'Dell',
                status: isActive ? 'active' : 'expired',
                warrantyType: primaryWarranty.serviceLevelDescription || 'Standard Warranty',
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                daysRemaining: daysRemaining,
                isActive: isActive,
                model: device.productLineDescription || 'Unknown Model',
                shipDate: device.shipDate ? new Date(device.shipDate).toISOString().split('T')[0] : null,
                allEntitlements: entitlements.map(ent => ({
                    type: ent.serviceLevelDescription,
                    startDate: ent.startDate,
                    endDate: ent.endDate
                }))
            };

        } catch (error) {
            console.error('Error parsing Dell warranty response:', error);
            return {
                serviceTag: serviceTag,
                vendor: 'Dell',
                status: 'error',
                message: 'Error parsing warranty information'
            };
        }
    }
}

/**
 * Lenovo API Implementation (Placeholder)
 * TODO: Implement Lenovo warranty API integration
 */
class LenovoAPI {
    constructor() {
        this.baseUrl = 'https://support.lenovo.com/api'; // Placeholder URL
        this.rateLimiter = rateLimiters.lenovo;
    }

    async lookupWarranty(serialNumber) {
        throw new Error('Lenovo API integration not yet implemented. Coming soon!');
    }
}

/**
 * HP API Implementation (Placeholder)
 * TODO: Implement HP warranty API integration
 */
class HPAPI {
    constructor() {
        this.baseUrl = 'https://support.hp.com/api'; // Placeholder URL
        this.rateLimiter = rateLimiters.hp;
    }

    async lookupWarranty(serialNumber) {
        throw new Error('HP API integration not yet implemented. Coming soon!');
    }
}

/**
 * Vendor API Factory
 * Creates appropriate API instance based on vendor
 */
class VendorAPIFactory {
    static createAPI(vendor) {
        switch (vendor.toLowerCase()) {
            case 'dell':
                return new DellAPI();
            case 'lenovo':
                return new LenovoAPI();
            case 'hp':
                return new HPAPI();
            default:
                throw new Error(`Unsupported vendor: ${vendor}`);
        }
    }

    static getSupportedVendors() {
        return ['dell', 'lenovo', 'hp'];
    }

    static isVendorSupported(vendor) {
        return this.getSupportedVendors().includes(vendor.toLowerCase());
    }
}

/**
 * Main Warranty Lookup Service
 * Provides unified interface for warranty lookups across all vendors
 */
class WarrantyLookupService {
    constructor() {
        this.apis = {};
        this.initializeAPIs();
    }

    initializeAPIs() {
        VendorAPIFactory.getSupportedVendors().forEach(vendor => {
            try {
                this.apis[vendor] = VendorAPIFactory.createAPI(vendor);
            } catch (error) {
                console.warn(`Failed to initialize ${vendor} API:`, error);
            }
        });
    }

    /**
     * Lookup warranty for a device
     * @param {string} vendor - Vendor name (dell, lenovo, hp)
     * @param {string} identifier - Service tag or serial number
     * @returns {Promise<Object>} Warranty information
     */
    async lookupWarranty(vendor, identifier) {
        const vendorLower = vendor.toLowerCase();

        if (!VendorAPIFactory.isVendorSupported(vendorLower)) {
            throw new Error(`Vendor "${vendor}" is not supported`);
        }

        if (!this.apis[vendorLower]) {
            throw new Error(`API for vendor "${vendor}" is not available`);
        }

        try {
            return await this.apis[vendorLower].lookupWarranty(identifier);
        } catch (error) {
            console.error(`Warranty lookup failed for ${vendor} ${identifier}:`, error);
            throw error;
        }
    }

    /**
     * Get rate limit status for a vendor
     */
    getRateLimitStatus(vendor) {
        const vendorLower = vendor.toLowerCase();
        const rateLimiter = rateLimiters[vendorLower];

        if (!rateLimiter) {
            return null;
        }

        return {
            canMakeRequest: rateLimiter.canMakeRequest(),
            waitTime: rateLimiter.getWaitTime(),
            requestsInLastMinute: rateLimiter.requests.filter(
                time => time > Date.now() - 60000
            ).length,
            requestsInLastHour: rateLimiter.requests.filter(
                time => time > Date.now() - 3600000
            ).length
        };
    }
}

// Export classes for use in other modules
export {
    WarrantyLookupService,
    VendorAPIFactory,
    DellAPI,
    LenovoAPI,
    HPAPI,
    RateLimiter
};



