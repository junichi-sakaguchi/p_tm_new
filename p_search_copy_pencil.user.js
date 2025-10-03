// ==UserScript==
// @name         Copy company name on icon click
// @namespace    local.tools
// @version      1.0.0
// @description  同じdiv内の会社名テキストを、ボタン押下時にクリップボードコピー
// @match        https://*/*
// @match        http://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_copy_pencil.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_copy_pencil.user.js
// ==/UserScript==

(() => {
  'use strict';

  // 既存ボタンのクリックを潰すかどうか（trueで元の動作を止める）
  const SUPPRESS_ORIGINAL = false;

  // セレクタはあなたのDOMに合わせて調整可
  const CONTAINER_SELECTOR = '.MuiStack-root';
  const BUTTON_SELECTOR    = '.MuiIconButton-root';     // 例の鉛筆ボタン
  const NAME_SELECTOR      = 'a[href^="/companies/"]';  // 会社名の <a>

  // クリックを拾う（動的に増える要素にも対応）
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest(BUTTON_SELECTOR);
    if (!btn) return;

    const container = btn.closest(CONTAINER_SELECTOR);
    if (!container) return;

    const a = container.querySelector(NAME_SELECTOR);
    const text = a?.textContent?.trim();
    if (!text) return;

    // 必要なら元のクリック挙動を止める
    if (SUPPRESS_ORIGINAL) {
      ev.preventDefault();
      ev.stopPropagation();
      // stopImmediatePropagation まで行う場合は下を有効化
      // if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    }

    // クリップボードへコピー（新しめのAPI → フォールバック）
    try {
      await navigator.clipboard.writeText(text);
      // 簡易フィードバック（任意）
      console.debug('[COPY]', text);
    } catch (e) {
      // フォールバック：古いブラウザ/権限なし対策
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      console.debug('[COPY-FALLBACK]', text);
    }
  }, true); // capture=true にしてMUIの内部ハンドラより先に拾えるように
})();
