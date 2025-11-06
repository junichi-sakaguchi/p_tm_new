// ==UserScript==
// @name         NN/NDA リマインド一括入力（フォームスコープ厳密化版）
// @namespace    local.sakaguchi.tools
// @version      1.1.0
// @description  対象pタグの直後に「NNリマインド」「NDAリマインド」ボタンを並べて設置し、同一.form-tab-panel内のみで入力＆保存
// @match        https://p-search.vercel.app/*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_call_nn_nda_input.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_call_nn_nda_input.user.js
// ==/UserScript==

(() => {
  'use strict';

  const TARGET_SUFFIX = 'への案件紹介の架電(新規)';

  /* ========== utils ========== */
  const setReactInputValue = (el, value) => {
    if (!el) return;
    const proto = Object.getPrototypeOf(el);
    const desc =
      Object.getOwnPropertyDescriptor(proto, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const fmtSlashDateTime = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mi}`;
  };

  function findMUISelectByLabel(labelText, scopeRoot) {
    const labels = Array.from(scopeRoot.querySelectorAll('label, .MuiFormLabel-root, .MuiTypography-root'));
    const label = labels.find(l => (l.textContent || '').trim() === labelText);
    if (!label) return null;
    const scope = label.closest('.MuiFormControl-root') || label.parentElement || scopeRoot;
    let combobox = scope.querySelector('[role="combobox"]');
    if (!combobox) {
      combobox = label.nextElementSibling?.querySelector?.('[role="combobox"]') ||
                 label.parentElement?.querySelector?.('[role="combobox"]');
    }
    return combobox || null;
  }

  function findInputByLabel(labelText, scopeRoot) {
    const labels = Array.from(scopeRoot.querySelectorAll('label, .MuiFormLabel-root'));
    const label = labels.find(l => (l.textContent || '').trim() === labelText);
    if (!label) return null;
    const scope = label.closest('.MuiFormControl-root') || label.parentElement || scopeRoot;
    let input = scope.querySelector('input, textarea');
    if (!input) {
      input = label.nextElementSibling?.querySelector?.('input, textarea') ||
              label.parentElement?.querySelector?.('input, textarea');
    }
    return input || null;
  }

  function waitForMenuOptionByExactText(text, timeoutMs = 4000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise(resolve => {
      const tick = () => {
        const candidates = Array.from(document.querySelectorAll('[role="option"], li.MuiMenuItem-root, li[tabindex]'));
        const found = candidates.find(el => (el.textContent || '').trim() === text);
        if (found) return resolve(found);
        if (Date.now() > deadline) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function getFormRootFromP(p) {
    return p.closest('.form-tab-panel') || p.closest('.MuiBox-root.css-0') || p.parentElement || document;
  }

  /* ========== main flow (tokenized: NN / NDA) ========== */
  async function runReminderFlow(scopeRoot, token /* 'NN' or 'NDA' */) {
    // 1) コン タクトチャネル = 「メール」
    {
      const combo = findMUISelectByLabel('コンタクトチャネル', scopeRoot);
      if (!combo) return alert('（同一フォーム内）「コンタクトチャネル」のセレクトが見つかりません');
      combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      combo.click();
      const opt = await waitForMenuOptionByExactText('メール');
      if (!opt) return alert('「メール」の選択肢が見つかりません');
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opt.click();
      combo.dispatchEvent(new Event('change', { bubbles: true }));
      document.activeElement && document.activeElement.blur();
    }

    // 2) コン タクト結果 = 「担当通電（ニーズ不明）」
    {
      const combo = findMUISelectByLabel('コンタクト結果', scopeRoot);
      if (!combo) return alert('（同一フォーム内）「コンタクト結果」のセレクトが見つかりません');
      combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      combo.click();
      const opt = await waitForMenuOptionByExactText('担当通電（ニーズ不明）');
      if (!opt) return alert('「担当通電（ニーズ不明）」の選択肢が見つかりません');
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opt.click();
      combo.dispatchEvent(new Event('change', { bubbles: true }));
      document.activeElement && document.activeElement.blur();
    }

    // 3) コン タクト詳細 = token（NN or NDA）
    {
      let details = scopeRoot.querySelector('textarea[name="details"], input[name="details"]');
      if (!details) details = findInputByLabel('コンタクト詳細', scopeRoot);
      if (!details) return alert('（同一フォーム内）「コンタクト詳細」の入力欄が見つかりません');
      details.focus();
      setReactInputValue(details, token);
      details.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // 4) アクション日時 = 今日+6日の 00:00
    {
      let act = findInputByLabel('アクション日時', scopeRoot);
      if (!act) act = scopeRoot.querySelector('input[placeholder="YYYY/MM/DD hh:mm"]');
      if (!act) return alert('（同一フォーム内）「アクション日時」の入力欄が見つかりません');

      const base = new Date();
      const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 6, 0, 0, 0, 0);
      const val = fmtSlashDateTime(target);

      act.focus();
      setReactInputValue(act, val);
      act.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // 5) 備考 = 「{token}リマインド」
    {
      const note = findInputByLabel('備考', scopeRoot);
      if (!note) return alert('（同一フォーム内）「備考」の入力欄が見つかりません');
      note.focus();
      setReactInputValue(note, `${token}リマインド`);
      note.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // 6) 保存
    {
      const btns = Array.from(scopeRoot.querySelectorAll('button[type="submit"]'));
      const saveBtn = btns.find(b => (b.textContent || '').trim() === '保存') ||
                      Array.from(scopeRoot.querySelectorAll('button')).find(b => (b.textContent || '').trim() === '保存');
      if (!saveBtn) return alert('（同一フォーム内）保存ボタンが見つかりません');
      saveBtn.click();
    }
  }

  /* ========== inject buttons (NN & NDA) next to target <p> ========== */
  function ensureButtons() {
    const ps = Array.from(document.querySelectorAll('p'));
    for (const p of ps) {
      const t = (p.textContent || '').trim();
      if (!t.endsWith(TARGET_SUFFIX)) continue;
      if (p.dataset.reminderButtonsInjected === 'true') continue;

      const formRoot = getFormRootFromP(p);

      // ボタン置き場（横並び）
      const wrap = document.createElement('span');
      wrap.style.display = 'inline-flex';
      wrap.style.gap = '8px';
      wrap.style.marginLeft = '10px';

      // ボタン生成ヘルパ
      const makeBtn = (label, bg) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        Object.assign(b.style, {
          padding: '4px 8px',
          backgroundColor: bg,
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        });
        return b;
      };

      // NNボタン
      const nnBtn = makeBtn('NNリマインド', '#673ab7');
      nnBtn.addEventListener('click', () => {
        runReminderFlow(formRoot, 'NN').catch(err => {
          console.error('[NNリマインド] error', err);
          alert('処理中にエラーが発生しました（コンソール参照）。');
        });
      });

      // NDAボタン（★新規）
      const ndaBtn = makeBtn('NDAリマインド', '#00796b');
      ndaBtn.addEventListener('click', () => {
        runReminderFlow(formRoot, 'NDA').catch(err => {
          console.error('[NDAリマインド] error', err);
          alert('処理中にエラーが発生しました（コンソール参照）。');
        });
      });

      wrap.appendChild(nnBtn);
      wrap.appendChild(ndaBtn);

      // pタグの直後に設置
      p.insertAdjacentElement('afterend', wrap);
      p.dataset.reminderButtonsInjected = 'true';
    }
  }

  // 自己修復（再描画・タブ遷移に耐える）
  const tickMs = 500;
  setInterval(ensureButtons, tickMs);
  const mo = new MutationObserver(() => ensureButtons());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
