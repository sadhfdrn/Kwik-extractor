# Overview

This is a fully functional Kwik Link Extractor web application that successfully extracts direct download links from Kwik URLs (kwik.si, kwik.cx, kwik.sx). The application features a modern web interface with a robust Node.js backend that handles compression, session management, and the complete extraction process using algorithms ported from the original C++ implementation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure
- **Frontend**: Modern web interface with HTML, CSS, and JavaScript
  - `index.html`: Main application interface with responsive design
  - `style.css`: Professional styling with gradient themes and animations
  - `app.js`: Main application logic and UI interactions
  - `kwik-extractor.js`: Core extraction algorithms and decoding functionality
- **Backend**: Simple Node.js HTTP server
  - `server.js`: HTTP server serving static files on port 5000
- **Legacy**: Original console application (`hello.js`) preserved

## Runtime Environment
- **Node.js HTTP Server**: Serves the web application on port 5000
- **Static File Serving**: Direct serving of HTML, CSS, and JavaScript files
- **CORS Support**: Cross-origin resource sharing enabled for API requests
- **Responsive Design**: Works on desktop and mobile devices

## Design Patterns
- **Class-based Architecture**: Object-oriented design with KwikExtractor and KwikLinkExtractorApp classes
- **Event-driven UI**: Modern web interface with event listeners and async operations
- **Progressive Enhancement**: Graceful error handling and user feedback
- **Separation of Concerns**: Clear separation between UI logic and extraction algorithms

# External Dependencies

## Runtime Dependencies
- **Node.js**: Required JavaScript runtime environment for the server
- **Modern Web Browser**: Required for the frontend interface

## External Services
- **CORS Proxy**: Uses `api.allorigins.win` for cross-origin requests to bypass browser CORS restrictions
- **Kwik Sites**: Extracts content from kwik.si, kwik.cx, kwik.sx domains

## Key Features
- **Link Extraction**: Decodes obfuscated JavaScript to extract download links
- **Progress Tracking**: Real-time progress indicators during extraction
- **Error Handling**: Comprehensive error handling with retry mechanisms
- **Copy to Clipboard**: One-click copying of extracted links
- **Responsive Design**: Works on all device sizes
- **URL Validation**: Validates Kwik URLs before processing

## Technical Implementation
- **Base Conversion Algorithm**: Ported from C++ for decoding obfuscated strings
- **Compression Support**: Handles gzip, deflate, and brotli compression automatically
- **Session Management**: Proper cookie handling for authenticated requests
- **Multiple Regex Patterns**: Flexible pattern matching for different JavaScript obfuscation formats
- **Real-time Progress**: Live progress indicators during extraction process
- **Async/Await**: Modern JavaScript for handling asynchronous operations
- **DOM Manipulation**: Dynamic UI updates without external frameworks

## Recent Changes (January 2025)
- **Fixed compression handling**: Added proper gzip/deflate decompression for web requests
- **Improved pattern matching**: Multiple regex patterns handle different obfuscation formats
- **Enhanced debugging**: Detailed logging for troubleshooting extraction issues
- **Working extraction**: Successfully extracts direct download links from real Kwik URLs
- **Backend API**: Complete extraction process handled server-side with proper session management
- **Cleanup**: Removed animepahe-cli C++ reference code after successful JavaScript implementation