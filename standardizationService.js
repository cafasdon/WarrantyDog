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
 * Enhanced Standardization Service
 * 
 * Two-layer standardization system:
 * Layer 1: Raw API Field Standardization (vendor-specific)
 * Layer 2: Final Output Standardization (universal)
 * 
 * This makes the system scalable for unpredictable new API formats
 */

export class StandardizationService {
    constructor() {
        this.vendorFieldMappings = this.initializeVendorMappings();
        this.dateFormats = this.initializeDateFormats();
        this.booleanFormats = this.initializeBooleanFormats();
    }

    /**
     * Initialize vendor-specific field mappings
     * Each vendor can have completely different field names and structures
     */
    initializeVendorMappings() {
        return {
            dell: {
                // Dell API field mappings
                device: {
                    'productLineDescription': 'model',
                    'shipDate': 'shipDate',
                    'serviceTag': 'serviceTag'
                },
                entitlement: {
                    'serviceLevelDescription': 'warrantyType',
                    'startDate': 'startDate', 
                    'endDate': 'endDate',
                    'entitlementType': 'entitlementCategory'
                },
                response: {
                    'devices': 'devices',
                    'entitlements': 'entitlements',
                    '_metadata': 'metadata'
                }
            },
            lenovo: {
                // Lenovo API field mappings
                main: {
                    'Product': 'model',
                    'InWarranty': 'isActive',
                    'Purchased': 'purchaseDate',
                    'Shipped': 'shipDate',
                    'Country': 'country',
                    'Serial': 'serviceTag',
                    'UpgradeUrl': 'upgradeUrl',
                    'Contract': 'contracts'
                },
                warranty: {
                    'Name': 'warrantyType',
                    'Description': 'warrantyDescription',
                    'Type': 'warrantyCategory',
                    'Start': 'startDate',
                    'End': 'endDate',
                    'ID': 'warrantyId'
                },
                error: {
                    'ErrorCode': 'errorCode',
                    'ErrorMessage': 'errorMessage'
                }
            },
            hp: {
                // HP API field mappings (placeholder for future implementation)
                main: {
                    'productNumber': 'model',
                    'serialNumber': 'serviceTag',
                    'warrantyStartDate': 'startDate',
                    'warrantyEndDate': 'endDate',
                    'warrantyStatus': 'status'
                }
            },
            microsoft: {
                // Microsoft API field mappings (placeholder for future implementation)
                main: {
                    'deviceModel': 'model',
                    'serialNumber': 'serviceTag',
                    'warrantyExpiration': 'endDate',
                    'supportStatus': 'status'
                }
            }
        };
    }

    /**
     * Initialize date format patterns for different vendors
     */
    initializeDateFormats() {
        return {
            // ISO format: 2025-12-31
            iso: /^\d{4}-\d{2}-\d{2}$/,
            // US format: 12/31/2025 or 12-31-2025
            us: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            // European format: 31/12/2025 or 31-12-2025
            eu: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            // Unix timestamp: 1735689600
            unix: /^\d{10}$/,
            // Unix timestamp (milliseconds): 1735689600000
            unixMs: /^\d{13}$/,
            // ISO with time: 2025-12-31T23:59:59Z
            isoTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        };
    }

    /**
     * Initialize boolean format patterns for different vendors
     */
    initializeBooleanFormats() {
        return {
            truthy: ['true', 'yes', 'y', '1', 'active', 'enabled', 'on'],
            falsy: ['false', 'no', 'n', '0', 'inactive', 'disabled', 'off', 'expired']
        };
    }

    /**
     * Layer 1: Standardize raw API response fields (vendor-specific)
     * This handles the unpredictable field names and formats from different APIs
     */
    standardizeRawApiResponse(vendor, rawResponse) {
        const vendorLower = vendor.toLowerCase();
        const mapping = this.vendorFieldMappings[vendorLower];
        
        if (!mapping) {
            console.warn(`No field mapping found for vendor: ${vendor}. Using raw response.`);
            return rawResponse;
        }

        console.log(`🔄 Applying Layer 1 standardization for ${vendor}...`);
        
        try {
            switch (vendorLower) {
                case 'dell':
                    return this.standardizeDellResponse(rawResponse, mapping);
                case 'lenovo':
                    return this.standardizeLenovoResponse(rawResponse, mapping);
                case 'hp':
                    return this.standardizeHpResponse(rawResponse, mapping);
                case 'microsoft':
                    return this.standardizeMicrosoftResponse(rawResponse, mapping);
                default:
                    return this.standardizeGenericResponse(rawResponse, mapping);
            }
        } catch (error) {
            console.error(`Layer 1 standardization failed for ${vendor}:`, error);
            return rawResponse; // Fallback to raw response
        }
    }

    /**
     * Standardize Dell API response structure
     */
    standardizeDellResponse(rawResponse, mapping) {
        const standardized = { ...rawResponse };
        
        // Handle metadata wrapper
        if (standardized._metadata) {
            const { _metadata, ...actualData } = standardized;
            standardized.metadata = _metadata;
            delete standardized._metadata;
            
            // Merge actual data into standardized response
            Object.assign(standardized, actualData);
        }

        // Handle numeric keys (Dell API quirk)
        const numericKeys = Object.keys(standardized).filter(key => !isNaN(key));
        if (numericKeys.length > 0) {
            standardized.devices = numericKeys.map(key => standardized[key]);
            numericKeys.forEach(key => delete standardized[key]);
        }

        // Standardize device fields
        if (standardized.devices && Array.isArray(standardized.devices)) {
            standardized.devices = standardized.devices.map(device => 
                this.mapFields(device, mapping.device)
            );
        }

        return standardized;
    }

