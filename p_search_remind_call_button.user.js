// ==UserScript==
// @name         担当者不在 リマインド一括入力
// @namespace    local.sakaguchi.tools
// @version      1.0.0
// @description  「担当者不在」ボタンを設置し、2営業日後（土日祝除く）のリマインドを一括入力＆保存
// @match        https://p-search.vercel.app/companies/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_remind_call_button.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_remind_call_button.user.js
// ==/UserScript==

(() => {
  'use strict';

  const TARGET_SUFFIX = 'への案件紹介の架電(新規)';
  const HOLIDAY_CSV_URL = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';

  /* ========== 祝日セット（YYYY/MM/DD 形式） ========== */
  let holidaySet = new Set();
  let holidayLoaded = false;
  let holidayError = null;

  function loadHolidays() {
    GM_xmlhttpRequest({
      method: 'GET',
      url: HOLIDAY_CSV_URL,
      onload(res) {
        try {
          const lines = res.responseText.split('\n');
          for (const line of lines) {
            const cols = line.split(',');
            const raw = (cols[0] || '').trim(); // 例: 2024/1/1
            if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) continue;
            // YYYY/MM/DD に正規化
            const [y, m, d] = raw.split('/');
            const key = `${y}/${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
            holidaySet.add(key);
          }
          holidayLoaded = true;
          console.log(`[担当者不在] 祝日読み込み完了: ${holidaySet.size}件`);
        } catch(e) {
          holidayError = e;
          console.error('[担当者不在] 祝日パースエラー', e);
        }
      },
      onerror(err) {
        holidayError = err;
        console.error('[担当者不在] 祝日CSV取得失敗', err);
      }
    });
  }

  loadHolidays();

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

  const isHoliday = (date) => {
    const key = `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
    return holidaySet.has(key);
  };

  const addBusinessDays = (date, days) => {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6 && !isHoliday(result)) added++;
    }
    return result;
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

  /* ========== main flow ========== */
  async function runAbsentFlow(scopeRoot) {
    // 祝日データ未ロードの場合は警告して続行
    if (!holidayLoaded) {
      if (holidayError) {
        const go = confirm('祝日データの取得に失敗しました。土日のみスキップで続行しますか？');
        if (!go) return;
      } else {
        const go = confirm('祝日データをまだ読み込み中です。土日のみスキップで続行しますか？');
        if (!go) return;
      }
    }

    // 1) コンタクトチャネル = 「電話」
    {
      const combo = findMUISelectByLabel('コンタクトチャネル', scopeRoot);
      if (!combo) return alert('（同一フォーム内）「コンタクトチャネル」のセレクトが見つかりません');
      combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      combo.click();
      const opt = await waitForMenuOptionByExactText('電話');
      if (!opt) return alert('「電話」の選択肢が見つかりません');
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opt.click();
      combo.dispatchEvent(new Event('change', { bubbles: true }));
      document.activeElement && document.activeElement.blur();
    }

    // 2) コンタクト結果 = 「窓口通電（担当者不在）」
    {
      const combo = findMUISelectByLabel('コンタクト結果', scopeRoot);
      if (!combo) return alert('（同一フォーム内）「コンタクト結果」のセレクトが見つかりません');
      combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      combo.click();
      const opt = await waitForMenuOptionByExactText('窓口通電（担当者不在）');
      if (!opt) return alert('「窓口通電（担当者不在）」の選択肢が見つかりません');
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opt.click();
      combo.dispatchEvent(new Event('change', { bubbles: true }));
      document.activeElement && document.activeElement.blur();
    }

    // 3) コンタクト詳細 = 空欄（スキップ）

    // 4) アクション日時 = 2営業日後の 00:00
    {
      let act = findInputByLabel('アクション日時', scopeRoot);
      if (!act) act = scopeRoot.querySelector('input[placeholder="YYYY/MM/DD hh:mm"]');
      if (!act) return alert('（同一フォーム内）「アクション日時」の入力欄が見つかりません');

      const target = addBusinessDays(new Date(), 2);
      const val = fmtSlashDateTime(target);

      act.focus();
      setReactInputValue(act, val);
      act.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // 5) 備考 = 「追い架電」
    {
      const note = findInputByLabel('備考', scopeRoot);
      if (!note) return alert('（同一フォーム内）「備考」の入力欄が見つかりません');
      note.focus();
      setReactInputValue(note, '追い架電');
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

  /* ========== inject button ========== */
  function ensureButtons() {
    const ps = Array.from(document.querySelectorAll('p'));
    for (const p of ps) {
      const t = (p.textContent || '').trim();
      if (!t.endsWith(TARGET_SUFFIX)) continue;
      if (p.dataset.reminderButtonsInjected === 'true') continue;

      const formRoot = getFormRootFromP(p);

      const wrap = document.createElement('span');
      wrap.style.display = 'inline-flex';
      wrap.style.gap = '8px';
      wrap.style.marginLeft = '10px';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '担当者不在';
      Object.assign(btn.style, {
        padding: '4px 8px',
        backgroundColor: '#e65100',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      });
      btn.addEventListener('click', () => {
        runAbsentFlow(formRoot).catch(err => {
          console.error('[担当者不在] error', err);
          alert('処理中にエラーが発生しました（コンソール参照）。');
        });
      });

      wrap.appendChild(btn);
      p.insertAdjacentElement('afterend', wrap);
      p.dataset.reminderButtonsInjected = 'true';
    }
  }

  const tickMs = 500;
  setInterval(ensureButtons, tickMs);
  const mo = new MutationObserver(() => ensureButtons());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
