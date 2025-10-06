// ==UserScript==
// @name         Google Calendar - 日程コピー（アラートなし版）
// @namespace    calendar-copy-noalert
// @version      1.3.1
// @description  常時右下にボタンを表示。予定ダイアログが開いているときのみコピー可能。アラートは出さない。
// @match        https://calendar.google.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/calendar_copy_noalert.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/calendar_copy_noalert.user.js
// ==/UserScript==
(function () {
  'use strict';
  const pad2 = n => String(n).padStart(2, '0');
  const JP_DOW_SHORT = ['日','月','火','水','木','金','土'];
  const toHalf = s =>
    s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
     .replace(/：/g, ':').replace(/－/g, '-').replace(/／/g, '/');
  function parseTime24(str) {
    if (!str) return null;
    let s = toHalf(str.trim());
    const isPM = /午後/i.test(s) || /\bPM\b/i.test(s);
    const isAM = /午前/i.test(s) || /\bAM\b/i.test(s);
    s = s.replace(/午[前後]/g, '').replace(/\b[AP]M\b/ig, '').trim();
    const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return { h, m: min };
  }
  function parseDateJP(str) {
    if (!str) return null;
    let s = toHalf(str.trim()).replace(/\s+/g, ' ');
    const dOnly = (s.match(/(\d{1,2}\s*月\s*\d{1,2}\s*日)/) || [])[1] || s;
    const nowY = new Date().getFullYear();
    let m = dOnly.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
    if (m) return new Date(nowY, +m[1]-1, +m[2]);
    m = dOnly.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    const d = new Date(dOnly);
    return isNaN(d.getTime()) ? null : d;
  }
  function formatForCopy(sd, st, ed, et) {
    const MM = pad2(sd.getMonth() + 1);
    const DD = pad2(sd.getDate());
    const DOW = JP_DOW_SHORT[sd.getDay()];
    const sHH = pad2(st.h), sMM = pad2(st.m);
    const eHH = pad2(et.h), eMM = pad2(et.m);
    const cross = ed && ed.toDateString() !== sd.toDateString();
    const endPart = cross ? `${eHH}:${eMM}（翌日）` : `${eHH}:${eMM}`;
    return `${MM}月${DD}日（${DOW}）${sHH}:${sMM}~${endPart}`;
  }
  function getDialog() {
    return Array.from(document.querySelectorAll('[role="dialog"]'))
      .find(d => /タイトルを追加|Add title|予定|イベント/.test(d.textContent || '')) || null;
  }
  function readFromDataKey(dlg) {
    if (!dlg) return null;
    const q = key => dlg.querySelector(`.JyrDof[data-key="${key}"]`);
    const sd = q('startDate') ? parseDateJP(q('startDate').textContent) : null;
    const st = q('startTime') ? parseTime24(q('startTime').textContent) : null;
    const et = q('endTime')   ? parseTime24(q('endTime').textContent)   : null;
    const ed = sd;
    if (sd && st && et) return { sd, st, ed, et };
    return null;
  }
  function getDateTime() {
    const dlg = getDialog();
    return dlg ? readFromDataKey(dlg) : null;
  }
  GM_addStyle(`
    .rf-fixed-wrap { position: fixed; right: 16px; bottom: 20px; z-index: 2147483647; }
    .rf-btn {
      cursor: pointer; border: 1px solid #dadce0; border-radius: 10px;
      padding: 8px 12px; background: #fff; font-size: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,.08);
    }
    .rf-btn[disabled] { cursor: not-allowed; opacity: .5; filter: grayscale(.3); }
  `);
  function ensureButton() {
    if (document.querySelector('.rf-fixed-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'rf-fixed-wrap';
    const btn = document.createElement('button');
    btn.className = 'rf-btn';
    btn.textContent = '📋 この日程をコピー';
    btn.addEventListener('click', onCopy);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    window.addEventListener('keydown', (e) => {
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && e.code === 'KeyC') {
        e.preventDefault();
        onCopy();
      }
    });
  }
  async function onCopy() {
    const btn = document.querySelector('.rf-btn');
    const dt = getDateTime();
    if (!dt) return; // 何もせず終了（アラートなし）
    try {
      const text = formatForCopy(dt.sd, dt.st, dt.ed, dt.et);
      await navigator.clipboard.writeText(text);
      if (btn) {
        btn.textContent = '✅ コピー完了';
        setTimeout(() => (btn.textContent = '📋 この日程をコピー'), 1200);
      }
    } catch (e) { console.error(e); }
  }
  function refreshState() {
    const btn = document.querySelector('.rf-btn');
    if (!btn) return;
    const hasDlg = !!getDialog();
    if (hasDlg) btn.removeAttribute('disabled');
    else btn.setAttribute('disabled', 'true');
  }
  function start() {
    ensureButton();
    const mo = new MutationObserver(refreshState);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(refreshState, 1000);
  }
  start();
})();
