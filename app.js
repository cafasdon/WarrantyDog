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

import { WarrantyLookupService } from './vendorApis.js?v=20250724-0200';

/**
 * Main WarrantyChecker Application Class
 */
class WarrantyChecker {
    constructor() {
        this.warrantyService = new WarrantyLookupService();
        this.csvData = [];
        this.processedResults = [];
        this.isProcessing = false;
        this.processingCancelled = false;
        this.currentIndex = 0;

        // Session management for resume functionality
        this.sessionId = null;
        this.sessionKey = 'warrantydog_session';

        this.initializeElements();
        this.initializeProcessingState();
        this.bindEvents();
        this.loadApiKeys();
        this.initializeSessionService();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        console.log('Initializing DOM elements...');

        // File upload elements
        this.fileInput = document.getElementById('csvFile');
        this.dropZone = document.getElementById('dropZone');
        this.fileInfo = document.getElementById('fileInfo');

        // Processing elements
        this.processBtn = document.getElementById('processBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.retryFailedBtn = document.getElementById('retryFailedBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.statusText = document.getElementById('statusText');
        this.liveStats = document.getElementById('liveStats');
        this.processedCountElement = document.getElementById('processedCount');
        this.successCountElement = document.getElementById('successCount');
        this.failedCountElement = document.getElementById('failedCount');
        this.skippedCountElement = document.getElementById('skippedCount');

        // Results elements
        this.resultsContainer = document.getElementById('resultsContainer');
        this.resultsTable = document.getElementById('resultsTable');
        this.exportBtn = document.getElementById('exportBtn');
        this.clearSessionBtn = document.getElementById('clearSessionBtn');

        // Configuration elements
        this.configBtn = document.getElementById('configBtn');
        this.configModal = document.getElementById('configModal');
        this.closeModal = document.querySelector('.close-modal');
        this.saveConfigBtn = document.getElementById('saveConfig');
        this.dellApiKeyInput = document.getElementById('dellApiKey');
        this.dellApiSecretInput = document.getElementById('dellApiSecret');
        this.testDellApiBtn = document.getElementById('testDellApi');
        this.testResultElement = document.getElementById('testResult');

        // Lenovo API elements
        this.lenovoApiKeyInput = document.getElementById('lenovoApiKey');
        this.testLenovoApiBtn = document.getElementById('testLenovoApi');
        this.testLenovoResultElement = document.getElementById('testLenovoResult');

        // API status elements
        this.apiStatusContainer = document.getElementById('apiStatus');
        this.dellStatusElement = document.getElementById('dellStatus');
        this.lenovoStatusElement = document.getElementById('lenovoStatus');

        // Log missing elements
        const elements = {
            fileInput: this.fileInput,
            dropZone: this.dropZone,
            fileInfo: this.fileInfo,
            processBtn: this.processBtn,
            cancelBtn: this.cancelBtn,
            progressContainer: this.progressContainer,
            progressBar: this.progressBar,
            progressText: this.progressText,
            statusText: this.statusText,
            resultsContainer: this.resultsContainer,
            resultsTable: this.resultsTable,
            exportBtn: this.exportBtn,
            configBtn: this.configBtn,
            configModal: this.configModal,
            saveConfigBtn: this.saveConfigBtn,
            dellApiKeyInput: this.dellApiKeyInput,
            testDellApiBtn: this.testDellApiBtn,
            testResultElement: this.testResultElement,
            dellStatusElement: this.dellStatusElement,
            lenovoStatusElement: this.lenovoStatusElement
        };

        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.error(`Missing element: ${name}`);
            }
        });

        console.log('DOM elements initialized');
    }

    /**
     * Initialize processing state management
     */
    initializeProcessingState() {
        // Track processing state
        this.processingState = {
            isActive: false,
            isPaused: false,
            isCompleted: false,
            startTime: null,
            endTime: null,
            totalDevices: 0,
            processedDevices: 0,
            currentDevice: null
        };

        // Add visibility change handler to maintain state
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.sessionId) {
                this.refreshSessionState();
            }
        });

        // Add beforeunload handler to warn about active processing
        window.addEventListener('beforeunload', (e) => {
            if (this.processingState.isActive && !this.processingState.isCompleted) {
                e.preventDefault();
                e.returnValue = 'Processing is still active. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        console.log('Processing state management initialized');
    }

    /**
     * Refresh session state from database
     */
    async refreshSessionState() {
        try {
            if (this.sessionId) {
                const session = await window.sessionService.getSession(this.sessionId);
                if (session && session.status === 'completed') {
                    this.processingState.isCompleted = true;
                    this.showSessionCompletedState();
                    console.log('Session state refreshed - processing completed');
                }
            }
        } catch (error) {
            console.error('Error refreshing session state:', error);
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // File upload events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Note: No click handler needed - the label handles this automatically

        // Processing events
        this.processBtn.addEventListener('click', () => this.startProcessing());
        this.cancelBtn.addEventListener('click', () => this.cancelProcessing());
        this.resumeBtn.addEventListener('click', () => this.resumeProcessing());
        this.retryFailedBtn.addEventListener('click', () => this.retryFailedDevices());

        // Session management events
        if (this.clearSessionBtn) {
            this.clearSessionBtn.addEventListener('click', () => this.clearSessionWithConfirmation());
        }

        // Export events
        this.exportBtn.addEventListener('click', () => this.exportResults());

        // Migration events removed - automatic standardization now handles this

        // Configuration events
        this.configBtn.addEventListener('click', () => this.showConfigModal());

        // Handle multiple close modal elements
        const closeModalElements = document.querySelectorAll('.close-modal');
        closeModalElements.forEach(element => {
            element.addEventListener('click', () => this.hideConfigModal());
        });

        this.saveConfigBtn.addEventListener('click', () => this.saveConfiguration());

        // Use event delegation for modal elements that might not exist yet
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'testDellApi') {
                console.log('Test Dell API button clicked via delegation');
                this.testDellApiConnection();
            } else if (e.target && e.target.id === 'testLenovoApi') {
                console.log('Test Lenovo API button clicked via delegation');
                this.testLenovoApiConnection();
            }
        });

        // Use event delegation for input changes
        document.addEventListener('input', (e) => {
            if (e.target && (e.target.id === 'dellApiKey' || e.target.id === 'dellApiSecret')) {
                const apiKeyInput = document.getElementById('dellApiKey');
                const apiSecretInput = document.getElementById('dellApiSecret');
                const hasKey = apiKeyInput && apiKeyInput.value.trim().length > 0;
                const hasSecret = apiSecretInput && apiSecretInput.value.trim().length > 0;
                const bothPresent = hasKey && hasSecret;

                console.log('Dell API credentials changed via delegation, hasKey:', hasKey, 'hasSecret:', hasSecret);
                const testBtn = document.getElementById('testDellApi');
                if (testBtn) {
                    testBtn.disabled = !bothPresent;
                    console.log('Dell test button disabled state:', testBtn.disabled);
                } else {
                    console.error('Dell test button not found when trying to enable/disable');
                }
            } else if (e.target && e.target.id === 'lenovoApiKey') {
                const apiKeyInput = document.getElementById('lenovoApiKey');
                const hasKey = apiKeyInput && apiKeyInput.value.trim().length > 0;

                console.log('Lenovo API key changed via delegation, hasKey:', hasKey);
                const testBtn = document.getElementById('testLenovoApi');
                if (testBtn) {
                    testBtn.disabled = !hasKey;
                    console.log('Lenovo test button disabled state:', testBtn.disabled);
                } else {
                    console.error('Lenovo test button not found when trying to enable/disable');
                }
            }
        });

        // Also try direct binding if elements exist
        if (this.testDellApiBtn) {
            console.log('Test Dell API button found, adding direct event listener');
            this.testDellApiBtn.addEventListener('click', () => this.testDellApiConnection());
        } else {
            console.log('Test Dell API button not found during init (will use delegation)');
        }

        if (this.dellApiKeyInput) {
            console.log('Dell API key input found, adding direct input event listener');
            this.dellApiKeyInput.addEventListener('input', (e) => {
                const hasKey = e.target.value.trim().length > 0;
                console.log('API key input changed directly, hasKey:', hasKey);
                const testBtn = document.getElementById('testDellApi');
                if (testBtn) {
                    testBtn.disabled = !hasKey;
                }
            });
        } else {
            console.log('Dell API key input not found during init (will use delegation)');
        }

        // Modal close on outside click
        this.configModal.addEventListener('click', (e) => {
            if (e.target === this.configModal) {
                this.hideConfigModal();
            }
        });
    }

    /**
     * Load API keys from localStorage and update status
     */
    loadApiKeys() {
        const dellApiKey = localStorage.getItem('dell_api_key');
        if (dellApiKey && this.dellApiKeyInput) {
            this.dellApiKeyInput.value = dellApiKey;
        }

        const lenovoApiKey = localStorage.getItem('lenovo_api_key');
        if (lenovoApiKey && this.lenovoApiKeyInput) {
            this.lenovoApiKeyInput.value = lenovoApiKey;
        }

        this.updateApiStatus();
    }

    /**
     * Update API status indicators
     */
    updateApiStatus() {
        const dellApiKey = localStorage.getItem('dell_api_key');
        const lenovoApiKey = localStorage.getItem('lenovo_api_key');

        // Update Dell status
        if (this.dellStatusElement) {
            if (dellApiKey && dellApiKey.trim().length > 0) {
                this.dellStatusElement.textContent = '✅ Configured & Validated';
                this.dellStatusElement.className = 'status configured';
                this.dellStatusElement.title = 'API key format validated and saved. Will be tested with actual API calls during warranty processing.';
            } else {
                this.dellStatusElement.textContent = '❌ Not configured';
                this.dellStatusElement.className = 'status not-configured';
                this.dellStatusElement.title = 'No Dell API key configured';
            }
        }

        // Update Lenovo status
        if (this.lenovoStatusElement) {
            if (lenovoApiKey && lenovoApiKey.trim().length > 0) {
                this.lenovoStatusElement.textContent = '✅ Configured & Validated';
                this.lenovoStatusElement.className = 'status configured';
                this.lenovoStatusElement.title = 'API key format validated and saved. Will be tested with actual API calls during warranty processing.';
            } else {
                this.lenovoStatusElement.textContent = '❌ Not configured';
                this.lenovoStatusElement.className = 'status not-configured';
                this.lenovoStatusElement.title = 'No Lenovo API key configured';
            }
        }
    }

    /**
     * Handle file selection
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    /**
     * Handle drag over event
     */
    handleDragOver(event) {
        event.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(event) {
        event.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    /**
     * Handle file drop
     */
    handleFileDrop(event) {
        event.preventDefault();
        this.dropZone.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Process uploaded CSV file
     */
    processFile(file) {
        console.log('Processing file:', file.name, 'Size:', file.size);

        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('Please select a CSV file.');
            return;
        }

        this.fileInfo.innerHTML = `
            <div class="file-details">
                <strong>📄 ${file.name}</strong><br>
                <small>Size: ${(file.size / 1024).toFixed(1)} KB | Processing...</small>
            </div>
        `;
        this.fileInfo.style.display = 'block';

        console.log('Starting CSV parsing...');

        // Check if Papa is available
        if (typeof Papa === 'undefined') {
            this.showError('PapaParse library not loaded. Please refresh the page and try again.');
            return;
        }

        // Parse CSV using PapaParse
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                console.log('CSV parsing complete:', results);
                console.log('Data rows:', results.data.length);
                console.log('First row:', results.data[0]);

                this.csvData = results.data;
                await this.validateCsvData();
            },
            error: (error) => {
                console.error('CSV parsing error:', error);
                this.showError(`Error parsing CSV: ${error.message}`);
            }
        });
    }

    /**
     * Validate CSV data structure
     */
    async validateCsvData() {
        console.log('Validating CSV data...');
        console.log('CSV data length:', this.csvData.length);

        if (this.csvData.length === 0) {
            this.showError('CSV file is empty or has no valid data rows.');
            return;
        }

        const firstRow = this.csvData[0];
        console.log('First row columns:', Object.keys(firstRow));

        // Check for simple format (vendor, service_tag columns)
        const hasSimpleFormat = 'vendor' in firstRow && ('service_tag' in firstRow || 'serial' in firstRow);

        // Check for system report format (Device Serial Number, Base Board Manufacturer)
        const hasSystemReportFormat = 'Device Serial Number' in firstRow && 'Base Board Manufacturer' in firstRow;

        console.log('Has simple format:', hasSimpleFormat);
        console.log('Has system report format:', hasSystemReportFormat);

        if (!hasSimpleFormat && !hasSystemReportFormat) {
            this.showError(`CSV format not recognized. Please ensure your CSV has either:

Simple format: "vendor" and "service_tag" columns
System Report format: "Device Serial Number" and "Base Board Manufacturer" columns

Current columns: ${Object.keys(firstRow).join(', ')}`);
            return;
        }

        // Filter and count valid devices
        const validDevices = this.getValidDevicesFromCsv();
        console.log('Valid devices found:', validDevices.length);
        console.log('Valid devices:', validDevices);

        if (validDevices.length === 0) {
            this.showError('No valid devices found in CSV. Please check that devices have serial numbers and recognized manufacturers.');
            return;
        }

        // Update file info with success
        this.fileInfo.innerHTML = `
            <div class="file-details">
                <strong>📄 ${this.fileInfo.querySelector('.file-details strong').textContent.replace('📄 ', '')}</strong><br>
                <small>✅ Processed successfully | ${validDevices.length} valid devices found</small>
            </div>
        `;

        this.showSuccess(`✅ CSV loaded successfully! Found ${validDevices.length} valid devices out of ${this.csvData.length} total rows.`);

        // Stage 1: Check for duplicates and display devices
        await this.checkDuplicatesAndDisplayDevices(validDevices);

        // Stage 2: Load any existing cached warranty data
        await this.loadCachedWarrantyData(validDevices);

        this.processBtn.disabled = false;
    }

    /**
     * Get all valid devices from CSV data, including unsupported vendors
     */
    getValidDevicesFromCsv() {
        // If we have unique devices (after deduplication), use those
        if (this.uniqueDevices) {
            return this.uniqueDevices;
        }

        // Otherwise, filter from CSV data
        return this.csvData.filter(row => {
            // Skip virtual machines and entries without serial numbers
            if (this.isVirtualMachine(row)) return false;

            const serialNumber = this.extractSerialNumber(row);
            const vendor = this.extractVendor(row);

            // Include all devices with serial numbers and identifiable vendors
            return serialNumber && vendor;
        }).map(row => {
            const vendor = this.extractVendor(row);
            return {
                originalData: row,
                vendor: vendor,
                serialNumber: this.extractSerialNumber(row),
                model: this.extractModel(row),
                deviceName: this.extractDeviceName(row),
                location: this.extractLocation(row),
                isSupported: this.isSupportedVendor(vendor),
                apiConfigured: this.isApiConfigured(vendor)
            };
        });
    }

    /**
     * Get only devices that can be processed (supported vendors with configured APIs)
     */
    getProcessableDevices() {
        return this.getValidDevicesFromCsv().filter(device =>
            device.isSupported && device.apiConfigured
        );
    }

    /**
     * Check if device is a virtual machine
     */
    isVirtualMachine(row) {
        const model = (row['System Model'] || row['model'] || '').toLowerCase();
        const manufacturer = (row['Base Board Manufacturer'] || row['vendor'] || '').toLowerCase();

        return model.includes('vmware') ||
               model.includes('virtual') ||
               manufacturer.includes('vmware') ||
               (row['Device Serial Number'] || '').startsWith('VMware-');
    }

    /**
     * Extract serial number from row
     */
    extractSerialNumber(row) {
        return row['Device Serial Number'] || row['service_tag'] || row['serial'] || '';
    }

    /**
     * Extract vendor from row
     */
    extractVendor(row) {
        const manufacturer = row['Base Board Manufacturer'] || row['vendor'] || '';

        // Normalize vendor names
        if (manufacturer.toLowerCase().includes('dell')) return 'dell';
        if (manufacturer.toLowerCase().includes('lenovo')) return 'lenovo';
        if (manufacturer.toLowerCase().includes('microsoft')) return 'hp'; // Treat Surface as HP for now

        return manufacturer.toLowerCase();
    }

    /**
     * Extract model from row
     */
    extractModel(row) {
        return row['System Model'] || row['model'] || row['description'] || '';
    }

    /**
     * Extract device name from row
     */
    extractDeviceName(row) {
        // Try multiple common column names for device name
        const nameColumns = [
            'Name', 'Friendly Name', 'device_name', 'Device Name', 'Computer Name',
            'Hostname', 'Host Name', 'Machine Name', 'System Name', 'PC Name'
        ];

        for (const col of nameColumns) {
            if (row[col] && row[col].trim()) {
                return row[col].trim();
            }
        }

        return '';
    }

    /**
     * Extract location from row
     */
    extractLocation(row) {
        // Try multiple common column names for location
        const locationColumns = [
            'Site Name', 'Site Friendly Name', 'location', 'Location', 'Office',
            'Building', 'Site', 'Branch', 'Department', 'Floor', 'Room'
        ];

        for (const col of locationColumns) {
            if (row[col] && row[col].trim()) {
                return row[col].trim();
            }
        }

        return '';
    }

    /**
     * Check if vendor is supported (has active API integration)
     */
    isSupportedVendor(vendor) {
        return ['dell', 'lenovo'].includes(vendor.toLowerCase());
    }

    /**
     * Check if vendor is recognized (supported or coming soon)
     */
    isRecognizedVendor(vendor) {
        const recognized = ['dell', 'lenovo', 'hp', 'hewlett-packard', 'microsoft', 'asus', 'apple'];
        return recognized.includes(vendor.toLowerCase());
    }

    /**
     * Get vendor status message
     */
    getVendorStatusMessage(vendor) {
        const vendorLower = vendor.toLowerCase();

        // Active vendors
        if (['dell', 'lenovo'].includes(vendorLower)) {
            return 'API not configured';
        }

        // Coming soon vendors
        if (['hp', 'hewlett-packard'].includes(vendorLower)) {
            return 'HP API integration coming soon';
        }
        if (vendorLower === 'microsoft') {
            return 'Microsoft API integration coming soon';
        }
        if (vendorLower === 'asus') {
            return 'ASUS API integration coming soon';
        }
        if (vendorLower === 'apple') {
            return 'Apple API integration coming soon';
        }

        // Unknown vendors
        return 'Vendor not supported';
    }

    /**
     * Check if API is configured for vendor
     */
    isApiConfigured(vendor) {
        switch (vendor.toLowerCase()) {
            case 'dell':
                return localStorage.getItem('dell_api_key') !== null;
            case 'lenovo':
                return localStorage.getItem('lenovo_api_key') !== null;
            case 'hp':
                return false; // Not implemented yet
            default:
                return false;
        }
    }

    /**
     * Check for duplicates and display devices with duplicate information
     */
    async checkDuplicatesAndDisplayDevices(devices) {
        try {
            // Check for duplicates
            const duplicateCheck = await window.sessionService.checkDuplicates(devices, 24);

            if (duplicateCheck.duplicates > 0) {
                this.showDuplicateDialog(duplicateCheck, devices);
            } else {
                this.displayDetectedDevices(devices);
            }
        } catch (error) {
            console.error('Error checking duplicates:', error);
            // Fallback to normal display if duplicate check fails
            this.displayDetectedDevices(devices);
        }
    }

    /**
     * Show duplicate detection dialog
     */
    showDuplicateDialog(duplicateCheck, devices) {
        const duplicateMessage = `🔍 Duplicate Detection Results:\n\n` +
            `📊 Total devices: ${duplicateCheck.total}\n` +
            `✅ Fresh devices: ${duplicateCheck.fresh}\n` +
            `🔄 Duplicates found: ${duplicateCheck.duplicates}\n\n` +
            `Duplicates (already processed within 24 hours):\n` +
            duplicateCheck.duplicateDetails.map(d =>
                `• ${d.serialNumber} (${d.vendor}) - ${d.ageHours}h ago`
            ).join('\n') + '\n\n' +
            `How would you like to handle duplicates?`;

        if (confirm(duplicateMessage + '\n\nClick OK to SKIP duplicates (recommended) or Cancel to REPROCESS all devices.')) {
            this.handleDuplicateChoice('skip', devices);
        } else {
            this.handleDuplicateChoice('reprocess', devices);
        }
    }

    /**
     * Handle user's duplicate choice
     */
    async handleDuplicateChoice(choice, devices) {
        const options = {
            skipDuplicates: choice === 'skip',
            updateExisting: choice === 'reprocess',
            maxAgeHours: 24
        };

        this.duplicateHandlingOptions = options;
        this.displayDetectedDevices(devices);

        if (choice === 'skip') {
            this.showMessage('✅ Duplicates will be skipped. Existing warranty data will be used for previously processed devices.', 'success');
        } else {
            this.showMessage('🔄 All devices will be reprocessed to get fresh warranty data.', 'info');
        }
    }

    /**
     * Display detected devices immediately after CSV upload (Stage 1)
     */
    displayDetectedDevices(devices) {
        this.resultsContainer.style.display = 'block';

        // Update table headers
        const thead = this.resultsTable.querySelector('thead tr');
        thead.innerHTML = `
            <th>Device Name</th>
            <th>Location</th>
            <th>Vendor</th>
            <th>Serial Number</th>
            <th>Model</th>
            <th>API Status</th>
            <th>Warranty Status</th>
            <th>Warranty Type</th>
            <th>End Date</th>
            <th>Days Remaining</th>
        `;

        // Clear existing table
        const tbody = this.resultsTable.querySelector('tbody');
        tbody.innerHTML = '';

        // Remove duplicates from devices array (same serial number + vendor)
        const uniqueDevices = [];
        const seenDevices = new Set();

        devices.forEach(device => {
            const deviceKey = `${device.vendor}_${device.serialNumber}`;
            if (!seenDevices.has(deviceKey)) {
                seenDevices.add(deviceKey);
                uniqueDevices.push(device);
            } else {
                console.log(`🔄 Duplicate device detected in CSV: ${device.serialNumber} (${device.vendor}) - skipping duplicate entry`);
            }
        });

        console.log(`📊 Device deduplication: ${devices.length} total -> ${uniqueDevices.length} unique devices`);

        // Add unique devices to table with initial status
        uniqueDevices.forEach(device => {
            const row = tbody.insertRow();
            const apiStatus = this.getApiStatusText(device);

            row.innerHTML = `
                <td>${device.deviceName || 'Unknown'}</td>
                <td>${device.location || 'Unknown'}</td>
                <td>${device.vendor || 'Unknown'}</td>
                <td>${device.serialNumber || 'Unknown'}</td>
                <td>${device.model || 'Unknown'}</td>
                <td><span class="status-${apiStatus.class}">${apiStatus.text}</span></td>
                <td class="warranty-status">⏳ Pending</td>
                <td class="warranty-type">-</td>
                <td class="warranty-ship">-</td>
                <td class="warranty-end">-</td>
                <td class="warranty-days">-</td>
            `;

            // Store device data for later processing
            row.dataset.deviceIndex = uniqueDevices.indexOf(device);
        });

        // Store the unique devices for later use
        this.uniqueDevices = uniqueDevices;

        // Show processing controls
        this.updateProcessingControls(uniqueDevices);
    }

    /**
     * Get API status text and class for a device
     */
    getApiStatusText(device) {
        if (!device.isSupported) {
            // Check if it's a recognized vendor (coming soon)
            if (this.isRecognizedVendor(device.vendor)) {
                const vendorLower = device.vendor.toLowerCase();
                if (['hp', 'hewlett-packard'].includes(vendorLower)) {
                    return { text: '🔜 HP Coming Soon', class: 'coming-soon' };
                }
                if (vendorLower === 'microsoft') {
                    return { text: '🔜 Microsoft Coming Soon', class: 'coming-soon' };
                }
                if (vendorLower === 'asus') {
                    return { text: '🔜 ASUS Coming Soon', class: 'coming-soon' };
                }
                if (vendorLower === 'apple') {
                    return { text: '🔜 Apple Coming Soon', class: 'coming-soon' };
                }
            }
            return { text: '❌ Not Supported', class: 'not-supported' };
        }
        if (!device.apiConfigured) {
            return { text: '⚙️ API Not Configured', class: 'not-configured' };
        }
        return { text: '✅ Ready', class: 'ready' };
    }

    /**
     * Update processing controls based on detected devices
     */
    updateProcessingControls(devices) {
        const processableCount = devices.filter(d => d.isSupported && d.apiConfigured).length;
        const unsupportedCount = devices.filter(d => !d.isSupported).length;
        const unconfiguredCount = devices.filter(d => d.isSupported && !d.apiConfigured).length;
        const skipCount = unsupportedCount + unconfiguredCount;

        // Update process button text
        if (processableCount === 0) {
            this.processBtn.textContent = 'No Devices Ready for Processing';
            this.processBtn.disabled = true;
        } else {
            const buttonText = skipCount > 0 ?
                `Process ${processableCount} Device${processableCount !== 1 ? 's' : ''} (Skip ${skipCount})` :
                `Process ${processableCount} Device${processableCount !== 1 ? 's' : ''}`;
            this.processBtn.textContent = buttonText;
            this.processBtn.disabled = false;
        }

        // Show status summary (persistent)
        let statusMessage = `📊 Device Summary: ${devices.length} total devices detected\n`;
        statusMessage += `✅ Ready for processing: ${processableCount}\n`;
        if (skipCount > 0) {
            statusMessage += `⏭️ Will be skipped: ${skipCount}\n`;
            if (unconfiguredCount > 0) {
                statusMessage += `  ⚙️ Need API configuration: ${unconfiguredCount}\n`;
            }
            if (unsupportedCount > 0) {
                statusMessage += `  ❌ Unsupported vendors: ${unsupportedCount}\n`;
            }
        }
        statusMessage += `\n💡 Tip: Configure API keys to process more devices!`;

        this.showPersistentMessage(statusMessage, 'info');
    }

    /**
     * Update processing controls accounting for devices with cached data
     */
    updateProcessingControlsWithCache(devices) {
        // Count devices that have actual warranty data (not just pending/error states)
        const devicesWithWarrantyData = new Set();

        this.processedResults.forEach(result => {
            // Only count as "processed" if we have actual warranty data, not errors or pending states
            if (result.status === 'success' && result.warrantyStatus &&
                result.warrantyStatus !== 'Unknown' && result.warrantyStatus !== 'Pending') {
                devicesWithWarrantyData.add(`${result.vendor}_${result.serviceTag}`);
            }
        });

        // Filter devices that need processing (supported, configured, and don't have warranty data)
        const devicesNeedingProcessing = devices.filter(device => {
            const deviceKey = `${device.vendor}_${device.serialNumber}`;
            const hasWarrantyData = devicesWithWarrantyData.has(deviceKey);
            return device.isSupported && device.apiConfigured && !hasWarrantyData;
        });

        const processableCount = devicesNeedingProcessing.length;
        const cachedCount = devices.filter(device => {
            const deviceKey = `${device.vendor}_${device.serialNumber}`;
            return devicesWithWarrantyData.has(deviceKey);
        }).length;

        const unsupportedCount = devices.filter(d => !d.isSupported).length;
        const unconfiguredCount = devices.filter(d => d.isSupported && !d.apiConfigured).length;
        const skipCount = unsupportedCount + unconfiguredCount;

        // Count devices that are pending/need retry (supported but no warranty data yet)
        const pendingDevices = devices.filter(device => {
            const deviceKey = `${device.vendor}_${device.serialNumber}`;
            const hasWarrantyData = devicesWithWarrantyData.has(deviceKey);
            return device.isSupported && !hasWarrantyData; // Include all supported devices without warranty data
        });

        const totalProcessableCount = pendingDevices.length;

        // Update process button text
        if (totalProcessableCount === 0) {
            if (cachedCount > 0) {
                this.processBtn.textContent = '✅ All Supported Devices Processed';
                this.processBtn.disabled = true;
            } else {
                this.processBtn.textContent = 'No Devices Ready for Processing';
                this.processBtn.disabled = true;
            }
        } else {
            // Count devices that will be skipped due to API configuration
            const configuredCount = pendingDevices.filter(d => d.apiConfigured).length;
            const unconfiguredSupportedCount = pendingDevices.filter(d => !d.apiConfigured).length;

            const buttonText = unconfiguredSupportedCount > 0 ?
                `Process ${configuredCount} Device${configuredCount !== 1 ? 's' : ''} (Skip ${skipCount + unconfiguredSupportedCount})` :
                `Process ${configuredCount} Device${configuredCount !== 1 ? 's' : ''}`;
            this.processBtn.textContent = buttonText;
            this.processBtn.disabled = configuredCount === 0;
        }

        // Show updated status summary
        let statusMessage = `📊 Device Summary: ${devices.length} total devices detected\n`;

        const configuredPendingCount = pendingDevices.filter(d => d.apiConfigured).length;
        const unconfiguredSupportedCount = pendingDevices.filter(d => !d.apiConfigured).length;

        statusMessage += `✅ Ready for processing: ${configuredPendingCount}\n`;
        if (cachedCount > 0) {
            statusMessage += `💾 Already processed (cached): ${cachedCount}\n`;
        }
        if (unconfiguredSupportedCount > 0) {
            statusMessage += `⚙️ Supported but need API config: ${unconfiguredSupportedCount}\n`;
        }
        if (unsupportedCount > 0) {
            statusMessage += `❌ Unsupported vendors: ${unsupportedCount}\n`;
        }
        statusMessage += `\n💡 Tip: Configure API keys to process more devices!`;

        this.showPersistentMessage(statusMessage, 'info');
    }

    /**
     * Start warranty processing
     */
    async startProcessing() {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.processingCancelled = false;

        // Update processing state
        this.processingState.isActive = true;
        this.processingState.isCompleted = false;
        this.processingState.startTime = Date.now();
        this.processingState.totalDevices = this.validDevices ? this.validDevices.length : 0;
        this.processingState.processedDevices = 0;
        this.processBtn.disabled = true;
        this.processBtn.style.display = 'none';
        this.cancelBtn.style.display = 'inline-block';
        this.progressContainer.style.display = 'block';
        // Keep results container visible for live updates
        this.resultsContainer.style.display = 'block';

        // Don't clear processedResults if we have cached data - only clear if starting fresh
        if (!this.processedResults || this.processedResults.length === 0) {
            this.processedResults = [];
        }
        this.currentIndex = 0;

        try {
            // Use simple sequential processing for reliability
            await this.processDevicesSequential();
        } catch (error) {
            if (!this.processingCancelled) {
                this.showError(`Processing failed: ${error.message}`);
            }
        } finally {
            this.resetProcessingUI();
        }
    }

    /**
     * Cancel warranty processing
     */
    cancelProcessing() {
        console.log('Processing cancelled by user');
        this.processingCancelled = true;
        this.showMessage('⏹️ Processing cancelled by user. Session saved for resume.', 'info');
        this.resetProcessingUI();
        // Session is automatically saved after each device, so no additional save needed
    }

    /**
     * Reset processing UI to initial state
     */
    resetProcessingUI() {
        this.isProcessing = false;
        this.processBtn.disabled = false;
        this.processBtn.style.display = 'inline-block';
        this.processBtn.textContent = 'Process Warranties';
        this.cancelBtn.style.display = 'none';
        this.resumeBtn.style.display = 'inline-block';
        this.progressContainer.style.display = 'none';
    }

    /**
     * Resume processing from where it left off
     */
    async resumeProcessing() {
        console.log('🔄 Resuming processing...');
        this.processingCancelled = false;
        this.resumeBtn.style.display = 'none';
        this.cancelBtn.style.display = 'inline-block';
        this.progressContainer.style.display = 'block';

        // Continue with remaining devices
        await this.startProcessing();
    }

    /**
     * Simple sequential processing - no caching, no concurrency
     * Workflow: API call -> Store in DB -> Parse data -> Update UI
     */
    async processDevicesSequential() {
        const allDevices = this.getValidDevicesFromCsv();
        const processableDevices = allDevices.filter(device => device.isSupported && device.apiConfigured);
        const skippedDevices = allDevices.filter(device => !device.isSupported || !device.apiConfigured);

        console.log(`🔄 Starting sequential processing: ${processableDevices.length} devices to process, ${skippedDevices.length} to skip`);

        this.processingStartTime = Date.now();
        let processed = 0;
        let successful = 0;
        let failed = 0;

        // Filter out devices that already have cached data loaded
        console.log(`🔍 Checking ${processableDevices.length} processable devices against ${this.processedResults.length} cached results`);

        const devicesToProcess = processableDevices.filter(device => {
            const alreadyProcessed = this.processedResults.some(result =>
                result.serviceTag === device.serialNumber && result.vendor === device.vendor
            );
            if (alreadyProcessed) {
                console.log(`⏭️ Skipping ${device.serialNumber} - already loaded from cache`);
            }
            return !alreadyProcessed;
        });

        console.log(`📊 Filtering results: ${processableDevices.length} processable -> ${devicesToProcess.length} need processing`);

        // Count devices already loaded from cache
        const cachedDevices = processableDevices.length - devicesToProcess.length;

        console.log(`📡 Need to fetch data for ${devicesToProcess.length} devices (${cachedDevices} already cached)`);

        // Initialize progress (include cached devices as already successful)
        this.updateProgress(cachedDevices + skippedDevices.length, allDevices.length, cachedDevices, 0, skippedDevices.length);

        // Process each device sequentially
        for (const device of devicesToProcess) {
            if (this.processingCancelled) {
                console.log('Processing cancelled by user');
                break;
            }

            try {
                console.log(`📡 Fetching new data for ${device.serialNumber} (${device.vendor})`);

                // Step 1: Make API call for new data
                const apiResult = await this.warrantyService.lookupWarranty(device.vendor, device.serialNumber);

                // Step 2: Store raw API response in database
                if (window.sessionService) {
                    try {
                        await this.storeApiResponse(device, apiResult);
                    } catch (dbError) {
                        console.warn(`Database storage failed for ${device.serialNumber}:`, dbError);
                    }
                }

                // Step 3: Parse and enhance result with device information
                const result = {
                    ...apiResult,
                    originalData: device.originalData,
                    deviceName: device.deviceName,
                    location: device.location,
                    model: apiResult.model || device.model,
                    vendor: device.vendor,
                    serviceTag: device.serialNumber
                };

                // Step 4: Update UI immediately
                this.updateDeviceRowRealtime(device, result, 'success');
                this.processedResults.push(result);

                // Step 5: Update database
                this.updateDeviceInDatabase(device, result, 'success').catch(err =>
                    console.error('Database update failed:', err)
                );

                successful++;
                console.log(`✅ Successfully processed ${device.serialNumber}: ${result.status}`);

            } catch (error) {
                console.error(`❌ Failed to process ${device.serialNumber}:`, error);

                const errorResult = {
                    vendor: device.vendor,
                    serviceTag: device.serialNumber,
                    status: 'error',
                    message: error.message,
                    originalData: device.originalData,
                    deviceName: device.deviceName,
                    location: device.location,
                    model: device.model
                };

                this.updateDeviceRowRealtime(device, errorResult, 'error');
                this.processedResults.push(errorResult);

                // Update database with error information
                this.updateDeviceInDatabase(device, errorResult, 'error').catch(err =>
                    console.error('Database update failed:', err)
                );

                failed++;
            }

            processed++;

            // Update progress (include cached devices in successful count)
            this.updateProgress(
                processed + cachedDevices + skippedDevices.length,
                allDevices.length,
                successful + cachedDevices,
                failed,
                skippedDevices.length
            );

            // Small delay to prevent overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Process skipped devices
        skippedDevices.forEach(device => {
            const skipResult = {
                vendor: device.vendor,
                serviceTag: device.serialNumber,
                status: 'skipped',
                message: this.getVendorStatusMessage(device.vendor),
                originalData: device.originalData,
                deviceName: device.deviceName,
                location: device.location,
                model: device.model
            };

            this.updateDeviceRowRealtime(device, skipResult, 'skipped');
            this.processedResults.push(skipResult);

            // Update database with skip information
            this.updateDeviceInDatabase(device, skipResult, 'skipped').catch(err =>
                console.error('Database update failed:', err)
            );
        });

        // Final update
        this.updateProgress(
            allDevices.length,
            allDevices.length,
            successful + cachedDevices,
            failed,
            skippedDevices.length
        );

        // Enable export and show completion
        this.exportBtn.disabled = false;
        this.resumeBtn.style.display = 'none';

        const processingTime = (Date.now() - this.processingStartTime) / 1000;
        const totalSuccessful = successful + cachedDevices;

        this.showSuccess(`🎉 Sequential processing complete!
✅ Successful: ${totalSuccessful} (${successful} new, ${cachedDevices} cached)
❌ Failed: ${failed}
⏭️ Skipped: ${skippedDevices.length}
⏱️ Time: ${processingTime.toFixed(1)}s

📊 Results ready for export.`);

        console.log(`🏁 Sequential processing completed in ${processingTime.toFixed(1)}s`);
    }

    /**
     * Load cached warranty data for devices and display immediately - BULK OPTIMIZED
     */
    async loadCachedWarrantyData(devices) {
        if (!window.sessionService) {
            console.log('📋 No database service available for cache loading');
            return;
        }

        // Filter to only supported devices
        const supportedDevices = devices.filter(device => device.isSupported && device.apiConfigured);

        if (supportedDevices.length === 0) {
            console.log('📋 No supported devices to check cache for');
            return;
        }

        console.log(`📋 Bulk loading cached warranty data for ${supportedDevices.length} supported devices...`);
        console.log('📋 Sample supported devices:', supportedDevices.slice(0, 3).map(d => ({serial: d.serialNumber, vendor: d.vendor, supported: d.isSupported, configured: d.apiConfigured})));
        const startTime = Date.now();

        try {
            // Get all cached warranty data in one bulk query
            const cachedDataMap = await this.bulkCheckDatabaseForAssets(supportedDevices);

            const loadTime = Date.now() - startTime;
            console.log(`⚡ Bulk cache check completed in ${loadTime}ms`);

            let cacheHits = 0;

            // Process each device with its cached data
            for (const device of supportedDevices) {
                const cacheKey = `${device.vendor}_${device.serialNumber}`;
                const cachedData = cachedDataMap.get(cacheKey);

                console.log(`🔍 Checking cache for ${device.serialNumber} (${device.vendor}), key: ${cacheKey}, found: ${!!cachedData}`);
                if (cachedData) {
                    console.log(`📋 Cache data for ${device.serialNumber}:`, {
                        status: cachedData.status,
                        warrantyStatus: cachedData.warrantyStatus,
                        warrantyType: cachedData.warrantyType,
                        source: cachedData.source || 'unknown'
                    });
                }

                if (cachedData) {
                    // Check if this device is already in processedResults to avoid duplicates
                    const existingIndex = this.processedResults.findIndex(existing =>
                        existing.serviceTag === device.serialNumber && existing.vendor === device.vendor
                    );

                    if (existingIndex >= 0) {
                        console.log(`⚠️ Duplicate detected: ${device.serialNumber} already in processedResults, skipping cache load`);
                    } else {
                        // Enhance cached data with current device information
                        const result = {
                            ...cachedData,
                            originalData: device.originalData,
                            deviceName: device.deviceName,
                            location: device.location,
                            model: cachedData.model || device.model
                        };

                        // Update the table row immediately with cached data
                        this.updateDeviceRowRealtime(device, result, 'success');

                        // Add to processed results
                        this.processedResults.push(result);
                        console.log(`💾 Added ${device.serialNumber} to processedResults (total: ${this.processedResults.length})`);

                        cacheHits++;
                    }
                }
            }

            console.log(`📊 Cache loading summary: ${cacheHits}/${supportedDevices.length} devices found in cache`);

            if (cacheHits > 0) {
                console.log(`✅ Loaded ${cacheHits} devices from cache in ${loadTime}ms`);
                this.showSuccess(`💾 Loaded ${cacheHits} devices from cache in ${loadTime}ms. Ready to process remaining devices.`);

                // Enable export if we have cached results
                if (this.processedResults.length > 0) {
                    this.exportBtn.disabled = false;
                }

                // Update processing controls to reflect cached devices
                this.updateProcessingControlsWithCache(devices);
            } else {
                console.log('📋 No cached warranty data found');
                // Still update processing controls to ensure they're current
                this.updateProcessingControlsWithCache(devices);
            }
        } catch (error) {
            console.error('❌ Failed to bulk load cached data:', error);
            // Fall back to individual checks if bulk fails
            console.log('🔄 Falling back to individual cache checks...');
            await this.loadCachedWarrantyDataIndividual(devices);
        }
    }

    /**
     * Bulk check database for multiple assets in one query
     */
    async bulkCheckDatabaseForAssets(devices) {
        if (!window.sessionService) {
            return new Map();
        }

        try {
            // Extract service tags and vendors for bulk query
            const deviceList = devices.map(device => ({
                serviceTag: device.serialNumber,
                vendor: device.vendor
            }));

            console.log(`🔍 Bulk checking database for ${deviceList.length} devices`);

            // Make bulk API call
            const bulkData = await window.sessionService.getBulkWarrantyData(deviceList);

            console.log(`📊 Bulk database response:`, bulkData);

            // Convert to Map for fast lookup
            const dataMap = new Map();

            if (bulkData && Array.isArray(bulkData)) {
                bulkData.forEach(item => {
                    const cacheKey = `${item.vendor}_${item.service_tag}`;

                    // Map database field names to expected field names
                    // Calculate days remaining locally instead of using stored value
                    const calculatedDays = this.calculateDaysRemaining(item.warranty_end_date);

                    const mappedData = {
                        vendor: item.vendor,
                        serviceTag: item.service_tag,
                        status: item.warranty_status || item.status,
                        warrantyType: item.warranty_type,
                        startDate: item.warranty_start_date,
                        endDate: item.warranty_end_date,
                        shipDate: item.ship_date,
                        daysRemaining: calculatedDays, // Use locally calculated value
                        isActive: item.is_active,
                        message: item.message || 'Retrieved from database',
                        model: item.model,
                        fromCache: true
                    };

                    dataMap.set(cacheKey, mappedData);
                });
            }

            console.log(`💾 Mapped ${dataMap.size} cached warranty records`);
            return dataMap;

        } catch (error) {
            console.error('❌ Failed to bulk check database:', error);
            return new Map();
        }
    }

    /**
     * Check database for existing warranty data for an asset
     */
    async checkDatabaseForAsset(device) {
        if (!window.sessionService) {
            console.log(`❌ No sessionService available for ${device.serialNumber}`);
            return null; // No database service available
        }

        try {
            console.log(`🔍 Checking database for ${device.serialNumber} (${device.vendor})`);

            // Check if we have existing warranty data for this asset tag
            const existingData = await window.sessionService.getWarrantyData(device.serialNumber, device.vendor);

            console.log(`📊 Database response for ${device.serialNumber}:`, existingData);

            if (existingData) {
                console.log(`💾 Found existing warranty data for ${device.serialNumber}`, existingData);

                // Map database field names to expected field names
                // Calculate days remaining locally instead of using stored value
                const calculatedDays = this.calculateDaysRemaining(existingData.warranty_end_date);

                const mappedData = {
                    vendor: device.vendor,
                    serviceTag: device.serialNumber,
                    status: existingData.warranty_status || existingData.status,
                    warrantyType: existingData.warranty_type,
                    startDate: existingData.warranty_start_date,
                    endDate: existingData.warranty_end_date,
                    shipDate: existingData.ship_date,
                    daysRemaining: calculatedDays, // Use locally calculated value
                    isActive: existingData.is_active,
                    message: existingData.message || 'Retrieved from database',
                    model: existingData.model,
                    fromCache: true
                };

                console.log(`🔧 Mapped cached data for ${device.serialNumber}:`, mappedData);
                return mappedData;
            }

            console.log(`❌ No existing data found for ${device.serialNumber}`);
            return null; // No existing data found
        } catch (error) {
            console.error(`❌ Failed to check database for ${device.serialNumber}:`, error);
            return null; // Proceed with API call on database error
        }
    }

    /**
     * Store API response in database for audit trail
     */
    async storeApiResponse(device, apiResult) {
        if (!window.sessionService) {
            console.log(`❌ No sessionService available for storing ${device.serialNumber}`);
            return; // Skip if no database service available
        }

        try {
            const warrantyData = {
                serviceTag: device.serialNumber,
                vendor: device.vendor,
                warranty_status: apiResult.status,
                warranty_type: apiResult.warrantyType || apiResult.type,
                warranty_start_date: apiResult.startDate,
                warranty_end_date: apiResult.endDate,
                ship_date: apiResult.shipDate,
                warranty_days_remaining: apiResult.daysRemaining,
                is_active: apiResult.isActive,
                message: apiResult.message,
                model: apiResult.model,
                raw_api_response: JSON.stringify(apiResult),
                last_updated: new Date().toISOString()
            };

            console.log(`💾 Storing warranty data for ${device.serialNumber}:`, warrantyData);

            // Store the complete warranty data for future retrieval
            await window.sessionService.storeWarrantyData(warrantyData);

            console.log(`✅ Successfully stored warranty data for ${device.serialNumber}`);
        } catch (error) {
            console.error(`❌ Failed to store warranty data for ${device.serialNumber}:`, error);
        }
    }

    /**
     * Process devices concurrently with caching (Enhanced Stage 2) - DEPRECATED
     */
    async processDevicesConcurrent() {
        const allDevices = this.getValidDevicesFromCsv();
        const processableDevices = this.getProcessableDevices();
        const total = allDevices.length;
        const processableCount = processableDevices.length;

        if (processableCount === 0) {
            this.showError('No devices are ready for processing. Please configure API keys for supported vendors.');
            return;
        }

        this.showMessage(`🚀 Starting concurrent processing: ${total} total devices (${processableCount} processable, ${total - processableCount} will be skipped)...`, 'info');

        // Ensure the table is visible and populated
        this.resultsContainer.style.display = 'block';

        // Initialize progress tracking for concurrent processing BEFORE starting
        this.concurrentProgress = {
            total: total,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            cached: 0
        };

        // Mark all processable devices as "Processing..." in the UI
        this.markDevicesAsProcessing(processableDevices);

        // Track processing start time
        this.processingStartTime = Date.now();

        // Group devices by vendor for optimal concurrent processing
        const devicesByVendor = this.groupDevicesByVendor(processableDevices);

        // Process each vendor concurrently
        const vendorPromises = Object.entries(devicesByVendor).map(async ([vendor, devices]) => {
            if (devices.length === 0) return { vendor, results: new Map() };

            console.log(`🔧 Starting concurrent processing for ${vendor}: ${devices.length} devices`);

            // Create vendor-specific concurrent processor with conservative settings
            const processor = new ConcurrentProcessor(vendor, {
                maxConcurrency: vendor === 'dell' ? 2 : vendor === 'hp' ? 2 : 1,
                minConcurrency: 1,
                initialConcurrency: 1,
                performanceThreshold: 0.85,
                responseTimeThreshold: 3000
            });

            // Define processing function for this vendor
            const processingFunction = async (device) => {
                try {
                    const result = await this.warrantyService.lookupWarranty(device.vendor, device.serialNumber);

                    // Enhance result with device information
                    result.originalData = device.originalData;
                    result.deviceName = device.deviceName;
                    result.location = device.location;
                    result.model = result.model || device.model;

                    // Update UI in real-time
                    this.updateDeviceRowRealtime(device, result, 'success');

                    // Update database with warranty information
                    this.updateDeviceInDatabase(device, result, 'success').catch(err =>
                        console.error('Database update failed:', err)
                    );

                    return result;
                } catch (error) {
                    console.error(`Error processing ${device.serialNumber}:`, error);

                    const errorResult = {
                        vendor: device.vendor,
                        serviceTag: device.serialNumber,
                        status: 'error',
                        message: error.message,
                        originalData: device.originalData,
                        deviceName: device.deviceName,
                        location: device.location,
                        model: device.model
                    };

                    // Update UI with error
                    this.updateDeviceRowRealtime(device, errorResult, 'error');

                    // Update database with error information
                    this.updateDeviceInDatabase(device, errorResult, 'error').catch(err =>
                        console.error('Database update failed:', err)
                    );

                    return errorResult;
                }
            };

            // Start concurrent processing for this vendor
            const results = await processor.startProcessing(devices, processingFunction);

            console.log(`✅ Completed ${vendor} processing: ${results.size} results (${processor.metrics.cacheHits} cache hits)`);

            return { vendor, results, metrics: processor.metrics };
        });

        // Wait for all vendors to complete
        const vendorResults = await Promise.all(vendorPromises);

        // Combine all results and update final statistics
        let totalSuccessful = 0;
        let totalFailed = 0;
        let totalCached = 0;
        const allResults = [];

        vendorResults.forEach(({ vendor, results, metrics }) => {
            results.forEach((result, serviceTag) => {
                allResults.push(result);
                // Count all valid API responses as successful (including no_warranty)
                if (result.status === 'success' || result.status === 'active' || result.status === 'expired' || result.status === 'no_warranty') {
                    totalSuccessful++;
                } else if (result.status === 'error') {
                    totalFailed++;
                } else {
                    // Log unexpected status for debugging
                    console.log(`⚠️ Unexpected result status: "${result.status}" for ${serviceTag}`);
                    totalFailed++;
                }
            });

            if (metrics) {
                totalCached += metrics.cacheHits;
                console.log(`📊 ${vendor} metrics: ${metrics.cacheHits} cache hits, ${metrics.cacheMisses} cache misses, ${metrics.cacheHitRate.toFixed(1)}% hit rate`);
            }
        });

        // Process skipped devices
        const skippedDevices = allDevices.filter(device => !device.isSupported || !device.apiConfigured);
        skippedDevices.forEach(device => {
            const skipResult = {
                vendor: device.vendor,
                serviceTag: device.serialNumber,
                status: 'skipped',
                message: this.getVendorStatusMessage(device.vendor),
                originalData: device.originalData,
                deviceName: device.deviceName,
                location: device.location,
                model: device.model
            };
            allResults.push(skipResult);
            this.updateDeviceRowRealtime(device, skipResult, 'skipped');
            // Update database with skip information
            this.updateDeviceInDatabase(device, skipResult, 'skipped').catch(err =>
                console.error('Database update failed:', err)
            );
        });

        // Store all results
        this.processedResults = allResults;

        // Enable export button and hide resume button
        this.exportBtn.disabled = false;
        this.resumeBtn.style.display = 'none';

        // Show completion summary
        const processingTime = (Date.now() - this.processingStartTime) / 1000;
        this.showSuccess(`🎉 Concurrent processing complete!
✅ Successful: ${totalSuccessful}
❌ Failed: ${totalFailed}
⏭️ Skipped: ${skippedDevices.length}
💾 Cache hits: ${totalCached}
⏱️ Time: ${processingTime.toFixed(1)}s

📊 Results will remain visible until manually cleared.
💾 You can safely upload a new CSV - these results will persist.`);

        console.log(`🏁 Concurrent processing completed in ${processingTime.toFixed(1)}s`);
    }

    /**
     * Process devices that can be processed (Stage 2) - Sequential fallback
     */
    async processDevices() {
        const allDevices = this.getValidDevicesFromCsv();
        const processableDevices = this.getProcessableDevices();
        const total = allDevices.length;
        const processableCount = processableDevices.length;
        let processed = 0;
        let successful = 0;
        let failed = 0;
        let skipped = 0;

        if (processableCount === 0) {
            this.showError('No devices are ready for processing. Please configure API keys for supported vendors.');
            return;
        }

        this.showMessage(`Processing ${total} total devices (${processableCount} processable, ${total - processableCount} will be skipped)...`, 'info');

        // Track processing start time for ETA calculation
        this.processingStartTime = Date.now();

        // Initialize resume data if not resuming
        if (!this.resumeData) {
            this.resumeData = {
                startIndex: 0,
                successful: 0,
                failed: 0,
                skipped: 0
            };
        }

        // Start from resume point if resuming
        processed = this.resumeData.startIndex;
        successful = this.resumeData.successful;
        failed = this.resumeData.failed;
        skipped = this.resumeData.skipped;

        // Determine which devices to process
        const devicesToProcess = this.resumeData && this.resumeData.retryMode
            ? this.resumeData.retryDevices
            : allDevices;

        for (let i = 0; i < devicesToProcess.length; i++) {
            const device = devicesToProcess[i];

            // Skip already processed devices if resuming (but not in retry mode)
            if (!this.resumeData?.retryMode && i < this.resumeData.startIndex) {
                continue;
            }
            // Check if processing was cancelled
            if (this.processingCancelled) {
                console.log('Processing loop cancelled');
                break;
            }

            this.currentIndex = processed;

            // Adjust total for retry mode
            const effectiveTotal = this.resumeData?.retryMode ? devicesToProcess.length : total;
            this.updateProgress(processed, effectiveTotal, successful, failed, skipped, device);

            // Find the table row for this device
            const deviceIndex = allDevices.indexOf(device);
            const row = this.resultsTable.querySelector(`tbody tr[data-device-index="${deviceIndex}"]`);

            // Check if device can be processed (has configured API)
            if (!device.isSupported || !device.apiConfigured) {
                // Skip this device
                skipped++;

                if (row) {
                    const skipReason = this.getVendorStatusMessage(device.vendor);
                    row.querySelector('.warranty-status').innerHTML = `⏭️ Skipped`;
                    row.querySelector('.warranty-type').textContent = skipReason;
                    row.querySelector('.warranty-ship').textContent = 'N/A';
                    row.querySelector('.warranty-end').textContent = 'N/A';
                    row.querySelector('.warranty-days').textContent = 'N/A';
                }

                const skipResult = {
                    vendor: device.vendor,
                    serviceTag: device.serialNumber,
                    status: 'skipped',
                    message: this.getVendorStatusMessage(device.vendor),
                    originalData: device.originalData,
                    deviceName: device.deviceName,
                    location: device.location,
                    model: device.model
                };
                this.processedResults.push(skipResult);

                // Mark device as skipped
                device.processingState = 'skipped';
                device.lastProcessed = new Date().toISOString();
                device.skipReason = this.getVendorStatusMessage(device.vendor);

                processed++;
                continue;
            }

            // Update processing state with current device
            this.processingState.currentDevice = device;
            this.processingState.processedDevices = processed;

            if (row) {
                // Update status to processing with enhanced visual feedback
                row.querySelector('.warranty-status').innerHTML = '🔄 Processing...';
                row.classList.add('processing');
            }

            try {
                const result = await this.warrantyService.lookupWarranty(device.vendor, device.serialNumber);

                // Enhance result with additional device information
                result.originalData = device.originalData;
                result.deviceName = device.deviceName;
                result.location = device.location;
                result.model = result.model || device.model;

                this.processedResults.push(result);
                successful++;

                // Update the table row with warranty information
                if (row) {
                    this.updateRowWithWarrantyData(row, result);
                }

                // Mark device as successfully processed
                device.processingState = 'success';
                device.lastProcessed = new Date().toISOString();

            } catch (error) {
                const errorResult = {
                    vendor: device.vendor,
                    serviceTag: device.serialNumber,
                    status: 'error',
                    message: error.message,
                    originalData: device.originalData,
                    deviceName: device.deviceName,
                    location: device.location,
                    model: device.model
                };
                this.processedResults.push(errorResult);
                failed++;

                // Update the table row with error information
                if (row) {
                    this.updateRowWithWarrantyData(row, errorResult);
                }

                // Mark device as failed with error details
                device.processingState = 'failed';
                device.lastProcessed = new Date().toISOString();
                device.errorMessage = error.message;
                device.isRetryable = this.isRetryableError(error);
            }

            processed++;

            // Save session state after each device (checkpoint)
            this.saveSession(allDevices, processed, successful, failed, skipped);

            // Respectful delay to prevent overwhelming the API (2 seconds between requests)
            // Only delay for actual API calls, not for skipped devices
            if (!this.processingCancelled && processed < total && (device.isSupported && device.apiConfigured)) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        this.updateProgress(processed, total, successful, failed, skipped);

        // Update processing state
        this.processingState.isActive = false;
        this.processingState.isCompleted = true;
        this.processingState.endTime = Date.now();
        this.processingState.processedDevices = processed;

        await this.finalizeProcessing(successful, failed, skipped);

        // Complete session when processing finishes successfully (but keep it visible)
        if (!this.processingCancelled && this.sessionId) {
            try {
                await window.sessionService.completeSession(this.sessionId, 'completed');
                // DON'T clear the session - keep it visible for results viewing
                console.log('Session completed successfully - results remain visible');

                // Update UI to show session is completed but still accessible
                this.showSessionCompletedState();
            } catch (error) {
                console.error('Error completing session:', error);
                // Still show completion state even if session update fails
                try {
                    this.showSessionCompletedState();
                } catch (uiError) {
                    console.error('Error showing completion state:', uiError);
                }
            }
        }

        // Show retry failed button if there are failed devices
        await this.updateRetryFailedButton();
    }

    /**
     * Calculate days remaining from warranty end date locally
     */
    calculateDaysRemaining(endDate) {
        if (!endDate || endDate === 'N/A' || endDate === null) {
            return null;
        }

        try {
            const today = new Date();
            const warrantyEnd = new Date(endDate);

            // Reset time to start of day for accurate day calculation
            today.setHours(0, 0, 0, 0);
            warrantyEnd.setHours(0, 0, 0, 0);

            const diffTime = warrantyEnd - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays;
        } catch (error) {
            console.error('Error calculating days remaining:', error);
            return null;
        }
    }

    /**
     * Update a table row with warranty data with enhanced visual feedback
     */
    updateRowWithWarrantyData(row, result) {
        console.log(`🎯 updateRowWithWarrantyData called for ${result.serviceTag}:`, result);

        const statusCell = row.querySelector('.warranty-status');
        const typeCell = row.querySelector('.warranty-type');
        const shipCell = row.querySelector('.warranty-ship');
        const endCell = row.querySelector('.warranty-end');
        const daysCell = row.querySelector('.warranty-days');

        console.log(`🎯 Found cells:`, {
            statusCell: !!statusCell,
            typeCell: !!typeCell,
            shipCell: !!shipCell,
            endCell: !!endCell,
            daysCell: !!daysCell
        });

        if (!statusCell || !typeCell || !shipCell || !endCell || !daysCell) {
            console.error(`❌ Missing cells for ${result.serviceTag}! Row HTML:`, row.innerHTML);
            return;
        }

        // Remove processing class and add completion animation
        row.classList.remove('processing');
        row.classList.add('data-updated');

        // Add timestamp for live updates
        const timestamp = new Date().toLocaleTimeString();

        // Update cells with warranty data and enhanced formatting
        if (result.status === 'active') {
            statusCell.innerHTML = `<span class="status-active">✅ Active</span>`;
        } else if (result.status === 'expired') {
            statusCell.innerHTML = `<span class="status-expired">⚠️ Expired</span>`;
        } else if (result.status === 'error') {
            statusCell.innerHTML = `<span class="status-error">❌ Error</span>`;
        } else {
            statusCell.innerHTML = `<span class="status-${result.status}">${this.formatStatus(result.status)}</span>`;
        }

        // Enhanced warranty type display with comprehensive information
        if (result.warrantyType) {
            let warrantyDisplay = `<strong>${result.warrantyType}</strong>`;

            // Add warranty count indicator if multiple warranties
            if (result.warrantyCount && result.warrantyCount > 1) {
                warrantyDisplay += `<br><small style="color: #6c757d;">${result.warrantyCount} warranties total</small>`;
            }

            // Add clickable warranty details if multiple warranties exist
            if (result.warrantyDetails && result.warrantyDetails.length > 1) {
                const tooltipDetails = result.warrantyDetails.map(w =>
                    `${w.type}: ${w.endDate} (${w.isActive ? 'Active' : 'Expired'})`
                ).join('\n');

                typeCell.innerHTML = `<span title="${tooltipDetails}" style="cursor: pointer; text-decoration: underline;" onclick="window.warrantyChecker.showWarrantyDetails('${result.serviceTag}')">${warrantyDisplay}</span>`;
            } else {
                typeCell.innerHTML = warrantyDisplay;
            }
        } else if (result.status === 'error') {
            typeCell.innerHTML = `<em>Error: ${result.message || 'Unknown error'}</em>`;
        } else {
            typeCell.textContent = 'N/A';
        }

        // Ship date formatting - ALWAYS show if available
        if (result.shipDate) {
            const shipDate = new Date(result.shipDate);
            shipCell.innerHTML = `<strong>${shipDate.toLocaleDateString()}</strong>`;
        } else {
            shipCell.textContent = 'N/A';
        }

        // Enhanced warranty end date formatting
        if (result.endDate) {
            const endDate = new Date(result.endDate);
            endCell.innerHTML = `<strong>${endDate.toLocaleDateString()}</strong>`;
        } else {
            endCell.textContent = 'N/A';
        }

        // Calculate days remaining locally from end date (avoids API calls)
        const calculatedDays = this.calculateDaysRemaining(result.endDate);

        if (calculatedDays !== null) {
            let daysDisplay;

            if (calculatedDays > 0) {
                // Active warranty
                if (calculatedDays <= 30) {
                    daysDisplay = `<span style="color: #fd7e14;"><strong>${calculatedDays}</strong> (Expiring Soon)</span>`;
                } else if (calculatedDays <= 90) {
                    daysDisplay = `<span style="color: #ffc107;"><strong>${calculatedDays}</strong></span>`;
                } else {
                    daysDisplay = `<span style="color: #28a745;"><strong>${calculatedDays}</strong></span>`;
                }
            } else if (calculatedDays === 0) {
                daysDisplay = `<span style="color: #fd7e14;"><strong>0</strong> (Expires Today)</span>`;
            } else {
                // Expired warranty
                const daysExpired = Math.abs(calculatedDays);
                daysDisplay = `<span style="color: #dc3545;">-${daysExpired} (Expired)</span>`;
            }

            daysCell.innerHTML = daysDisplay;
        } else {
            daysCell.textContent = 'N/A';
        }

        // Add processing timestamp as tooltip
        row.title = `Last updated: ${timestamp}`;

        // Visual flash is now handled by applyVisualFlash method

        // Add visual feedback for successful data retrieval
        if (result.status === 'active' || result.status === 'expired') {
            row.classList.add('warranty-success');
            // Flash green briefly to show successful update
            setTimeout(() => {
                row.classList.remove('warranty-success');
            }, 2000);
        } else if (result.status === 'error') {
            row.classList.add('warranty-error');
            setTimeout(() => {
                row.classList.remove('warranty-error');
            }, 2000);
        }

        console.log(`✅ Row updated for ${result.serviceTag} - Status: ${statusCell.innerHTML}, Type: ${typeCell.innerHTML}`);

        // Add a subtle flash animation
        row.style.transition = 'all 0.3s ease';

        // Remove the data-updated class after animation
        setTimeout(() => {
            row.classList.remove('data-updated');
            row.style.transition = '';
        }, 1000);

        console.log(`✅ Live update: ${result.serviceTag} - ${result.status} - ${result.warrantyType || 'N/A'} (${timestamp})`);
    }

    /**
     * Apply visual flash effect to a table row
     */
    applyVisualFlash(row) {
        // Force a very obvious visual refresh
        row.style.backgroundColor = '#ffff00'; // Bright yellow flash
        row.style.border = '2px solid #ff0000'; // Red border
        row.style.transform = 'scale(1.02)'; // Slight scale effect

        setTimeout(() => {
            row.style.backgroundColor = '#e8f5e8'; // Light green
            row.style.border = '1px solid #28a745'; // Green border
            row.style.transform = 'scale(1.0)';
        }, 300);

        setTimeout(() => {
            row.style.backgroundColor = '';
            row.style.border = '';
            row.style.transform = '';
        }, 1500);

        console.log(`🎯 Visual flash applied to row for device at index ${row.dataset.deviceIndex}`);
    }

    /**
     * Update device state in database
     */
    async updateDeviceInDatabase(device, result, status) {
        try {
            if (!this.sessionId || !window.sessionService) {
                console.log(`⚠️ No session or sessionService available for database update: ${device.serialNumber}`);
                return;
            }

            // Find device in database by session and serial number
            const deviceData = await window.sessionService.findDeviceBySerial(this.sessionId, device.serialNumber);
            if (!deviceData) {
                console.log(`⚠️ Device not found in database: ${device.serialNumber}`);
                return;
            }

            // Prepare state data based on result with automatic standardization
            const stateData = {
                processing_state: status === 'success' ? 'success' : status === 'error' ? 'failed' : 'skipped',
                // Apply standardization to all data before storing
                vendor: this.standardizeVendor(device.vendor),
                model: this.standardizeModel(result.model || device.model, device.vendor),
                warranty_status: this.standardizeWarrantyStatus(result.status),
                warranty_type: this.standardizeWarrantyType(result.warrantyType || result.type, result.status, result.message),
                warranty_end_date: this.standardizeDate(result.endDate),
                warranty_days_remaining: result.daysRemaining || null,
                ship_date: this.standardizeDate(result.shipDate),
                error_message: status === 'error' ? this.standardizeMessage(result.message, result.status) : null,
                is_retryable: status === 'error' ? (result.retryable !== false) : null,
                retry_count: 0,
                last_processed_at: new Date().toISOString()
            };

            // Update device in database
            await window.sessionService.updateDeviceState(deviceData.id, stateData);
            console.log(`💾 Database updated for ${device.serialNumber}: ${stateData.processing_state} -> ${stateData.warranty_status || 'N/A'}`);

        } catch (error) {
            console.error(`❌ Failed to update device in database: ${device.serialNumber}`, error);
        }
    }

    /**
     * Show session completed state with persistent results
     */
    showSessionCompletedState() {
        try {
            // Update process button to show completion
            if (this.processBtn) {
                this.processBtn.textContent = '✅ Processing Complete';
                this.processBtn.disabled = true;
                this.processBtn.style.background = '#28a745';
                this.processBtn.style.color = 'white';
            }

            // Show clear session button for manual cleanup
            if (this.clearSessionBtn) {
                this.clearSessionBtn.style.display = 'inline-block';
                this.clearSessionBtn.textContent = '🗑️ Clear Results';
            }

            // Add completion timestamp to results
            this.addCompletionTimestamp();

            // Keep results table visible and scrollable
            if (this.resultsContainer) {
                this.resultsContainer.style.display = 'block';
            }

            console.log('Session completed - results remain visible for review');
        } catch (error) {
            console.error('Error showing session completed state:', error);
            // Continue execution despite UI error
        }
    }

    /**
     * Add completion timestamp to results
     */
    addCompletionTimestamp() {
        const timestamp = new Date().toLocaleString();

        // Add or update completion info
        let completionInfo = document.getElementById('completion-info');
        if (!completionInfo) {
            completionInfo = document.createElement('div');
            completionInfo.id = 'completion-info';
            completionInfo.style.cssText = `
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                font-weight: bold;
            `;

            // Safely insert the completion info
            if (this.resultsContainer && this.resultsTable) {
                // Check if resultsTable is actually a child of resultsContainer
                if (this.resultsContainer.contains(this.resultsTable)) {
                    this.resultsContainer.insertBefore(completionInfo, this.resultsTable);
                } else {
                    // Fallback: prepend to results container
                    this.resultsContainer.prepend(completionInfo);
                }
            } else if (this.resultsContainer) {
                // Fallback: append to results container
                this.resultsContainer.prepend(completionInfo);
            } else {
                // Last resort: append to document body
                document.body.appendChild(completionInfo);
            }
        }

        completionInfo.innerHTML = `
            ✅ <strong>Processing Completed</strong> at ${timestamp}<br>
            📊 Results are saved and will persist until manually cleared<br>
            💾 You can safely upload a new CSV or refresh the page - these results will remain
        `;
    }

    /**
     * Finalize processing and show summary
     */
    async finalizeProcessing(successful, failed, skipped = 0) {
        this.exportBtn.disabled = false;

        let message = `✅ Processing complete!\n`;
        message += `✅ Successful: ${successful}\n`;
        if (failed > 0) {
            message += `❌ Failed: ${failed}\n`;
        }
        if (skipped > 0) {
            message += `⏭️ Skipped: ${skipped} (unconfigured vendors)`;
        }

        // Add retry information if there are retryable failures
        const retryableFailures = this.getFailedDevices().length;
        if (retryableFailures > 0) {
            message += `\n\n🔄 ${retryableFailures} failed devices can be retried`;
        }

        message += `\n\n📊 Results will remain visible until manually cleared.`;
        message += `\n💾 You can safely upload a new CSV - these results will persist.`;

        this.showSuccess(message);

        // Update retry button visibility
        await this.updateRetryFailedButton();
    }

    /**
     * Mark devices as processing in the UI
     */
    markDevicesAsProcessing(devices) {
        const allDevices = this.getValidDevicesFromCsv();

        devices.forEach(device => {
            const deviceIndex = allDevices.findIndex(d =>
                d.serialNumber === device.serialNumber && d.vendor === device.vendor
            );

            if (deviceIndex !== -1) {
                const row = this.resultsTable.querySelector(`tbody tr[data-device-index="${deviceIndex}"]`);
                if (row) {
                    row.querySelector('.warranty-status').innerHTML = '🔄 Processing...';
                    row.classList.add('processing');
                }
            }
        });
    }

    /**
     * Group devices by vendor for concurrent processing
     */
    groupDevicesByVendor(devices) {
        const grouped = {};
        devices.forEach(device => {
            const vendor = device.vendor.toLowerCase();
            if (!grouped[vendor]) {
                grouped[vendor] = [];
            }
            grouped[vendor].push(device);
        });
        return grouped;
    }

    /**
     * Update device row in real-time during concurrent processing
     */
    updateDeviceRowRealtime(device, result, status) {
        try {
            console.log(`🔄 Updating row for ${device.serialNumber} with status: ${status}`);

            // Find the device in the original list to get its index
            const allDevices = this.getValidDevicesFromCsv();
            console.log(`📊 Total devices in list: ${allDevices.length}`);

            const deviceIndex = allDevices.findIndex(d =>
                d.serialNumber === device.serialNumber && d.vendor === device.vendor
            );

            console.log(`📍 Device index for ${device.serialNumber}: ${deviceIndex}`);

            if (deviceIndex === -1) {
                console.warn(`❌ Device not found in list: ${device.serialNumber}`);
                console.log(`🔍 Looking for: vendor=${device.vendor}, serial=${device.serialNumber}`);
                console.log(`🔍 First few devices:`, allDevices.slice(0, 3).map(d => ({vendor: d.vendor, serial: d.serialNumber})));
                return;
            }

            const row = this.resultsTable.querySelector(`tbody tr[data-device-index="${deviceIndex}"]`);
            if (!row) {
                console.warn(`❌ Row not found for device index: ${deviceIndex}`);
                console.log(`📊 Available rows:`, this.resultsTable.querySelectorAll('tbody tr').length);
                console.log(`🔍 Looking for selector: tbody tr[data-device-index="${deviceIndex}"]`);

                // Check if any rows have data-device-index attributes
                const allRows = this.resultsTable.querySelectorAll('tbody tr');
                console.log(`🔍 Sample row attributes:`, allRows.length > 0 ? allRows[0].dataset : 'No rows found');
                return;
            }

            console.log(`✅ Found row for ${device.serialNumber}, updating with status: ${status}`);

            // Remove processing class
            row.classList.remove('processing');

            // Apply visual flash to ALL updates
            this.applyVisualFlash(row);

            // Update based on status
            switch (status) {
                case 'success':
                    console.log(`🔧 Calling updateRowWithWarrantyData for ${device.serialNumber}:`, result);
                    this.updateRowWithWarrantyData(row, result);
                    // Add subtle success indicator without scrolling
                    row.classList.add('recently-updated');
                    setTimeout(() => row.classList.remove('recently-updated'), 3000);
                    break;
                case 'error':
                    row.querySelector('.warranty-status').innerHTML = '❌ Error';
                    row.querySelector('.warranty-type').textContent = 'Error';
                    row.querySelector('.warranty-ship').textContent = 'N/A';
                    row.querySelector('.warranty-end').textContent = 'N/A';
                    row.querySelector('.warranty-days').textContent = 'N/A';
                    row.classList.add('error');
                    break;
                case 'skipped':
                    const skipReason = this.getVendorStatusMessage(device.vendor);
                    row.querySelector('.warranty-status').innerHTML = '⏭️ Skipped';
                    row.querySelector('.warranty-type').textContent = skipReason;
                    row.querySelector('.warranty-ship').textContent = 'N/A';
                    row.querySelector('.warranty-end').textContent = 'N/A';
                    row.querySelector('.warranty-days').textContent = 'N/A';
                    row.classList.add('skipped');
                    break;
            }

            // Update progress counters
            if (this.concurrentProgress) {
                this.concurrentProgress.processed++;

                switch (status) {
                    case 'success':
                        this.concurrentProgress.successful++;
                        break;
                    case 'error':
                        this.concurrentProgress.failed++;
                        break;
                    case 'skipped':
                        this.concurrentProgress.skipped++;
                        break;
                    default:
                        console.log(`⚠️ Unknown status for progress counting: "${status}" for ${device.serialNumber}`);
                        // Treat unknown status as failed for now
                        this.concurrentProgress.failed++;
                        break;
                }

                // Update progress display
                this.updateProgress(
                    this.concurrentProgress.processed,
                    this.concurrentProgress.total,
                    this.concurrentProgress.successful,
                    this.concurrentProgress.failed,
                    this.concurrentProgress.skipped,
                    device
                );
            }

            // Show live update notification
            const timestamp = new Date().toLocaleTimeString();
            console.log(`✅ Live update: ${device.serialNumber} - ${status} - ${result.message || 'N/A'} (${timestamp})`);

        } catch (error) {
            console.error('Error updating device row:', error);
        }
    }

    /**
     * Update progress display with enhanced information
     */
    updateProgress(processed, total, successful, failed, skipped = 0, currentDevice = null) {
        console.log(`📊 updateProgress called: ${processed}/${total} (${Math.round((processed / total) * 100)}%) - S:${successful} F:${failed} SK:${skipped}`);

        const percentage = Math.round((processed / total) * 100);
        this.progressBar.style.width = `${percentage}%`;

        console.log(`📊 Progress bar updated to ${percentage}%`);

        // Enhanced progress text with current device info
        let progressText = `${processed}/${total} (${percentage}%)`;
        if (currentDevice) {
            progressText += ` - Processing: ${currentDevice.vendor} ${currentDevice.serialNumber}`;
        }
        this.progressText.textContent = progressText;

        // Enhanced status with real-time counts
        this.statusText.textContent = `✅ ${successful} successful, ❌ ${failed} failed, ⏭️ ${skipped} skipped`;

        // Update live statistics display
        if (this.liveStats && processed > 0) {
            this.liveStats.style.display = 'flex';
            this.processedCountElement.textContent = processed;
            this.successCountElement.textContent = successful;
            this.failedCountElement.textContent = failed;
            this.skippedCountElement.textContent = skipped;
        }

        // Add estimated time remaining if we have enough data
        if (processed > 0 && processed < total) {
            const avgTimePerDevice = (Date.now() - this.processingStartTime) / processed;
            const remainingDevices = total - processed;
            const estimatedTimeRemaining = Math.round((avgTimePerDevice * remainingDevices) / 1000);

            if (estimatedTimeRemaining > 0) {
                const minutes = Math.floor(estimatedTimeRemaining / 60);
                const seconds = estimatedTimeRemaining % 60;
                const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                this.statusText.textContent += ` | ETA: ${timeText}`;
            }
        }
    }

    /**
     * Show results table
     */
    showResults() {
        this.resultsContainer.style.display = 'block';
        this.exportBtn.disabled = false;

        // Update table headers for enhanced information
        const thead = this.resultsTable.querySelector('thead tr');
        thead.innerHTML = `
            <th>Device Name</th>
            <th>Location</th>
            <th>Vendor</th>
            <th>Serial Number</th>
            <th>Model</th>
            <th>Status</th>
            <th>Warranty Type</th>
            <th>End Date</th>
            <th>Days Remaining</th>
            <th>Message</th>
        `;

        // Clear existing table
        const tbody = this.resultsTable.querySelector('tbody');
        tbody.innerHTML = '';

        // Add results to table
        this.processedResults.forEach(result => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${result.deviceName || 'Unknown'}</td>
                <td>${result.location || 'Unknown'}</td>
                <td>${result.vendor || 'Unknown'}</td>
                <td>${result.serviceTag || 'Unknown'}</td>
                <td>${result.model || 'Unknown'}</td>
                <td><span class="status-${result.status}">${this.formatStatus(result.status)}</span></td>
                <td>${this.formatWarrantyStatus(result.status)}</td>
                <td>${result.warrantyType || result.type || 'N/A'}</td>
                <td>${result.shipDate || 'N/A'}</td>
                <td>${result.endDate || 'N/A'}</td>
                <td>${result.daysRemaining || 'N/A'}</td>
            `;
        });
    }

    /**
     * Format status for display
     */
    formatStatus(status) {
        const statusMap = {
            'active': '✅ Active',
            'expired': '⏰ Expired',
            'not_found': '❓ Not Found',
            'error': '❌ Error'
        };
        return statusMap[status] || status;
    }

    /**
     * Standardize string values for consistent export
     */
    standardizeString(value) {
        if (!value || value === null || value === undefined) return '';
        return String(value).trim();
    }

    /**
     * Standardize vendor names
     */
    standardizeVendor(vendor) {
        if (!vendor) return '';
        const vendorLower = vendor.toLowerCase();
        if (vendorLower.includes('dell')) return 'Dell';
        if (vendorLower.includes('lenovo')) return 'Lenovo';
        if (vendorLower.includes('hp') || vendorLower.includes('hewlett')) return 'HP';
        return vendor.charAt(0).toUpperCase() + vendor.slice(1).toLowerCase();
    }

    /**
     * Standardize model names for consistent display
     */
    standardizeModel(model, vendor) {
        if (!model) return '';

        // Clean up Lenovo's verbose model paths
        if (vendor && vendor.toLowerCase().includes('lenovo')) {
            // Extract meaningful model from Lenovo's path format
            const parts = model.split('/');
            const lastPart = parts[parts.length - 1];

            // If last part looks like a model number, use it
            if (lastPart && lastPart.match(/^[A-Z0-9]+$/)) {
                return lastPart;
            }

            // Otherwise, try to find a meaningful model name
            for (const part of parts) {
                if (part.includes('THINKPAD') || part.includes('THINKBOOK') || part.includes('THINKCENTRE')) {
                    return part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
                if (part.match(/^[0-9]{2}[A-Z]{2}$/)) {
                    return part;
                }
            }
        }

        // Clean up Dell models
        if (vendor && vendor.toLowerCase().includes('dell')) {
            return model.replace(/^DELL\s+/i, '').trim();
        }

        return model.trim();
    }

    /**
     * Standardize warranty status
     */
    standardizeWarrantyStatus(status) {
        if (!status) return 'Unknown';
        const statusLower = status.toLowerCase();
        if (statusLower.includes('active') || statusLower === 'active') return 'Active';
        if (statusLower.includes('expired') || statusLower === 'expired') return 'Expired';
        if (statusLower.includes('error') || statusLower === 'error') return 'Error';
        if (statusLower.includes('skipped') || statusLower === 'skipped') return 'Skipped';
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }

    /**
     * Standardize warranty type names
     */
    standardizeWarrantyType(warrantyType, status, message) {
        if (!warrantyType) {
            if (status === 'skipped') return `Skipped - ${message || 'Unknown reason'}`;
            if (status === 'error') return `Error - ${message || 'Processing failed'}`;
            return 'Unknown';
        }

        // Clean up common warranty type variations
        return warrantyType
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }

    /**
     * Standardize date format to YYYY-MM-DD
     */
    standardizeDate(dateValue) {
        if (!dateValue || dateValue === null || dateValue === undefined) return '';

        try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '';

            // Return in YYYY-MM-DD format
            return date.toISOString().split('T')[0];
        } catch (error) {
            return '';
        }
    }

    /**
     * Standardize days remaining values
     */
    standardizeDaysRemaining(daysRemaining, status) {
        if (status === 'expired') return '';
        if (!daysRemaining && daysRemaining !== 0) return '';

        const days = parseInt(daysRemaining);
        if (isNaN(days)) return '';

        return days.toString();
    }

    /**
     * Standardize boolean values
     */
    standardizeBoolean(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const valueLower = value.toLowerCase();
            return valueLower === 'true' || valueLower === 'yes' || valueLower === '1';
        }
        return Boolean(value);
    }

    /**
     * Standardize message content
     */
    standardizeMessage(message, status) {
        if (!message) {
            if (status === 'active') return 'Active warranty';
            if (status === 'expired') return 'Warranty expired';
            if (status === 'error') return 'Processing error';
            if (status === 'skipped') return 'Device skipped';
            return '';
        }
        return message.trim();
    }

    /**
     * Standardize processing notes
     */
    standardizeProcessingNotes(status, message) {
        switch (status) {
            case 'skipped':
                return `Device skipped - ${message || 'Unknown reason'}`;
            case 'error':
                return `Processing failed - ${message || 'Unknown error'}`;
            case 'active':
            case 'expired':
                return 'Successfully processed';
            default:
                return `Status: ${status} - ${message || 'No additional notes'}`;
        }
    }

    /**
     * Standardize numeric values
     */
    standardizeNumber(value) {
        if (!value && value !== 0) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        return num.toString();
    }

    // Manual migration function removed - automatic standardization now handles this

    /**
     * Export results to CSV
     */
    exportResults() {
        if (this.processedResults.length === 0) return;

        const csvData = this.processedResults.map(result => ({
            device_name: this.standardizeString(result.deviceName),
            location: this.standardizeString(result.location),
            vendor: this.standardizeVendor(result.vendor),
            serial_number: this.standardizeString(result.serviceTag),
            model: this.standardizeModel(result.model, result.vendor),
            warranty_status: this.standardizeWarrantyStatus(result.status),
            warranty_type: this.standardizeWarrantyType(result.warrantyType, result.status, result.message),
            warranty_start_date: this.standardizeDate(result.startDate),
            warranty_end_date: this.standardizeDate(result.endDate),
            days_remaining: this.standardizeDaysRemaining(result.daysRemaining, result.status),
            is_active: this.standardizeBoolean(result.isActive),
            ship_date: this.standardizeDate(result.shipDate),
            message: this.standardizeMessage(result.message, result.status),
            lookup_date: this.standardizeDate(new Date().toISOString()),
            processing_notes: this.standardizeProcessingNotes(result.status, result.message),
            // Include key original CSV data for reference
            original_name: this.standardizeString(result.originalData?.Name || result.originalData?.['Device Name'] || result.originalData?.['Computer Name']),
            original_model: this.standardizeString(result.originalData?.['System Model'] || result.originalData?.['Model']),
            processor: this.standardizeString(result.originalData?.Processor),
            ram_gb: this.standardizeNumber(result.originalData?.['RAM (GB)'] || result.originalData?.['Total Physical Memory (GB)']),
            installed_date: this.standardizeDate(result.originalData?.['Installed Date'] || result.originalData?.['Install Date']),
            last_check_date: this.standardizeDate(result.originalData?.['Last Check Date'] || result.originalData?.['Last Check-in Date'])
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `warranty-results-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Show configuration modal
     */
    showConfigModal() {
        console.log('Showing configuration modal');
        if (this.configModal) {
            this.configModal.style.display = 'block';
            console.log('Modal displayed');

            // Initialize modal elements after a short delay to ensure they're rendered
            setTimeout(() => {
                this.initializeModalElements();
            }, 100);
        } else {
            console.error('Config modal element not found');
        }
    }

    /**
     * Initialize modal elements when modal is shown
     */
    initializeModalElements() {
        console.log('Initializing modal elements...');

        const testBtn = document.getElementById('testDellApi');
        const apiKeyInput = document.getElementById('dellApiKey');
        const apiSecretInput = document.getElementById('dellApiSecret');

        console.log('Test button in modal:', testBtn);
        console.log('API key input in modal:', apiKeyInput);
        console.log('API secret input in modal:', apiSecretInput);

        if (testBtn && apiKeyInput && apiSecretInput) {
            console.log('Both elements found, setting up functionality');

            // Remove any existing listeners to avoid duplicates
            const newTestBtn = testBtn.cloneNode(true);
            testBtn.parentNode.replaceChild(newTestBtn, testBtn);

            const newApiInput = apiKeyInput.cloneNode(true);
            apiKeyInput.parentNode.replaceChild(newApiInput, apiKeyInput);

            // Add fresh event listeners
            newTestBtn.addEventListener('click', () => {
                console.log('Test button clicked');
                this.testDellApiConnection();
            });

            newApiInput.addEventListener('input', (e) => {
                const hasKey = e.target.value.trim().length > 0;
                newTestBtn.disabled = !hasKey;
                console.log('Modal input changed, hasKey:', hasKey, 'button disabled:', newTestBtn.disabled);
            });

            // Set initial state
            const hasKey = newApiInput.value.trim().length > 0;
            newTestBtn.disabled = !hasKey;
            console.log('Initial button state - hasKey:', hasKey, 'disabled:', newTestBtn.disabled);

            // Update references
            this.testDellApiBtn = newTestBtn;
            this.dellApiKeyInput = newApiInput;

        } else {
            console.error('Modal elements not found after delay');
            if (!testBtn) console.error('Test button not found');
            if (!apiInput) console.error('API input not found');
        }
    }

    /**
     * Hide configuration modal
     */
    hideConfigModal() {
        console.log('Hiding configuration modal');
        if (this.configModal) {
            this.configModal.style.display = 'none';
            console.log('Modal hidden');
        } else {
            console.error('Config modal element not found');
        }
    }

    /**
     * Save configuration with validation and feedback
     */
    async saveConfiguration() {
        console.log('Save configuration called');

        if (!this.dellApiKeyInput) {
            console.error('Dell API key input not found');
            this.showError('Configuration error: Dell API key input not found');
            return;
        }

        const dellApiKey = this.dellApiKeyInput.value.trim();
        const dellApiSecret = this.dellApiSecretInput ? this.dellApiSecretInput.value.trim() : '';
        const lenovoApiKey = this.lenovoApiKeyInput ? this.lenovoApiKeyInput.value.trim() : '';

        console.log('Dell API key length:', dellApiKey.length);
        console.log('Dell API secret length:', dellApiSecret.length);
        console.log('Lenovo API key length:', lenovoApiKey.length);

        // Show saving indicator
        this.saveConfigBtn.disabled = true;
        this.saveConfigBtn.textContent = 'Validating...';

        try {
            if (dellApiKey && dellApiSecret) {
                // Basic validation - check if both credentials look valid
                if (dellApiKey.length < 10) {
                    throw new Error('API key appears to be too short. Please check your Dell API key.');
                }
                if (dellApiSecret.length < 10) {
                    throw new Error('API secret appears to be too short. Please check your Dell API secret.');
                }

                // Perform mock validation first (format and structure checks)
                try {
                    this.showMessage('🔍 Validating Dell API credentials format...', 'info');
                    const keyValid = await this.validateDellApiKey(dellApiKey);
                    const secretValid = await this.validateDellApiKey(dellApiSecret);

                    if (keyValid && secretValid) {
                        // Save both credentials after successful validation
                        localStorage.setItem('dell_api_key', dellApiKey);
                        localStorage.setItem('dell_api_secret', dellApiSecret);
                        this.updateApiStatus();
                        this.showSuccess('✅ Dell API credentials format validated and saved successfully! OAuth 2.0 tokens will be generated during warranty processing.');
                    }
                } catch (error) {
                    // Validation failed - don't save the credentials
                    this.showError(`❌ API Credentials Validation Failed: ${error.message}`);
                    return; // Don't save invalid credentials
                }
            } else {
                throw new Error('Both Dell API Key and API Secret are required for OAuth 2.0 authentication.');
            }

            // Handle Lenovo API key
            if (lenovoApiKey) {
                if (lenovoApiKey.length < 10) {
                    throw new Error('Lenovo API Client ID appears to be too short. Please check your Lenovo API key.');
                }

                // Save Lenovo API key
                localStorage.setItem('lenovo_api_key', lenovoApiKey);
                this.updateApiStatus();
                this.showSuccess('✅ Lenovo API Client ID saved successfully!');
            }

            // Close modal after successful save
            setTimeout(() => {
                this.hideConfigModal();
            }, 2000);

        } catch (error) {
            this.showError(`❌ Configuration Error: ${error.message}`);
        } finally {
            // Reset button
            this.saveConfigBtn.disabled = false;
            this.saveConfigBtn.textContent = 'Save';
        }
    }

    /**
     * Validate Dell API key using mock validation (CORS-free)
     */
    async validateDellApiKey(apiKey) {
        console.log('Starting mock API key validation...');

        // Simulate API validation delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Comprehensive API key format validation
        const validationResult = this.performMockApiKeyValidation(apiKey);

        if (!validationResult.isValid) {
            throw new Error(validationResult.error);
        }

        console.log('Mock validation passed:', validationResult.message);
        return true;
    }

    /**
     * Perform comprehensive mock API key validation
     */
    performMockApiKeyValidation(apiKey) {
        // Dell API key characteristics (based on typical patterns)
        const validations = [
            {
                test: () => apiKey && apiKey.length > 0,
                error: 'API key cannot be empty'
            },
            {
                test: () => apiKey.length >= 20,
                error: 'Dell API key appears too short (minimum 20 characters expected)'
            },
            {
                test: () => apiKey.length <= 100,
                error: 'Dell API key appears too long (maximum 100 characters expected)'
            },
            {
                test: () => !/\s/.test(apiKey),
                error: 'Dell API key should not contain spaces'
            },
            {
                test: () => /^[a-zA-Z0-9\-_]+$/.test(apiKey),
                error: 'Dell API key contains invalid characters (only alphanumeric, hyphens, and underscores allowed)'
            },
            {
                test: () => !apiKey.toLowerCase().includes('test'),
                error: 'API key appears to be a test/placeholder value'
            },
            {
                test: () => !apiKey.toLowerCase().includes('example'),
                error: 'API key appears to be an example/placeholder value'
            },
            {
                test: () => !apiKey.toLowerCase().includes('sample'),
                error: 'API key appears to be a sample/placeholder value'
            },
            {
                test: () => !/^(.)\1+$/.test(apiKey),
                error: 'API key appears to be invalid (repeated characters)'
            },
            {
                test: () => apiKey !== '12345678901234567890',
                error: 'API key appears to be a placeholder value'
            }
        ];

        // Run all validations
        for (const validation of validations) {
            if (!validation.test()) {
                return {
                    isValid: false,
                    error: validation.error
                };
            }
        }

        // Additional heuristic checks
        const hasGoodEntropy = this.checkApiKeyEntropy(apiKey);
        if (!hasGoodEntropy) {
            return {
                isValid: false,
                error: 'API key appears to have low entropy (may be invalid or placeholder)'
            };
        }

        return {
            isValid: true,
            message: 'API key format validation passed. Key appears to be properly formatted for Dell API.'
        };
    }

    /**
     * Check if API key has reasonable entropy (not too repetitive)
     */
    checkApiKeyEntropy(apiKey) {
        const uniqueChars = new Set(apiKey.toLowerCase()).size;
        const entropyRatio = uniqueChars / apiKey.length;

        // Expect at least 30% unique characters for a valid API key
        return entropyRatio >= 0.3 && uniqueChars >= 8;
    }

    /**
     * Test Dell API connection with mock scenarios
     */
    async testDellApiConnection() {
        const apiKey = this.dellApiKeyInput.value.trim();

        if (!apiKey) {
            this.showTestResult('❌ Please enter an API key first', 'error');
            return;
        }

        // Disable button and show testing state
        this.testDellApiBtn.disabled = true;
        this.testDellApiBtn.textContent = '🔄 Testing...';
        this.showTestResult('🧪 Running API connection test...', 'info');

        try {
            // First validate the format
            const formatValidation = this.performMockApiKeyValidation(apiKey);
            if (!formatValidation.isValid) {
                throw new Error(formatValidation.error);
            }

            // Simulate API connection test with realistic scenarios
            await this.simulateApiConnectionTest(apiKey);

            this.showTestResult('✅ API connection test passed! Key format is valid and connection simulation successful.', 'success');

        } catch (error) {
            this.showTestResult(`❌ Test failed: ${error.message}`, 'error');
        } finally {
            // Reset button
            this.testDellApiBtn.disabled = false;
            this.testDellApiBtn.textContent = '🧪 Test API Connection';
        }
    }

    /**
     * Test Lenovo API connection
     */
    async testLenovoApiConnection() {
        const apiKey = this.lenovoApiKeyInput.value.trim();
        const savedApiKey = localStorage.getItem('lenovo_api_key');

        console.log('🔍 Lenovo API Test Debug:');
        console.log('  Input field value:', apiKey);
        console.log('  Saved in localStorage:', savedApiKey);
        console.log('  Input field element:', this.lenovoApiKeyInput);

        // Disable button and show testing state
        this.testLenovoApiBtn.disabled = true;
        this.testLenovoApiBtn.textContent = '🔄 Testing...';
        this.showLenovoTestResult('🧪 Running Lenovo API connection test...', 'info');

        try {
            if (!apiKey) {
                // Test without API key to verify endpoint connectivity
                this.showLenovoTestResult('🔍 Testing API endpoint connectivity...', 'info');
                await new Promise(resolve => setTimeout(resolve, 500));

                // Try to make a request without API key to test endpoint
                const response = await fetch('https://supportapi.lenovo.com/v2.5/warranty', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({ Serial: 'TEST123' })
                });

                if (response.status === 401) {
                    this.showLenovoTestResult('✅ API endpoint is reachable. Please enter your ClientID to test authentication.', 'warning');
                } else {
                    this.showLenovoTestResult('⚠️ Unexpected response from API endpoint. Please enter your ClientID to test properly.', 'warning');
                }
                return;
            }

            // Save the API key temporarily for testing
            console.log('💾 Temporarily saving Lenovo API key for testing...');
            localStorage.setItem('lenovo_api_key', apiKey);

            // Test with the warranty service using provided API key
            this.showLenovoTestResult('🔍 Testing API authentication...', 'info');
            const result = await this.warrantyService.lookupWarranty('lenovo', 'PF2ABCDE');

            if (result) {
                this.showLenovoTestResult('✅ Lenovo API connection test passed! ClientID is working correctly.', 'success');
            } else {
                this.showLenovoTestResult('⚠️ API responded but returned no data. This may be normal for test serial numbers.', 'warning');
            }

        } catch (error) {
            if (error.message.includes('authentication failed') || error.message.includes('401')) {
                this.showLenovoTestResult('❌ Authentication failed: Please check your Lenovo ClientID.', 'error');
            } else if (error.message.includes('rate limit') || error.message.includes('429')) {
                this.showLenovoTestResult('⚠️ Rate limit reached. ClientID appears valid but too many requests.', 'warning');
            } else if (error.message.includes('not configured')) {
                this.showLenovoTestResult('❌ Please enter your Lenovo ClientID first.', 'error');
            } else if (error.message.includes('CORS') || error.message.includes('network')) {
                this.showLenovoTestResult('⚠️ Network connectivity issue. API endpoint may be reachable but CORS restricted.', 'warning');
            } else {
                this.showLenovoTestResult(`❌ Test failed: ${error.message}`, 'error');
            }
        } finally {
            // Reset button
            this.testLenovoApiBtn.disabled = false;
            this.testLenovoApiBtn.textContent = '🧪 Test API Connection';
        }
    }

    /**
     * Simulate realistic API connection scenarios
     */
    async simulateApiConnectionTest(apiKey) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate different scenarios based on API key characteristics
        const scenarios = this.determineApiTestScenario(apiKey);

        for (const scenario of scenarios) {
            this.showTestResult(`🔍 ${scenario.description}...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 800));

            if (!scenario.success) {
                throw new Error(scenario.error);
            }
        }
    }

    /**
     * Determine realistic test scenarios based on API key
     */
    determineApiTestScenario(apiKey) {
        const scenarios = [
            {
                description: 'Testing API key format',
                success: true
            },
            {
                description: 'Simulating authentication headers',
                success: true
            },
            {
                description: 'Checking API endpoint accessibility',
                success: true
            }
        ];

        // Add scenario based on key characteristics
        if (apiKey.length < 30) {
            scenarios.push({
                description: 'Validating key length for Dell API standards',
                success: false,
                error: 'API key may be too short for Dell API requirements'
            });
        } else if (apiKey.includes('-') && apiKey.length > 40) {
            scenarios.push({
                description: 'Validating enterprise API key format',
                success: true
            });
        } else {
            scenarios.push({
                description: 'Validating standard API key format',
                success: true
            });
        }

        return scenarios;
    }

    /**
     * Show test result in the modal
     */
    showTestResult(message, type) {
        if (this.testResultElement) {
            this.testResultElement.textContent = message;
            this.testResultElement.className = `test-result test-${type}`;
        }
    }

    /**
     * Show Lenovo test result in the modal
     */
    showLenovoTestResult(message, type) {
        if (this.testLenovoResultElement) {
            this.testLenovoResultElement.textContent = message;
            this.testLenovoResultElement.className = `test-result test-${type}`;
        }
    }

    /**
     * Show comprehensive warranty details for a device
     */
    showWarrantyDetails(serviceTag) {
        // Find the device data from processed results
        const deviceData = this.processedResults?.find(device => device.serviceTag === serviceTag);

        if (!deviceData || !deviceData.warrantyDetails) {
            alert('No detailed warranty information available for this device.');
            return;
        }

        const modal = document.getElementById('warrantyDetailsModal');
        const content = document.getElementById('warrantyDetailsContent');

        // Build comprehensive warranty information display
        let html = `
            <div style="margin-bottom: 20px;">
                <h4>🖥️ Device: ${serviceTag}</h4>
                <p><strong>Model:</strong> ${deviceData.model || 'Unknown'}</p>
                <p><strong>Vendor:</strong> ${deviceData.vendor}</p>
                <p><strong>Ship Date:</strong> ${deviceData.shipDate || 'N/A'}</p>
            </div>

            <h4>📋 Warranty Coverage (${deviceData.warrantyDetails.length} warranties)</h4>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Warranty Type</th>
                            <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Start Date</th>
                            <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">End Date</th>
                            <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Status</th>
                            <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Days Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        deviceData.warrantyDetails.forEach(warranty => {
            const daysRemaining = this.calculateDaysRemaining(warranty.endDate);
            const statusColor = warranty.isActive ? '#28a745' : '#dc3545';
            const statusText = warranty.isActive ? 'Active' : 'Expired';

            let daysDisplay = 'N/A';
            if (daysRemaining !== null) {
                if (daysRemaining > 0) {
                    daysDisplay = `${daysRemaining} days`;
                } else if (daysRemaining === 0) {
                    daysDisplay = 'Expires today';
                } else {
                    daysDisplay = `${Math.abs(daysRemaining)} days ago`;
                }
            }

            html += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>${warranty.type}</strong><br><small style="color: #6c757d;">${warranty.fullType}</small></td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${warranty.startDate || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${warranty.endDate || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; color: ${statusColor};"><strong>${statusText}</strong></td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${daysDisplay}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h5>📊 Summary</h5>
                <p><strong>Primary Warranty:</strong> ${deviceData.primaryWarrantyType || deviceData.warrantyType}</p>
                <p><strong>Overall Status:</strong> <span style="color: ${deviceData.status === 'active' ? '#28a745' : '#dc3545'};">${deviceData.status.toUpperCase()}</span></p>
                <p><strong>Total Warranties:</strong> ${deviceData.warrantyDetails.length}</p>
                <p><strong>Active Warranties:</strong> ${deviceData.warrantyDetails.filter(w => w.isActive).length}</p>
            </div>
        `;

        content.innerHTML = html;
        modal.style.display = 'block';
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        console.log('Success:', message);
        this.showMessage(message, 'success');
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Error:', message);
        this.showMessage(message, 'error');
    }

    /**
     * Show message with type
     */
    showMessage(message, type) {
        console.log(`Message (${type}):`, message);

        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;

        // Insert at top of main content
        const main = document.querySelector('main');
        if (main) {
            main.insertBefore(messageDiv, main.firstChild);
        } else {
            console.error('Main element not found, appending to body');
            document.body.appendChild(messageDiv);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    /**
     * Show persistent message that doesn't auto-hide
     */
    showPersistentMessage(message, type) {
        console.log(`Persistent Message (${type}):`, message);

        // Remove existing persistent messages
        const existingMessages = document.querySelectorAll('.message-persistent');
        existingMessages.forEach(msg => msg.remove());

        // Create new persistent message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type} message-persistent`;
        messageDiv.textContent = message;

        // Add a small close button for manual dismissal
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'message-close';
        closeBtn.title = 'Dismiss';
        closeBtn.addEventListener('click', () => {
            messageDiv.remove();
        });
        messageDiv.appendChild(closeBtn);

        // Insert at top of main content
        const main = document.querySelector('main');
        if (main) {
            main.insertBefore(messageDiv, main.firstChild);
        } else {
            console.error('Main element not found, appending to body');
            document.body.appendChild(messageDiv);
        }

        // No auto-remove for persistent messages
    }

    /**
     * Session Management Methods for Resume Functionality (SQLite-based)
     */

    /**
     * Initialize session service and check for existing sessions
     */
    async initializeSessionService() {
        try {
            // First, try to migrate any localStorage sessions
            await window.sessionService.migrateLocalStorageSession();

            // Check for existing active sessions
            await this.checkForExistingSessions();
        } catch (error) {
            console.error('Error initializing session service:', error);
        }
    }

    /**
     * Check for existing sessions on page load
     */
    async checkForExistingSessions() {
        try {
            const activeSessions = await window.sessionService.checkForExistingSessions();

            if (activeSessions.length > 0) {
                // Show the most recent session for resume
                const latestSession = activeSessions[0];
                this.showResumeOption(latestSession);
            }
        } catch (error) {
            console.error('Error checking for existing sessions:', error);
        }
    }

    /**
     * Validate if a session is still valid and resumable
     */
    isValidSession(session) {
        return session &&
               session.id &&
               session.total_devices > 0 &&
               session.processed_count < session.total_devices &&
               session.status === 'active';
    }

    /**
     * Save current session state to database
     */
    async saveSession(devices, processedCount, successful, failed, skipped) {
        try {
            if (!this.sessionId) {
                this.sessionId = window.sessionService.generateSessionId();

                // Create new session in database with duplicate handling
                await window.sessionService.createSession({
                    sessionId: this.sessionId,
                    fileName: this.fileInfo ? this.fileInfo.textContent : 'Unknown',
                    devices: devices
                }, this.duplicateHandlingOptions || {});

                window.sessionService.setCurrentSession(this.sessionId);
            }

            // Update session progress
            await window.sessionService.updateSessionProgress(this.sessionId, {
                processed: processedCount,
                successful: successful,
                failed: failed,
                skipped: skipped
            });

            console.log(`Session saved: ${processedCount}/${devices.length} devices processed`);
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    /**
     * Clear current session from database
     */
    async clearSession() {
        try {
            if (this.sessionId) {
                await window.sessionService.completeSession(this.sessionId, 'cancelled');
            }

            this.sessionId = null;
            this.resumeData = null;
            window.sessionService.clearCurrentSession();

            if (this.clearSessionBtn) {
                this.clearSessionBtn.style.display = 'none';
            }
            console.log('Session cleared');
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    }

    /**
     * Clear session with user confirmation
     */
    async clearSessionWithConfirmation() {
        const confirmMessage = 'Are you sure you want to clear the current results?\n\n' +
            '⚠️ This will:\n' +
            '• Remove all warranty data from the table\n' +
            '• Clear the current session from the database\n' +
            '• Reset the interface for a new CSV upload\n\n' +
            'This action cannot be undone.';

        if (confirm(confirmMessage)) {
            await this.clearSession();
            this.clearResultsDisplay();
            this.showMessage('🗑️ Results cleared successfully - ready for new CSV upload', 'info');
        }
    }

    /**
     * Clear the results display and reset UI
     */
    clearResultsDisplay() {
        // Hide results container
        this.resultsContainer.style.display = 'none';

        // Clear table
        const tbody = this.resultsTable.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }

        // Remove completion info
        const completionInfo = document.getElementById('completion-info');
        if (completionInfo) {
            completionInfo.remove();
        }

        // Reset process button
        this.processBtn.textContent = 'Process Warranties';
        this.processBtn.disabled = true;
        this.processBtn.style.background = '';
        this.processBtn.style.color = '';

        // Hide export and clear buttons
        this.exportBtn.disabled = true;
        if (this.clearSessionBtn) {
            this.clearSessionBtn.style.display = 'none';
        }

        // Reset file input
        if (this.fileInput) {
            this.fileInput.value = '';
        }

        // Clear file info
        if (this.fileInfo) {
            this.fileInfo.textContent = 'No file selected';
        }

        console.log('Results display cleared - ready for new upload');
    }

    /**
     * Show resume option to user
     */
    showResumeOption(session) {
        const resumeMessage = `📋 Previous session found!\n\n` +
            `File: ${session.file_name}\n` +
            `Progress: ${session.processed_count}/${session.total_devices} devices processed\n` +
            `✅ ${session.successful_count} successful, ❌ ${session.failed_count} failed, ⏭️ ${session.skipped_count} skipped\n\n` +
            `Would you like to resume where you left off?`;

        if (confirm(resumeMessage)) {
            this.resumeSession(session);
        } else {
            this.clearSession();
        }
    }

    /**
     * Resume processing from saved session
     */
    async resumeSession(session) {
        try {
            console.log('Resuming session:', session.id);

            // Get full session data from database
            const sessionData = await window.sessionService.getSession(session.id);
            if (!sessionData) {
                this.showMessage('❌ Session data not found', 'error');
                return;
            }

            // Restore session data
            this.sessionId = session.id;
            this.csvData = sessionData.devices;
            window.sessionService.setCurrentSession(session.id);

            // Display the devices in the table
            this.displayDetectedDevices(sessionData.devices);

            // Show resume status
            this.showPersistentMessage(
                `🔄 Session Resumed!\n` +
                `Continuing from device ${session.processed_count + 1}/${session.total_devices}\n` +
                `Previous progress: ✅ ${session.successful_count} successful, ❌ ${session.failed_count} failed, ⏭️ ${session.skipped_count} skipped`,
                'info'
            );

            // Enable processing with resume data
            this.processBtn.disabled = false;
            this.processBtn.textContent = `Resume Processing (${session.total_devices - session.processed_count} remaining)`;

            // Show clear session button
            if (this.clearSessionBtn) {
                this.clearSessionBtn.style.display = 'inline-block';
            }

            // Store resume data for processing
            this.resumeData = {
                startIndex: session.processed_count,
                successful: session.successful_count,
                failed: session.failed_count,
                skipped: session.skipped_count
            };
        } catch (error) {
            console.error('Error resuming session:', error);
            this.showMessage('❌ Failed to resume session', 'error');
        }
    }

    /**
     * Retry Failed Devices Functionality
     */

    /**
     * Update the retry failed button visibility
     */
    async updateRetryFailedButton() {
        if (!this.retryFailedBtn) return;

        const failedDevices = await this.getFailedDevices();
        if (failedDevices.length > 0) {
            this.retryFailedBtn.style.display = 'inline-block';
            this.retryFailedBtn.textContent = `🔄 Retry Failed (${failedDevices.length})`;
        } else {
            this.retryFailedBtn.style.display = 'none';
        }
    }

    /**
     * Get list of failed devices that can be retried
     */
    async getFailedDevices() {
        try {
            if (this.sessionId) {
                const retryableDevices = await window.sessionService.getRetryableDevices(this.sessionId);
                return retryableDevices.map(device => ({
                    serialNumber: device.serial_number,
                    vendor: device.vendor,
                    model: device.model,
                    deviceName: device.device_name,
                    isSupported: Boolean(device.is_supported),
                    apiConfigured: Boolean(device.api_configured),
                    processingState: device.processing_state,
                    errorMessage: device.error_message,
                    isRetryable: Boolean(device.is_retryable)
                }));
            } else {
                // Fallback to in-memory data if no session
                return this.csvData.filter(device =>
                    device.processingState === 'failed' &&
                    device.isRetryable !== false &&
                    device.isSupported &&
                    device.apiConfigured
                );
            }
        } catch (error) {
            console.error('Error fetching failed devices:', error);
            return [];
        }
    }

    /**
     * Check if an error is retryable
     */
    isRetryableError(error) {
        const retryablePatterns = [
            'rate_limit_exceeded',
            'timeout',
            'network',
            '500',
            '502',
            '503',
            '504',
            'temporary'
        ];

        return retryablePatterns.some(pattern =>
            error.message && error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Retry processing for failed devices only
     */
    async retryFailedDevices() {
        const failedDevices = await this.getFailedDevices();

        if (failedDevices.length === 0) {
            this.showMessage('No failed devices to retry', 'info');
            return;
        }

        const confirmMessage = `Retry processing for ${failedDevices.length} failed devices?\n\n` +
            `This will attempt to process only the devices that failed previously.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Reset failed devices for retry
        failedDevices.forEach(device => {
            device.processingState = 'pending';
            device.errorMessage = null;
            device.isRetryable = null;
        });

        // Set up retry-specific resume data
        this.resumeData = {
            startIndex: 0,
            successful: this.csvData.filter(d => d.processingState === 'success').length,
            failed: 0,
            skipped: this.csvData.filter(d => d.processingState === 'skipped').length,
            retryMode: true,
            retryDevices: failedDevices
        };

        // Hide retry button during processing
        this.retryFailedBtn.style.display = 'none';

        // Start processing
        await this.startProcessing();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.warrantyChecker = new WarrantyChecker();
});

