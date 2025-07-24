/**
 * WarrantyDog Vendor API Implementations
 *
 * This module provides warranty lookup functionality for various hardware vendors.
 * Currently supports Dell with plans for Lenovo and HP integration.
 *
 * Features:
 * - Intelligent adaptive rate limiting with machine learning
 * - Dynamic burst handling and concurrent processing
 * - Circuit breaker patterns for error recovery
 * - Comprehensive analytics and optimization
 * - API key management via localStorage
 * - Standardized response format across vendors
 */

import IntelligentRateLimitingSystem from './intelligentRateLimitingSystem.js';

// Legacy rate limiting configuration (now used as fallback/initial values)
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

// Global singleton for intelligent rate limiting systems
window.warrantyDogRateLimiters = window.warrantyDogRateLimiters || null;

function getIntelligentRateLimiters() {
    if (!window.warrantyDogRateLimiters) {
        console.log('🔧 Initializing intelligent rate limiting systems...');
        window.warrantyDogRateLimiters = {
            dell: new IntelligentRateLimitingSystem('dell', {
                mode: 'adaptive',
                rateLimiter: {
                    requestsPerMinute: RATE_LIMITS.dell.requestsPerMinute,
                    requestsPerHour: RATE_LIMITS.dell.requestsPerHour
                }
            }),
            lenovo: new IntelligentRateLimitingSystem('lenovo', {
                mode: 'adaptive',
                rateLimiter: {
                    requestsPerMinute: RATE_LIMITS.lenovo.requestsPerMinute,
                    requestsPerHour: RATE_LIMITS.lenovo.requestsPerHour
                }
            }),
            hp: new IntelligentRateLimitingSystem('hp', {
                mode: 'adaptive',
                rateLimiter: {
                    requestsPerMinute: RATE_LIMITS.hp.requestsPerMinute,
                    requestsPerHour: RATE_LIMITS.hp.requestsPerHour
                }
            })
        };
        console.log('✅ Intelligent rate limiting systems initialized');
    }
    return window.warrantyDogRateLimiters;
}

// Legacy RateLimiter class (kept for backward compatibility)
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

