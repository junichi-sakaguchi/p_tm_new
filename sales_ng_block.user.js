// ==UserScript==
// @name         Path and Form Aware Page Blocker
// @namespace    http://tampermonkey.net/
// @version      0.1.13
// @description  Page blocker with path and form awareness, including Google Forms support
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

    // Googleフォームかどうかを判定
    function isGoogleForm() {
        return window.location.hostname.includes('docs.google.com') &&
               window.location.pathname.includes('/forms/');
    }

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
        // Googleフォームの場合は常にtrue
        if (isGoogleForm()) {
            return true;
        }

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

            if (!isSearchForm) {
                return true;
            }
        }
        return false;
    }

    function getAllTextContent() {
        const textParts = [];

        try {
            // Googleフォーム特有の要素を追加
            if (isGoogleForm()) {
                // Googleフォームの新しいUI要素を取得
                // タイトル
                document.querySelectorAll('[role="heading"]').forEach(heading => {
                    if (heading.textContent) {
                        textParts.push(heading.textContent);
                    }
                });

                // 説明文
                document.querySelectorAll('.freebirdFormviewerViewDescriptionText').forEach(desc => {
                    if (desc.textContent) {
                        textParts.push(desc.textContent);
                    }
                });

                // 質問項目（複数のクラスに対応）
                const questionSelectors = [
                    '.freebirdFormviewerComponentsQuestionBaseTitle',
                    '.freebirdFormviewerComponentsQuestionText',
                    '.freebirdFormviewerComponentsQuestionBaseHeader',
                    '.freebirdFormviewerViewNumberedItemContainer',
                    '.freebirdFormviewerComponentsQuestionRadioChoice',
                    '.freebirdFormviewerComponentsQuestionCheckboxChoice',
                    '.freebirdFormviewerComponentsQuestionTextRoot'
                ];

                questionSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(element => {
                        if (element.textContent) {
                            textParts.push(element.textContent);
                        }
                    });
                });
            }

            // 通常のテキスト取得処理
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        let parent = node.parentElement;
                        while (parent) {
                            if (parent.tagName === 'SELECT' ||
                                parent.tagName === 'OPTION') {
                                return NodeFilter.FILTER_REJECT;
                            }

                            if (parent.className &&
                                typeof parent.className === 'string' &&
                                parent.className.toLowerCase().includes('agree')) {
                                return NodeFilter.FILTER_REJECT;
                            }

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

            // metaタグとtitleタグの内容も含める
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
        // 同じwordを持つオブジェクトの除外パターンをマージ
        const mergedWordGroup = wordGroup.reduce((acc, item) => {
            if (typeof item === 'string') {
                if (!acc.find(x => typeof x === 'string' && x === item)) {
                    acc.push(item);
                }
            } else {
                const existing = acc.find(x => typeof x === 'object' && x.word === item.word);
                if (existing) {
                    existing.exclude = [...new Set([...(existing.exclude || []), ...(item.exclude || [])])];
                } else {
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
                // テキストを空白で分割して単語単位で検査
                const words = text.split(/\s+/);
                let hasStandaloneWord = false;

                // 除外パターンに完全一致する箇所を探す
                const excludeMatches = new Set();
                if (wordItem.exclude) {
                    for (const excludePattern of wordItem.exclude) {
                        let startIndex = 0;
                        while (true) {
                            const index = text.indexOf(excludePattern, startIndex);
                            if (index === -1) break;
                            // 除外パターンの範囲を記録
                            for (let i = index; i < index + excludePattern.length; i++) {
                                excludeMatches.add(i);
                            }
                            startIndex = index + 1;
                        }
                    }
                }

                // 対象の単語を探す（除外パターンの一部でない場所で）
                let startIndex = 0;
                while (true) {
                    const index = text.indexOf(wordItem.word, startIndex);
                    if (index === -1) break;

                    // この出現が除外パターンの一部でないかチェック
                    let isPartOfExclude = false;
                    for (let i = index; i < index + wordItem.word.length; i++) {
                        if (excludeMatches.has(i)) {
                            isPartOfExclude = true;
                            break;
                        }
                    }

                    if (!isPartOfExclude) {
                        hasStandaloneWord = true;
                        break;
                    }

                    startIndex = index + 1;
                }

                if (hasStandaloneWord) {
                    detected.push(wordItem.word);
                }
            }
        }
        return detected;
    }

    function blockPage(detectedWords1, detectedWords2) {
        if (isBlocked) return;
        isBlocked = true;

        // コンテナ要素の作成
        const blockContainer = document.createElement('div');
        blockContainer.style.position = 'fixed';
        blockContainer.style.top = '0';
        blockContainer.style.left = '0';
        blockContainer.style.width = '100%';
        blockContainer.style.height = '100%';
        blockContainer.style.backgroundColor = 'white';
        blockContainer.style.zIndex = '999999';

        // メッセージコンテナの作成
        const blockMessage = document.createElement('div');
        blockMessage.style.position = 'fixed';
        blockMessage.style.top = '50%';
        blockMessage.style.left = '50%';
        blockMessage.style.transform = 'translate(-50%, -50%)';
        blockMessage.style.padding = '20px';
        blockMessage.style.backgroundColor = '#f8d7da';
        blockMessage.style.border = '1px solid #f5c6cb';
        blockMessage.style.borderRadius = '5px';
        blockMessage.style.textAlign = 'center';
        blockMessage.style.fontFamily = 'Arial, sans-serif';
        blockMessage.style.zIndex = '1000000';

        // ヘッダーの作成
        const header = document.createElement('h2');
        header.style.color = '#721c24';
        header.style.marginBottom = '10px';
        header.textContent = 'こちらの企業は営業禁止です。';

        // メインメッセージの作成
        const mainMessage = document.createElement('p');
        mainMessage.style.color = '#721c24';
        mainMessage.style.margin = '0';
        mainMessage.textContent = '送付結果を「送付失敗」にして、送付失敗理由に「営業禁止」と記載してください';

        // 検出単語の情報を含むパラグラフの作成
        const detectedWordsInfo = document.createElement('p');
        detectedWordsInfo.style.color = '#721c24';
        detectedWordsInfo.style.marginTop = '15px';
        detectedWordsInfo.style.fontSize = '12px';

        const detectedWordsText = document.createElement('span');
        detectedWordsText.textContent = '検出された単語:';

        const group1Text = document.createElement('br');
        const group1 = document.createElement('span');
        group1.textContent = `語群1: ${detectedWords1.join(', ')}`;

        const group2Text = document.createElement('br');
        const group2 = document.createElement('span');
        group2.textContent = `語群2: ${detectedWords2.join(', ')}`;

        // 要素の組み立て
        detectedWordsInfo.appendChild(detectedWordsText);
        detectedWordsInfo.appendChild(group1Text);
        detectedWordsInfo.appendChild(group1);
        detectedWordsInfo.appendChild(group2Text);
        detectedWordsInfo.appendChild(group2);

        blockMessage.appendChild(header);
        blockMessage.appendChild(mainMessage);
        blockMessage.appendChild(detectedWordsInfo);

        // ドキュメントへの追加
        document.body.appendChild(blockContainer);
        document.body.appendChild(blockMessage);
    }

    // Googleフォーム用の特別なチェック処理
    function setupGoogleFormCheck() {
        if (!isGoogleForm()) return;

        // 初期チェック
        setTimeout(() => {
            checkAndBlockPage();

            // 定期的なチェック
            const checkInterval = setInterval(() => {
                if (isBlocked) {
                    clearInterval(checkInterval);
                    return;
                }
                checkAndBlockPage();
            }, 1000);

            // 30秒後にチェックを停止
            setTimeout(() => {
                clearInterval(checkInterval);
            }, 30000);
        }, 2000);
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
        console.log("Detected text:", visibleText); // デバッグ用

        const detectedWords1 = getDetectedWords(visibleText, wordGroup1);
        const detectedWords2 = getDetectedWords(visibleText, wordGroup2);

        console.log("Group 1 matches:", detectedWords1); // デバッグ用
        console.log("Group 2 matches:", detectedWords2); // デバッグ用

        if (detectedWords1.length > 0 && detectedWords2.length > 0) {
            console.log('Detected words from group 1:', detectedWords1);
            console.log('Detected words from group 2:', detectedWords2);
            blockPage(detectedWords1, detectedWords2);
        }
    }, 500);

    // MutationObserverの設定
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

    // ページ読み込みの初期化処理
    window.addEventListener('load', () => {
        isInitialized = true;

        if (isGoogleForm()) {
            setupGoogleFormCheck();
        } else {
            setTimeout(() => {
                checkAndBlockPage();
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }, 1000);
        }
    });
})();
