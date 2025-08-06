/**
 * Main application logic for Kwik Link Extractor
 */
class KwikLinkExtractorApp {
    constructor() {
        this.extractor = new KwikExtractor();
        this.isExtracting = false;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Input elements
        this.urlInput = document.getElementById('kwikUrl');
        this.extractBtn = document.getElementById('extractBtn');
        this.btnText = this.extractBtn.querySelector('.btn-text');
        this.spinner = this.extractBtn.querySelector('.spinner');

        // Status elements
        this.statusContainer = document.getElementById('statusContainer');
        this.statusText = document.getElementById('statusText');
        this.progressFill = document.getElementById('progressFill');

        // Result elements
        this.resultContainer = document.getElementById('resultContainer');
        this.resultLink = document.getElementById('resultLink');
        this.copyBtn = document.getElementById('copyBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resultInfo = document.getElementById('resultInfo');

        // Error elements
        this.errorContainer = document.getElementById('errorContainer');
        this.errorText = document.getElementById('errorText');
        this.retryBtn = document.getElementById('retryBtn');
    }

    bindEvents() {
        // Extract button click
        this.extractBtn.addEventListener('click', () => this.handleExtract());

        // Enter key in input
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isExtracting) {
                this.handleExtract();
            }
        });

        // Copy button click
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());

        // Retry button click
        this.retryBtn.addEventListener('click', () => this.handleExtract());

        // URL input validation
        this.urlInput.addEventListener('input', () => this.validateInput());
    }

    validateInput() {
        const url = this.urlInput.value.trim();
        const isValid = url === '' || this.extractor.isValidKwikUrl(url);
        
        this.urlInput.style.borderColor = isValid ? '#e1e5e9' : '#e53e3e';
        this.extractBtn.disabled = !isValid || url === '' || this.isExtracting;
    }

    async handleExtract() {
        const url = this.urlInput.value.trim();
        
        if (!url) {
            this.showError('Please enter a Kwik URL');
            return;
        }

        if (!this.extractor.isValidKwikUrl(url)) {
            this.showError('Invalid Kwik URL. Please enter a valid kwik.si, kwik.cx, or kwik.sx URL');
            return;
        }

        this.startExtraction();

        try {
            const result = await this.extractor.extract(url, (message, progress) => {
                this.updateProgress(message, progress);
            });

            if (result.success) {
                this.showResult(result);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError(`Unexpected error: ${error.message}`);
        } finally {
            this.endExtraction();
        }
    }

    startExtraction() {
        this.isExtracting = true;
        this.hideAllSections();
        
        // Update button state
        this.btnText.textContent = 'Extracting...';
        this.spinner.classList.remove('hidden');
        this.extractBtn.disabled = true;
        
        // Show status
        this.statusContainer.classList.remove('hidden');
        this.updateProgress('Starting extraction...', 0);
    }

    endExtraction() {
        this.isExtracting = false;
        
        // Reset button state
        this.btnText.textContent = 'Extract Link';
        this.spinner.classList.add('hidden');
        this.extractBtn.disabled = false;
        
        // Hide status
        setTimeout(() => {
            this.statusContainer.classList.add('hidden');
        }, 1000);
    }

    updateProgress(message, progress) {
        this.statusText.textContent = message;
        this.progressFill.style.width = `${progress}%`;
    }

    showResult(result) {
        this.hideError();
        
        // Populate result data
        this.resultLink.value = result.directLink;
        this.downloadBtn.href = result.directLink;
        
        // Set result info
        let infoText = result.message;
        if (result.warning) {
            infoText += ` Note: ${result.warning}`;
        }
        this.resultInfo.textContent = infoText;
        
        // Show result container
        this.resultContainer.classList.remove('hidden');
        
        // Smooth scroll to result
        this.resultContainer.scrollIntoView({ behavior: 'smooth' });
    }

    showError(message) {
        this.hideResult();
        this.errorText.textContent = message;
        this.errorContainer.classList.remove('hidden');
        
        // Smooth scroll to error
        this.errorContainer.scrollIntoView({ behavior: 'smooth' });
    }

    hideAllSections() {
        this.hideResult();
        this.hideError();
    }

    hideResult() {
        this.resultContainer.classList.add('hidden');
    }

    hideError() {
        this.errorContainer.classList.add('hidden');
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.resultLink.value);
            
            // Show temporary feedback
            const originalText = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '✅';
            this.copyBtn.style.background = '#48bb78';
            this.copyBtn.style.borderColor = '#48bb78';
            
            setTimeout(() => {
                this.copyBtn.innerHTML = originalText;
                this.copyBtn.style.background = '';
                this.copyBtn.style.borderColor = '';
            }, 2000);
            
        } catch (error) {
            // Fallback for older browsers
            this.resultLink.select();
            this.resultLink.setSelectionRange(0, 99999);
            document.execCommand('copy');
            
            // Show feedback
            const originalText = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '✅';
            setTimeout(() => {
                this.copyBtn.innerHTML = originalText;
            }, 2000);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new KwikLinkExtractorApp();
});

// Add some example URLs for testing
window.addEventListener('load', () => {
    const urlInput = document.getElementById('kwikUrl');
    
    // Add placeholder with example
    urlInput.placeholder = 'https://kwik.si/f/b2bq1bjLdsC2';
    
    // Focus on input
    urlInput.focus();
});