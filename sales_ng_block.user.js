// ==UserScript==
// @name         Path and Form Aware Page Blocker
// @namespace    http://tampermonkey.net/
// @version      0.1.12
// @description  Page blocker with path and form awareness
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==
(function() {
    'use strict';

    const wordGroup1 = [
        '勧誘',
        { word: '営業', exclude: ['営業時間'] },
        { word: '営業', exclude: ['営業内容'] },
        { word: '営業', exclude: ['営業部'] },
        { word: '営業', exclude: ['営業日'] },
        { word: '取引', exclude: ['取引銀行'] },
        { word: '取引', exclude: ['特定商取引'] },
        '売り込',
        '売込',
        'セールス',
        '営利目的',
        '商用利用',
        { word: '業者', exclude: ['販売業者'] },
        { word: '業者', exclude: ['事業者'] },
        '業務',
        { word: '広告', exclude: ['広告媒体'] }
    ];

    const wordGroup2 = [
        'かねます',
        '兼ねます',
        '断り',
        'おりません',
        { word: '遠慮', exclude: ['遠慮なく'] },
        '控え',
        'ありません',
        'ではない',
        'いたしません',
        'ございません',
        'しかるべき対応',
        '訴訟',
        { word: '請求', exclude: ['資料請求'] },
        { word: '請求', exclude: ['保険請求'] },
        { word: '請求', exclude: ['請求日'] },
        { word: '請求', exclude: ['請求書ダウンロード'] }
    ];

    // 検索フォームを示す可能性のある文字列
    const searchFormIdentifiers = [
        'search',
        'query',
        'q=',
        'keyword',
        'キーワード',
        '検索',
        'サーチ'
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

    // トップページかどうかを判定
    function isTopPage() {
        const path = window.location.pathname;
        return path === '/' || path === '/index.html' || path === '/index.php';
    }

    // フォーム要素の存在チェック（検索フォームを除外）
    function hasNonSearchForm() {
        const forms = document.getElementsByTagName('form');
        for (const form of forms) {
            // フォームが検索用かどうかをチェック
            const isSearchForm = (
                // action属性のチェック
                searchFormIdentifiers.some(identifier =>
                    (form.action || '').toLowerCase().includes(identifier)
                ) ||
                // class名のチェック
                searchFormIdentifiers.some(identifier =>
                    (form.className || '').toLowerCase().includes(identifier)
                ) ||
                // id属性のチェック
                searchFormIdentifiers.some(identifier =>
                    (form.id || '').toLowerCase().includes(identifier)
                ) ||
                // 入力フィールドの属性チェック
                Array.from(form.elements).some(element =>
                    searchFormIdentifiers.some(identifier =>
                        (element.name || '').toLowerCase().includes(identifier) ||
                        (element.id || '').toLowerCase().includes(identifier) ||
                        (element.className || '').toLowerCase().includes(identifier) ||
                        (element.placeholder || '').toLowerCase().includes(identifier)
                    )
                )
            );

            // 検索フォームでないフォームが見つかった場合
            if (!isSearchForm) {
                return true;
            }
        }
        return false;
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
                        // select要素内のテキストを除外
                        if (parent.tagName === 'SELECT' ||
                            parent.tagName === 'OPTION') {
                            return NodeFilter.FILTER_REJECT;
                        }

                        // class名に'agree'を含む要素内のテキストを除外
                        if (parent.className &&
                            typeof parent.className === 'string' &&
                            parent.className.toLowerCase().includes('agree')) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        // 非表示要素のチェックは維持
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

        // metaタグの description も含める
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            const content = metaDescription.getAttribute('content');
            if (content) {
                textParts.push(content);
            }
        }

        // titleタグの内容も含める
        if (document.title) {
            textParts.push(document.title);
        }
    } catch (error) {
        console.error('Error getting text content:', error);
    }

    return textParts.join(' ').toLowerCase();
}
    function getDetectedWords(text, wordGroup) {
    // 同じwordを持つオブジェクトの除外パターンをマージ
    const mergedWordGroup = wordGroup.reduce((acc, item) => {
        if (typeof item === 'string') {
            if (!acc.find(x => typeof x === 'string' && x === item)) {
                acc.push(item);
            }
        } else {
            const existing = acc.find(x => typeof x === 'object' && x.word === item.word);
            if (existing) {
                // 既存のオブジェクトがある場合、除外パターンをマージ
                existing.exclude = [...new Set([...(existing.exclude || []), ...(item.exclude || [])])];
            } else {
                // 新しいオブジェクトの場合はそのまま追加
                acc.push({...item});
            }
        }
        return acc;
    }, []);

    const detected = [];
    for (const wordItem of mergedWordGroup) {
        if (typeof wordItem === 'string') {
            if (text.includes(wordItem)) {
                detected.push(wordItem);
            }
        } else {
            if (text.includes(wordItem.word)) {
                // すべての除外パターンをチェック
                const isExcluded = wordItem.exclude?.some(excludePattern =>
                    text.includes(excludePattern)
                );

                // 除外パターンに一致しない場合のみ追加
                if (!isExcluded) {
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

        // トップページの場合の特別処理
        if (isTopPage()) {
            // フォーム要素がない場合は検証をスキップ
            if (!hasNonSearchForm()) {
                return;
            }
        }

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
        }, 1000);
    });
})();
