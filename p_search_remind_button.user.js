// ==UserScript==
// @name         Remind & Gohonen Buttons Injector (toolbar above container, right-aligned)
// @namespace    local.sakaguchi.tools
// @version      1.3.1
// @description  MUI再レンダーに耐える自己修復型ボタン注入＋MUI Select操作対応（ボタンは対象divの上・右寄せ）
// @match        https://*/*
// @match        http://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_remind_button.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_remind_button.user.js
// ==/UserScript==

(() => {
  'use strict';

  const SEL = {
    container: 'div.MuiBox-root.css-17ljtfu',
    placeholderBar: '.tm-toolbar',
    nextActionAt: 'input[name="nextActionAt"]',
    ngDate: 'input[name="ngDate"]',
    ngReasonSelect: '#ng-reason-select',
    ngMemo: 'input[name="ngMemo"]',
    saveBtn: 'button[type="submit"], .MuiButton-root[type="submit"]'
  };

  const LABELS = {
    gohonenMemo: 'ご放念リマインドまで実施した',
    ngReasonText: '買い手NG-その他',
    omitMemo: 'お見送り連絡（理由は共有なし）'
  };

  /* ---------- utils ---------- */
  const fmtYmd = dt => {
    const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const d = String(dt.getDate()).padStart(2,'0');
    return `${y}/${m}/${d}`;
  };
  const setReactInputValue = (el, value) => {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc.set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const parseFlexible = (s) => {
    const t = String(s || '').trim();
    let m = t.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
    if (m) return { dt: new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]), fmt: 'slash' };
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (m) return { dt: new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]), fmt: 'html5' };
    return null;
  };
  const fmtBy = (dt, kind) => {
    const y = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,'0'); const dd = String(dt.getDate()).padStart(2,'0');
    const hh = String(dt.getHours()).padStart(2,'0'); const mi = String(dt.getMinutes()).padStart(2,'0');
    return (kind === 'html5') ? `${y}-${mm}-${dd}T${hh}:${mi}` : `${y}/${mm}/${dd} ${hh}:${mi}`;
  };
  const fmtYmdHtml = (dt) => {
    const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const d = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };
  const findContainer = () => document.querySelector(SEL.container);

  /* ---------- mount buttons above the container (right aligned) ---------- */
  function ensureButtons() {
    const container = findContainer();
    if (!container) return;

    let bar = container.previousElementSibling;
    if (!bar || !bar.matches(SEL.placeholderBar)) {
      bar = document.createElement('div');
      bar.className = 'tm-toolbar';
      Object.assign(bar.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginBottom: '6px',
        alignItems: 'center',
        marginRight: '200px'
      });
      container.insertAdjacentElement('beforebegin', bar);
    }

    // 3ボタンが揃っていれば再注入しない
    if (bar.querySelector('.tm-btn-remind') &&
        bar.querySelector('.tm-btn-gohonen') &&
        bar.querySelector('.tm-btn-omitng')) return;

    const btn1 = document.createElement('button');
    btn1.type = 'button';
    btn1.className = 'tm-btn-remind';
    styleBtn(btn1, '次のリマインド', 'remind');

    const btn2 = document.createElement('button');
    btn2.type = 'button';
    btn2.className = 'tm-btn-gohonen';
    styleBtn(btn2, 'ご放念', 'gohonen');

    const btn3 = document.createElement('button');
    btn3.type = 'button';
    btn3.className = 'tm-btn-omitng';
    styleBtn(btn3, 'お見送りNG', 'omitng');

    bar.replaceChildren(btn1, btn2, btn3);

    btn1.addEventListener('click', onRemind);
    btn2.addEventListener('click', onGohonen);
    btn3.addEventListener('click', onOmiokuriNG);
  }

  function styleBtn(btn, text, type) {
    btn.textContent = text;
    btn.style.padding = '4px 8px';
    btn.style.border = '1px solid #ccc';
    btn.style.borderRadius = '6px';
    btn.style.fontSize = '12px';
    btn.style.cursor = 'pointer';

    if (type === 'remind') {
      btn.style.background = '#e6f7ff';  // 薄い水色
      btn.style.color = '#007acc';
      btn.style.borderColor = '#007acc';
    } else if (type === 'gohonen') {
      btn.style.background = '#fff0f0';  // 薄いピンク
      btn.style.color = '#cc0000';
      btn.style.borderColor = '#cc0000';
    } else if (type === 'omitng') {
      btn.style.background = '#f3e8ff';  // 薄い紫
      btn.style.color = '#6b21a8';       // 濃い紫
      btn.style.borderColor = '#6b21a8';
      btn.title = 'NG日: 今日 / NG理由: 買い手NG-その他 / メモ: お見送り連絡（理由は共有なし）';
    } else {
      btn.style.background = '#f8f8f8';
      btn.style.color = '#000';
    }
  }

  /* ---------- actions ---------- */
  function onRemind() {
    const container = findContainer();
    if (!container) return alert('コンテナ未表示です');
    const input = container.querySelector(SEL.nextActionAt);
    if (!input) return alert('nextActionAt が見つかりません');

    const parsed = parseFlexible(input.value);
    if (!parsed) return alert('nextActionAt の形式が不明です（YYYY/MM/DD hh:mm または YYYY-MM-DDTHH:mm）');

    // 現在の日時から6日後にする
    const dt = new Date();
    dt.setDate(dt.getDate() + 6);


    input.focus();
    setReactInputValue(input, fmtBy(dt, parsed.fmt));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    const save = container.querySelector(SEL.saveBtn);
    if (!save) return alert('保存ボタンが見つかりません');
    save.click();
  }

  async function onGohonen() {
    await setNgFieldsAndSave(LABELS.ngReasonText, LABELS.gohonenMemo);
  }

  async function onOmiokuriNG() {
    await setNgFieldsAndSave(LABELS.ngReasonText, LABELS.omitMemo);
  }

  async function setNgFieldsAndSave(reasonText, memoText) {
    const container = findContainer();
    if (!container) return alert('コンテナ未表示です');

    // NG日
    const nn = container.querySelector(SEL.ngDate);
    if (!nn) return alert('ngDate が見つかりません');
    const today = new Date();
    const nnVal = (nn.type === 'date') ? fmtYmdHtml(today) : fmtYmd(today);
    nn.focus();
    setReactInputValue(nn, nnVal);
    nn.dispatchEvent(new Event('blur', { bubbles: true }));

    // NG理由（MUI Select）
    const selectDiv = container.querySelector(SEL.ngReasonSelect);
    if (!selectDiv) return alert('ng-reason-select が見つかりません');
    selectDiv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    selectDiv.click();
    const option = await waitForOptionByText(reasonText, 3000);
    if (!option) return alert(`「${reasonText}」の候補が見つかりません`);
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    option.click();
    selectDiv.dispatchEvent(new Event('change', { bubbles: true }));
    document.activeElement && document.activeElement.blur();

    // NG理由メモ（input/textarea両対応）
    const memo = container.querySelector('input[name="ngMemo"], textarea[name="ngMemo"]');
    if (!memo) return alert('ngMemo が見つかりません');
    memo.focus();
    setReactInputValue(memo, memoText);
    memo.dispatchEvent(new Event('blur', { bubbles: true }));

    // 保存
    const save = container.querySelector(SEL.saveBtn);
    if (!save) return alert('保存ボタンが見つかりません');
    save.click();
  }

  // MUIのメニューから表示テキスト一致で探す
  function waitForOptionByText(text, timeoutMs=3000) {
    const deadline = Date.now()+timeoutMs;
    return new Promise(resolve => {
      const tick = () => {
        const candidates = Array.from(document.querySelectorAll('[role="option"], li.MuiMenuItem-root, li[tabindex]'));
        const found = candidates.find(el => el.textContent.trim() === text);
        if (found) return resolve(found);
        if (Date.now()>deadline) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /* ---------- boot (self-healing) ---------- */
  const intervalMs = 500;
  const ticker = setInterval(ensureButtons, intervalMs);
  const mo = new MutationObserver(() => ensureButtons());
  mo.observe(document.documentElement, {childList:true, subtree:true});
})();
