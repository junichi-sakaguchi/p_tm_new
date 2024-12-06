// ==UserScript==
// @name         Optimized Page Blocker for Specific Word Combinations
// @namespace    http://tampermonkey.net/
// @version      0.1.9
// @description  Performance-optimized page blocker with dynamic content detection
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

    // ブロック状態を追跡
    let isBlocked = false;
    
    // デバウンス用のタイマーID
    let debounceTimer = null;

    // デバウンス関数
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

    // テキストコンテンツを取得する関数（最適化版）
    function getAllTextContent() {
        const textParts = [];
        
        // ページ全体のテキストを取得（非表示要素を除外）
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // 非表示要素のテキストは除外
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
        
        // metaタグの description を追加
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            const content = metaDescription.getAttribute('content');
            if (content) {
                textParts.push(content);
            }
        }
        
        // titleタグの内容を追加
        if (document.title) {
            textParts.push(document.title);
        }
        
        return textParts.join(' ').toLowerCase();
    }

    // 指定された語群から検出された単語を取得（最適化版）
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

    // ページをブロックする処理（最適化版）
    function blockPage(detectedWords1, detectedWords2) {
        if (isBlocked) return; // 既にブロック済みの場合は処理しない
        isBlocked = true;

        // 元のコンテンツを非表示にする（完全に削除せず）
        const originalContent = document.body.innerHTML;
        document.body.style.display = 'none';
        
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
            z-index: 9999;
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
        
        // 新しいコンテナを作成してメッセージを追加
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: white;
            z-index: 9998;
        `;
        
        document.body.appendChild(container);
        document.body.appendChild(blockMessage);
    }

    // メイン処理（最適化版）
    const checkAndBlockPage = debounce(() => {
        if (isBlocked) return; // 既にブロック済みの場合はチェックしない
        
        const visibleText = getAllTextContent();
        const detectedWords1 = getDetectedWords(visibleText, wordGroup1);
        const detectedWords2 = getDetectedWords(visibleText, wordGroup2);
        
        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            console.log('Detected words from group 1:', detectedWords1);
            console.log('Detected words from group 2:', detectedWords2);
            blockPage(detectedWords1, detectedWords2);
        }
    }, 300); // 300ミリ秒のデバウンス

    // MutationObserverの設定（最適化版）
    const observer = new MutationObserver((mutations) => {
        if (isBlocked) {
            observer.disconnect(); // ブロック済みの場合は監視を停止
            return;
        }
        
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

    // 監視の開始
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // 初回チェック
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndBlockPage);
    } else {
        checkAndBlockPage();
    }
})();
