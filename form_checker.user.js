// ==UserScript==
// @name         Form Checker
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  フォームチェッカー
// @match        *://*/*
// @grant        none
// @updateURL    https://github.com/junichi-sakaguchi/p_tm_new/raw/main/form_checker.user.js
// @downloadURL  https://github.com/junichi-sakaguchi/p_tm_new/raw/main/form_checker.user.js
// ==/UserScript==  

(function() {
    'use strict';
  
    // デバッグモード（trueの場合は実際のフォーム送信をキャンセル）
    const DEBUG_MODE = false;

    // 連結適用対象のルール名を配列で定義
    const chainableRules = ['prefecture', 'municipalities_1', 'municipalities_2', 'municipalities_3', 'block', 'building'];

    // 各連結ルールに対応する置換パターンを定義（必要に応じて調整）
    const chainableReplacements = {
        prefecture: "東京都",
        municipalities_1: "中央区",
        municipalities_2: "日本橋",
        municipalities_3: "本石町",
        block: "3-3-16",
        building: "室町ビル4階"
    };

    // 差し替えルール（ロジックの順番に従って昇順で適用）
    const substitutionRules = [
      // 【順番1】送信内容
      {
        order: 1,
        name: 'send_content',
        variable: '{send_content}',
        condition: (fieldName, value) => {
          return value.includes("株式会社プレックス") &&
                 value.includes("お問い合わせ番号") &&
                 value.length >= 100;
        }
      },
      // 【順番2】件名
      {
        order: 2,
        name: 'subject',
        variable: '{subject}',
        condition: (fieldName, value) => {
          return (value.includes("事業承継") || value.includes("資本提携") || value.includes("譲渡案件")) && value.length <= 50;
        }
      },
      // 【順番2】会社名
      {
        order: 2,
        name: 'corporate_name',
        variable: '{corporate_name}',
        condition: (fieldName, value) => {
            const trimmed = value.trim();
            return (trimmed === "株式会社プレックス");
        }
      },
      // 【順番2】所属
      {
        order: 2,
        name: 'department_name',
        variable: '{department_name}',
        condition: (fieldName, value) => {
            const trimmed = value.trim();
            return (trimmed === "法人戦略部");
        }
      },
      // 【順番2】役職
      {
        order: 2,
        name: 'position',
        variable: '{position}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "課長") || (trimmed === "ジェネラルマネージャー") || (trimmed === "主任") ;
        }
      },
      // 【順番2】業種
      {
        order: 2,
        name: 'industry',
        variable: '{industry}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "専門サービス業");
        }
      },
      // 【順番2】氏名（フルネーム）
      {
        order: 2,
        name: 'sender_all_name',
        variable: '{sender_all_name}',
        condition: (fieldName, value) => {
          return (value.includes("深谷") && value.includes("凌")) ||
                 (value.includes("渡橋") && value.includes("勇輝"));
        }
      },
      // 【順番2】氏名（よみがな）
      {
        order: 2,
        name: 'sender_all_name_kana',
        variable: '{sender_all_name_kana}',
        condition: (fieldName, value) => {
          return (value.includes("フカヤ") && value.includes("リョウ")) ||
                 (value.includes("ワタハシ") && value.includes("ユウキ"))||
                 (value.includes("ふかや") && value.includes("りょう"))||
                 (value.includes("わたはし") && value.includes("ゆうき"));
        }
      },
      // 【順番2】ホームページ
      {
        order: 2,
        name: 'home_page_url',
        variable: '{home_page_url}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "https://mashien.com/" || trimmed === "https://mashien.com");
        }
      },
      // 【順番2】住所
      {
        order: 2,
        name: 'location',
        variable: '{location}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "東京都中央区日本橋本石町3-3-16室町ビル4階");
        }
      },
      // 【順番2】電話番号
      {
        order: 2,
        name: 'phone_number',
        variable: '{phone_number}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["03-6682-1382", "0366821382", "03ー6682ー1382","050-1782-0380","05017820380","050ー1782ー0380"].includes(trimmed);
        }
      },
      // 【順番2】FAX番号
      {
        order: 2,
        name: 'fax_number',
        variable: '{fax_number}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["03-6800-6539", "0368006539", "03ー6800ー6539","03-4586-6309","0345866309","03ー4586ー6309"].includes(trimmed);
        }
      },
      // 【順番2】メールアドレス
      {
        order: 2,
        name: 'mail_address',
        variable: '{mail_address}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return trimmed === "ma-client@plex.co.jp";
        }
      },
      // 【順番2】郵便番号
      {
        order: 2,
        name: 'post_code',
        variable: '{post_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["103-0021", "1030021", "103ー0021"].includes(trimmed);
        }
      },
      // 【順番2】生年月日
      {
        order: 2,
        name: 'date_of_birth',
        variable: '{date_of_birth}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["1989-04-09", "1989-4-9", "1989/04/09", "1989/4/9", "1989年4月9日"].includes(trimmed);
        }
      },
      // 【順番3】姓
      {
        order: 3,
        name: 'sender_last_name',
        variable: '{sender_last_name}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "深谷" || trimmed === "渡橋");
        }
      },
      // 【順番3】姓_かな
      {
        order: 3,
        name: 'sender_last_name_kana',
        variable: '{sender_last_name_kana}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "フカヤ" || trimmed === "ワタハシ"|| trimmed === "ふかや"|| trimmed === "わたはし");
        }
      },
      // 【順番3】名
      {
        order: 3,
        name: 'sender_first_name',
        variable: '{sender_first_name}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "凌" || trimmed === "勇輝");
        }
      },
      // 【順番3】名_かな
      {
        order: 3,
        name: 'sender_first_name_kana',
        variable: '{sender_first_name_kana}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "リョウ" || trimmed === "ユウキ"|| trimmed === "りょう"|| trimmed === "ゆうき");
        }
      },
      // 【順番3】都道府県
      {
        order: 3,
        name: 'prefecture',
        variable: '{prefecture}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return trimmed.includes("東京都");
        }
      },
      // 【順番3】市区町村_1
      {
        order: 3,
        name: 'municipalities_1',
        variable: '{municipalities_1}',
        condition: (fieldName, value) => {
          return value.trim().includes("中央区");
        }
      },
      // 【順番3】市区町村_2
      {
        order: 3,
        name: 'municipalities_2',
        variable: '{municipalities_2}',
        condition: (fieldName, value) => {
          return value.trim().includes("日本橋");
        }
      },
      // 【順番3】市区町村_3
      {
        order: 3,
        name: 'municipalities_3',
        variable: '{municipalities_3}',
        condition: (fieldName, value) => {
          return value.trim().includes("本石町");
        }
      },
      // 【順番3】番地
      {
        order: 3,
        name: 'block',
        variable: '{block}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return trimmed.includes("3-3-16") || trimmed.includes("3丁目3番16号");
        }
      },
      // 【順番3】建物名
      {
        order: 3,
        name: 'building',
        variable: '{building}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return trimmed.includes("室町ビル4階") || trimmed.includes("室町ビル4F");
        }
      },
      // 【順番4】メール_ローカル
      {
        order: 4,
        name: 'mail_local',
        variable: '{mail_local}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "ma-client" || trimmed === "[ma-client]");
        }
      },
      // 【順番4】メール_ドメイン
      {
        order: 4,
        name: 'mail_domain',
        variable: '{mail_domain}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return (trimmed === "plex.co.jp" || trimmed === "[plex.co.jp]");
        }
      },
      // 【順番4】市内局番（電話）
      {
        order: 4,
        name: 'phone_city_code',
        variable: '{phone_city_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["6682", "６６８２","1782","１７８２"].includes(trimmed);
        }
      },
      // 【順番4】加入者番号（電話）
      {
        order: 4,
        name: 'phone_sub_code',
        variable: '{phone_sub_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["1382", "１３８２","0380","０３８０"].includes(trimmed);
        }
      },
      // 【順番4】市内局番（FAX）
      {
        order: 4,
        name: 'fax_city_code',
        variable: '{fax_city_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["6800", "６８００","4586","４５８６"].includes(trimmed);
        }
      },
      // 【順番4】加入者番号（FAX）
      {
        order: 4,
        name: 'fax_sub_code',
        variable: '{fax_sub_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["6539", "６５３９","6309","６３０９"].includes(trimmed);
        }
      },
      // 【順番4】郵便番号_前半
      {
        order: 4,
        name: 'post_first',
        variable: '{post_first}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          const lowerName = fieldName.toLowerCase();
          if (lowerName.includes("pos") || lowerName.includes("zip") || lowerName.includes("郵便")) {
            return ["103", "１０３"].includes(trimmed);
          }
          return false;
        }
      },
      // 【順番4】郵便番号_後半
      {
        order: 4,
        name: 'post_second',
        variable: '{post_second}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          const lowerName = fieldName.toLowerCase();
          if (lowerName.includes("pos") || lowerName.includes("zip") || lowerName.includes("郵便")) {
            return ["0021", "００２１"].includes(trimmed);
          }
          return false;
        }
      },
      // 【順番4】生年
      {
        order: 4,
        name: 'birth_year',
        variable: '{birth_year}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["1989", "１９８９"].includes(trimmed);
        }
      },
      // 【順番5】年齢
      {
        order: 5,
        name: 'age',
        variable: '{age}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["35", "３５", "35歳", "３５歳", "三十五歳"].includes(trimmed);
        }
      },
      // 【順番5】市外局番（電話）
      {
        order: 5,
        name: 'phone_area_code',
        variable: '{phone_area_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["050", "０５０"].includes(trimmed);
        }
      },
      // 【順番5】市外局番（FAX）
      {
        order: 5,
        name: 'fax_area_code',
        variable: '{fax_area_code}',
        condition: (fieldName, value) => {
          const trimmed = value.trim();
          return ["03", "０３"].includes(trimmed);
        }
      }
    ];

    // 各要素の情報を取得するヘルパー関数
    function getFieldData(el) {
      const tag = el.tagName.toLowerCase();
      let field = {};
      field.type = el.type;
      field.name = el.getAttribute('name') || '';
      field.class = el.getAttribute('class') || '';
      
      if (el.type === "checkbox" || el.type === "radio") {
          // チェックボックスとラジオボタンの場合、チェック状態に応じてvalueを設定
          field.checked = el.checked;
          field.value = el.checked ? el.value : "";
      } else if (tag === "select") {
          // セレクトボックスの場合
          if (el.multiple) {
              // 複数選択可能な場合、選択されているoptionの値の配列を取得
              field.type = "multiselect";
              field.selectedOptions = Array.from(el.options)
                                            .filter(opt => opt.selected)
                                            .map(opt => opt.value);
          } else {
              field.value = el.value;
          }
      } else {
          // その他（text、textareaなど）
          field.value = el.value;
      }
      return field;
    }
  
    // フォームsubmit時のイベントハンドラ
    document.addEventListener('submit', function(e) {
      const form = e.target;

      // 送信元URLと送信先URL
      const sourceUrl = location.href;
      const actionUrl = form.action || sourceUrl; // action属性がない場合は現在のURL

      // 入力要素の取得（hidden以外のinput, textarea, select）
      const elements = form.querySelectorAll('input:not([type="hidden"]), textarea, select');

      // すべてのフォーム要素の値を連結して「お問い合わせ番号」と「プレックス」が含まれているかチェック
      let combinedText = "";
      elements.forEach(el => {
          const fieldData = getFieldData(el);
          if (fieldData.selectedOptions) {
              combinedText += fieldData.selectedOptions.join("");
          } else if (fieldData.checked === undefined || fieldData.checked) {
              // text/select/textarea か「選択済み」のラジオ・チェックだけ追加
              combinedText += fieldData.value;
          }
      });


      // submitボタンの情報を1つのオブジェクトにまとめる
      let submitButton = {};
      if (e.submitter) {
          submitButton = {
              class: e.submitter.className || "",
              name: e.submitter.name || "",
              value: e.submitter.value || ""
          };
      }

      // 「お問い合わせ番号」と「プレックス」の両方が含まれていない場合、最低限の情報のみをpayloadに含める
      if (!(combinedText.includes("お問い合わせ番号") && combinedText.includes("プレックス"))) {
          const payload = {
              sourceUrl,
              actionUrl,
              submitButton
          };
          // console.log(JSON.stringify(payload, null, 2));
          
          // APIに送信するデータ構造を作成（最低限の情報のみ）
          const apiPayload = {
              source_url: sourceUrl,
              destination_url: actionUrl,
              form_data: {
                  submit_button: submitButton
              }
          };

          console.log(JSON.stringify(apiPayload, null, 2));
          
          // APIにデータを送信
          fetch("https://prd-yorozuya-7987bc94377e.herokuapp.com/ma/form_logs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(apiPayload)
          })
          .then(response => {
            console.log("ログ送信完了:", response);
          })
          .catch(error => {
            console.error("ログ送信エラー:", error);
          });
          
          if (DEBUG_MODE) {
              e.preventDefault();
              console.log("DEBUG_MODE: フォーム送信をキャンセルしました。", payload);
              console.log("DEBUG_MODE: API送信データ:", apiPayload);
          }
          return;
      }

      // 以下、両方が含まれている場合の処理

      const originalData = {};
      const substitutedData = {};
      const changes = {};

      elements.forEach(el => {
        const key = el.getAttribute('name'); // name属性を直接取得
        const field = getFieldData(el);
        let originalValue = field.value;
        let newValue = originalValue;
        let appliedRules = [];
        
        // デバッグ用ログ追加
        console.log('Original field data:', {
            name: field.name,
            class: field.class,
            value: field.value
        });
        
        // 文字列型の値の場合のみ置換ルールを適用
        if (typeof originalValue === "string") {
            const sortedRules = substitutionRules.slice().sort((a, b) => a.order - b.order);
            for (let rule of sortedRules) {
                if (chainableRules.includes(rule.name)) {
                    // 連結対象のルールの場合は、既に置換された newValue に対して判定
                    if (rule.condition(key, newValue)) {
                        let pattern = chainableReplacements[rule.name];
                        if (pattern && newValue.includes(pattern)) {
                            // 既存の該当部分をルールの変数に置換
                            newValue = newValue.replace(pattern, rule.variable);
                        } else {
                            // 置換対象が無い場合は先頭に連結する
                            newValue = rule.variable + newValue;
                        }
                        appliedRules.push(rule.name);
                    }
                } else {
                    // 連結対象外の場合は、元の値に対して最初にマッチしたルールのみを適用
                    if (rule.condition(key, originalValue)) {
                        newValue = rule.variable;
                        appliedRules.push(rule.name);
                        break; // それ以降はチェックせず終了
                    }
                }
            }
            if (appliedRules.length > 0) {
                changes[key] = {
                    original: originalValue,
                    substituted: newValue,
                    rule: appliedRules.join(",")
                };
            }
        }
        
        // 差し替え後のデータオブジェクトを作成（チェックボックスやラジオ、セレクトの場合も対応）
        const substitutedField = Object.assign({}, field);
        if (substitutedField.hasOwnProperty("value") && typeof substitutedField.value === "string") {
            substitutedField.value = newValue;
        }
        // classの値を含めるように修正
        originalData[key] = {
            ...field,
            class: field.class
        };
        substitutedData[key] = {
            ...substitutedField,
            class: field.class
        };

        // デバッグ用ログ追加
        console.log('Processed field data:', {
            original: originalData[key],
            substituted: substitutedData[key]
        });
    });
    

      const payload = {
          sourceUrl,
          actionUrl,
          originalData,
          substitutedData,
          changes,
          submitButton
      };



      // APIに送信するデータ構造を作成
      const apiPayload = {
          source_url: sourceUrl,
          destination_url: actionUrl,
          form_data: {
              original: originalData,
              template: substitutedData,
              changes: changes,
              submit_button: submitButton
          }
      };

      // 検証用ログ出力
      console.log(JSON.stringify(apiPayload, null, 2));

      // APIにデータを送信
      fetch("https://prd-yorozuya-7987bc94377e.herokuapp.com/ma/form_logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(apiPayload)
      })
      .then(response => {
        console.log("ログ送信完了:", response);
      })
      .catch(error => {
        console.error("ログ送信エラー:", error);
      });

      if (DEBUG_MODE) {
          // デバッグモードの場合、実際のフォーム送信をキャンセル
          e.preventDefault();
          console.log("DEBUG_MODE: フォーム送信をキャンセルしました。", payload);
          console.log("DEBUG_MODE: API送信データ:", apiPayload);
      }
  }, true);
})();
