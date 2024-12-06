// ==UserScript==
// @name         Improved Page Blocker for Specific Word Combinations
// @namespace    http://tampermonkey.net/
// @version      0.1.7
// @description  Enhanced page blocker with better text detection
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 語群1と語群2の定義は同じ
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

    // すべてのテキストを取得する改善された関数
    function getAllTextContent() {
        // ページ全体のテキストを取得
        let fullText = document.body.innerText;
        
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

    // メイン処理
    function checkAndBlockPage() {
        const visibleText = getAllTextContent();
        
        const detectedWords1 = getDetectedWords(visibleText, wordGroup1);
        const detectedWords2 = getDetectedWords(visibleText, wordGroup2);
        
        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            console.log('Detected words from group 1:', detectedWords1);
            console.log('Detected words from group 2:', detectedWords2);
            
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
    }

    // ページ読み込み完了時に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndBlockPage);
    } else {
        checkAndBlockPage();
    }
})();
