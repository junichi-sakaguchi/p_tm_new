// ==UserScript==
// @name         Domain Blocker
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  指定したドメインへのアクセスをブロックします
// @author       plex
// @match        *://*/*
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/refs/heads/main/domain_block_settings.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/refs/heads/main/domain_block_settings.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ブロックしたいドメインのリストを設定
    const blockedDomains = [
        'tsukulink.net',
        'carcon.co.jp'
        // 必要に応じて追加してください
    ];

    // 現在のドメインを取得
    const currentDomain = window.location.hostname;

    // ドメインがブロックリストに含まれているかチェック
    const isBlocked = blockedDomains.some(domain =>
        currentDomain === domain || currentDomain.endsWith('.' + domain)
    );

    if (isBlocked) {
        // ページの内容を全て削除
        document.body.innerHTML = '';

        // ブロックメッセージを表示
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
            <h2 style="color: #721c24; margin-bottom: 10px;">アクセスがブロックされました</h2>
            <p style="color: #721c24; margin: 0;">このサイトへのアクセスは制限されています。</p>
        `;
        document.body.appendChild(blockMessage);
    }
})();
