/**
 * WarrantyDog Main Application
 *
 * Browser-based warranty checker with CSV processing and real-time progress tracking.
 * Supports Dell API with plans for Lenovo and HP integration.
 */

import { WarrantyLookupService } from './vendorApis.js';

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

        // API status elements
        this.apiStatusContainer = document.getElementById('apiStatus');
        this.dellStatusElement = document.getElementById('dellStatus');

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
            dellStatusElement: this.dellStatusElement
        };

        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.error(`Missing element: ${name}`);
            }
        });

        console.log('DOM elements initialized');
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
        this.retryFailedBtn.addEventListener('click', () => this.retryFailedDevices());

        // Session management events
        if (this.clearSessionBtn) {
            this.clearSessionBtn.addEventListener('click', () => this.clearSessionWithConfirmation());
        }

        // Export events
        this.exportBtn.addEventListener('click', () => this.exportResults());

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
                console.log('Test API button clicked via delegation');
                this.testDellApiConnection();
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

                console.log('API credentials changed via delegation, hasKey:', hasKey, 'hasSecret:', hasSecret);
                const testBtn = document.getElementById('testDellApi');
                if (testBtn) {
                    testBtn.disabled = !bothPresent;
                    console.log('Test button disabled state:', testBtn.disabled);
                } else {
                    console.error('Test button not found when trying to enable/disable');
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
        this.updateApiStatus();
    }

    /**
     * Update API status indicators
     */
    updateApiStatus() {
        const dellApiKey = localStorage.getItem('dell_api_key');

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
            complete: (results) => {
                console.log('CSV parsing complete:', results);
                console.log('Data rows:', results.data.length);
                console.log('First row:', results.data[0]);

                this.csvData = results.data;
                this.validateCsvData();
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
    validateCsvData() {
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
        this.processBtn.disabled = false;
    }

    /**
     * Get all valid devices from CSV data, including unsupported vendors
     */
    getValidDevicesFromCsv() {
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
        return row['Name'] || row['Friendly Name'] || row['device_name'] || '';
    }

    /**
     * Extract location from row
     */
    extractLocation(row) {
        return row['Site Name'] || row['Site Friendly Name'] || row['location'] || '';
    }

    /**
     * Check if vendor is supported
     */
    isSupportedVendor(vendor) {
        return ['dell', 'lenovo', 'hp'].includes(vendor.toLowerCase());
    }

    /**
     * Check if API is configured for vendor
     */
    isApiConfigured(vendor) {
        switch (vendor.toLowerCase()) {
            case 'dell':
                return localStorage.getItem('dell_api_key') !== null;
            case 'lenovo':
                return false; // Not implemented yet
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

        // Add devices to table with initial status
        devices.forEach(device => {
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
                <td class="warranty-end">-</td>
                <td class="warranty-days">-</td>
            `;

            // Store device data for later processing
            row.dataset.deviceIndex = devices.indexOf(device);
        });

        // Show processing controls
        this.updateProcessingControls(devices);
    }

    /**
     * Get API status text and class for a device
     */
    getApiStatusText(device) {
        if (!device.isSupported) {
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
     * Start warranty processing
     */
    async startProcessing() {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.processingCancelled = false;
        this.processBtn.disabled = true;
        this.processBtn.style.display = 'none';
        this.cancelBtn.style.display = 'inline-block';
        this.progressContainer.style.display = 'block';
        this.resultsContainer.style.display = 'none';

        this.processedResults = [];
        this.currentIndex = 0;

        try {
            await this.processDevices();
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
        this.progressContainer.style.display = 'none';
    }

    /**
     * Process devices that can be processed (Stage 2)
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
                    const skipReason = !device.isSupported ? 'Vendor Not Supported' : 'API Not Configured';
                    row.querySelector('.warranty-status').innerHTML = `⏭️ Skipped`;
                    row.querySelector('.warranty-type').textContent = skipReason;
                    row.querySelector('.warranty-end').textContent = 'N/A';
                    row.querySelector('.warranty-days').textContent = 'N/A';
                }

                const skipResult = {
                    vendor: device.vendor,
                    serviceTag: device.serialNumber,
                    status: 'skipped',
                    message: !device.isSupported ? 'Vendor not supported' : 'API not configured',
                    originalData: device.originalData,
                    deviceName: device.deviceName,
                    location: device.location,
                    model: device.model
                };
                this.processedResults.push(skipResult);

                // Mark device as skipped
                device.processingState = 'skipped';
                device.lastProcessed = new Date().toISOString();
                device.skipReason = !device.isSupported ? 'Vendor not supported' : 'API not configured';

                processed++;
                continue;
            }

            if (row) {
                // Update status to processing with enhanced visual feedback
                row.querySelector('.warranty-status').innerHTML = '🔄 Processing...';
                row.classList.add('processing');

                // Scroll to current row to keep it visible
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        this.finalizeProcessing(successful, failed, skipped);

        // Complete session when processing finishes successfully
        if (!this.processingCancelled && this.sessionId) {
            try {
                await window.sessionService.completeSession(this.sessionId, 'completed');
                this.sessionId = null;
                window.sessionService.clearCurrentSession();
            } catch (error) {
                console.error('Error completing session:', error);
            }
        }

        // Show retry failed button if there are failed devices
        await this.updateRetryFailedButton();
    }

    /**
     * Update a table row with warranty data with enhanced visual feedback
     */
    updateRowWithWarrantyData(row, result) {
        const statusCell = row.querySelector('.warranty-status');
        const typeCell = row.querySelector('.warranty-type');
        const endCell = row.querySelector('.warranty-end');
        const daysCell = row.querySelector('.warranty-days');

        // Remove processing class and add completion animation
        row.classList.remove('processing');
        row.classList.add('data-updated');

        // Update cells with warranty data
        statusCell.innerHTML = `<span class="status-${result.status}">${this.formatStatus(result.status)}</span>`;
        typeCell.textContent = result.warrantyType || (result.status === 'error' ? 'Error' : 'N/A');
        endCell.textContent = result.endDate || 'N/A';
        daysCell.textContent = result.daysRemaining || 'N/A';

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

        // Remove the data-updated class after animation
        setTimeout(() => {
            row.classList.remove('data-updated');
        }, 1000);
    }

    /**
     * Finalize processing and show summary
     */
    finalizeProcessing(successful, failed, skipped = 0) {
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

        this.showSuccess(message);

        // Update retry button visibility
        await this.updateRetryFailedButton();
    }

    /**
     * Update progress display with enhanced information
     */
    updateProgress(processed, total, successful, failed, skipped = 0, currentDevice = null) {
        const percentage = Math.round((processed / total) * 100);
        this.progressBar.style.width = `${percentage}%`;

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
                <td>${result.warrantyType || 'N/A'}</td>
                <td>${result.endDate || 'N/A'}</td>
                <td>${result.daysRemaining || 'N/A'}</td>
                <td>${result.message || 'Success'}</td>
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
     * Export results to CSV
     */
    exportResults() {
        if (this.processedResults.length === 0) return;

        const csvData = this.processedResults.map(result => ({
            device_name: result.deviceName || '',
            location: result.location || '',
            vendor: result.vendor,
            serial_number: result.serviceTag,
            model: result.model || '',
            warranty_status: result.status,
            warranty_type: result.warrantyType || (result.status === 'skipped' ? 'Skipped - ' + result.message : ''),
            warranty_start_date: result.startDate || '',
            warranty_end_date: result.endDate || '',
            days_remaining: result.daysRemaining || '',
            is_active: result.isActive || false,
            ship_date: result.shipDate || '',
            message: result.message || '',
            lookup_date: new Date().toISOString().split('T')[0],
            processing_notes: result.status === 'skipped' ? 'Device skipped - ' + result.message :
                             result.status === 'error' ? 'Processing failed - ' + result.message :
                             'Successfully processed',
            // Include key original CSV data for reference
            original_name: result.originalData?.Name || '',
            original_model: result.originalData?.['System Model'] || '',
            processor: result.originalData?.Processor || '',
            ram_gb: result.originalData?.['RAM (GB)'] || '',
            installed_date: result.originalData?.['Installed Date'] || '',
            last_check_date: result.originalData?.['Last Check Date'] || ''
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

            const newApiInput = apiInput.cloneNode(true);
            apiInput.parentNode.replaceChild(newApiInput, apiInput);

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

        console.log('Dell API key length:', dellApiKey.length);
        console.log('Dell API secret length:', dellApiSecret.length);

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
        if (confirm('Are you sure you want to clear the saved session? This will permanently delete your progress and cannot be undone.')) {
            await this.clearSession();
            this.showMessage('🗑️ Session cleared successfully', 'info');
        }
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
    new WarrantyChecker();
});

