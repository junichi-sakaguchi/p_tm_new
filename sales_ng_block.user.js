// ==UserScript==
// @name         Improved Page Blocker for Specific Word Combinations with Dynamic Content Detection
// @namespace    http://tampermonkey.net/
// @version      0.1.8
// @description  Enhanced page blocker with dynamic content detection
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

    // テキストコンテンツを取得する関数（動的コンテンツ対応）
    function getAllTextContent() {
        let fullText = '';
        
        // ページ全体のテキストを取得
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            // hidden要素は除外
            if (!isHiddenElement(node.parentElement)) {
                fullText += node.textContent + ' ';
            }
        }
        
        // metaタグの description も含める
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            fullText += ' ' + metaDescription.getAttribute('content');
        }
        
        // titleタグの内容も含める
        const titleText = document.title;
        if (titleText) {
            fullText += ' ' + titleText;
        }
        
        return fullText.toLowerCase();
    }

    // 要素が非表示かどうかをチェック
    function isHiddenElement(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    }

    // 指定された語群から検出された単語を取得（除外パターンを考慮）
    function getDetectedWords(text, wordGroup) {
        return wordGroup.filter(wordItem => {
            if (typeof wordItem === 'string') {
                return text.includes(wordItem);
            } else {
                const isWordPresent = text.includes(wordItem.word);
                if (!isWordPresent) return false;
                return !wordItem.exclude?.some(excludePattern => 
                    text.includes(excludePattern)
                );
            }
        }).map(wordItem => typeof wordItem === 'string' ? wordItem : wordItem.word);
    }

    // ページをブロックする処理
    function blockPage(detectedWords1, detectedWords2) {
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

    // メイン処理
    function checkAndBlockPage() {
        const visibleText = getAllTextContent();
        
        const detectedWords1 = getDetectedWords(visibleText, wordGroup1);
        const detectedWords2 = getDetectedWords(visibleText, wordGroup2);
        
        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            console.log('Detected words from group 1:', detectedWords1);
            console.log('Detected words from group 2:', detectedWords2);
            blockPage(detectedWords1, detectedWords2);
        }
    }

    // MutationObserverの設定
    const observer = new MutationObserver((mutations) => {
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
