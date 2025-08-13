/**
 * WarrantyDog Frontend Type Definitions
 * Type safety for browser-based warranty checking application
 */

export type VendorType = 'dell' | 'lenovo' | 'hp' | 'microsoft' | 'asus' | 'unknown';
export type ProcessingState = 'pending' | 'processing' | 'success' | 'error' | 'skipped' | 'rate_limited';
export type WarrantyStatus = 'active' | 'expired' | 'unknown' | 'not_supported';

export interface DeviceData {
  serialNumber: string;
  vendor: VendorType;
  model?: string;
  deviceName?: string;
  location?: string;
  originalData?: Record<string, any>;
  isSupported?: boolean;
  apiConfigured?: boolean;
  processingState?: ProcessingState;
  warrantyStatus?: WarrantyStatus;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyDetails?: Record<string, any>;
  errorMessage?: string | undefined;
  lastProcessed?: string;
}

export interface CsvRow {
  [key: string]: string;
}

export interface ProcessingProgress {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  total: number;
  percentage: number;
}

export interface SessionData {
  sessionId: string;
  fileName: string;
  devices: DeviceData[];
  progress: ProcessingProgress;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface ResumeData {
  startIndex: number;
  successful: number;
  failed: number;
  skipped: number;
  retryMode?: boolean;
  retryDevices?: DeviceData[];
}

export interface DuplicateHandlingOptions {
  strategy?: 'skip' | 'update' | 'replace';
  compareFields?: string[];
}

export interface ApiKeyConfig {
  dell?: {
    apiKey: string;
    apiSecret: string;
  };
  lenovo?: {
    clientId: string;
    clientSecret?: string;
  };
  hp?: {
    apiKey: string;
  };
}

export interface WarrantyApiResponse {
  success: boolean;
  vendor: VendorType;
  serialNumber: string;
  model?: string;
  warrantyStatus: WarrantyStatus;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyDetails?: Record<string, any>;
  errorMessage?: string;
  rateLimited?: boolean;
  retryAfter?: number;
}

export interface StandardizedWarrantyData {
  serialNumber: string;
  vendor: VendorType;
  model?: string;
  warrantyStatus: WarrantyStatus;
  startDate?: string;
  endDate?: string;
  serviceLevel?: string;
  description?: string;
  isActive?: boolean;
  daysRemaining?: number;
  error?: {
    code?: string;
    message: string;
  };
}

export interface RateLimitInfo {
  vendor: VendorType;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

export interface ProcessingMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  totalDevices: number;
  processedDevices: number;
  successfulLookups: number;
  failedLookups: number;
  rateLimitedLookups: number;
  averageResponseTime: number;
  vendorBreakdown: Record<VendorType, {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
  }>;
}

export interface UIElements {
  fileInput: HTMLInputElement;
  dropZone: HTMLElement;
  fileInfo: HTMLElement;
  processBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  retryFailedBtn: HTMLButtonElement;
  progressContainer: HTMLElement;
  progressBar: HTMLElement;
  progressText: HTMLElement;
  statusText: HTMLElement;
  resultsContainer: HTMLElement;
  resultsTable: HTMLTableElement;
  exportBtn: HTMLButtonElement;
  configBtn: HTMLButtonElement;
  configModal: HTMLElement;
  saveConfigBtn: HTMLButtonElement;
  dellApiKeyInput: HTMLInputElement;
  dellApiSecretInput: HTMLInputElement;
  lenovoClientIdInput: HTMLInputElement;
  testDellApiBtn: HTMLButtonElement;
  testLenovoApiBtn: HTMLButtonElement;
  testResultElement: HTMLElement;
  dellStatusElement: HTMLElement;
  lenovoStatusElement: HTMLElement;
}

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string;
  suggestions?: string[];
}

export interface ApiTestScenario {
  description: string;
  success: boolean;
  error?: string;
  delay?: number;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeRawData: boolean;
  includeErrorDetails: boolean;
  filterByStatus?: WarrantyStatus[];
}

export interface CacheEntry {
  vendor: VendorType;
  serialNumber: string;
  data: StandardizedWarrantyData;
  timestamp: number;
  maxAge: number;
}

// Window interface extensions for global objects
declare global {
  interface Window {
    warrantyChecker: any;
    sessionService: any;
    Papa: any; // PapaParse library
  }
}

// Event handler types
export type EventHandler<T = Event> = (event: T) => void | Promise<void>;
export type ProgressCallback = (progress: ProcessingProgress) => void;
export type ErrorCallback = (error: Error, context?: string) => void;
export type SuccessCallback = (message: string, data?: any) => void;

// Utility types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Forward declarations for classes that will be converted
export interface WarrantyChecker {
  warrantyService: WarrantyLookupService;
  csvData: DeviceData[];
  processedResults: StandardizedWarrantyData[];
  isProcessing: boolean;
  processingCancelled: boolean;
  currentIndex: number;
  sessionId: string | null;
  sessionKey: string;
  
  // Methods
  initializeElements(): void;
  bindEvents(): void;
  loadApiKeys(): void;
  processDevices(): Promise<void>;
  exportResults(): void;
  showError(message: string): void;
  showSuccess(message: string): void;
}

export interface WarrantyLookupService {
  apis: Record<VendorType, any>;
  lookupWarranty(vendor: VendorType, serialNumber: string): Promise<WarrantyApiResponse>;
  testConnection(vendor: VendorType): Promise<TestResult>;
}

export interface ISessionService {
  currentSessionId: string | null;
  generateSessionId(): string;
  createSession(data: any, options?: DuplicateHandlingOptions): Promise<any>;
  updateSessionProgress(sessionId: string, progress: Partial<ProcessingProgress>): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
}

export interface StandardizationService {
  standardizeRawApiResponse(vendor: VendorType, rawResponse: any): StandardizedWarrantyData;
  standardizeUniversalFields(data: any): StandardizedWarrantyData;
  validateStandardizedData(data: StandardizedWarrantyData): ValidationResult;
}
