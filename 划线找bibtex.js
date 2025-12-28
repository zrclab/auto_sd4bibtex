// ==UserScript==
// @name         ScienceDirect BibTeX(chalk line)
// @namespace    https://github.com/zrc2024
// @version      1.0
// @description  Select text → Right-click → Copy BibTeX (via Google Scholar)
// @match        *://www.sciencedirect.com/science/article/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      scholar.google.com
// @connect      scholar.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Get BibTeX from Google Scholar
    function getBibTeX(title) {
        return new Promise((resolve, reject) => {
            const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}&hl=en`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: searchUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                onload: function(response) {
                    if (response.status !== 200) {
                        reject('Search failed');
                        return;
                    }

                    // Find BibTeX link
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    const bibLink = doc.querySelector('a[href*="scholar.bib"]');

                    if (!bibLink) {
                        reject('No BibTeX found');
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
                                reject('Failed to fetch BibTeX');
                            }
                        },
                        onerror: function() {
                            reject('Network error fetching BibTeX');
                        },
                        timeout: 8000
                    });
                },
                onerror: function() {
                    reject('Network error searching Scholar');
                },
                timeout: 10000
            });
        });
    }

    // Create context menu
    function createMenu(x, y, selectedText) {
        const menu = document.createElement('div');
        menu.id = 'bibtex-menu-simple';
        menu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: #2196F3;
            color: white;
            padding: 6px 15px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            z-index: 2147483647 !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            pointer-events: auto;
        `;
        menu.textContent = '📋 Copy BibTeX';

        menu.addEventListener('click', async function(e) {
            e.stopPropagation();
            menu.remove();

            try {
                const bibtex = await getBibTeX(selectedText);
                await GM_setClipboard(bibtex);
                alert('✅ BibTeX copied to clipboard!');
            } catch (error) {
                console.error('Error:', error);
                alert('❌ Failed to get BibTeX:\n' + error);
            }
        });

        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            }, { once: true });
        }, 10);

        document.body.appendChild(menu);
    }

    // Context menu handler
    document.addEventListener('contextmenu', function(e) {
        const selection = window.getSelection().toString().trim();
        if (selection.length < 5) return; // Minimum length for meaningful search

        e.preventDefault();
        createMenu(e.clientX + 5, e.clientY - 20, selection);
    }, true);
})();
