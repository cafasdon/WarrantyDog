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
        this.currentIndex = 0;

        this.initializeElements();
        this.bindEvents();
        this.loadApiKeys();
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
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.statusText = document.getElementById('statusText');

        // Results elements
        this.resultsContainer = document.getElementById('resultsContainer');
        this.resultsTable = document.getElementById('resultsTable');
        this.exportBtn = document.getElementById('exportBtn');

        // Configuration elements
        this.configBtn = document.getElementById('configBtn');
        this.configModal = document.getElementById('configModal');
        this.closeModal = document.querySelector('.close-modal');
        this.saveConfigBtn = document.getElementById('saveConfig');
        this.dellApiKeyInput = document.getElementById('dellApiKey');

        // API status elements
        this.apiStatusContainer = document.getElementById('apiStatus');
        this.dellStatusElement = document.getElementById('dellStatus');

        // Log missing elements
        const elements = {
            fileInput: this.fileInput,
            dropZone: this.dropZone,
            fileInfo: this.fileInfo,
            processBtn: this.processBtn,
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
        this.dropZone.addEventListener('click', () => this.fileInput.click());

        // Processing events
        this.processBtn.addEventListener('click', () => this.startProcessing());

        // Export events
        this.exportBtn.addEventListener('click', () => this.exportResults());

        // Configuration events
        this.configBtn.addEventListener('click', () => this.showConfigModal());
        this.closeModal.addEventListener('click', () => this.hideConfigModal());
        this.saveConfigBtn.addEventListener('click', () => this.saveConfiguration());

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
                this.dellStatusElement.textContent = '✅ Configured';
                this.dellStatusElement.className = 'status configured';
            } else {
                this.dellStatusElement.textContent = '❌ Not configured';
                this.dellStatusElement.className = 'status not-configured';
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
                <small>Size: ${(file.size / 1024).toFixed(1)} KB</small>
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

        this.showSuccess(`✅ CSV loaded successfully! Found ${validDevices.length} valid devices out of ${this.csvData.length} total rows.`);

        // Stage 1: Immediately display all detected devices
        this.displayDetectedDevices(validDevices);
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

        // Update process button text
        if (processableCount === 0) {
            this.processBtn.textContent = 'No Devices Ready for Processing';
            this.processBtn.disabled = true;
        } else {
            this.processBtn.textContent = `Process ${processableCount} Device${processableCount !== 1 ? 's' : ''}`;
            this.processBtn.disabled = false;
        }

        // Show status summary
        let statusMessage = `📊 Device Summary: ${devices.length} total devices detected\n`;
        statusMessage += `✅ Ready for processing: ${processableCount}\n`;
        if (unconfiguredCount > 0) {
            statusMessage += `⚙️ Need API configuration: ${unconfiguredCount}\n`;
        }
        if (unsupportedCount > 0) {
            statusMessage += `❌ Unsupported vendors: ${unsupportedCount}`;
        }

        this.showMessage(statusMessage, 'info');
    }

    /**
     * Start warranty processing
     */
    async startProcessing() {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.processBtn.disabled = true;
        this.processBtn.textContent = 'Processing...';
        this.progressContainer.style.display = 'block';
        this.resultsContainer.style.display = 'none';

        this.processedResults = [];
        this.currentIndex = 0;

        try {
            await this.processDevices();
        } catch (error) {
            this.showError(`Processing failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.processBtn.disabled = false;
            this.processBtn.textContent = 'Process Warranties';
        }
    }

    /**
     * Process devices that can be processed (Stage 2)
     */
    async processDevices() {
        const processableDevices = this.getProcessableDevices();
        const total = processableDevices.length;
        let processed = 0;
        let successful = 0;
        let failed = 0;

        if (total === 0) {
            this.showError('No devices are ready for processing. Please configure API keys for supported vendors.');
            return;
        }

        this.showMessage(`Processing ${total} device${total !== 1 ? 's' : ''} with configured APIs...`, 'info');

        for (const device of processableDevices) {
            this.currentIndex = processed;
            this.updateProgress(processed, total, successful, failed);

            // Find the table row for this device
            const deviceIndex = this.getValidDevicesFromCsv().indexOf(device);
            const row = this.resultsTable.querySelector(`tbody tr[data-device-index="${deviceIndex}"]`);

            if (row) {
                // Update status to processing
                row.querySelector('.warranty-status').innerHTML = '🔄 Processing...';
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
            }

            processed++;

            // Small delay to prevent overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.updateProgress(processed, total, successful, failed);
        this.finalizeProcessing(successful, failed);
    }

    /**
     * Update a table row with warranty data
     */
    updateRowWithWarrantyData(row, result) {
        const statusCell = row.querySelector('.warranty-status');
        const typeCell = row.querySelector('.warranty-type');
        const endCell = row.querySelector('.warranty-end');
        const daysCell = row.querySelector('.warranty-days');

        statusCell.innerHTML = `<span class="status-${result.status}">${this.formatStatus(result.status)}</span>`;
        typeCell.textContent = result.warrantyType || (result.status === 'error' ? 'Error' : 'N/A');
        endCell.textContent = result.endDate || 'N/A';
        daysCell.textContent = result.daysRemaining || 'N/A';
    }

    /**
     * Finalize processing and show summary
     */
    finalizeProcessing(successful, failed) {
        this.exportBtn.disabled = false;

        let message = `✅ Processing complete!\n`;
        message += `✅ Successful: ${successful}\n`;
        if (failed > 0) {
            message += `❌ Failed: ${failed}`;
        }

        this.showSuccess(message);
    }

    /**
     * Update progress display
     */
    updateProgress(processed, total, successful, failed) {
        const percentage = Math.round((processed / total) * 100);
        this.progressBar.style.width = `${percentage}%`;
        this.progressText.textContent = `${processed}/${total} (${percentage}%)`;
        this.statusText.textContent = `✅ ${successful} successful, ❌ ${failed} failed`;
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
            warranty_type: result.warrantyType || '',
            warranty_start_date: result.startDate || '',
            warranty_end_date: result.endDate || '',
            days_remaining: result.daysRemaining || '',
            is_active: result.isActive || false,
            ship_date: result.shipDate || '',
            message: result.message || '',
            lookup_date: new Date().toISOString().split('T')[0],
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
        this.configModal.style.display = 'block';
    }

    /**
     * Hide configuration modal
     */
    hideConfigModal() {
        this.configModal.style.display = 'none';
    }

    /**
     * Save configuration with validation and feedback
     */
    async saveConfiguration() {
        const dellApiKey = this.dellApiKeyInput.value.trim();

        // Show saving indicator
        this.saveConfigBtn.disabled = true;
        this.saveConfigBtn.textContent = 'Validating...';

        try {
            if (dellApiKey) {
                // Basic validation - check if key looks valid
                if (dellApiKey.length < 10) {
                    throw new Error('API key appears to be too short. Please check your Dell API key.');
                }

                // Test the API key with a real validation call
                this.showMessage('🔍 Testing Dell API key...', 'info');
                const isValid = await this.validateDellApiKey(dellApiKey);

                if (isValid) {
                    localStorage.setItem('dell_api_key', dellApiKey);
                    this.updateApiStatus();
                    this.showSuccess('✅ Dell API key validated and saved successfully! You can now process Dell devices.');
                } else {
                    throw new Error('Dell API key validation failed. Please check your API key and try again.');
                }
            } else {
                localStorage.removeItem('dell_api_key');
                this.updateApiStatus();
                this.showSuccess('✅ Dell API key removed.');
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
     * Validate Dell API key by making a test call
     */
    async validateDellApiKey(apiKey) {
        try {
            // Use a test service tag that should always return a response (even if not found)
            const testServiceTag = 'TEST123'; // This will return 404 but validates the API key
            const url = 'https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements';

            const response = await fetch(`${url}?servicetags=${testServiceTag}`, {
                method: 'GET',
                headers: {
                    'X-Dell-Api-Key': apiKey,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            // API key is valid if we get any response other than 401 (unauthorized)
            // 404 (not found) is actually a good response - it means the API key works
            if (response.status === 401) {
                return false; // Invalid API key
            }

            // Any other response (200, 404, 429, 500) means the API key is valid
            return true;

        } catch (error) {
            console.error('API validation error:', error);
            // Network errors or CORS issues - assume key might be valid
            // We'll let the user proceed and catch issues during actual processing
            return true;
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WarrantyChecker();
});