    /**
     * Standardize Lenovo API response structure
     */
    standardizeLenovoResponse(rawResponse, mapping) {
        const standardized = this.mapFields(rawResponse, mapping.main);
        
        // Handle error responses
        if (rawResponse.ErrorCode !== undefined) {
            standardized.error = this.mapFields({
                ErrorCode: rawResponse.ErrorCode,
                ErrorMessage: rawResponse.ErrorMessage
            }, mapping.error);
        }

        // Standardize warranty array
        if (rawResponse.Warranty && Array.isArray(rawResponse.Warranty)) {
            standardized.warranties = rawResponse.Warranty.map(warranty =>
                this.mapFields(warranty, mapping.warranty)
            );
        }

        return standardized;
    }

    /**
     * Standardize HP API response structure (placeholder)
     */
    standardizeHpResponse(rawResponse, mapping) {
        return this.mapFields(rawResponse, mapping.main);
    }

    /**
     * Standardize Microsoft API response structure (placeholder)
     */
    standardizeMicrosoftResponse(rawResponse, mapping) {
        return this.mapFields(rawResponse, mapping.main);
    }

    /**
     * Generic response standardization for unknown vendors
     */
    standardizeGenericResponse(rawResponse, mapping) {
        return this.mapFields(rawResponse, mapping.main || {});
    }

    /**
     * Map fields from source object using field mapping
     */
    mapFields(source, fieldMapping) {
        if (!source || !fieldMapping) return source;
        
        const mapped = { ...source };
        
        Object.entries(fieldMapping).forEach(([oldField, newField]) => {
            if (source.hasOwnProperty(oldField)) {
                mapped[newField] = source[oldField];
                if (oldField !== newField) {
                    delete mapped[oldField];
                }
            }
        });
        
        return mapped;
    }

    /**
     * Layer 2: Universal field standardization (vendor-agnostic)
     * This ensures consistent output format regardless of vendor
     */
    standardizeUniversalFields(data) {
        if (!data || typeof data !== 'object') return data;

        const standardized = { ...data };

        // Standardize dates
        ['startDate', 'endDate', 'shipDate', 'purchaseDate'].forEach(field => {
            if (standardized[field]) {
                standardized[field] = this.standardizeDate(standardized[field]);
            }
        });

        // Standardize booleans
        ['isActive', 'inWarranty'].forEach(field => {
            if (standardized[field] !== undefined) {
                standardized[field] = this.standardizeBoolean(standardized[field]);
            }
        });

        // Standardize strings
        ['model', 'warrantyType', 'status'].forEach(field => {
            if (standardized[field]) {
                standardized[field] = this.standardizeString(standardized[field]);
            }
        });

        return standardized;
    }

    /**
     * Standardize date values to ISO format (YYYY-MM-DD)
     */
    standardizeDate(dateValue) {
        if (!dateValue) return null;
        
        try {
            // Handle different date formats
            if (typeof dateValue === 'string') {
                // ISO format - already good
                if (this.dateFormats.iso.test(dateValue)) {
                    return dateValue;
                }
                
                // ISO with time - extract date part
                if (this.dateFormats.isoTime.test(dateValue)) {
                    return dateValue.split('T')[0];
                }
                
                // Unix timestamp (seconds)
                if (this.dateFormats.unix.test(dateValue)) {
                    return new Date(parseInt(dateValue) * 1000).toISOString().split('T')[0];
                }
                
                // Unix timestamp (milliseconds)
                if (this.dateFormats.unixMs.test(dateValue)) {
                    return new Date(parseInt(dateValue)).toISOString().split('T')[0];
                }
            }
            
            // Try to parse as Date object
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return null;
            
            return date.toISOString().split('T')[0];
        } catch (error) {
            console.warn(`Failed to standardize date: ${dateValue}`, error);
            return null;
        }
    }

    /**
     * Standardize boolean values
     */
    standardizeBoolean(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        
        if (typeof value === 'string') {
            const valueLower = value.toLowerCase().trim();
            if (this.booleanFormats.truthy.includes(valueLower)) return true;
            if (this.booleanFormats.falsy.includes(valueLower)) return false;
        }
        
        if (typeof value === 'number') {
            return value !== 0;
        }
        
        return Boolean(value);
    }

    /**
     * Standardize string values
     */
    standardizeString(value) {
        if (!value) return '';
        return String(value).trim();
    }

    /**
     * Add new vendor field mapping (for future API integrations)
     */
    addVendorMapping(vendor, mapping) {
        this.vendorFieldMappings[vendor.toLowerCase()] = mapping;
        console.log(`✅ Added field mapping for vendor: ${vendor}`);
    }

    /**
     * Get available vendor mappings
     */
    getAvailableVendors() {
        return Object.keys(this.vendorFieldMappings);
    }
}

// Export singleton instance
export const standardizationService = new StandardizationService();
