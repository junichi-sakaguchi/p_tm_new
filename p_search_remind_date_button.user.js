// ==UserScript==
// @name         Remind Buttons Injector (toolbar above container, right-aligned)
// @namespace    local.sakaguchi.tools
// @version      1.0.0
// @description  MUI再レンダーに耐える自己修復型ボタン注入（1営後・2営後・3営後）
// @match        https://*/*
// @match        http://*/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      www8.cao.go.jp
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_remind_date_button.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/p_search_remind_date_button.user.js
// ==/UserScript==

(() => {
  'use strict';

  const SEL = {
    container: 'div.MuiBox-root.css-17ljtfu',
    placeholderBar: '.tm-toolbar',
    nextActionAt: 'input[name="nextActionAt"]',
    saveBtn: 'button[type="submit"], .MuiButton-root[type="submit"]'
  };

  /* ---------- utils ---------- */
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

  /* ---------- 祝日キャッシュ＋取得 ---------- */
  let jpHolidays = null;

  async function fetchHolidays() {
    if (jpHolidays !== null) return;
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://www8.cao.go.jp/counter/syukujitsu/syukujitsu.csv',
        onload(res) {
          try {
            const lines = res.responseText.split('\n');
            jpHolidays = new Set(
              lines.slice(1)
                .map(l => l.split(',')[0].trim())
                .filter(s => /^\d{4}\/\d{2}\/\d{2}$/.test(s))
                .map(s => s.replace(/\//g, '-'))
            );
          } catch (e) {
            console.warn('[tm-toolbar] CSV解析失敗', e);
            jpHolidays = new Set();
          }
          resolve();
        },
        onerror(e) {
          console.warn('[tm-toolbar] 祝日CSV取得失敗', e);
          jpHolidays = new Set();
          resolve();
        }
      });
    });
  }

  function isBusinessDay(dt) {
    const dow = dt.getDay();
    return dow !== 0 && dow !== 6 && !(jpHolidays && jpHolidays.has(fmtYmdHtml(dt)));
  }

  async function addBusinessDays(base, n) {
    await fetchHolidays();
    const dt = new Date(base.getTime());
    let count = 0;
    while (count < n) {
      dt.setDate(dt.getDate() + 1);
      if (isBusinessDay(dt)) count++;
    }
    return dt;
  }

  /* ---------- mount buttons ---------- */
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

    if (bar.querySelector('.tm-btn-remind1') &&
        bar.querySelector('.tm-btn-remind2') &&
        bar.querySelector('.tm-btn-remind3')) return;

    const btns = [1, 2, 3].map(n => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tm-btn-remind${n}`;
      btn.textContent = `${n}営後`;
      Object.assign(btn.style, {
        padding: '4px 8px',
        border: '1px solid #007acc',
        borderRadius: '6px',
        fontSize: '12px',
        cursor: 'pointer',
        background: '#e6f7ff',
        color: '#007acc'
      });
      btn.addEventListener('click', () => onRemindBiz(n));
      return btn;
    });

    bar.replaceChildren(...btns);
  }

  /* ---------- action ---------- */
  async function onRemindBiz(n) {
    const container = findContainer();
    if (!container) return alert('コンテナ未表示です');
    const input = container.querySelector(SEL.nextActionAt);
    if (!input) return alert('nextActionAt が見つかりません');

    const parsed = parseFlexible(input.value);
    if (!parsed) return alert('nextActionAt の形式が不明です（YYYY/MM/DD hh:mm または YYYY-MM-DDTHH:mm）');

    const dt = await addBusinessDays(new Date(), n);

    input.focus();
    setReactInputValue(input, fmtBy(dt, parsed.fmt));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    const save = container.querySelector(SEL.saveBtn);
    if (!save) return alert('保存ボタンが見つかりません');
    save.click();
  }

  /* ---------- boot (self-healing) ---------- */
  setInterval(ensureButtons, 500);
  const mo = new MutationObserver(() => ensureButtons());
  mo.observe(document.documentElement, {childList:true, subtree:true});
})();
