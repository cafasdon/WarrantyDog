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
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // File upload events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
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
     * Load API keys from localStorage
     */
    loadApiKeys() {
        const dellApiKey = localStorage.getItem('dell_api_key');
        if (dellApiKey && this.dellApiKeyInput) {
            this.dellApiKeyInput.value = dellApiKey;
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

        // Parse CSV using PapaParse
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                this.csvData = results.data;
                this.validateCsvData();
            },
            error: (error) => {
                this.showError(`Error parsing CSV: ${error.message}`);
            }
        });
    }

    /**
     * Validate CSV data structure
     */
    validateCsvData() {
        if (this.csvData.length === 0) {
            this.showError('CSV file is empty or has no valid data rows.');
            return;
        }

        const firstRow = this.csvData[0];

        // Check for simple format (vendor, service_tag columns)
        const hasSimpleFormat = 'vendor' in firstRow && ('service_tag' in firstRow || 'serial' in firstRow);

        // Check for system report format (Device Serial Number, Base Board Manufacturer)
        const hasSystemReportFormat = 'Device Serial Number' in firstRow && 'Base Board Manufacturer' in firstRow;

        if (!hasSimpleFormat && !hasSystemReportFormat) {
            this.showError(`CSV format not recognized. Please ensure your CSV has either:

Simple format: "vendor" and "service_tag" columns
System Report format: "Device Serial Number" and "Base Board Manufacturer" columns

Current columns: ${Object.keys(firstRow).join(', ')}`);
            return;
        }

        // Filter and count valid devices
        const validDevices = this.getValidDevicesFromCsv();

        if (validDevices.length === 0) {
            this.showError('No valid devices found in CSV. Please check that devices have serial numbers and recognized manufacturers.');
            return;
        }

        this.showSuccess(`✅ CSV loaded successfully! Found ${validDevices.length} valid devices out of ${this.csvData.length} total rows.`);
        this.processBtn.disabled = false;
    }

    /**
     * Get valid devices from CSV data, handling both simple and system report formats
     */
    getValidDevicesFromCsv() {
        return this.csvData.filter(row => {
            // Skip virtual machines and invalid entries
            if (this.isVirtualMachine(row)) return false;

            const serialNumber = this.extractSerialNumber(row);
            const vendor = this.extractVendor(row);

            return serialNumber && vendor && this.isSupportedVendor(vendor);
        }).map(row => {
            return {
                originalData: row,
                vendor: this.extractVendor(row),
                serialNumber: this.extractSerialNumber(row),
                model: this.extractModel(row),
                deviceName: this.extractDeviceName(row),
                location: this.extractLocation(row)
            };
        });
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
     * Process all devices in the CSV
     */
    async processDevices() {
        const validDevices = this.getValidDevicesFromCsv();
        const total = validDevices.length;
        let processed = 0;
        let successful = 0;
        let failed = 0;

        this.showMessage(`Processing ${total} valid devices...`, 'info');

        for (const device of validDevices) {
            this.currentIndex = processed;
            this.updateProgress(processed, total, successful, failed);

            try {
                const result = await this.warrantyService.lookupWarranty(device.vendor, device.serialNumber);

                // Enhance result with additional device information
                result.originalData = device.originalData;
                result.deviceName = device.deviceName;
                result.location = device.location;
                result.model = result.model || device.model;

                this.processedResults.push(result);
                successful++;

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
            }

            processed++;

            // Small delay to prevent overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.updateProgress(processed, total, successful, failed);
        this.showResults();
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
     * Save configuration
     */
    saveConfiguration() {
        const dellApiKey = this.dellApiKeyInput.value.trim();

        if (dellApiKey) {
            localStorage.setItem('dell_api_key', dellApiKey);
            this.showSuccess('✅ Dell API key saved successfully!');
        } else {
            localStorage.removeItem('dell_api_key');
            this.showSuccess('✅ Dell API key removed.');
        }

        this.hideConfigModal();
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showMessage(message, 'error');
    }

    /**
     * Show message with type
     */
    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;

        // Insert at top of main content
        const main = document.querySelector('main');
        main.insertBefore(messageDiv, main.firstChild);

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

