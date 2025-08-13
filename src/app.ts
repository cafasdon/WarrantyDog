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
 * WarrantyDog Main Application
 *
 * Browser-based warranty checker with CSV processing and real-time progress tracking.
 * Supports Dell API with plans for Lenovo and HP integration.
 */

import { WarrantyLookupService } from './vendorApis';
import { standardizationService } from './standardizationService';
import type {
  DeviceData,
  CsvRow,
  ProcessingProgress,
  SessionData,
  ResumeData,
  DuplicateHandlingOptions,
  ApiKeyConfig,
  WarrantyApiResponse,
  StandardizedWarrantyData,
  ProcessingMetrics,
  UIElements,
  TestResult,
  ValidationResult,
  ExportOptions,
  VendorType,
  ProcessingState,
  WarrantyStatus,
  EventHandler,
  ProgressCallback,
  ErrorCallback,
  SuccessCallback
} from './types/frontend';

/**
 * Main WarrantyChecker Application Class
 */
class WarrantyChecker {
  public warrantyService: WarrantyLookupService;
  public csvData: DeviceData[] = [];
  public processedResults: StandardizedWarrantyData[] = [];
  public isProcessing: boolean = false;
  public processingCancelled: boolean = false;
  public currentIndex: number = 0;

  // Session management for resume functionality
  public sessionId: string | null = null;
  public sessionKey: string = 'warrantydog_session';

  // UI Elements
  private elements: Partial<UIElements> = {};
  
  // Processing state
  private processingStartTime: number = 0;
  private resumeData: ResumeData | null = null;
  private duplicateHandlingOptions: DuplicateHandlingOptions = {};
  private uniqueDevices: DeviceData[] | null = null;
  private metrics: ProcessingMetrics | null = null;

  // Configuration
  private apiConfig: ApiKeyConfig = {};

  constructor() {
    this.warrantyService = new WarrantyLookupService();
    
    this.initializeElements();
    this.initializeProcessingState();
    this.bindEvents();
    this.loadApiKeys();
    this.initializeSessionService();
  }

  /**
   * Initialize DOM element references
   */
  private initializeElements(): void {
    const elementIds = {
      fileInput: 'csvFile',
      dropZone: 'dropZone',
      fileInfo: 'fileInfo',
      processBtn: 'processBtn',
      cancelBtn: 'cancelBtn',
      retryFailedBtn: 'retryFailedBtn',
      progressContainer: 'progressContainer',
      progressBar: 'progressBar',
      progressText: 'progressText',
      statusText: 'statusText',
      resultsContainer: 'resultsContainer',
      resultsTable: 'resultsTable',
      exportBtn: 'exportBtn',
      configBtn: 'configBtn',
      configModal: 'configModal',
      saveConfigBtn: 'saveConfigBtn',
      dellApiKeyInput: 'dellApiKey',
      dellApiSecretInput: 'dellApiSecret',
      lenovoClientIdInput: 'lenovoClientId',
      testDellApiBtn: 'testDellApi',
      testLenovoApiBtn: 'testLenovoApi',
      testResultElement: 'testResult',
      dellStatusElement: 'dellStatus',
      lenovoStatusElement: 'lenovoStatus'
    };

    // Get all elements and store references
    Object.entries(elementIds).forEach(([key, id]) => {
      const element = document.getElementById(id);
      if (element) {
        (this.elements as any)[key] = element;
      } else {
        console.warn(`Element not found: ${id}`);
      }
    });

    // Validate critical elements
    this.validateCriticalElements();
  }

  /**
   * Validate that critical UI elements are present
   */
  private validateCriticalElements(): void {
    const critical = ['fileInput', 'processBtn', 'progressContainer', 'resultsContainer'];
    const missing = critical.filter(key => !this.elements[key as keyof UIElements]);
    
    if (missing.length > 0) {
      console.error('Critical UI elements missing:', missing);
      this.showError(`Critical UI elements missing: ${missing.join(', ')}`);
    }
  }

