/**
 * Kwik Link Extractor - Core functionality
 * Ported from C++ AnimepaheCLI to JavaScript
 */
class KwikExtractor {
    constructor() {
        this.baseAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";
        this.zp = 17;
        this.placeholder = 24;
    }

    /**
     * Decode base conversion similar to _0xe16c function in C++
     */
    decodeBase(encodedStr, fromBase, toBase) {
        const fromAlphabet = this.baseAlphabet.substring(0, fromBase);
        const toAlphabet = this.baseAlphabet.substring(0, toBase);

        // Convert from source base to decimal
        let decimal = 0;
        for (let i = 0; i < encodedStr.length; i++) {
            const char = encodedStr[encodedStr.length - 1 - i];
            const pos = fromAlphabet.indexOf(char);
            if (pos !== -1) {
                decimal += pos * Math.pow(fromBase, i);
            }
        }

        // Convert decimal to target base
        if (decimal === 0) return toAlphabet[0];

        let result = '';
        while (decimal > 0) {
            result = toAlphabet[decimal % toBase] + result;
            decimal = Math.floor(decimal / toBase);
        }

        return parseInt(result);
    }

    /**
     * Decode JS-style obfuscated string
     */
    decodeJSStyle(encodedStr, zp, alphabetKey, offset, base, placeholder) {
        let result = '';
        
        for (let i = 0; i < encodedStr.length; i++) {
            let segment = '';
            
            // Extract segment until we hit the separator character
            while (i < encodedStr.length && encodedStr[i] !== alphabetKey[base]) {
                segment += encodedStr[i];
                i++;
            }

            // Replace alphabet characters with their indices
            for (let j = 0; j < alphabetKey.length; j++) {
                const regex = new RegExp(alphabetKey[j], 'g');
                segment = segment.replace(regex, j.toString());
            }

            // Decode the segment
            const code = this.decodeBase(segment, base, 10) - offset;
            result += String.fromCharCode(code);
        }

        return result;
    }

    /**
     * Use backend API for requests
     */
    createApiUrl(endpoint, url = '') {
        if (endpoint === 'extract') {
            return '/api/extract';
        } else if (endpoint === 'fetch') {
            return `/api/fetch/${encodeURIComponent(url)}`;
        }
        return endpoint;
    }

    /**
     * Extract direct download link using backend API
     */
    async extractWithBackend(url, onProgress) {
        try {
            onProgress?.('Starting extraction...', 10);
            
            const response = await fetch(this.createApiUrl('extract'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Server error`);
            }
            
            onProgress?.('Processing response...', 90);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown server error');
            }
            
            onProgress?.('Extraction completed!', 100);
            return data;
            
        } catch (error) {
            throw new Error(`Backend extraction failed: ${error.message}`);
        }
    }

    /**
     * Fallback method for frontend-only extraction (legacy)
     */
    async extractKwikLink(link, onProgress) {
        try {
            onProgress?.('Fetching initial page...', 20);
            
            const fetchUrl = this.createApiUrl('fetch', link);
            const response = await fetch(fetchUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch page`);
            }

            const data = await response.json();
            let cleanText = data.contents.replace(/(\r\n|\r|\n)/g, '');
            
            onProgress?.('Parsing page content...', 40);

            let kwikLink = '';

            // First attempt: direct link extraction
            const directLinkMatch = cleanText.match(/"(https?:\/\/kwik\.[^\/\s"]+\/[^\/\s"]+\/[^"\s]*)"/);
            if (directLinkMatch) {
                kwikLink = directLinkMatch[1];
            } else {
                // Second attempt: decode and extract
                const encodeMatch = cleanText.match(/\(\s*"([^",]*)"\s*,\s*\d+\s*,\s*"([^",]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/);
                
                if (!encodeMatch) {
                    throw new Error('Could not find encoding parameters in the page');
                }

                onProgress?.('Decoding obfuscated content...', 60);

                const [, encodedString, alphabetKey, offsetStr, baseStr] = encodeMatch;
                const offset = parseInt(offsetStr);
                const base = parseInt(baseStr);

                const decodedString = this.decodeJSStyle(encodedString, this.zp, alphabetKey, offset, base, this.placeholder);
                
                const decodedLinkMatch = decodedString.match(/"(https?:\/\/kwik\.[^\/\s"]+\/[^\/\s"]+\/[^"\s]*)"/);
                if (!decodedLinkMatch) {
                    throw new Error('Could not extract Kwik link from decoded content');
                }

                kwikLink = decodedLinkMatch[1];
                // Replace /d/ with /f/ in the URL if present
                kwikLink = kwikLink.replace(/(https:\/\/kwik\.[^\/]+\/)d\//, '$1f/');
            }

            onProgress?.('Kwik link extracted successfully', 80);
            return kwikLink;

        } catch (error) {
            throw new Error(`Failed to extract Kwik link: ${error.message}`);
        }
    }

    /**
     * Make authenticated request (would need backend in real implementation)
     */
    async makeAuthenticatedRequest(postUrl, token, referer) {
        // In a real implementation, this would need to be handled by a backend service
        // because of CORS restrictions and the need for proper cookie handling
        
        try {
            // Attempt to use the CORS proxy for the POST request
            const proxyUrl = this.createProxyUrl(postUrl);
            
            // This is a simplified approach - in reality, you'd need proper session handling
            const response = await fetch(proxyUrl, {
                method: 'GET', // The proxy service might not support POST
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Look for redirect URLs in the response
                const redirectMatch = data.contents.match(/(?:location|href)["':\s]*["']?(https?:\/\/[^"'\s]+)/i);
                if (redirectMatch) {
                    return redirectMatch[1];
                }
            }

            // Fallback: return a message indicating backend needed
            throw new Error('Direct link extraction requires backend service for proper authentication');
            
        } catch (error) {
            // Return informative error for frontend-only limitation
            throw new Error('This extraction requires a backend service due to CORS and authentication requirements. The Kwik link has been successfully extracted and can be opened manually.');
        }
    }

    /**
     * Main extraction method
     */
    async extract(url, onProgress) {
        try {
            onProgress?.('Starting extraction...', 0);
            
            // Validate URL
            if (!this.isValidKwikUrl(url)) {
                throw new Error('Invalid Kwik URL format');
            }

            // Try backend extraction first (most reliable)
            try {
                const result = await this.extractWithBackend(url, onProgress);
                return result;
            } catch (backendError) {
                onProgress?.('Backend extraction failed, trying fallback...', 50);
                
                // Fallback to frontend-only extraction
                try {
                    const kwikLink = await this.extractKwikLink(url, onProgress);
                    return {
                        success: true,
                        directLink: kwikLink,
                        kwikLink,
                        message: 'Kwik link extracted successfully. Full extraction may require additional backend support.',
                        warning: `Backend error: ${backendError.message}`
                    };
                } catch (fallbackError) {
                    throw new Error(`Both backend and fallback extraction failed. Backend: ${backendError.message}. Fallback: ${fallbackError.message}`);
                }
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate if URL is a valid Kwik URL
     */
    isValidKwikUrl(url) {
        try {
            const urlObj = new URL(url);
            return /kwik\.(si|cx|sx|li)/i.test(urlObj.hostname);
        } catch {
            return false;
        }
    }

    /**
     * Sanitize UTF-8 content (simplified version)
     */
    sanitizeUtf8(text) {
        // Remove non-printable characters except whitespace
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
}