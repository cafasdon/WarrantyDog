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
        const hasVendor = 'vendor' in firstRow;
        const hasIdentifier = 'service_tag' in firstRow || 'serial' in firstRow;

        if (!hasVendor) {
            this.showError('CSV must have a "vendor" column.');
            return;
        }

        if (!hasIdentifier) {
            this.showError('CSV must have either a "service_tag" or "serial" column.');
            return;
        }

        this.showSuccess(`✅ CSV loaded successfully! Found ${this.csvData.length} devices.`);
        this.processBtn.disabled = false;
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
        const total = this.csvData.length;
        let processed = 0;
        let successful = 0;
        let failed = 0;

        for (const device of this.csvData) {
            this.currentIndex = processed;
            this.updateProgress(processed, total, successful, failed);

            try {
                const vendor = device.vendor?.toLowerCase();
                const identifier = device.service_tag || device.serial;

                if (!vendor || !identifier) {
                    throw new Error('Missing vendor or identifier');
                }

                const result = await this.warrantyService.lookupWarranty(vendor, identifier);
                result.originalData = device; // Keep original CSV data
                this.processedResults.push(result);
                successful++;

            } catch (error) {
                const errorResult = {
                    vendor: device.vendor || 'Unknown',
                    serviceTag: device.service_tag || device.serial || 'Unknown',
                    status: 'error',
                    message: error.message,
                    originalData: device
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

        // Clear existing table
        const tbody = this.resultsTable.querySelector('tbody');
        tbody.innerHTML = '';

        // Add results to table
        this.processedResults.forEach(result => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${result.vendor || 'Unknown'}</td>
                <td>${result.serviceTag || result.originalData?.service_tag || result.originalData?.serial || 'Unknown'}</td>
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
            vendor: result.vendor,
            service_tag: result.serviceTag,
            status: result.status,
            warranty_type: result.warrantyType || '',
            start_date: result.startDate || '',
            end_date: result.endDate || '',
            days_remaining: result.daysRemaining || '',
            is_active: result.isActive || false,
            model: result.model || '',
            message: result.message || '',
            // Include original CSV data
            ...result.originalData
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

