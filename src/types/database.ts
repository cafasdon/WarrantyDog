/**
 * WarrantyDog Database Type Definitions
 * Comprehensive type safety for SQLite database operations
 */

export interface Session {
  id: string;
  file_name: string;
  fileName?: string; // Alias for compatibility
  total_devices: number;
  totalDevices?: number; // Alias for compatibility
  created_at: string;
  createdAt?: string; // Alias for compatibility
  updated_at: string;
  updatedAt?: string; // Alias for compatibility
  status: 'active' | 'completed' | 'cancelled';
}

export interface Device {
  id: number;
  session_id: string;
  sessionId?: string; // Alias for compatibility
  serial_number: string;
  serialNumber?: string; // Alias for compatibility
  vendor: string;
  model?: string;
  device_name?: string;
  deviceName?: string; // Alias for compatibility
  location?: string;
  original_data?: string; // JSON string
  originalData?: string; // Alias for compatibility
  warranty_status?: 'active' | 'expired' | 'unknown' | 'not_supported';
  warrantyStatus?: 'active' | 'expired' | 'unknown' | 'not_supported'; // Alias for compatibility
  warranty_start_date?: string;
  warrantyStartDate?: string; // Alias for compatibility
  warranty_end_date?: string;
  warrantyEndDate?: string; // Alias for compatibility
  warranty_details?: string; // JSON string
  warrantyDetails?: string; // Alias for compatibility
  last_checked?: string;
  lastChecked?: string; // Alias for compatibility
  last_processed_at?: string;
  created_at: string;
  createdAt?: string; // Alias for compatibility
  updated_at: string;
  updatedAt?: string; // Alias for compatibility
}

export interface ApiResponse {
  id: number;
  sessionId: string;
  serialNumber: string;
  vendor: string;
  rawResponse: string; // JSON string
  responseStatus: 'success' | 'error' | 'rate_limited';
  errorMessage?: string;
  createdAt: string;
}

export interface SessionStats {
  sessionId: string;
  totalDevices: number;
  processedDevices: number;
  successfulLookups: number;
  failedLookups: number;
  rateLimitedLookups: number;
  lastProcessedAt?: string;
}

export interface DatabaseHealth {
  status: 'ok' | 'error' | 'degraded';
  message: string;
  dbPath?: string;
  isInitialized?: boolean;
}

export interface DuplicateHandlingResult {
  action: 'skip' | 'update' | 'insert';
  existingDevices: number;
  newDevices: number;
  updatedDevices: number;
  skippedDevices: number;
  duplicateStrategy: 'skip' | 'update' | 'replace';
}

export interface DuplicateHandlingOptions {
  strategy?: 'skip' | 'update' | 'replace';
  compareFields?: string[];
}

// Vendor-specific warranty response types
export interface DellWarrantyResponse {
  serviceTag: string;
  model?: string;
  warrantyStatus: 'active' | 'expired' | 'unknown';
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyDetails?: {
    serviceLevel?: string;
    description?: string;
    provider?: string;
  };
}

export interface LenovoWarrantyResponse {
  serialNumber: string;
  model?: string;
  warrantyStatus: 'active' | 'expired' | 'unknown';
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyDetails?: {
    type?: string;
    description?: string;
    location?: string;
  };
}

export interface HPWarrantyResponse {
  serialNumber: string;
  model?: string;
  warrantyStatus: 'active' | 'expired' | 'unknown';
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyDetails?: {
    contractType?: string;
    supportLevel?: string;
    description?: string;
  };
}

export type VendorWarrantyResponse = DellWarrantyResponse | LenovoWarrantyResponse | HPWarrantyResponse;

// Database query result types
export interface DeviceQueryResult extends Device {
  // Additional computed fields that might be added in queries
  daysSinceLastCheck?: number;
  warrantyDaysRemaining?: number;
}

export interface SessionQueryResult extends Session {
  // Additional computed fields
  deviceCount?: number;
  completionPercentage?: number;
}

// Migration types
export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
  appliedAt?: string;
}

export interface MigrationStatus {
  currentVersion: number;
  pendingMigrations: Migration[];
  appliedMigrations: Migration[];
}
