// ==UserScript==
// @name         Page Blocker for Specific Word Combinations
// @namespace    http://tampermonkey.net/
// @version      0.1.3
// @description  Blocks pages containing specific word combinations
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 語群1と語群2の定義
    const wordGroup1 = [
        '勧誘',
        '営業',
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

    // 検索フォーム関連の属性や文字列を判定
    function isSearchRelated(element) {
        const searchKeywords = ['search', 'query', 'keyword', 'find', 'q', 'キーワード', '検索'];
        
        // 要素の属性をチェック
        const attributes = [
            element.id?.toLowerCase() || '',
            element.name?.toLowerCase() || '',
            element.className?.toLowerCase() || '',
            element.placeholder?.toLowerCase() || '',
            element.type?.toLowerCase() || ''
        ];

        // 親要素のform要素の属性もチェック
        const parentForm = element.closest('form');
        if (parentForm) {
            attributes.push(
                parentForm.id?.toLowerCase() || '',
                parentForm.className?.toLowerCase() || '',
                parentForm.action?.toLowerCase() || ''
            );
        }

        // いずれかの属性に検索関連のキーワードが含まれているかチェック
        return attributes.some(attr => 
            searchKeywords.some(keyword => attr.includes(keyword))
        );
    }

    // フォーム要素の存在チェック（検索フォームを除外）
    function hasNonSearchFormElements() {
        // form要素のチェック
        const forms = document.getElementsByTagName('form');
        for (const form of forms) {
            // 明らかに検索フォームと判断できる場合はスキップ
            if (isSearchRelated(form)) continue;
            return true;
        }

        // input要素のチェック
        const inputs = document.getElementsByTagName('input');
        for (const input of inputs) {
            // 検索関連の要素はスキップ
            if (isSearchRelated(input)) continue;
            // hidden inputはスキップ
            if (input.type === 'hidden') continue;
            return true;
        }

        // textarea要素のチェック（通常検索フォームには使用されない）
        const textareas = document.getElementsByTagName('textarea');
        if (textareas.length > 0) return true;

        return false;
    }

    // ページ内のテキストを取得
    function getPageText() {
        return document.body.innerText.toLowerCase();
    }

    // 指定された語群から検出された単語を取得
    function getDetectedWords(text, wordGroup) {
        return wordGroup.filter(word => text.includes(word));
    }

    // メイン処理
    function checkAndBlockPage() {
        // トップページの場合は、検索フォーム以外のフォーム要素がある場合のみチェックする
        if (isTopPage() && !hasNonSearchFormElements()) {
            return;
        }

        const pageText = getPageText();
        
        // 両方の語群から検出された単語を取得
        const detectedWords1 = getDetectedWords(pageText, wordGroup1);
        const detectedWords2 = getDetectedWords(pageText, wordGroup2);
        
        // 両方の語群から単語が見つかった場合
        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            // ページの内容を非表示にする
            document.body.innerHTML = '';
            
            // 警告メッセージを作成
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
            
            // 警告メッセージをページに追加
            document.body.appendChild(blockMessage);
        }
    }

    // DOMの読み込み完了後に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndBlockPage);
    } else {
        checkAndBlockPage();
    }
})();
