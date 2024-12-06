// ==UserScript==
// @name         Timing-Optimized Page Blocker
// @namespace    http://tampermonkey.net/
// @version      0.1.10
// @description  Performance and timing optimized page blocker
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    
    const wordGroup1 = [
        '勧誘',
        { word: '営業', exclude: ['営業時間'] },
        '取引',
        '売り込',
        '売込',
        'セールス',
        '営利目的',
        '商用利用',
        '業者',
        '業務',
        '広告'
    ];
    
    const wordGroup2 = [
        'かねます',
        '兼ねます',
        '断り',
        'おりません',
        '遠慮',
        '控え',
        'ありません',
        'ではない',
        'いたしません',
        'ございません',
        'しかるべき対応',
        '訴訟',
        '請求'
    ];

    let isBlocked = false;
    let isInitialized = false;
    let debounceTimer = null;

    function debounce(func, wait) {
        return function executedFunction(...args) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                func.apply(this, args);
                debounceTimer = null;
            }, wait);
        };
    }

    function getAllTextContent() {
        const textParts = [];
        
        try {
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        let parent = node.parentElement;
                        while (parent) {
                            const style = window.getComputedStyle(parent);
                            if (style.display === 'none' || 
                                style.visibility === 'hidden' || 
                                style.opacity === '0') {
                                return NodeFilter.FILTER_REJECT;
                            }
                            parent = parent.parentElement;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                },
                false
            );

            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text) {
                    textParts.push(text);
                }
            }
            
            const metaDescription = document.querySelector('meta[name="description"]');
            if (metaDescription) {
                const content = metaDescription.getAttribute('content');
                if (content) {
                    textParts.push(content);
                }
            }
            
            if (document.title) {
                textParts.push(document.title);
            }
        } catch (error) {
            console.error('Error getting text content:', error);
        }
        
        return textParts.join(' ').toLowerCase();
    }

    function getDetectedWords(text, wordGroup) {
        const detected = [];
        for (const wordItem of wordGroup) {
            if (typeof wordItem === 'string') {
                if (text.includes(wordItem)) {
                    detected.push(wordItem);
                }
            } else {
                if (text.includes(wordItem.word)) {
                    if (!wordItem.exclude?.some(excludePattern => text.includes(excludePattern))) {
                        detected.push(wordItem.word);
                    }
                }
            }
        }
        return detected;
    }

    function blockPage(detectedWords1, detectedWords2) {
        if (isBlocked) return;
        isBlocked = true;

        // オリジナルのコンテンツを保持
        const originalDisplay = document.body.style.display;
        const blockContainer = document.createElement('div');
        blockContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: white;
            z-index: 999999;
        `;
        
        const blockMessage = document.createElement('div');
        blockMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            text-align: center;
            font-family: Arial, sans-serif;
            z-index: 1000000;
        `;
        
        blockMessage.innerHTML = `
            <h2 style="color: #721c24; margin-bottom: 10px;">こちらの企業は営業禁止です。</h2>
            <p style="color: #721c24; margin: 0;">送付結果を「送付失敗」にして、送付失敗理由に「営業禁止」と記載してください</p>
            <p style="color: #721c24; margin-top: 15px; font-size: 12px;">
                検出された単語:<br>
                語群1: ${detectedWords1.join(', ')}<br>
                語群2: ${detectedWords2.join(', ')}
            </p>
        `;
        
        document.body.appendChild(blockContainer);
        document.body.appendChild(blockMessage);
    }

    const checkAndBlockPage = debounce(() => {
        if (isBlocked || !isInitialized) return;
        
        const visibleText = getAllTextContent();
        const detectedWords1 = getDetectedWords(visibleText, wordGroup1);
        const detectedWords2 = getDetectedWords(visibleText, wordGroup2);
        
        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            console.log('Detected words from group 1:', detectedWords1);
            console.log('Detected words from group 2:', detectedWords2);
            blockPage(detectedWords1, detectedWords2);
        }
    }, 500);

    const observer = new MutationObserver((mutations) => {
        if (isBlocked || !isInitialized) return;
        
        let shouldCheck = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                shouldCheck = true;
                break;
            }
        }
        
        if (shouldCheck) {
            checkAndBlockPage();
        }
    });

    // ページの完全な読み込み後に初期化
    window.addEventListener('load', () => {
        isInitialized = true;
        setTimeout(() => {
            checkAndBlockPage();
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }, 1000); // 1秒待ってから初期チェックを実行
    });
})();
