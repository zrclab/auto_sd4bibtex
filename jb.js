// ==UserScript==
// @name         ScienceDirect BibTeX(Direct)
// @namespace    https://github.com/zrc2024
// @version      2.0
// @description  Add "Copy BibTeX" button next to Google Scholar buttons on ScienceDirect
// @match        *://www.sciencedirect.com/science/article/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      scholar.google.com
// @connect      scholar.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Get BibTeX from Google Scholar URL
    function getBibTeX(googleScholarUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: googleScholarUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                onload: function(response) {
                    if (response.status !== 200) {
                        reject('Failed to access Google Scholar');
                        return;
                    }

                    // Find BibTeX link in the Google Scholar page
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    
                    // Look for "Import into BibTeX" link
                    const bibLink = doc.querySelector('a[href*="scholar.bib"]');
                    
                    if (!bibLink) {
                        reject('No BibTeX link found on Google Scholar page');
                        return;
                    }

                    // Get the BibTeX content
                    const bibUrl = bibLink.href;
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: bibUrl,
                        onload: function(bibResponse) {
                            if (bibResponse.status === 200) {
                                resolve(bibResponse.responseText.trim());
                            } else {
                                reject('Failed to fetch BibTeX content');
                            }
                        },
                        onerror: function() {
                            reject('Network error fetching BibTeX');
                        },
                        timeout: 8000
                    });
                },
                onerror: function() {
                    reject('Network error accessing Google Scholar');
                },
                timeout: 10000
            });
        });
    }

    // Show notification
    function showNotification(message, isSuccess = true) {
        // Remove existing notification
        const existingNotification = document.getElementById('bibtex-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'bibtex-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isSuccess ? '#4CAF50' : '#f44336'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 2147483647 !important;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // Hide after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Create and add Copy BibTeX button
    function createBibTeXButton(googleScholarButton) {
        // Check if button already exists
        const existingButton = googleScholarButton.parentNode.querySelector('.bibtex-copy-btn');
        if (existingButton) {
            return;
        }

        // Create the Copy BibTeX button
        const bibtexButton = document.createElement('button');
        bibtexButton.className = 'bibtex-copy-btn';
        bibtexButton.textContent = 'Copy BibTeX';
        bibtexButton.style.cssText = `
            background: #2196F3;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            margin-left: 8px;
            font-family: Arial, sans-serif;
            transition: background-color 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;

        // Hover effect
        bibtexButton.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#1976D2';
        });

        bibtexButton.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#2196F3';
        });

        // Click handler
        bibtexButton.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Get Google Scholar URL
            const googleScholarUrl = googleScholarButton.href;
            
            if (!googleScholarUrl) {
                showNotification('Google Scholar URL not found', false);
                return;
            }

            // Show loading state
            const originalText = bibtexButton.textContent;
            bibtexButton.textContent = 'Loading...';
            bibtexButton.disabled = true;

            try {
                const bibtex = await getBibTeX(googleScholarUrl);
                await GM_setClipboard(bibtex);
                showNotification('✅ BibTeX copied to clipboard!');
            } catch (error) {
                console.error('Error getting BibTeX:', error);
                showNotification('❌ Failed to get BibTeX: ' + error, false);
            } finally {
                // Restore button state
                bibtexButton.textContent = originalText;
                bibtexButton.disabled = false;
            }
        });

        // Insert button after Google Scholar button
        googleScholarButton.parentNode.insertBefore(bibtexButton, googleScholarButton.nextSibling);
    }

    // Find and add buttons to all Google Scholar links
    function findAndAddBibTeXButtons() {
        // Look for Google Scholar links with various selectors
        const selectors = [
            'a[href*="scholar.google.com"]',
            'a[title*="Google Scholar"]',
            'a:contains("Google Scholar")',
            '.google-scholar-link',
            '[data-testid*="google-scholar"]'
        ];

        let foundButtons = [];

        selectors.forEach(selector => {
            try {
                const buttons = document.querySelectorAll(selector);
                foundButtons.push(...Array.from(buttons));
            } catch (e) {
                // Some selectors might not be supported
            }
        });

        // Also look by text content
        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(link => {
            if (link.textContent.includes('Google Scholar') || 
                link.title.includes('Google Scholar') ||
                link.href.includes('scholar.google.com')) {
                foundButtons.push(link);
            }
        });

        // Remove duplicates
        foundButtons = [...new Set(foundButtons)];

        // Add buttons to each Google Scholar link
        foundButtons.forEach(button => {
            createBibTeXButton(button);
        });
    }

    // Initialize the script
    function init() {
        // Initial scan
        findAndAddBibTeXButtons();

        // Watch for dynamic content changes
        const observer = new MutationObserver(function(mutations) {
            let shouldRescan = false;
            
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added nodes might contain Google Scholar links
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'A' || node.querySelector && node.querySelector('a')) {
                                shouldRescan = true;
                            }
                        }
                    });
                }
            });

            if (shouldRescan) {
                setTimeout(findAndAddBibTeXButtons, 500);
            }
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also rescan periodically (fallback)
        setInterval(findAndAddBibTeXButtons, 3000);
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
