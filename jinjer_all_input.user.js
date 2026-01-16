// ==UserScript==
// @name         Jinjer Manager Bulk Fill 9‑20 + Reason (実績セレクタ修正)
// @namespace    https://example.com/
// @version      1.0
// @description  実績/休憩ともに深い <div><div><input> に対応し、9:00-20:00 と 12:00-13:00 を休日休暇が空欄の行に自動入力。理由「打刻忘れ」も入力。右下に一括ボタン表示。
// @author       you
// @match        https://kintai.jinjer.biz/staffs/time_cards*
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/jinjer_all_input.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/jinjer_all_input.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const setVal = (el, v) => {
    if (!el) return;
    el.value = v;
    ['input', 'change'].forEach(ev =>
      el.dispatchEvent(new Event(ev, { bubbles: true }))
    );
  };

  const fillRow = row => {
    // ✅ 休日休暇（9列目）
    //const holidayText = row.querySelector('td:nth-child(9) div div')?.textContent.trim();
    //if (holidayText && holidayText !== '-') return false;
    // ✅ 休日休暇（8列目）: <td><div><select><option>－</option>…</select></div></td>
    const holidaySelect = row.querySelector('td:nth-child(9) select');
    const selectedHoliday = holidaySelect?.selectedOptions[0]?.textContent.trim();
    if (selectedHoliday && selectedHoliday !== '-') return false; // 入力済みならスキップ


    // ✅ 実績（4列目）に 9:00 – 18:00
    const actualTd = row.querySelector('td:nth-child(5)');
    const actualInputs = actualTd?.querySelectorAll('div > div > input');
    if (actualInputs?.length >= 4) {
      setVal(actualInputs[0], '9');
      setVal(actualInputs[1], '00');
      setVal(actualInputs[2], '18');
      setVal(actualInputs[3], '00');
    }

    // ✅ 休憩（6列目）に 12:00 – 13:00
    const breakTd = row.querySelector('td:nth-child(7)');
    const breakInputs = breakTd?.querySelectorAll('div > div > div > div > input');
    if (breakInputs?.length >= 4) {
      setVal(breakInputs[0], '12');
      setVal(breakInputs[1], '00');
      setVal(breakInputs[2], '13');
      setVal(breakInputs[3], '00');
    }

//    // ✅ 理由（16列目）
    const reason = row.querySelector('td:nth-child(17) textarea');
    if (reason) setVal(reason, '打刻忘れ');

    return true;
  };

  const bulkFill = () => {
    const rows = document.querySelectorAll('table tbody tr');
    let count = 0;
    rows.forEach(row => { if (fillRow(row)) count++; });

    alert(count
      ? `${count} 行を 9‑20 / 12‑13 / 打刻忘れ で入力しました！`
      : '休日休暇が未入力の行はありませんでした。'
    );
  };

  const injectBtn = () => {
    if (document.getElementById('bulkFillBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'bulkFillBtn';
    btn.textContent = '9‑18 一括入力';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '9999',
      padding: '12px 18px',
      fontSize: '14px',
      backgroundColor: '#28a745',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0,0,0,.25)',
      cursor: 'pointer'
    });
    btn.onclick = bulkFill;
    document.body.appendChild(btn);
  };

  injectBtn();
  new MutationObserver(injectBtn).observe(document.body, {
    childList: true,
    subtree: true
  });
})();
