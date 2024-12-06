// ==UserScript==
// @name         Page Blocker for Specific Word Combinations
// @namespace    http://tampermonkey.net/
// @version      0.1.6
// @description  Blocks pages containing specific word combinations
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true; // デバッグモード

    // デバッグ用ログ関数
    function debugLog(...args) {
        if (DEBUG) {
            console.log('[BlockerDebug]', ...args);
        }
    }

    // 語群の定義
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

    // ページがトップページかどうかをチェック
    function isTopPage() {
        const path = window.location.pathname;
        return path === '/' || path === '/index.html' || path === '/index.php';
    }

    // 要素が実際に表示されているかチェック
    function isElementVisible(element) {
        if (!element) return false;

        try {
            const style = window.getComputedStyle(element);
            
            // 非表示の条件をチェック
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0') {
                debugLog('Element is hidden by CSS:', element);
                return false;
            }

            // 要素のサイズと位置をチェック
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                debugLog('Element has zero size:', element);
                return false;
            }

            // 親要素をチェック
            let parent = element.parentElement;
            while (parent) {
                const parentStyle = window.getComputedStyle(parent);
                if (parentStyle.display === 'none' || 
                    parentStyle.visibility === 'hidden' || 
                    parentStyle.opacity === '0') {
                    debugLog('Parent element is hidden:', parent);
                    return false;
                }
                parent = parent.parentElement;
            }

            debugLog('Element is visible:', element);
            return true;
        } catch (e) {
            debugLog('Error checking visibility:', e);
            return true; // エラーの場合は表示されているものとして扱う
        }
    }

    // 検索フォーム関連の属性や文字列を判定
    function isSearchRelated(element) {
        const searchKeywords = ['search', 'query', 'keyword', 'find', 'q', 'キーワード', '検索'];
        
        const attributes = [
            element.id?.toLowerCase() || '',
            element.name?.toLowerCase() || '',
            element.className?.toLowerCase() || '',
            element.placeholder?.toLowerCase() || '',
            element.type?.toLowerCase() || ''
        ];

        const parentForm = element.closest('form');
        if (parentForm) {
            attributes.push(
                parentForm.id?.toLowerCase() || '',
                parentForm.className?.toLowerCase() || '',
                parentForm.action?.toLowerCase() || ''
            );
        }

        return attributes.some(attr => 
            searchKeywords.some(keyword => attr.includes(keyword))
        );
    }

    // フォーム要素の存在チェック（検索フォームを除外）
    function hasNonSearchFormElements() {
        const forms = document.getElementsByTagName('form');
        for (const form of forms) {
            if (isSearchRelated(form)) continue;
            if (isElementVisible(form)) return true;
        }

        const inputs = document.getElementsByTagName('input');
        for (const input of inputs) {
            if (isSearchRelated(input)) continue;
            if (input.type === 'hidden') continue;
            if (isElementVisible(input)) return true;
        }

        const textareas = document.getElementsByTagName('textarea');
        for (const textarea of textareas) {
            if (isElementVisible(textarea)) return true;
        }

        return false;
    }

    // 表示されているテキストを取得
    function getVisibleText() {
        const visibleTexts = [];
        
        // テキストを含む可能性のある要素を全て取得
        const elements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, label, a');
        
        elements.forEach(element => {
            if (isElementVisible(element)) {
                // 直接のテキストノードの内容を取得
                element.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent.trim();
                        if (text) {
                            visibleTexts.push(text);
                            debugLog('Found visible text:', text);
                        }
                    }
                });

                // data属性内のテキストも取得
                const dataAttributes = Array.from(element.attributes)
                    .filter(attr => attr.name.startsWith('data-'))
                    .map(attr => attr.value);
                
                dataAttributes.forEach(text => {
                    if (text.trim()) {
                        visibleTexts.push(text.trim());
                        debugLog('Found data attribute text:', text);
                    }
                });
            }
        });

        const combinedText = visibleTexts.join(' ');
        debugLog('Combined visible text:', combinedText);
        return combinedText;
    }

    // 指定された語群から検出された単語を取得
    function getDetectedWords(visibleText, wordGroup) {
        return wordGroup.filter(wordItem => {
            if (typeof wordItem === 'string') {
                const found = visibleText.includes(wordItem);
                debugLog(`Checking word: ${wordItem}, found: ${found}`);
                return found;
            } else {
                const isWordPresent = visibleText.includes(wordItem.word);
                debugLog(`Checking word: ${wordItem.word}, found: ${isWordPresent}`);
                if (!isWordPresent) return false;

                const isExcluded = wordItem.exclude.some(excludePattern => 
                    visibleText.includes(excludePattern)
                );
                debugLog(`Word ${wordItem.word} excluded: ${isExcluded}`);
                return !isExcluded;
            }
        }).map(wordItem => typeof wordItem === 'string' ? wordItem : wordItem.word);
    }

    // メイン処理
    function checkAndBlockPage() {
        debugLog('Starting page check');

        // トップページの場合は、フォームがある場合のみチェック
        if (isTopPage() && !hasNonSearchFormElements()) {
            debugLog('Skipping top page without forms');
            return;
        }

        const visibleText = getVisibleText().toLowerCase();
        const detectedWords1 = getDetectedWords(visibleText, wordGroup1);
        const detectedWords2 = getDetectedWords(visibleText, wordGroup2);
        
        debugLog('Detected words from group 1:', detectedWords1);
        debugLog('Detected words from group 2:', detectedWords2);

        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            debugLog('Blocking page due to detected words');
            document.body.innerHTML = '';
            
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
                max-width: 80%;
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
            
            document.body.appendChild(blockMessage);
        }
    }

    // ページ読み込み完了時に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndBlockPage);
    } else {
        checkAndBlockPage();
    }

    // 動的なコンテンツ変更を監視
    const observer = new MutationObserver((mutations) => {
        debugLog('DOM mutation detected, rechecking page');
        checkAndBlockPage();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
