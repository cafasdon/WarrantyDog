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
 * WarrantyDog Data Standardization Service
 *
 * This service provides comprehensive data standardization for warranty information
 * across different vendor APIs. It handles the unpredictable nature of vendor API
 * responses and ensures consistent data format for the application.
 *
 * Features:
 * - Two-layer standardization approach
 * - Vendor-specific field mapping
 * - Universal data format conversion
 * - Robust error handling and fallbacks
 * - Extensible architecture for new vendors
 */

import type {
  VendorType,
  StandardizedWarrantyData,
  ValidationResult
} from './types/frontend';

interface FieldMapping {
  [oldField: string]: string;
}

interface VendorMapping {
  main: FieldMapping;
  warranty?: FieldMapping;
  error?: FieldMapping;
}

interface BooleanFormats {
  truthy: string[];
  falsy: string[];
}

interface DateFormats {
  patterns: RegExp[];
  formats: string[];
}

/**
 * Standardization Service Class
 */
class StandardizationService {
  private vendorFieldMappings: Record<VendorType, VendorMapping>;
  private booleanFormats: BooleanFormats;
  private dateFormats: DateFormats;

  constructor() {
    this.vendorFieldMappings = this.initializeVendorMappings();
    this.booleanFormats = this.initializeBooleanFormats();
    this.dateFormats = this.initializeDateFormats();
  }

  /**
   * Initialize vendor-specific field mappings
   */
  private initializeVendorMappings(): Record<VendorType, VendorMapping> {
    return {
      dell: {
        main: {
          'serviceTag': 'serialNumber',
          'productLineDescription': 'model',
          'serviceLevelDescription': 'serviceLevel',
          'entitlementType': 'warrantyType',
          'startDate': 'startDate',
          'endDate': 'endDate'
        },
        warranty: {
          'serviceLevelDescription': 'serviceLevel',
          'entitlementType': 'type',
          'startDate': 'startDate',
          'endDate': 'endDate'
        },
        error: {
          'ErrorCode': 'code',
          'ErrorMessage': 'message'
        }
      },
      lenovo: {
        main: {
          'Serial': 'serialNumber',
          'Type': 'model',
          'Start': 'startDate',
          'End': 'endDate',
          'Description': 'description',
          'Location': 'location'
        },
        warranty: {
          'Type': 'type',
          'Start': 'startDate',
          'End': 'endDate',
          'Description': 'description'
        },
        error: {
          'ErrorCode': 'code',
          'ErrorMessage': 'message'
        }
      },
      hp: {
        main: {
          'serialNumber': 'serialNumber',
          'productNumber': 'model',
          'warrantyStartDate': 'startDate',
          'warrantyEndDate': 'endDate',
          'contractType': 'warrantyType',
          'supportLevel': 'serviceLevel'
        }
      },
      microsoft: {
        main: {
          'serialNumber': 'serialNumber',
          'productName': 'model',
          'warrantyStart': 'startDate',
          'warrantyEnd': 'endDate'
        }
      },
      asus: {
        main: {
          'serialNumber': 'serialNumber',
          'model': 'model',
          'warrantyStartDate': 'startDate',
          'warrantyEndDate': 'endDate'
        }
      },
      unknown: {
        main: {}
      }
    };
  }

  /**
   * Initialize boolean format patterns
   */
  private initializeBooleanFormats(): BooleanFormats {
    return {
      truthy: ['true', 'yes', 'y', '1', 'active', 'enabled', 'on'],
      falsy: ['false', 'no', 'n', '0', 'inactive', 'disabled', 'off', 'expired']
    };
  }

  /**
   * Initialize date format patterns
   */
  private initializeDateFormats(): DateFormats {
    return {
      patterns: [
        /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY
        /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
        /^\d{2}\.\d{2}\.\d{4}$/,         // DD.MM.YYYY
        /^\d{4}\.\d{2}\.\d{2}$/          // YYYY.MM.DD
      ],
      formats: [
        'YYYY-MM-DD',
        'MM/DD/YYYY',
        'MM-DD-YYYY',
        'YYYY/MM/DD',
        'DD.MM.YYYY',
        'YYYY.MM.DD'
      ]
    };
  }

