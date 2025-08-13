/**
 * WarrantyDog API Type Definitions
 * Type safety for Express API endpoints and request/response handling
 */

import { Request, Response } from 'express';

// Vendor API Types
export type VendorType = 'dell' | 'lenovo' | 'hp' | 'microsoft' | 'asus';

export interface DellApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface LenovoApiCredentials {
  clientId: string;
  clientSecret: string;
}

// API Request/Response Types
export interface WarrantyApiRequest extends Request {
  params: {
    serviceTag?: string;
  };
  headers: {
    'x-dell-api-key'?: string;
    'x-dell-api-secret'?: string;
    'x-lenovo-client-id'?: string;
    'x-lenovo-client-secret'?: string;
  } & Request['headers'];
  body: {
    serialNumbers?: string[];
    vendor?: VendorType;
  } & Request['body'];
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
  timestamp?: string;
  requestId?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data: T;
  timestamp?: string;
  requestId?: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  message: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    api: 'operational' | 'degraded' | 'error';
    proxy: 'operational' | 'degraded' | 'error';
    database: 'ok' | 'degraded' | 'error';
  };
  database: {
    status: string;
    message: string;
    dbPath?: string;
    isInitialized?: boolean;
  };
}

export interface SessionCreateRequest {
  sessionId: string;
  fileName: string;
  devices: Array<{
    serialNumber: string;
    vendor: VendorType;
    model?: string;
    deviceName?: string;
    location?: string;
    originalData?: Record<string, unknown>;
  }>;
  options?: {
    strategy?: 'skip' | 'update' | 'replace';
    compareFields?: string[];
  };
}

export interface SessionResponse {
  sessionId: string;
  message: string;
  duplicateHandling?: {
    action: 'skip' | 'update' | 'insert';
    existingDevices: number;
    newDevices: number;
    updatedDevices: number;
    skippedDevices: number;
    duplicateStrategy: 'skip' | 'update' | 'replace';
  };
}

export interface DeviceUpdateRequest {
  deviceId: number;
  sessionId: string;
  warrantyData: {
    vendor: VendorType;
    serialNumber: string;
    model?: string;
    warrantyStatus: 'active' | 'expired' | 'unknown';
    warrantyStartDate?: string;
    warrantyEndDate?: string;
    warrantyDetails?: Record<string, unknown>;
    processingState: 'pending' | 'processing' | 'success' | 'error' | 'rate_limited';
    errorMessage?: string;
  };
}

export interface MetricsResponse {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    status: string;
    sessions: Record<string, number>;
    devices: Record<string, number>;
    totalAttempts: number;
  };
  api: {
    requests: {
      total: number;
      successful: number;
      failed: number;
      rateLimited: number;
    };
    vendors: Record<VendorType, {
      requests: number;
      successful: number;
      failed: number;
      avgResponseTime: number;
    }>;
  };
}

// Rate Limiting Types
export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

export interface RateLimitResponse extends ApiErrorResponse {
  rateLimitInfo: RateLimitInfo;
  retryAfter: number;
}

// Middleware Types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export interface RequestWithMetrics extends Request {
  startTime: number;
  requestId: string;
}

// Vendor-specific API Response Types
export interface DellWarrantyApiResponse {
  serviceTag: string;
  productCode?: string;
  model?: string;
  warrantyStatus: 'Active' | 'Expired' | 'Invalid';
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  serviceLevel?: string;
  description?: string;
  provider?: string;
}

export interface LenovoWarrantyApiResponse {
  serialNumber: string;
  machineType?: string;
  model?: string;
  warrantyStatus: 'In Warranty' | 'Out of Warranty' | 'Unknown';
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyType?: string;
  location?: string;
}

export interface HPWarrantyApiResponse {
  serialNumber: string;
  productNumber?: string;
  model?: string;
  warrantyStatus: 'Active' | 'Expired' | 'Unknown';
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  contractType?: string;
  supportLevel?: string;
}

// Raw API response types (before standardization)
export interface RawApiResponse {
  [key: string]: unknown;
}

export interface DellRawApiResponse extends RawApiResponse {
  entitlements?: Array<{
    serviceLevelDescription?: string;
    startDate?: string;
    endDate?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface LenovoRawApiResponse extends RawApiResponse {
  ErrorCode?: number;
  ErrorMessage?: string;
  Warranty?: Array<{
    Start?: string;
    End?: string;
    Type?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// Error Types
export interface ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
}

export interface ValidationError extends ApiError {
  field: string;
  value: unknown;
  constraint: string;
}

export interface RateLimitError extends ApiError {
  retryAfter: number;
  limit: number;
  current: number;
}

// Utility Types
export type ApiHandler<T = unknown> = (req: Request, res: Response) => Promise<T> | T;
export type ErrorHandler = (error: Error, req: Request, res: Response, next: Function) => void;
export type Middleware = (req: Request, res: Response, next: Function) => void;
