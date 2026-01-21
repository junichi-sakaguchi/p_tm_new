// ==UserScript==
// @name         kintoneレコード取得
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  try to take over the world!
// @author       You
// @match        https://plex.cybozu.com/k/252/show*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cybozu.com
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/ma_app_copy.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/ma_app_copy.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ボタンを表示するための親要素を作成
    const container = document.createElement('div');
    container.style.position = 'fixed';
    // container.style.bottom = '10px';
    container.style.top = '5px'; // 上からの距離を指定
    container.style.right = '10px';
    container.style.backgroundColor = 'white';
    container.style.padding = '10px';
    container.style.border = '1px solid black';
    container.style.zIndex = '9999';
    document.body.appendChild(container);

    // 「レジュメをコピー」ボタンを作成
    const button = document.createElement('button');
    button.textContent = '会社情報をコピー';
    button.style.margin = '5px';

// ボタンクリック時の動作
button.onclick = async () => {
    let combinedText = '';

    // 1. kintone.app.record.get().recordを実行してデータを取得
    const recordData = kintone.app.record.get();

    if (!recordData || !recordData.record) {
        alert('レコードデータを取得できませんでした。');
        return;
    }

    const record = recordData.record;

   // サブテーブルデータの取得
    const 売り案件ステータス_新 = record['売り案件ステータス_新']?.value || [];
    const コンタクト履歴 = record['コンタクト履歴']?.value || [];

// 2. サブテーブルから条件を満たすデータを取得
    let latestRecord = null;
    売り案件ステータス_新.forEach((row) => {
        const initialMeetingDate = row.value['売り_初回面談予定日']?.value;
        const id = parseInt(row.id, 10); // IDを数値に変換

        // 売り_初回面談予定日が空欄でない、かつ、現在の最新レコードよりIDが大きい場合
        if (initialMeetingDate && (!latestRecord || id > parseInt(latestRecord.id, 10))) {
            latestRecord = { id: row.id, date: initialMeetingDate };
        }
    });

    // 最もIDの大きい売り_初回面談予定日を取得し、日本時間に変換
    let latestInitialMeetingDate = null;
    if (latestRecord) {
        const date = new Date(latestRecord.date); // ISO形式の文字列をDateオブジェクトに変換
        date.setHours(date.getHours() + 9); // 日本時間（UTC+9）に変換

        // 表示形式をYYYY-MM-DD HH:mmに変換
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        latestInitialMeetingDate = `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    // 2. サブテーブルから条件を満たすデータを取得
let latestContact = null;
コンタクト履歴.forEach((row) => {
    const contactDetail = row.value['コンタクト_詳細']?.value;
    const contactId = parseInt(row.id, 10); // IDを数値に変換

    // コンタクト_詳細が空欄でない、かつ、現在の最新レコードよりIDが大きい場合
    if (contactDetail && (!latestContact || contactId > parseInt(latestContact.id, 10))) {
        latestContact = { id: row.id, value: contactDetail };
    }
});

// 最もIDの大きいコンタクト_詳細を取得
let latestContactDetail = null;
if (latestContact) {
    latestContactDetail = latestContact.value; // テキストデータを取得
}

    // 3. 必要なデータを取得し加工する
    const 商号 = record['商号_漢字_略称なし_自動']?.value || '';
    const 代表者姓 = record['代表者_姓_TSR']?.value || '';
    const 代表者名 = record['代表者_名_TSR']?.value || '';
    const 所在地 = record['所在地_TSR']?.value || '';
    const 役員 = record['役員_TSR']?.value || '';
    const 従業員数 = record['従業員数_TSR']?.value || '';
    const 販売先 = record['販売先_TSR']?.value || '';
    const 営業種目 = record['営業種目_TSR']?.value || '';
    const 大株主 = record['大株主_TSR']?.value || '';
    const 売上 = record['当期_売上_千円_TSR']?.value || '';
    const 概況 = record['概況_TSR']?.value || '';

    combinedText = `
会社名: ${商号}
日次:${latestInitialMeetingDate || '未記入'}
先方代表者: ${代表者姓} ${代表者名}
所在地: ${所在地}
役員: ${役員}
社員数: ${従業員数}
取引先: ${販売先}
営業種目: ${営業種目}
資本関係: ${大株主}
売上: ${売上}
概況: ${概況}
事前ヒアリング情報: ${latestContactDetail}
`.trim();

    // 3. クリップボードにコピー
    if (combinedText.trim()) {
        try {
            await navigator.clipboard.writeText(combinedText);
            alert(`以下の情報をコピーしました:\n\n${combinedText}`);
        } catch (err) {
            console.error('クリップボードにコピーできませんでした:', err);
            alert('クリップボードにコピーできませんでした。');
        }
    } else {
        alert('コピーする情報が見つかりませんでした。');
    }
};

    // ボタンを親要素に追加
    container.appendChild(button);
})();
