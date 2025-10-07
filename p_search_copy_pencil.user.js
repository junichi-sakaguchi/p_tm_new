// ==UserScript==
// @name         Copy company name on icon click
// @namespace    local.tools
// @version      1.1.0
// @description  ボタン押下時にクリップボードコピー
// @match        https://p-search.vercel.app/*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_copy_pencil.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_copy_pencil.user.js
// ==/UserScript==

(() => {
  'use strict';

  // ▼必要に応じて調整
  const SUPPRESS_ORIGINAL = false; // true ならボタン本来の動作を止める
  // 反応させたいボタンの条件（過剰反応を避けたければ aria-label="Edit" などを使う）
  const BUTTON_SELECTOR = 'button.MuiIconButton-root';

  // 会社名の候補（第一候補: buyerCorporateName 列、第二候補: /companies/ へのリンク）
  const NAME_SELECTOR = [
    '[data-field="buyerCorporateName"] a',
    'a[href^="/companies/"]'
  ].join(',');

  // 行（DataGrid）の検出
  const ROW_SELECTOR = '.MuiDataGrid-row,[role="row"]';

  // クリック委譲
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest(BUTTON_SELECTOR);
    if (!btn) return;

    // 1) 行優先で探す
    let text = findNameFromRow(btn);
    // 2) 見つからなければ、従来方式（近いコンテナ→段階的に遡る）で探す
    if (!text) text = findNameFromContainers(btn);

    if (!text) return; // 見つからなければ何もしない

    if (SUPPRESS_ORIGINAL) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    }

    try {
      await navigator.clipboard.writeText(text);
      flashBadge(btn, `コピー: ${text}`);
      console.debug('[COPY]', text);
    } catch {
      // フォールバック（古い権限/環境）
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flashBadge(btn, `コピー: ${text}`);
      console.debug('[COPY-FALLBACK]', text);
    }
  }, true); // capture=true で MUI のハンドラより前に拾う

  function findNameFromRow(btn) {
    const row = btn.closest(ROW_SELECTOR);
    if (!row) return '';
    const a = row.querySelector(NAME_SELECTOR);
    const t = a?.textContent?.trim();
    return t || '';
  }

  function findNameFromContainers(btn) {
    // できるだけ「ボタンと同じ塊」を優先して探索し、無ければ少しずつ親を遡る
    // よくあるMUIの塊クラスを優先的に試す
    const prefContainers = [
      btn.closest('.MuiStack-root'),
      btn.closest('.MuiDataGrid-actionsCell'),
      btn.closest('.MuiBox-root'),
    ].filter(Boolean);

    for (const c of prefContainers) {
      const a = c.querySelector(NAME_SELECTOR);
      const t = a?.textContent?.trim();
      if (t) return t;
    }

    // それでも見つからなければ、最大5階層ほど親を遡って毎回その配下を探索
    let el = btn;
    for (let i = 0; i < 5 && el; i++) {
      const a = el.querySelector?.(NAME_SELECTOR);
      const t = a?.textContent?.trim();
      if (t) return t;
      el = el.parentElement;
    }
    return '';
  }

  // 簡易フィードバック
  function flashBadge(targetEl, message) {
    try {
      const rect = targetEl.getBoundingClientRect();
      const badge = document.createElement('div');
      badge.textContent = message;
      Object.assign(badge.style, {
        position: 'fixed',
        top: `${Math.max(0, rect.top - 28)}px`,
        left: `${Math.min(window.innerWidth - 8, rect.left + rect.width)}px`,
        transform: 'translateX(8px)',
        padding: '4px 8px',
        fontSize: '12px',
        lineHeight: '1.4',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        borderRadius: '6px',
        zIndex: 2147483647,
        pointerEvents: 'none',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      });
      document.body.appendChild(badge);
      setTimeout(() => {
        badge.style.transition = 'opacity 200ms ease';
        badge.style.opacity = '0';
        setTimeout(() => badge.remove(), 220);
      }, 800);
    } catch { /* no-op */ }
  }
})();