  /**
   * Initialize processing state from localStorage
   */
  private initializeProcessingState(): void {
    try {
      const savedState = localStorage.getItem(this.sessionKey);
      if (savedState) {
        const state = JSON.parse(savedState);
        this.sessionId = state.sessionId;
        this.resumeData = state.resumeData;
        console.log('Restored processing state:', state);
      }
    } catch (error) {
      console.warn('Failed to restore processing state:', error);
      localStorage.removeItem(this.sessionKey);
    }
  }

  /**
   * Bind event handlers to UI elements
   */
  private bindEvents(): void {
    // File input events
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }

    // Drag and drop events
    if (this.elements.dropZone) {
      this.elements.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
      this.elements.dropZone.addEventListener('drop', this.handleFileDrop.bind(this));
      this.elements.dropZone.addEventListener('click', () => {
        this.elements.fileInput?.click();
      });
    }

    // Processing control events
    if (this.elements.processBtn) {
      this.elements.processBtn.addEventListener('click', this.startProcessing.bind(this));
    }

    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.addEventListener('click', this.cancelProcessing.bind(this));
    }

    if (this.elements.retryFailedBtn) {
      this.elements.retryFailedBtn.addEventListener('click', this.retryFailedDevices.bind(this));
    }

    // Export and configuration events
    if (this.elements.exportBtn) {
      this.elements.exportBtn.addEventListener('click', this.exportResults.bind(this));
    }

    if (this.elements.configBtn) {
      this.elements.configBtn.addEventListener('click', this.openConfigModal.bind(this));
    }

    if (this.elements.saveConfigBtn) {
      this.elements.saveConfigBtn.addEventListener('click', this.saveConfiguration.bind(this));
    }

    // API testing events
    if (this.elements.testDellApiBtn) {
      this.elements.testDellApiBtn.addEventListener('click', this.testDellApi.bind(this));
    }

    if (this.elements.testLenovoApiBtn) {
      this.elements.testLenovoApiBtn.addEventListener('click', this.testLenovoApi.bind(this));
    }

    // Modal close events
    document.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('modal')) {
        this.closeModal(target);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  /**
   * Load API keys from localStorage
   */
  private loadApiKeys(): void {
    try {
      // Load Dell API configuration
      const dellApiKey = localStorage.getItem('dell_api_key');
      const dellApiSecret = localStorage.getItem('dell_api_secret');
      
      if (dellApiKey && dellApiSecret) {
        this.apiConfig.dell = {
          apiKey: dellApiKey,
          apiSecret: dellApiSecret
        };
        
        if (this.elements.dellApiKeyInput) {
          (this.elements.dellApiKeyInput as HTMLInputElement).value = dellApiKey;
        }
        if (this.elements.dellApiSecretInput) {
          (this.elements.dellApiSecretInput as HTMLInputElement).value = dellApiSecret;
        }
      }

      // Load Lenovo API configuration
      const lenovoClientId = localStorage.getItem('lenovo_client_id');
      
      if (lenovoClientId) {
        this.apiConfig.lenovo = {
          clientId: lenovoClientId
        };
        
        if (this.elements.lenovoClientIdInput) {
          (this.elements.lenovoClientIdInput as HTMLInputElement).value = lenovoClientId;
        }
      }

      this.updateApiStatusIndicators();
    } catch (error) {
      console.warn('Failed to load API keys:', error);
    }
  }

  /**
   * Initialize session service
   */
  private initializeSessionService(): void {
    if (typeof window !== 'undefined' && window.sessionService) {
      console.log('Session service initialized');
    } else {
      console.warn('Session service not available');
    }
  }

  /**
   * Handle file selection from input
   */
  private async handleFileSelect(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      await this.processFile(file);
    }
  }

  /**
   * Handle drag over event
   */
  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.elements.dropZone) {
      this.elements.dropZone.classList.add('drag-over');
    }
  }

  /**
   * Handle file drop event
   */
  private async handleFileDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.elements.dropZone) {
      this.elements.dropZone.classList.remove('drag-over');
    }

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        await this.processFile(file);
      }
    }
  }

  /**
   * Process uploaded CSV file
   */
  private async processFile(file: File): Promise<void> {
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please select a CSV file');
      }

      this.showInfo(`📁 Loading file: ${file.name} (${this.formatFileSize(file.size)})`);

      const text = await this.readFileAsText(file);
      await this.parseCsvData(text, file.name);

    } catch (error) {
      this.showError(`❌ File processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Read file as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse CSV data using PapaParse
   */
  private async parseCsvData(csvText: string, fileName: string): Promise<void> {
    try {
      if (!window.Papa) {
        throw new Error('CSV parser not available');
      }

      const parseResult = window.Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });

      if (parseResult.errors.length > 0) {
        console.warn('CSV parsing warnings:', parseResult.errors);
      }

      const rawData = parseResult.data as CsvRow[];
      const validDevices = this.extractDevicesFromCsv(rawData);

      if (validDevices.length === 0) {
        throw new Error('No valid devices found in CSV. Please check the format.');
      }

      this.csvData = validDevices;
      this.updateFileInfo(fileName, validDevices.length);
      this.showSuccess(`✅ CSV loaded successfully! Found ${validDevices.length} valid devices.`);

      // Stage 1: Check for duplicates and display devices
      await this.checkDuplicatesAndDisplayDevices(validDevices);

      // Stage 2: Load any existing cached warranty data
      await this.loadCachedWarrantyData(validDevices);

      if (this.elements.processBtn) {
        (this.elements.processBtn as HTMLButtonElement).disabled = false;
      }
    } catch (error) {
      throw new Error(`CSV parsing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract device data from CSV rows
   */
  private extractDevicesFromCsv(rawData: CsvRow[]): DeviceData[] {
    const devices: DeviceData[] = [];

    rawData.forEach((row, index) => {
      try {
        const device = this.parseDeviceFromRow(row, index);
        if (device) {
          devices.push(device);
        }
      } catch (error) {
        console.warn(`Skipping row ${index + 1}:`, error);
      }
    });

    return devices;
  }

  /**
   * Parse individual device from CSV row
   */
  private parseDeviceFromRow(row: CsvRow, index: number): DeviceData | null {
    // Try to find serial number in various column names
    const serialNumber = this.findValueInRow(row, [
      'serial', 'serialnumber', 'serial_number', 'servicetag', 'service_tag', 'asset_tag'
    ]);

    if (!serialNumber) {
      console.warn(`Row ${index + 1}: No serial number found`);
      return null;
    }

    // Try to find vendor
    const vendor = this.findValueInRow(row, [
      'vendor', 'manufacturer', 'make', 'brand'
    ]);

    if (!vendor) {
      console.warn(`Row ${index + 1}: No vendor found for ${serialNumber}`);
      return null;
    }

    const normalizedVendor = this.normalizeVendor(vendor);
    const isSupported = this.isVendorSupported(normalizedVendor);
    const apiConfigured = this.isApiConfigured(normalizedVendor);

    return {
      serialNumber: serialNumber.trim().toUpperCase(),
      vendor: normalizedVendor,
      model: this.findValueInRow(row, ['model', 'product', 'product_name']) || undefined,
      deviceName: this.findValueInRow(row, ['name', 'device_name', 'hostname', 'computer_name']) || undefined,
      location: this.findValueInRow(row, ['location', 'site', 'building', 'department']) || undefined,
      originalData: row,
      isSupported,
      apiConfigured,
      processingState: 'pending'
    };
  }

  /**
   * Find value in row using multiple possible column names
   */
  private findValueInRow(row: CsvRow, possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      const value = row[name] || row[name.toLowerCase()] || row[name.toUpperCase()];
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  /**
   * Normalize vendor name
   */
  private normalizeVendor(vendor: string): VendorType {
    const normalized = vendor.toLowerCase().trim();

    if (normalized.includes('dell')) return 'dell';
    if (normalized.includes('lenovo')) return 'lenovo';
    if (normalized.includes('hp') || normalized.includes('hewlett')) return 'hp';
    if (normalized.includes('microsoft')) return 'microsoft';
    if (normalized.includes('asus')) return 'asus';

    // Default to the original value if no match
    return normalized as VendorType;
  }

  /**
   * Check if vendor is supported
   */
  private isVendorSupported(vendor: VendorType): boolean {
    return ['dell', 'lenovo', 'hp'].includes(vendor);
  }

  /**
   * Check if API is configured for vendor
   */
  private isApiConfigured(vendor: VendorType): boolean {
    switch (vendor) {
      case 'dell':
        return !!(this.apiConfig.dell?.apiKey && this.apiConfig.dell?.apiSecret);
      case 'lenovo':
        return !!(this.apiConfig.lenovo?.clientId);
      case 'hp':
        return !!(this.apiConfig.hp?.apiKey);
      default:
        return false;
    }
  }

  /**
   * Update file info display
   */
  private updateFileInfo(fileName: string, deviceCount: number): void {
    if (this.elements.fileInfo) {
      this.elements.fileInfo.textContent = `${fileName} (${deviceCount} devices)`;
      this.elements.fileInfo.style.display = 'block';
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check for duplicates and display devices
   */
  private async checkDuplicatesAndDisplayDevices(devices: DeviceData[]): Promise<void> {
    try {
      // Check for duplicates if session service is available
      if (window.sessionService) {
        const duplicateInfo = await this.checkForDuplicates(devices);
        if (duplicateInfo.duplicates.length > 0) {
          await this.handleDuplicates(duplicateInfo);
        }
      }

      // Display all devices in the table
      this.displayDevicesInTable(devices);

    } catch (error) {
      console.warn('Duplicate checking failed:', error);
      // Continue with normal display
      this.displayDevicesInTable(devices);
    }
  }

  /**
   * Check for duplicate devices
   */
  private async checkForDuplicates(devices: DeviceData[]): Promise<any> {
    // This would call the session service to check for duplicates
    // For now, return empty duplicates
    return {
      duplicates: [],
      fresh: devices
    };
  }

  /**
   * Handle duplicate devices
   */
  private async handleDuplicates(duplicateInfo: any): Promise<void> {
    // Implementation for handling duplicates
    console.log('Handling duplicates:', duplicateInfo);
  }

  /**
   * Display devices in results table
   */
  private displayDevicesInTable(devices: DeviceData[]): void {
    if (!this.elements.resultsTable) return;

    const table = this.elements.resultsTable as HTMLTableElement;

    // Clear existing content
    table.innerHTML = '';

    // Create header
    const header = this.createTableHeader();
    table.appendChild(header);

    // Create rows for each device
    devices.forEach((device, index) => {
      const row = this.createDeviceRow(device, index);
      table.appendChild(row);
    });

    // Show results container
    if (this.elements.resultsContainer) {
      this.elements.resultsContainer.style.display = 'block';
    }
  }

  /**
   * Create table header
   */
  private createTableHeader(): HTMLTableRowElement {
    const headerRow = document.createElement('tr');
    const headers = [
      'Serial Number', 'Vendor', 'Model', 'Device Name', 'Location',
      'Warranty Status', 'Start Date', 'End Date', 'Status'
    ];

    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });

    return headerRow;
  }

  /**
   * Create device row
   */
  private createDeviceRow(device: DeviceData, index: number): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.id = `device-row-${index}`;

    const cells = [
      device.serialNumber,
      device.vendor,
      device.model || '',
      device.deviceName || '',
      device.location || '',
      device.warrantyStatus || '',
      device.warrantyStartDate || '',
      device.warrantyEndDate || '',
      this.getStatusDisplay(device)
    ];

    cells.forEach(cellText => {
      const td = document.createElement('td');
      td.textContent = cellText;
      row.appendChild(td);
    });

    // Add status class
    row.className = `status-${device.processingState || 'pending'}`;

    return row;
  }

  /**
   * Get status display text
   */
  private getStatusDisplay(device: DeviceData): string {
    if (!device.isSupported) return 'Not Supported';
    if (!device.apiConfigured) return 'API Not Configured';

    switch (device.processingState) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing...';
      case 'success': return 'Complete';
      case 'error': return 'Error';
      case 'skipped': return 'Skipped';
      case 'rate_limited': return 'Rate Limited';
      default: return 'Unknown';
    }
  }

  /**
   * Load cached warranty data
   */
  private async loadCachedWarrantyData(devices: DeviceData[]): Promise<void> {
    try {
      // Implementation for loading cached data
      console.log('Loading cached warranty data for', devices.length, 'devices');
    } catch (error) {
      console.warn('Failed to load cached warranty data:', error);
    }
  }

  /**
   * Process devices (alias for startProcessing for interface compatibility)
   */
  public async processDevices(): Promise<void> {
    return this.startProcessing();
  }

  /**
   * Start warranty processing
   */
  public async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.warn('Processing already in progress');
      return;
    }

    try {
      this.isProcessing = true;
      this.processingCancelled = false;
      this.processingStartTime = Date.now();

      this.updateProcessingUI(true);
      this.showInfo('🚀 Starting warranty lookup process...');

      await this.processDevicesSequential();

    } catch (error) {
      this.showError(`❌ Processing failed: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
      this.updateProcessingUI(false);
    }
  }

  /**
   * Cancel processing
   */
  public cancelProcessing(): void {
    if (!this.isProcessing) return;

    this.processingCancelled = true;
    this.showInfo('⏹️ Processing cancelled by user');
  }

  /**
   * Update processing UI state
   */
  private updateProcessingUI(processing: boolean): void {
    if (this.elements.processBtn) {
      (this.elements.processBtn as HTMLButtonElement).disabled = processing;
      (this.elements.processBtn as HTMLButtonElement).textContent = processing ? 'Processing...' : 'Start Processing';
    }

    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.style.display = processing ? 'inline-block' : 'none';
    }

    if (this.elements.progressContainer) {
      this.elements.progressContainer.style.display = processing ? 'block' : 'none';
    }
  }

  /**
   * Process devices sequentially
   */
  private async processDevicesSequential(): Promise<void> {
    const allDevices = this.getValidDevicesFromCsv();
    const processableDevices = allDevices.filter(device => device.isSupported && device.apiConfigured);
    const skippedDevices = allDevices.filter(device => !device.isSupported || !device.apiConfigured);

    console.log(`🔄 Starting sequential processing: ${processableDevices.length} devices to process, ${skippedDevices.length} to skip`);

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = skippedDevices.length;

    // Mark skipped devices
    skippedDevices.forEach(device => {
      device.processingState = 'skipped';
      this.updateDeviceRowStatus(device);
    });

    // Process each device
    for (let i = 0; i < processableDevices.length; i++) {
      if (this.processingCancelled) {
        break;
      }

      const device = processableDevices[i];
      if (!device) continue;

      this.currentIndex = i;

      try {
        console.log(`📡 Processing ${device.serialNumber} (${device.vendor})`);
        device.processingState = 'processing';
        this.updateDeviceRowStatus(device);

        const apiResult = await this.warrantyService.lookupWarranty(device.vendor, device.serialNumber);

        if (apiResult.success) {
          device.processingState = 'success';
          device.warrantyStatus = apiResult.warrantyStatus;
          device.warrantyStartDate = apiResult.warrantyStartDate;
          device.warrantyEndDate = apiResult.warrantyEndDate;
          device.warrantyDetails = apiResult.warrantyDetails;
          successful++;
        } else {
          device.processingState = 'error';
          device.errorMessage = apiResult.errorMessage;
          failed++;
        }

      } catch (error) {
        console.error(`Error processing ${device.serialNumber}:`, error);
        device.processingState = 'error';
        device.errorMessage = (error as Error).message;
        failed++;
      }

      processed++;
      this.updateDeviceRowStatus(device);
      this.updateProgress(processed, successful, failed, skipped, processableDevices.length + skippedDevices.length);

      // Save progress periodically
      if (processed % 10 === 0) {
        await this.saveSession(allDevices, processed, successful, failed, skipped);
      }

      // Add delay to avoid overwhelming APIs
      await this.delay(1000);
    }

    // Final save
    await this.saveSession(allDevices, processed, successful, failed, skipped);

    this.showProcessingComplete(processed, successful, failed, skipped);
  }

  /**
   * Get valid devices from CSV data
   */
  private getValidDevicesFromCsv(): DeviceData[] {
    return this.uniqueDevices || this.csvData;
  }

  /**
   * Update device row status in table
   */
  private updateDeviceRowStatus(device: DeviceData): void {
    const deviceIndex = this.csvData.findIndex(d => d.serialNumber === device.serialNumber);
    if (deviceIndex === -1) return;

    const row = document.getElementById(`device-row-${deviceIndex}`) as HTMLTableRowElement;
    if (!row) return;

    // Update status cell
    const statusCell = row.cells[8]; // Status is the 9th column (0-indexed)
    if (statusCell) {
      statusCell.textContent = this.getStatusDisplay(device);
    }

    // Update warranty cells if available
    if (device.warrantyStatus) {
      const warrantyStatusCell = row.cells[5];
      if (warrantyStatusCell) {
        warrantyStatusCell.textContent = device.warrantyStatus;
      }
    }

    if (device.warrantyStartDate) {
      const startDateCell = row.cells[6];
      if (startDateCell) {
        startDateCell.textContent = device.warrantyStartDate;
      }
    }

    if (device.warrantyEndDate) {
      const endDateCell = row.cells[7];
      if (endDateCell) {
        endDateCell.textContent = device.warrantyEndDate;
      }
    }

    // Update row class
    row.className = `status-${device.processingState}`;
  }

  /**
   * Update progress display
   */
  private updateProgress(processed: number, successful: number, failed: number, skipped: number, total: number): void {
    const percentage = Math.round((processed / total) * 100);

    if (this.elements.progressBar) {
      (this.elements.progressBar as HTMLElement).style.width = `${percentage}%`;
    }

    if (this.elements.progressText) {
      this.elements.progressText.textContent = `${processed}/${total} (${percentage}%)`;
    }

    if (this.elements.statusText) {
      this.elements.statusText.textContent = `✅ ${successful} successful, ❌ ${failed} failed, ⏭️ ${skipped} skipped`;
    }
  }

  /**
   * Save session progress
   */
  private async saveSession(devices: DeviceData[], processed: number, successful: number, failed: number, skipped: number): Promise<void> {
    try {
      if (!window.sessionService) return;

      if (!this.sessionId) {
        this.sessionId = this.generateSessionId();
        await window.sessionService.createSession({
          sessionId: this.sessionId,
          fileName: this.elements.fileInfo?.textContent || 'Unknown',
          devices: devices
        }, this.duplicateHandlingOptions);
      }

      await window.sessionService.updateSessionProgress(this.sessionId, {
        processed,
        successful,
        failed,
        skipped
      });

    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Show processing complete message
   */
  private showProcessingComplete(processed: number, successful: number, failed: number, skipped: number): void {
    const duration = Date.now() - this.processingStartTime;
    const durationText = this.formatDuration(duration);

    this.showSuccess(`🎉 Processing complete! ${successful} successful, ${failed} failed, ${skipped} skipped in ${durationText}`);

    // Show retry button if there are failed devices
    if (failed > 0 && this.elements.retryFailedBtn) {
      this.elements.retryFailedBtn.style.display = 'inline-block';
    }

    // Enable export button
    if (this.elements.exportBtn) {
      (this.elements.exportBtn as HTMLButtonElement).disabled = false;
    }
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          if (!this.isProcessing) {
            this.exportResults();
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (!this.isProcessing && this.csvData.length > 0) {
            this.startProcessing();
          }
          break;
      }
    }

    if (event.key === 'Escape') {
      // Close any open modals
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        if ((modal as HTMLElement).style.display === 'block') {
          this.closeModal(modal as HTMLElement);
        }
      });
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.showMessage(message, 'error');
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.showMessage(message, 'success');
  }

  /**
   * Show info message
   */
  private showInfo(message: string): void {
    this.showMessage(message, 'info');
  }

  /**
   * Show message with type
   */
  private showMessage(message: string, type: 'error' | 'success' | 'info'): void {
    // Create or update status message element
    let statusElement = document.getElementById('status-message');

    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'status-message';
      statusElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        max-width: 400px;
        word-wrap: break-word;
      `;
      document.body.appendChild(statusElement);
    }

    // Set message and styling based on type
    statusElement.textContent = message;

    switch (type) {
      case 'error':
        statusElement.style.backgroundColor = '#dc3545';
        break;
      case 'success':
        statusElement.style.backgroundColor = '#28a745';
        break;
      case 'info':
        statusElement.style.backgroundColor = '#17a2b8';
        break;
    }

    statusElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (statusElement) {
        statusElement.style.display = 'none';
      }
    }, 5000);

    // Also log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Export results to CSV
   */
  public exportResults(): void {
    try {
      const csvContent = this.generateCsvContent();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `warranty_results_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      this.showSuccess('✅ Results exported successfully!');
    } catch (error) {
      this.showError(`❌ Export failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate CSV content for export
   */
  private generateCsvContent(): string {
    const headers = [
      'Serial Number', 'Vendor', 'Model', 'Device Name', 'Location',
      'Warranty Status', 'Warranty Start Date', 'Warranty End Date',
      'Processing Status', 'Error Message'
    ];

    const rows = this.csvData.map(device => [
      device.serialNumber,
      device.vendor,
      device.model || '',
      device.deviceName || '',
      device.location || '',
      device.warrantyStatus || '',
      device.warrantyStartDate || '',
      device.warrantyEndDate || '',
      device.processingState || '',
      device.errorMessage || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Open configuration modal
   */
  private openConfigModal(): void {
    if (this.elements.configModal) {
      this.elements.configModal.style.display = 'block';
    }
  }

  /**
   * Close modal
   */
  private closeModal(modal: HTMLElement): void {
    modal.style.display = 'none';
  }

  /**
   * Save configuration
   */
  private async saveConfiguration(): Promise<void> {
    try {
      if (this.elements.saveConfigBtn) {
        (this.elements.saveConfigBtn as HTMLButtonElement).disabled = true;
        (this.elements.saveConfigBtn as HTMLButtonElement).textContent = 'Saving...';
      }

      // Save Dell API configuration
      const dellApiKey = (this.elements.dellApiKeyInput as HTMLInputElement)?.value?.trim();
      const dellApiSecret = (this.elements.dellApiSecretInput as HTMLInputElement)?.value?.trim();

      if (dellApiKey && dellApiSecret) {
        localStorage.setItem('dell_api_key', dellApiKey);
        localStorage.setItem('dell_api_secret', dellApiSecret);
        this.apiConfig.dell = { apiKey: dellApiKey, apiSecret: dellApiSecret };
      }

      // Save Lenovo API configuration
      const lenovoClientId = (this.elements.lenovoClientIdInput as HTMLInputElement)?.value?.trim();

      if (lenovoClientId) {
        localStorage.setItem('lenovo_client_id', lenovoClientId);
        this.apiConfig.lenovo = { clientId: lenovoClientId };
      }

      this.updateApiStatusIndicators();
      this.showSuccess('✅ Configuration saved successfully!');

      // Close modal
      if (this.elements.configModal) {
        this.closeModal(this.elements.configModal);
      }

    } catch (error) {
      this.showError(`❌ Configuration Error: ${(error as Error).message}`);
    } finally {
      if (this.elements.saveConfigBtn) {
        (this.elements.saveConfigBtn as HTMLButtonElement).disabled = false;
        (this.elements.saveConfigBtn as HTMLButtonElement).textContent = 'Save';
      }
    }
  }

  /**
   * Update API status indicators
   */
  private updateApiStatusIndicators(): void {
    // Update Dell status
    if (this.elements.dellStatusElement) {
      const dellConfigured = this.isApiConfigured('dell');
      this.elements.dellStatusElement.textContent = dellConfigured ? '✅ Configured' : '❌ Not Configured';
      this.elements.dellStatusElement.className = dellConfigured ? 'status-success' : 'status-error';
    }

    // Update Lenovo status
    if (this.elements.lenovoStatusElement) {
      const lenovoConfigured = this.isApiConfigured('lenovo');
      this.elements.lenovoStatusElement.textContent = lenovoConfigured ? '✅ Configured' : '❌ Not Configured';
      this.elements.lenovoStatusElement.className = lenovoConfigured ? 'status-success' : 'status-error';
    }
  }

  /**
   * Retry failed devices
   */
  private async retryFailedDevices(): Promise<void> {
    const failedDevices = this.csvData.filter(device => device.processingState === 'error');

    if (failedDevices.length === 0) {
      this.showInfo('No failed devices to retry');
      return;
    }

    // Reset failed devices to pending
    failedDevices.forEach(device => {
      device.processingState = 'pending';
      device.errorMessage = undefined;
      this.updateDeviceRowStatus(device);
    });

    this.showInfo(`🔄 Retrying ${failedDevices.length} failed devices...`);

    // Hide retry button during processing
    if (this.elements.retryFailedBtn) {
      this.elements.retryFailedBtn.style.display = 'none';
    }

    await this.startProcessing();
  }



  /**
   * Test Dell API connection
   */
  private async testDellApi(): Promise<void> {
    try {
      if (this.elements.testDellApiBtn) {
        (this.elements.testDellApiBtn as HTMLButtonElement).disabled = true;
        (this.elements.testDellApiBtn as HTMLButtonElement).textContent = '🧪 Testing...';
      }

      const result = await this.warrantyService.testConnection('dell');

      if (result.success) {
        this.showTestResult('✅ Dell API connection successful!', 'success');
      } else {
        this.showTestResult(`❌ Dell API test failed: ${result.message}`, 'error');
      }

    } catch (error) {
      this.showTestResult(`❌ Dell API test failed: ${(error as Error).message}`, 'error');
    } finally {
      if (this.elements.testDellApiBtn) {
        (this.elements.testDellApiBtn as HTMLButtonElement).disabled = false;
        (this.elements.testDellApiBtn as HTMLButtonElement).textContent = '🧪 Test API Connection';
      }
    }
  }

  /**
   * Test Lenovo API connection
   */
  private async testLenovoApi(): Promise<void> {
    try {
      if (this.elements.testLenovoApiBtn) {
        (this.elements.testLenovoApiBtn as HTMLButtonElement).disabled = true;
        (this.elements.testLenovoApiBtn as HTMLButtonElement).textContent = '🧪 Testing...';
      }

      const result = await this.warrantyService.testConnection('lenovo');

      if (result.success) {
        this.showTestResult('✅ Lenovo API connection successful!', 'success');
      } else {
        this.showTestResult(`❌ Lenovo API test failed: ${result.message}`, 'error');
      }

    } catch (error) {
      this.showTestResult(`❌ Lenovo API test failed: ${(error as Error).message}`, 'error');
    } finally {
      if (this.elements.testLenovoApiBtn) {
        (this.elements.testLenovoApiBtn as HTMLButtonElement).disabled = false;
        (this.elements.testLenovoApiBtn as HTMLButtonElement).textContent = '🧪 Test API Connection';
      }
    }
  }

  /**
   * Show test result
   */
  private showTestResult(message: string, type: 'success' | 'error' | 'info'): void {
    if (this.elements.testResultElement) {
      this.elements.testResultElement.textContent = message;
      this.elements.testResultElement.className = `test-result ${type}`;
      this.elements.testResultElement.style.display = 'block';

      // Hide after 5 seconds
      setTimeout(() => {
        if (this.elements.testResultElement) {
          this.elements.testResultElement.style.display = 'none';
        }
      }, 5000);
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.warrantyChecker = new WarrantyChecker();
});

// Export for module usage
export default WarrantyChecker;