  /**
   * Layer 1: Standardize raw API response fields (vendor-specific)
   */
  standardizeRawApiResponse(vendor: VendorType, rawResponse: any): any {
    const vendorLower = vendor.toLowerCase() as VendorType;
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
        case 'asus':
          return this.standardizeAsusResponse(rawResponse, mapping);
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
  private standardizeDellResponse(rawResponse: any, mapping: VendorMapping): any {
    const standardized = this.mapFields(rawResponse, mapping.main);
    
    // Handle entitlements array
    if (rawResponse.entitlements && Array.isArray(rawResponse.entitlements)) {
      standardized.warranties = rawResponse.entitlements.map((entitlement: any) =>
        this.mapFields(entitlement, mapping.warranty || {})
      );
    }

    return standardized;
  }

  /**
   * Standardize Lenovo API response structure
   */
  private standardizeLenovoResponse(rawResponse: any, mapping: VendorMapping): any {
    const standardized = this.mapFields(rawResponse, mapping.main);
    
    // Handle error responses
    if (rawResponse.ErrorCode !== undefined) {
      standardized.error = this.mapFields({
        ErrorCode: rawResponse.ErrorCode,
        ErrorMessage: rawResponse.ErrorMessage
      }, mapping.error || {});
    }

    // Standardize warranty array
    if (rawResponse.Warranty && Array.isArray(rawResponse.Warranty)) {
      standardized.warranties = rawResponse.Warranty.map((warranty: any) =>
        this.mapFields(warranty, mapping.warranty || {})
      );
    }

    return standardized;
  }

  /**
   * Standardize HP API response structure
   */
  private standardizeHpResponse(rawResponse: any, mapping: VendorMapping): any {
    return this.mapFields(rawResponse, mapping.main);
  }

  /**
   * Standardize Microsoft API response structure
   */
  private standardizeMicrosoftResponse(rawResponse: any, mapping: VendorMapping): any {
    return this.mapFields(rawResponse, mapping.main);
  }

  /**
   * Standardize ASUS API response structure
   */
  private standardizeAsusResponse(rawResponse: any, mapping: VendorMapping): any {
    return this.mapFields(rawResponse, mapping.main);
  }

  /**
   * Generic response standardization for unknown vendors
   */
  private standardizeGenericResponse(rawResponse: any, mapping: VendorMapping): any {
    return this.mapFields(rawResponse, mapping.main || {});
  }

  /**
   * Map fields from source object using field mapping
   */
  private mapFields(source: any, fieldMapping: FieldMapping): any {
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
   */
  standardizeUniversalFields(data: any): StandardizedWarrantyData {
    if (!data || typeof data !== 'object') {
      return this.createEmptyStandardizedData();
    }

    const standardized: StandardizedWarrantyData = {
      serialNumber: data.serialNumber || data.serviceTag || '',
      vendor: data.vendor || 'unknown' as VendorType,
      warrantyStatus: 'unknown'
    };

    // Standardize optional fields
    if (data.model) standardized.model = String(data.model);
    if (data.startDate) standardized.startDate = this.standardizeDate(data.startDate);
    if (data.endDate) standardized.endDate = this.standardizeDate(data.endDate);
    if (data.serviceLevel) standardized.serviceLevel = String(data.serviceLevel);
    if (data.description) standardized.description = String(data.description);

    // Determine warranty status
    standardized.warrantyStatus = this.determineWarrantyStatus(data);
    standardized.isActive = standardized.warrantyStatus === 'active';

    // Calculate days remaining
    if (standardized.endDate) {
      standardized.daysRemaining = this.calculateDaysRemaining(standardized.endDate);
    }

    // Handle errors
    if (data.error) {
      standardized.error = {
        code: data.error.code,
        message: data.error.message || 'Unknown error'
      };
    }

    return standardized;
  }

  /**
   * Create empty standardized data structure
   */
  private createEmptyStandardizedData(): StandardizedWarrantyData {
    return {
      serialNumber: '',
      vendor: 'unknown' as VendorType,
      warrantyStatus: 'unknown'
    };
  }

  /**
   * Standardize date format
   */
  private standardizeDate(dateValue: any): string {
    if (!dateValue) return '';

    try {
      // If it's already a Date object
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }

      // If it's a string, try to parse it
      const dateStr = String(dateValue).trim();
      if (!dateStr) return '';

      // Try parsing as ISO date first
      const isoDate = new Date(dateStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString().split('T')[0];
      }

      // Try different date formats
      for (const pattern of this.dateFormats.patterns) {
        if (pattern.test(dateStr)) {
          const parsedDate = this.parseSpecificDateFormat(dateStr, pattern);
          if (parsedDate) {
            return parsedDate.toISOString().split('T')[0];
          }
        }
      }

      console.warn(`Unable to parse date: ${dateStr}`);
      return dateStr; // Return original if can't parse
    } catch (error) {
      console.warn(`Date standardization error:`, error);
      return String(dateValue);
    }
  }

  /**
   * Parse specific date format
   */
  private parseSpecificDateFormat(dateStr: string, pattern: RegExp): Date | null {
    try {
      if (pattern.source.includes('\\d{4}-\\d{2}-\\d{2}')) {
        // YYYY-MM-DD
        return new Date(dateStr);
      } else if (pattern.source.includes('\\d{2}\\/\\d{2}\\/\\d{4}')) {
        // MM/DD/YYYY
        const [month, day, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (pattern.source.includes('\\d{2}-\\d{2}-\\d{4}')) {
        // MM-DD-YYYY
        const [month, day, year] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (pattern.source.includes('\\d{4}\\/\\d{2}\\/\\d{2}')) {
        // YYYY/MM/DD
        const [year, month, day] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (pattern.source.includes('\\d{2}\\.\\d{2}\\.\\d{4}')) {
        // DD.MM.YYYY
        const [day, month, year] = dateStr.split('.');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (pattern.source.includes('\\d{4}\\.\\d{2}\\.\\d{2}')) {
        // YYYY.MM.DD
        const [year, month, day] = dateStr.split('.');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Standardize boolean values
   */
  private standardizeBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;

    const strValue = String(value).toLowerCase().trim();

    if (this.booleanFormats.truthy.includes(strValue)) return true;
    if (this.booleanFormats.falsy.includes(strValue)) return false;

    // Default to false for unknown values
    return false;
  }

  /**
   * Determine warranty status from data
   */
  private determineWarrantyStatus(data: any): 'active' | 'expired' | 'unknown' {
    // Check explicit status field
    if (data.warrantyStatus) {
      const status = String(data.warrantyStatus).toLowerCase();
      if (status.includes('active') || status.includes('valid')) return 'active';
      if (status.includes('expired') || status.includes('invalid')) return 'expired';
    }

    // Check end date
    if (data.endDate) {
      try {
        const endDate = new Date(data.endDate);
        const now = new Date();
        return endDate > now ? 'active' : 'expired';
      } catch (error) {
        console.warn('Error parsing end date for warranty status:', error);
      }
    }

    // Check boolean fields
    if (data.isActive !== undefined) {
      return this.standardizeBoolean(data.isActive) ? 'active' : 'expired';
    }

    if (data.inWarranty !== undefined) {
      return this.standardizeBoolean(data.inWarranty) ? 'active' : 'expired';
    }

    return 'unknown';
  }

  /**
   * Calculate days remaining until warranty expiration
   */
  private calculateDaysRemaining(endDate: string): number {
    try {
      const end = new Date(endDate);
      const now = new Date();
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch (error) {
      console.warn('Error calculating days remaining:', error);
      return 0;
    }
  }

  /**
   * Validate standardized warranty data
   */
  validateStandardizedData(data: StandardizedWarrantyData): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!data.serialNumber || data.serialNumber.trim() === '') {
      errors.push('Serial number is required');
    }

    if (!data.vendor || data.vendor === 'unknown') {
      errors.push('Vendor information is required');
    }

    // Date validation
    if (data.startDate && data.endDate) {
      try {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        if (start > end) {
          errors.push('Warranty start date cannot be after end date');
        }
      } catch (error) {
        errors.push('Invalid date format in warranty dates');
      }
    }

    // Warranty status validation
    const validStatuses = ['active', 'expired', 'unknown'];
    if (!validStatuses.includes(data.warrantyStatus)) {
      errors.push('Invalid warranty status');
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      message: errors.length === 0 ? 'Data is valid' : `Validation failed: ${errors.join('; ')}`
    };
  }

  /**
   * Complete standardization process (both layers)
   */
  standardizeWarrantyData(vendor: VendorType, rawResponse: any): StandardizedWarrantyData {
    try {
      console.log(`🔄 Starting complete standardization for ${vendor}...`);

      // Layer 1: Vendor-specific standardization
      const layer1Result = this.standardizeRawApiResponse(vendor, rawResponse);
      console.log(`✅ Layer 1 complete for ${vendor}`);

      // Layer 2: Universal standardization
      const layer2Result = this.standardizeUniversalFields(layer1Result);
      console.log(`✅ Layer 2 complete for ${vendor}`);

      // Validation
      const validation = this.validateStandardizedData(layer2Result);
      if (!validation.isValid) {
        console.warn(`⚠️ Validation warnings for ${vendor}:`, validation.error);
      }

      console.log(`🎉 Complete standardization finished for ${vendor}`);
      return layer2Result;

    } catch (error) {
      console.error(`❌ Standardization failed for ${vendor}:`, error);

      // Return minimal valid structure on error
      return {
        serialNumber: rawResponse?.serialNumber || rawResponse?.serviceTag || '',
        vendor,
        warrantyStatus: 'unknown',
        error: {
          message: `Standardization failed: ${(error as Error).message}`
        }
      };
    }
  }
}

// Create and export singleton instance
const standardizationService = new StandardizationService();

export { standardizationService, StandardizationService };
