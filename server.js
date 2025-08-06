const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const querystring = require('querystring');
const zlib = require('zlib');

const PORT = 5000;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// API request handler
async function handleApiRequest(req, res) {
    const urlPath = req.url;
    
    if (urlPath === '/api/extract' && req.method === 'POST') {
        await handleExtractRequest(req, res);
    } else if (urlPath.startsWith('/api/fetch/') && req.method === 'GET') {
        await handleFetchRequest(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }
}

// Handle extract request
async function handleExtractRequest(req, res) {
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const { url: targetUrl } = JSON.parse(body);
            
            if (!targetUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'URL is required' }));
                return;
            }

            const result = await extractKwikLink(targetUrl);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
        } catch (error) {
            console.error('Extract error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

// Handle fetch request with proper headers
async function handleFetchRequest(req, res) {
    try {
        const encodedUrl = req.url.substring('/api/fetch/'.length);
        const targetUrl = decodeURIComponent(encodedUrl);
        
        const result = await fetchWithHeaders(targetUrl);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            contents: result.body,
            headers: result.headers
        }));
        
    } catch (error) {
        console.error('Fetch error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
}

// Extract Kwik link with proper session handling
async function extractKwikLink(url) {
    try {
        // Step 1: Fetch initial page
        const initialResponse = await fetchWithHeaders(url);
        let cleanText = initialResponse.body.replace(/(\r\n|\r|\n)/g, '');
        cleanText = sanitizeUtf8(cleanText);
        
        console.log('Debug: Initial page fetched, content length:', cleanText.length);
        
        let kwikLink = '';
        
        // Try direct link extraction first
        const directLinkMatch = cleanText.match(/"(https?:\/\/kwik\.[^\/\s"]+\/[^\/\s"]+\/[^"\s]*)"/);
        if (directLinkMatch) {
            kwikLink = directLinkMatch[1];
        } else {
            // Try multiple regex patterns for obfuscated content
            let encodeMatch = null;
            
            // Pattern 1: Standard pattern from C++
            encodeMatch = cleanText.match(/\(\s*"([^",]*)"\s*,\s*\d+\s*,\s*"([^",]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/);
            
            // Pattern 2: Alternative format without spaces
            if (!encodeMatch) {
                encodeMatch = cleanText.match(/\("([^",]*)",\d+,"([^",]*)",(\d+),(\d+),\d+[a-zA-Z]?\)/);
            }
            
            // Pattern 3: Alternative format with different delimiters
            if (!encodeMatch) {
                encodeMatch = cleanText.match(/\(['"]([^'",]*)['"]\s*,\s*\d+\s*,\s*['"]([^'",]*)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/);
            }
            
            // Pattern 4: Look for any function call with the pattern
            if (!encodeMatch) {
                encodeMatch = cleanText.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(\s*['"]([^'",]*)['"],\d+,['"]([^'",]*)['"]\s*,\s*(\d+)\s*,\s*(\d+)/);
            }
            
            if (!encodeMatch) {
                console.log('Debug: Clean text length:', cleanText.length);
                console.log('Debug: First 1000 chars:', cleanText.substring(0, 1000));
                console.log('Debug: Looking for patterns in text...');
                
                // Look for any parentheses with string patterns
                const patternSearch = cleanText.match(/\([^)]*["'][^"']*["'][^)]*\)/g);
                if (patternSearch) {
                    console.log('Debug: Found potential patterns:', patternSearch.slice(0, 5));
                }
                
                throw new Error('Could not find encoding parameters in the page. Debug info logged.');
            }
            
            const [, encodedString, alphabetKey, offsetStr, baseStr] = encodeMatch;
            const offset = parseInt(offsetStr);
            const base = parseInt(baseStr);
            
            const decodedString = decodeJSStyle(encodedString, alphabetKey, offset, base);
            
            const decodedLinkMatch = decodedString.match(/"(https?:\/\/kwik\.[^\/\s"]+\/[^\/\s"]+\/[^"\s]*)"/);
            if (!decodedLinkMatch) {
                throw new Error('Could not extract Kwik link from decoded content');
            }
            
            kwikLink = decodedLinkMatch[1];
            kwikLink = kwikLink.replace(/(https:\/\/kwik\.[^\/]+\/)d\//, '$1f/');
        }
        
        // Step 2: Fetch Kwik page and extract direct link
        console.log('Debug: Fetching Kwik page:', kwikLink);
        const kwikResponse = await fetchWithHeaders(kwikLink);
        const kwikText = kwikResponse.body.replace(/(\r\n|\r|\n)/g, '');
        
        console.log('Debug: Kwik page fetched, content length:', kwikText.length);
        
        // Extract session cookie
        const kwikSession = extractCookieValue(kwikResponse.headers['set-cookie'], 'kwik_session');
        console.log('Debug: Kwik session extracted:', kwikSession ? 'found' : 'not found');
        
        // Find encoded parameters in Kwik page with multiple patterns
        let kwikEncodeMatch = null;
        
        // Try the same patterns as above
        kwikEncodeMatch = kwikText.match(/\(\s*"([^",]*)"\s*,\s*\d+\s*,\s*"([^",]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/);
        
        if (!kwikEncodeMatch) {
            kwikEncodeMatch = kwikText.match(/\("([^",]*)",\d+,"([^",]*)",(\d+),(\d+),\d+[a-zA-Z]?\)/);
        }
        
        if (!kwikEncodeMatch) {
            kwikEncodeMatch = kwikText.match(/\(['"]([^'",]*)['"]\s*,\s*\d+\s*,\s*['"]([^'",]*)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/);
        }
        
        if (!kwikEncodeMatch) {
            kwikEncodeMatch = kwikText.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(\s*['"]([^'",]*)['"],\d+,['"]([^'",]*)['"]\s*,\s*(\d+)\s*,\s*(\d+)/);
        }
        
        if (!kwikEncodeMatch) {
            console.log('Debug: Kwik page encoding not found, returning intermediate result');
            return { success: true, directLink: kwikLink, message: 'Kwik link extracted (direct link pattern not found in page)' };
        }
        
        const [, kwikEncodedString, kwikAlphabetKey, kwikOffsetStr, kwikBaseStr] = kwikEncodeMatch;
        const kwikOffset = parseInt(kwikOffsetStr);
        const kwikBase = parseInt(kwikBaseStr);
        
        const kwikDecodedString = decodeJSStyle(kwikEncodedString, kwikAlphabetKey, kwikOffset, kwikBase);
        
        // Extract POST URL and token
        const postUrlMatch = kwikDecodedString.match(/"(https?:\/\/kwik\.[^\/\s"]+\/[^\/\s"]+\/[^"\s]*)"/);
        const tokenMatch = kwikDecodedString.match(/name="_token"[^"]*"(\S*)"/);
        
        if (!postUrlMatch || !tokenMatch) {
            return { success: true, directLink: kwikLink, message: 'Kwik link extracted (direct link extraction not available)' };
        }
        
        const postUrl = postUrlMatch[1];
        const token = tokenMatch[1];
        
        // Step 3: Make POST request to get direct link
        const directLink = await makePostRequest(postUrl, token, kwikLink, kwikSession);
        
        return {
            success: true,
            directLink,
            kwikLink,
            message: 'Direct download link extracted successfully!'
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Decode JS-style obfuscated string
function decodeJSStyle(encodedStr, alphabetKey, offset, base) {
    const baseAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";
    let result = '';
    
    for (let i = 0; i < encodedStr.length; i++) {
        let segment = '';
        
        while (i < encodedStr.length && encodedStr[i] !== alphabetKey[base]) {
            segment += encodedStr[i];
            i++;
        }
        
        for (let j = 0; j < alphabetKey.length; j++) {
            const regex = new RegExp(alphabetKey[j], 'g');
            segment = segment.replace(regex, j.toString());
        }
        
        const fromAlphabet = baseAlphabet.substring(0, base);
        let decimal = 0;
        for (let k = 0; k < segment.length; k++) {
            const char = segment[segment.length - 1 - k];
            const pos = fromAlphabet.indexOf(char);
            if (pos !== -1) {
                decimal += pos * Math.pow(base, k);
            }
        }
        
        const code = decimal - offset;
        result += String.fromCharCode(code);
    }
    
    return result;
}

// Make HTTP/HTTPS request with proper headers and compression support
function fetchWithHeaders(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers
            }
        };
        
        const req = lib.request(reqOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                let body = '';
                
                // Handle different compression types
                const encoding = res.headers['content-encoding'];
                
                try {
                    if (encoding === 'gzip') {
                        body = zlib.gunzipSync(buffer).toString('utf8');
                    } else if (encoding === 'deflate') {
                        body = zlib.inflateSync(buffer).toString('utf8');
                    } else if (encoding === 'br') {
                        body = zlib.brotliDecompressSync(buffer).toString('utf8');
                    } else {
                        body = buffer.toString('utf8');
                    }
                } catch (decompressError) {
                    console.log('Debug: Decompression failed, trying as plain text');
                    body = buffer.toString('utf8');
                }
                
                resolve({
                    body: body,
                    headers: res.headers,
                    statusCode: res.statusCode
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Make POST request for direct link
async function makePostRequest(postUrl, token, referer, kwikSession) {
    const formData = querystring.stringify({
        '_token': token
    });
    
    const response = await fetchWithHeaders(postUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData),
            'Referer': referer,
            'Cookie': `kwik_session=${kwikSession}`
        },
        body: formData
    });
    
    // Check for redirect (302)
    if (response.statusCode === 302) {
        const location = response.headers.location;
        if (location) {
            return location;
        }
    }
    
    // Look for redirect in response body
    const redirectMatch = response.body.match(/(?:location|href)["':\s]*["']?(https?:\/\/[^"'\s]+)/i);
    if (redirectMatch) {
        return redirectMatch[1];
    }
    
    throw new Error('Could not extract direct download link from response');
}

// Extract cookie value from set-cookie headers
function extractCookieValue(setCookieHeaders, cookieName) {
    if (!setCookieHeaders) return '';
    
    const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    
    for (const cookie of cookies) {
        const match = cookie.match(new RegExp(`${cookieName}=([^;]*)`));
        if (match) {
            return match[1];
        }
    }
    
    return '';
}

// Sanitize UTF-8 content (JavaScript version of C++ function)
function sanitizeUtf8(input) {
    // Remove non-printable ASCII characters except whitespace
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

const server = http.createServer((req, res) => {
    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle API endpoints
    if (req.url.startsWith('/api/')) {
        handleApiRequest(req, res);
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;
    
    // Remove query parameters
    filePath = filePath.split('?')[0];
    
    // Security: prevent directory traversal
    filePath = path.normalize(filePath);
    if (filePath.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            // File not found
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - Not Found</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        h1 { color: #c53030; }
                        a { color: #667eea; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <h1>404 - File Not Found</h1>
                    <p>The requested file could not be found.</p>
                    <a href="/">← Go back to Kwik Link Extractor</a>
                </body>
                </html>
            `);
            return;
        }

        // Determine content type
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        // Read and serve the file
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>500 - Server Error</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #c53030; }
                            a { color: #667eea; text-decoration: none; }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <h1>500 - Internal Server Error</h1>
                        <p>An error occurred while reading the file.</p>
                        <a href="/">← Go back to Kwik Link Extractor</a>
                    </body>
                    </html>
                `);
                return;
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kwik Link Extractor server running at http://0.0.0.0:${PORT}`);
    console.log(`📱 Access your app at: http://localhost:${PORT}`);
    console.log('🔗 Ready to extract Kwik download links!');
});

// Handle server errors
server.on('error', (err) => {
    console.error('❌ Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.log(`💡 Port ${PORT} is already in use. Please stop other processes or use a different port.`);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});