// Legacy rate limiters (kept for backward compatibility)
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
        this.rateLimiter = rateLimiters.dell; // Legacy rate limiter
        this.intelligentRateLimiter = getIntelligentRateLimiters().dell; // New intelligent system
        this.useIntelligentRateLimiting = true; // Enable intelligent rate limiting by default
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
     * Get API secret from localStorage
     */
    getApiSecret() {
        const secret = localStorage.getItem('dell_api_secret');
        if (!secret) {
            throw new Error('Dell API secret not configured. Please set your API secret in the configuration modal.');
        }
        return secret;
    }

    /**
     * Lookup warranty information for a Dell service tag
     * @param {string} serviceTag - Dell service tag
     * @returns {Promise<Object>} Warranty information
     */
    async lookupWarranty(serviceTag) {
        console.log(`Looking up Dell warranty for service tag: ${serviceTag}`);

        // Use intelligent rate limiting system if enabled
        if (this.useIntelligentRateLimiting) {
            return await this.intelligentRateLimiter.executeRequest(
                () => this.performWarrantyLookup(serviceTag),
                { serviceTag, vendor: 'dell' }
            );
        } else {
            // Fallback to legacy rate limiting
            return await this.performWarrantyLookupLegacy(serviceTag);
        }
    }

    /**
     * Perform warranty lookup with intelligent rate limiting
     */
    async performWarrantyLookup(serviceTag) {
        const apiKey = this.getApiKey();
        const apiSecret = this.getApiSecret();

        // Use backend proxy to avoid CORS issues
        const proxyUrl = `/api/dell/warranty/${serviceTag}`;

        console.log('Dell API Request via proxy:', proxyUrl);
        console.log('API Key length:', apiKey.length);
        console.log('API Secret length:', apiSecret.length);

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'X-Dell-Api-Key': apiKey,
                'X-Dell-Api-Secret': apiSecret,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        console.log('Dell API Response Status:', response.status);
        console.log('Dell API Response Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Handle rate limiting specifically
            if (response.status === 429) {
                const rateLimitError = new Error(`rate_limit_exceeded: ${errorData.message || 'Too many requests'}`);
                rateLimitError.isRateLimit = true;
                rateLimitError.retryAfter = errorData.retryAfterSeconds || 60;
                rateLimitError.originalError = errorData;
                throw rateLimitError;
            }

            const errorMessage = await this.handleErrorResponse(response);
            console.error('Dell API Error Response:', errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Dell API Response Data:', data);

        // Parse the warranty response and store parsing results
        try {
            const parsedResult = this.parseWarrantyResponse(data, serviceTag);

            // Store successful parsing result if we have metadata with response ID
            if (data._metadata && data._metadata.responseId) {
                await this.updateParsingStatus(data._metadata.responseId, 'success', parsedResult);
            }

            return parsedResult;
        } catch (parseError) {
            console.error(`Parsing error for ${serviceTag}:`, parseError);

            // Store parsing failure if we have metadata with response ID
            if (data._metadata && data._metadata.responseId) {
                await this.updateParsingStatus(data._metadata.responseId, 'failed', null, parseError.message);
            }

            // Return a standardized error response
            return {
                serviceTag: serviceTag,
                vendor: 'Dell',
                status: 'parsing_error',
                message: `Failed to parse warranty data: ${parseError.message}`
            };
        }
    }

    /**
     * Legacy warranty lookup method (for backward compatibility)
     */
    async performWarrantyLookupLegacy(serviceTag) {
        if (!this.rateLimiter.canMakeRequest()) {
            const waitTime = this.rateLimiter.getWaitTime();
            throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }

        try {
            const result = await this.performWarrantyLookup(serviceTag);
            this.rateLimiter.recordRequest();
            return result;

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
     * Update parsing status in database
     */
    async updateParsingStatus(responseId, status, parsedData = null, error = null) {
        try {
            const response = await fetch('/api/parsing-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    responseId,
                    status,
                    parsedData,
                    error
                })
            });

            if (!response.ok) {
                console.error('Failed to update parsing status:', response.statusText);
            }
        } catch (error) {
            console.error('Error updating parsing status:', error);
        }
    }

    /**
     * Organize warranties by type and priority for clear display
     */
    organizeWarranties(entitlements) {
        if (!entitlements || entitlements.length === 0) {
            return { primary: null, all: [], summary: 'No warranties found' };
        }

        // Sort warranties by priority and end date
        const sortedWarranties = entitlements.sort((a, b) => {
            // Priority order: Extended > Premium > Standard > Basic
            const priorityOrder = {
                'extended': 4,
                'premium': 3,
                'standard': 2,
                'basic': 1,
                'default': 0
            };

            const aPriority = this.getWarrantyPriority(a.serviceLevelDescription, priorityOrder);
            const bPriority = this.getWarrantyPriority(b.serviceLevelDescription, priorityOrder);

            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }

            // If same priority, sort by end date (latest first)
            return new Date(b.endDate) - new Date(a.endDate);
        });

        // Find the most relevant warranty for primary display
        const primary = sortedWarranties[0];

        // Create a comprehensive summary
        const warrantyTypes = [...new Set(sortedWarranties.map(w =>
            this.cleanWarrantyType(w.serviceLevelDescription)
        ))];

        const summary = warrantyTypes.length > 1
            ? `${warrantyTypes[0]} + ${warrantyTypes.length - 1} more`
            : warrantyTypes[0] || 'Standard Warranty';

        return {
            primary: primary,
            all: sortedWarranties,
            summary: summary,
            count: sortedWarranties.length
        };
    }

    /**
     * Get warranty priority for sorting
     */
    getWarrantyPriority(description, priorityOrder) {
        if (!description) return 0;

        const desc = description.toLowerCase();
        for (const [key, priority] of Object.entries(priorityOrder)) {
            if (desc.includes(key)) {
                return priority;
            }
        }
        return 0;
    }

    /**
     * Clean warranty type for display
     */
    cleanWarrantyType(description) {
        if (!description) return 'Standard Warranty';

        // Remove common prefixes/suffixes and clean up
        return description
            .replace(/^(Dell\s+)?/i, '')
            .replace(/\s+(Warranty|Service|Support)$/i, '')
            .replace(/\s+/g, ' ')
            .trim() || 'Standard Warranty';
    }

    /**
     * Parse Dell API warranty response into standardized format
     */
    parseWarrantyResponse(data, serviceTag) {
        try {
            console.log(`[DEBUG] Parsing warranty response for ${serviceTag}:`, JSON.stringify(data, null, 2));

            // Handle different response structures
            let devices = data;

            // Check if data is wrapped in a response object
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                // Common Dell API response structures
                if (data.devices) {
                    devices = data.devices;
                } else if (data.entitlements) {
                    devices = [data]; // Single device response
                } else if (data._metadata) {
                    // Response with metadata wrapper - extract the actual data
                    const { _metadata, ...actualData } = data;
                    console.log(`[DEBUG] After removing metadata for ${serviceTag}:`, actualData);
                    console.log(`[DEBUG] ActualData keys:`, Object.keys(actualData));

                    // Check if the remaining data is an array or has nested structure
                    if (Array.isArray(actualData)) {
                        devices = actualData;
                    } else if (actualData.devices) {
                        devices = actualData.devices;
                    } else if (actualData.entitlements) {
                        devices = [actualData];
                    } else {
                        // Dell API often uses numeric keys like "0", "1", etc.
                        const numericKeys = Object.keys(actualData).filter(key => !isNaN(key));
                        if (numericKeys.length > 0) {
                            // Extract devices from numeric keys
                            devices = numericKeys.map(key => actualData[key]);
                            console.log(`[DEBUG] Extracted from numeric keys for ${serviceTag}:`, devices);
                        } else {
                            // Check if any property is an array (common Dell API pattern)
                            const arrayProps = Object.values(actualData).filter(val => Array.isArray(val));
                            if (arrayProps.length > 0) {
                                devices = arrayProps[0]; // Use the first array found
                            } else {
                                devices = [actualData]; // Treat as single device
                            }
                        }
                    }
                } else {
                    // Check if any property is an array (Dell API sometimes nests data)
                    const arrayProps = Object.values(data).filter(val => Array.isArray(val));
                    if (arrayProps.length > 0) {
                        devices = arrayProps[0]; // Use the first array found
                    } else if (data.serviceTag || data.serialNumber) {
                        devices = [data]; // Single device response
                    }
                }
            }

            console.log(`[DEBUG] Extracted devices for ${serviceTag}:`, devices);

            if (!devices || (Array.isArray(devices) && devices.length === 0)) {
                console.log(`[DEBUG] No devices found for ${serviceTag}`);
                return {
                    serviceTag: serviceTag,
                    vendor: 'Dell',
                    status: 'not_found',
                    message: 'No warranty information found for this service tag'
                };
            }

            // Get the first device from the array or use the single device
            const device = Array.isArray(devices) ? devices[0] : devices;
            console.log(`[DEBUG] Processing device for ${serviceTag}:`, device);
            console.log(`[DEBUG] Device keys:`, Object.keys(device));
            console.log(`[DEBUG] Device entitlements property:`, device.entitlements);

            const entitlements = device.entitlements || [];
            console.log(`[DEBUG] Entitlements for ${serviceTag}:`, entitlements.length, entitlements);

            // Additional debugging for entitlements extraction
            if (entitlements.length === 0 && device.entitlements) {
                console.log(`[DEBUG] Entitlements exist but length is 0. Raw entitlements:`, device.entitlements);
            }

            // Organize warranties by type and priority
            const warrantyHierarchy = this.organizeWarranties(entitlements);
            console.log(`[DEBUG] Organized warranties for ${serviceTag}:`, warrantyHierarchy);

            // Find the primary warranty (most relevant for display)
            const primaryWarranty = warrantyHierarchy.primary;
            console.log(`[DEBUG] Primary warranty for ${serviceTag}:`, primaryWarranty);

            if (!primaryWarranty) {
                console.log(`[DEBUG] No primary warranty found for ${serviceTag}, entitlements:`, entitlements);
                return {
                    serviceTag: serviceTag,
                    vendor: 'Dell',
                    status: 'no_warranty',
                    message: 'No warranty entitlements found',
                    model: device.productLineDescription || 'Unknown Model',
                    shipDate: device.shipDate ? new Date(device.shipDate).toISOString().split('T')[0] : null
                };
            }

            const startDate = new Date(primaryWarranty.startDate);
            const endDate = new Date(primaryWarranty.endDate);
            const now = new Date();

            const isActive = now >= startDate && now <= endDate;
            const daysRemaining = isActive ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : 0;
            const daysExpired = !isActive && now > endDate ? Math.ceil((now - endDate) / (1000 * 60 * 60 * 24)) : 0;

            console.log(`[DEBUG] Warranty dates for ${serviceTag}: start=${startDate.toISOString()}, end=${endDate.toISOString()}, now=${now.toISOString()}, active=${isActive}, daysRemaining=${daysRemaining}, daysExpired=${daysExpired}`);

            return {
                serviceTag: serviceTag,
                vendor: 'Dell',
                status: isActive ? 'active' : 'expired',
                warrantyType: warrantyHierarchy.summary, // Use comprehensive summary
                primaryWarrantyType: this.cleanWarrantyType(primaryWarranty.serviceLevelDescription),
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                daysRemaining: daysRemaining,
                daysExpired: daysExpired,
                isActive: isActive,
                model: device.productLineDescription || 'Unknown Model',
                shipDate: device.shipDate ? new Date(device.shipDate).toISOString().split('T')[0] : null,
                message: isActive ?
                    `Active warranty - ${daysRemaining} days remaining` :
                    `Warranty expired ${daysExpired} days ago`,
                warrantyCount: warrantyHierarchy.count,
                warrantyDetails: warrantyHierarchy.all.map(ent => ({
                    type: this.cleanWarrantyType(ent.serviceLevelDescription),
                    fullType: ent.serviceLevelDescription,
                    startDate: ent.startDate,
                    endDate: ent.endDate,
                    entitlementType: ent.entitlementType,
                    isActive: new Date(ent.endDate) > new Date()
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
 * Lenovo Warranty API Implementation
 * Uses Lenovo Support API v2.5 for warranty lookups
 */
class LenovoAPI {
    constructor() {
        this.baseUrl = 'https://supportapi.lenovo.com/v2.5';
        this.rateLimiter = rateLimiters.lenovo;
        this.useIntelligentRateLimiting = true;
        this.intelligentRateLimiter = getIntelligentRateLimiters().lenovo;
    }

    /**
     * Lookup warranty information for a Lenovo serial number
     * @param {string} serialNumber - Lenovo serial number
     * @returns {Promise<Object>} Warranty information
     */
    async lookupWarranty(serialNumber) {
        console.log(`Looking up Lenovo warranty for serial number: ${serialNumber}`);

        // Use intelligent rate limiting system if enabled
        if (this.useIntelligentRateLimiting) {
            return await this.intelligentRateLimiter.executeRequest(
                () => this.performLenovoWarrantyLookup(serialNumber),
                `lenovo_warranty_${serialNumber}`
            );
        } else {
            // Fallback to legacy rate limiting
            await this.rateLimiter.waitForSlot();
            return await this.performLenovoWarrantyLookup(serialNumber);
        }
    }

    /**
     * Perform the actual Lenovo warranty lookup
     */
    async performLenovoWarrantyLookup(serialNumber) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('Lenovo API key not configured. Please configure your API key in settings.');
        }

        // Use backend proxy to avoid CORS issues
        const proxyUrl = `/api/lenovo/warranty`;

        console.log(`Making Lenovo API request via proxy: ${proxyUrl}`);

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Lenovo-Client-ID': apiKey
                },
                body: JSON.stringify({
                    Serial: serialNumber
                })
            });

            console.log(`Lenovo API Response Status: ${response.status}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));

                if (response.status === 401) {
                    throw new Error('Lenovo API authentication failed. Please check your ClientID.');
                } else if (response.status === 429) {
                    throw new Error('Lenovo API rate limit exceeded. Please try again later.');
                } else if (response.status === 404) {
                    throw new Error('Serial number not found in Lenovo database.');
                } else {
                    throw new Error(`Lenovo API error: ${response.status} - ${errorData.message || response.statusText}`);
                }
            }

            const data = await response.json();
            console.log(`Lenovo API Response Data:`, data);

            return this.parseLenovoWarrantyResponse(data, serialNumber);

        } catch (error) {
            console.error(`Lenovo API lookup failed for ${serialNumber}:`, error);
            throw error;
        }
    }

    /**
     * Parse Lenovo warranty response into standardized format
     */
    parseLenovoWarrantyResponse(data, serialNumber) {
        try {
            // Handle error codes in response
            if (data.ErrorCode) {
                if (data.ErrorCode === 100) {
                    return {
                        vendor: 'Lenovo',
                        serviceTag: serialNumber,
                        status: 'no_warranty',
                        message: 'Warranty data not found',
                        isActive: false
                    };
                } else if (data.ErrorCode === 101) {
                    throw new Error('Multiple records found. Please specify SN.MT instead of SN');
                } else {
                    throw new Error(`Lenovo API error: ${data.ErrorCode} - ${data.ErrorMessage || 'Unknown error'}`);
                }
            }

            // Extract basic information
            const product = data.Product || 'Unknown';
            const inWarranty = data.InWarranty || false;
            const purchased = data.Purchased ? new Date(data.Purchased) : null;
            const shipped = data.Shipped ? new Date(data.Shipped) : null;
            const country = data.Country || '';

            // Process warranty information
            const warranties = data.Warranty || [];
            let primaryWarranty = null;
            let warrantyEndDate = null;
            let warrantyType = 'Unknown';

            if (warranties.length > 0) {
                // Find the primary/base warranty or the one with the latest end date
                primaryWarranty = warranties.find(w => w.Type === 'BASE') || warranties[0];

                if (primaryWarranty) {
                    warrantyType = primaryWarranty.Name || primaryWarranty.Description || 'Standard Warranty';
                    warrantyEndDate = primaryWarranty.End ? new Date(primaryWarranty.End) : null;
                }
            }

            // Calculate warranty status and days remaining
            let status = 'no_warranty';
            let daysRemaining = null;
            let isActive = false;

            if (inWarranty && warrantyEndDate) {
                const now = new Date();
                const timeDiff = warrantyEndDate.getTime() - now.getTime();
                daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (daysRemaining > 0) {
                    status = 'active';
                    isActive = true;
                } else {
                    status = 'expired';
                    isActive = false;
                }
            } else if (warrantyEndDate) {
                const now = new Date();
                const timeDiff = warrantyEndDate.getTime() - now.getTime();
                daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (daysRemaining <= 0) {
                    status = 'expired';
                    isActive = false;
                }
            }

            return {
                vendor: 'Lenovo',
                serviceTag: serialNumber,
                status: status,
                warrantyType: warrantyType,
                startDate: primaryWarranty?.Start || shipped?.toISOString() || null,
                endDate: warrantyEndDate?.toISOString() || null,
                shipDate: shipped?.toISOString() || null,
                daysRemaining: daysRemaining,
                isActive: isActive,
                message: inWarranty ? 'Warranty information found' : 'No active warranty',
                model: product,
                country: country,
                purchaseDate: purchased?.toISOString() || null,
                upgradeUrl: data.UpgradeUrl || null,
                allWarranties: warranties.map(w => ({
                    id: w.ID,
                    name: w.Name,
                    description: w.Description,
                    type: w.Type,
                    start: w.Start,
                    end: w.End
                })),
                contracts: data.Contract || []
            };

        } catch (error) {
            console.error('Error parsing Lenovo warranty response:', error);
            throw new Error(`Failed to parse Lenovo warranty data: ${error.message}`);
        }
    }

    /**
     * Get Lenovo API key from localStorage
     */
    getApiKey() {
        const apiKey = localStorage.getItem('lenovo_api_key') || '';
        console.log('🔍 Lenovo API getApiKey() called:');
        console.log('  Retrieved from localStorage:', apiKey ? `${apiKey.substring(0, 10)}...` : 'empty');
        console.log('  Key length:', apiKey.length);
        return apiKey;
    }

    /**
     * Set Lenovo API key in localStorage
     */
    setApiKey(apiKey) {
        if (apiKey && apiKey.trim()) {
            localStorage.setItem('lenovo_api_key', apiKey.trim());
            console.log('Lenovo API key saved successfully');
        } else {
            localStorage.removeItem('lenovo_api_key');
            console.log('Lenovo API key removed');
        }
    }

    /**
     * Bulk warranty lookup for multiple serial numbers (Lenovo API supports this)
     */
    async lookupWarrantyBulk(serialNumbers) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('Lenovo API key not configured. Please configure your API key in settings.');
        }

        // Use backend proxy to avoid CORS issues
        const proxyUrl = `/api/lenovo/warranty`;

        console.log(`Making Lenovo bulk API request for ${serialNumbers.length} devices via proxy`);

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Lenovo-Client-ID': apiKey
                },
                body: JSON.stringify({
                    Serial: serialNumbers.join(',')
                })
            });

            console.log(`Lenovo bulk API Response Status: ${response.status}`);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Lenovo API authentication failed. Please check your ClientID.');
                } else {
                    throw new Error(`Lenovo API error: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log(`Lenovo bulk API Response Data:`, data);

            // Parse bulk response - Lenovo returns array for multiple devices
            const results = new Map();

            if (Array.isArray(data)) {
                data.forEach(deviceData => {
                    const serialNumber = deviceData.Serial || deviceData.ServiceTag;
                    if (serialNumber) {
                        results.set(serialNumber, this.parseLenovoWarrantyResponse(deviceData, serialNumber));
                    }
                });
            } else {
                // Single device response
                const serialNumber = serialNumbers[0];
                results.set(serialNumber, this.parseLenovoWarrantyResponse(data, serialNumber));
            }

            return results;

        } catch (error) {
            console.error(`Lenovo bulk API lookup failed:`, error);
            throw error;
        }
    }

    /**
     * Test Lenovo API connection with a sample serial number
     */
    async testConnection(testSerial = 'PF2ABCDE', allowWithoutKey = false) {
        try {
            if (allowWithoutKey && !this.getApiKey()) {
                // Test endpoint connectivity without authentication via proxy
                const proxyUrl = `/api/lenovo/warranty`;

                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        Serial: testSerial
                    })
                });

                if (response.status === 401) {
                    return {
                        success: true,
                        message: 'API endpoint is reachable. Authentication required.',
                        needsAuth: true
                    };
                } else {
                    return {
                        success: false,
                        message: `Unexpected response: ${response.status}`,
                        needsAuth: true
                    };
                }
            }

            const result = await this.lookupWarranty(testSerial);
            return {
                success: true,
                message: 'Lenovo API connection successful',
                data: result
            };
        } catch (error) {
            return {
                success: false,
                message: `Lenovo API test failed: ${error.message}`,
                error: error
            };
        }
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
     * Lookup warranty for a device with retry logic
     * @param {string} vendor - Vendor name (dell, lenovo, hp)
     * @param {string} identifier - Service tag or serial number
     * @param {number} retryCount - Current retry attempt (internal use)
     * @returns {Promise<Object>} Warranty information
     */
    async lookupWarranty(vendor, identifier, retryCount = 0) {
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

            // Handle rate limiting with retry logic
            if (this.isRateLimitError(error) && retryCount < 3) {
                const retryAfter = this.extractRetryAfter(error);
                console.log(`Rate limit hit for ${identifier}, retrying in ${retryAfter} seconds... (attempt ${retryCount + 1}/3)`);

                await this.waitForRetry(retryAfter);
                return await this.lookupWarranty(vendor, identifier, retryCount + 1);
            }

            // Handle other retryable errors with exponential backoff
            if (this.isRetryableError(error) && retryCount < 2) {
                const backoffTime = Math.pow(2, retryCount) * 1000; // 1s, 2s exponential backoff
                console.log(`Retryable error for ${identifier}, retrying in ${backoffTime}ms... (attempt ${retryCount + 1}/2)`);

                await this.waitForRetry(backoffTime / 1000);
                return await this.lookupWarranty(vendor, identifier, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * Check if error is due to rate limiting
     */
    isRateLimitError(error) {
        return error.message && (
            error.message.includes('rate_limit_exceeded') ||
            error.message.includes('429') ||
            error.message.includes('Too Many Requests')
        );
    }

    /**
     * Check if error is retryable (network issues, temporary server errors)
     */
    isRetryableError(error) {
        return error.message && (
            error.message.includes('500') ||
            error.message.includes('502') ||
            error.message.includes('503') ||
            error.message.includes('504') ||
            error.message.includes('network') ||
            error.message.includes('timeout')
        );
    }

    /**
     * Extract retry-after time from error
     */
    extractRetryAfter(error) {
        // Try to extract from error message or default to 60 seconds
        if (error.retryAfter) {
            return parseInt(error.retryAfter);
        }

        const match = error.message.match(/retry.*?(\d+)/i);
        return match ? parseInt(match[1]) : 60;
    }

    /**
     * Wait for specified number of seconds
     */
    async waitForRetry(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    /**
     * Get rate limit status for a vendor (enhanced with intelligent rate limiting)
     */
    getRateLimitStatus(vendor) {
        const vendorLower = vendor.toLowerCase();

        // Try intelligent rate limiter first
        const intelligentRateLimiter = getIntelligentRateLimiters()[vendorLower];
        if (intelligentRateLimiter) {
            const status = intelligentRateLimiter.getSystemStatus();
            return {
                // Legacy compatibility
                canMakeRequest: status.rateLimiter.canMakeRequest,
                waitTime: status.rateLimiter.optimalDelayMs,
                requestsInLastMinute: status.rateLimiter.requestsInLastMinute,
                requestsInLastHour: status.rateLimiter.requestsInLastHour,

                // Enhanced information
                intelligentStatus: {
                    mode: status.currentMode,
                    circuitState: status.errorRecovery.circuitState,
                    burstMode: status.burstManager.isInBurst,
                    concurrency: status.concurrentProcessor.currentConcurrency,
                    successRate: status.analytics.currentPerformance?.successRate || 1.0,
                    averageResponseTime: status.analytics.currentPerformance?.averageResponseTime || 0,
                    recommendations: status.analytics.latestRecommendations?.length || 0
                }
            };
        }

        // Fallback to legacy rate limiter
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

    /**
     * Get comprehensive analytics dashboard for a vendor
     */
    getAnalyticsDashboard(vendor) {
        const vendorLower = vendor.toLowerCase();
        const intelligentRateLimiter = getIntelligentRateLimiters()[vendorLower];

        if (intelligentRateLimiter) {
            return intelligentRateLimiter.analytics.getDashboardData();
        }

        return null;
    }

    /**
     * Set rate limiting mode for a vendor
     */
    setRateLimitingMode(vendor, mode) {
        const vendorLower = vendor.toLowerCase();
        const intelligentRateLimiter = getIntelligentRateLimiters()[vendorLower];

        if (intelligentRateLimiter) {
            intelligentRateLimiter.setMode(mode);
            console.log(`[${vendor}] Rate limiting mode set to: ${mode}`);
        }
    }

    /**
     * Process multiple devices with intelligent concurrent processing
     */
    async processDevicesBatch(vendor, devices, processingOptions = {}) {
        const vendorLower = vendor.toLowerCase();
        const intelligentRateLimiter = getIntelligentRateLimiters()[vendorLower];

        if (!intelligentRateLimiter) {
            throw new Error(`Intelligent rate limiter not available for vendor: ${vendor}`);
        }

        const processingFunction = async (device) => {
            return await this.lookupWarranty(vendor, device.serialNumber || device.serviceTag);
        };

        return await intelligentRateLimiter.processDevices(devices, processingFunction, processingOptions);
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



