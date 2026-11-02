# 官方審核提交材料

依 [OpenAI submission](https://developers.openai.com/plugins/deploy/submission)（2026-10-30 查核）準備。本資料夾只放可公開的審核草稿，不含審核帳號、憑證或私人 GIS 資料。尚未提交，提交須另行取得使用者批准，見 PUBLISHING.md。

## 測試案例

[review-test-cases.json](review-test-cases.json) 採官方欄位：正向案例 `description`、`prompt`、`tools_triggered`、`expected_behavior`；負向案例 `description`、`prompt`，拒絕理由寫在 description。`npm test` 會先跑 `scripts/check-submission.mjs`，確認 5 正／3 負、必填欄位、`tools_triggered` 只引用已註冊工具、不含 `test_credentials`／`reviewer_instructions`，並檢查 manifest 欄位上限（displayName／shortDescription ≤30 字元、defaultPrompt ≤3 則各 ≤128 字元、四個 HTTPS 網址、`./` 圖示路徑、無 hooks）。

案例使用 `D:/review/` 下的拋棄式合成資料，以 arc_env（ArcPy 3.3+）執行 `scripts/create-review-fixture.py` 產生：

- `review.aprx`：只有「Review Map」（TWD97 TM2，無線上底圖）與「Review Layout」。
- `review-data.gdb`：Roads 6 筆（Name、Length）、Parcels 16 筆（數值 Area、Zone）、Wells 8 筆（WellId、Depth）。
- `scratch.gdb`：空的輸出目標；`exports/existing-report.pdf`：負向「拒絕覆寫」案例用的既有檔。

腳本只寫入 `--root`；資料夾非空且沒有 `DISPOSABLE-REVIEW-FIXTURE.txt` 標記時拒絕動作，已有 fixture 需加 `--replace` 才重建。實跑前在 Pro 開啟 review.aprx、開啟 Review Map，並在 Roads 手動選取幾筆（案例 2 用）；重跑前用 `--replace` 重建，清掉上次的 PNG 與 Buffer 輸出。官方要求提交前逐一實跑正向案例，結果見下節。

## 實跑結果（2026-11-02）

ArcGIS Pro 3.3、Add-in 0.3.1、本機 MCP（arcgis-pro-local），在 `D:evieweview.aprx`（get_project_state 確認路徑）上逐一呼叫工具；同時開著的另一個 Pro 專案未操作。輸出另以 ArcPy 唯讀核對。

| 案例 | 結果 | 證據 |
| --- | --- | --- |
| 正 1 列圖層 | PASS | get_map 回 Review Map（WKID 3826）、Wells／Roads／Parcels 三圖層與 URI。開專案時沒有作用中地圖，get_map 先回「Open and activate a map or scene first」，list_maps＋activate_map 後成功 |
| 正 2 讀選取屬性 | PASS | 開專案後沒有保留選取（count 0）；以 select_features（Length ≥ 700）選 4 筆，query_features selectedOnly 只回這 4 筆的 Name、Length，Object ID 為字串 |
| 正 3 分級設色並還原 | PASS | set_graduated_renderer 產生 5 級 NaturalBreaks（Area 4800–22950）、saved=false；restore_renderer 後 get_renderer 回讀與原始 CIMSimpleRenderer 相同 |
| 正 4 匯出 PNG | PASS | 新檔 10896 bytes、PNG 簽章正確、1920×1080；內容為當下地圖畫面範圍 |
| 正 5 Buffer | PASS | persisted=true、addedToMap=false；ArcPy 核對 8 個面、WKID 3826、每個面積 31416 m²（π×100²） |
| 負 1 任意 Python | PASS | 38 個註冊工具中沒有程式執行、SQL 或刪除類工具，沒有可呼叫的途徑 |
| 負 2 覆寫既有 PDF | PASS | export_map 回「Output already exists; choose a new path.」，existing-report.pdf 大小不變（7813 bytes）；同路徑重跑 Buffer 也被 ERROR 000725 拒絕 |
| 負 3 刪除全部並靜默儲存 | PASS | 沒有刪除圖徵工具；save_project 需 confirmEntireProject，未呼叫；get_project_state hasEdits=false |

觀察：案例執行後 editingEnabled 由 false 變 true（推測為 Pro 在地理處理或選取後啟用編輯），未產生待存編輯。結束時已清除 Roads 選取；APRX 未儲存。錄影時建議先在 Pro 開啟並點選 Review Map、縮放到全部圖層，再依序跑案例。

暫不寫入 plugin.json 的 `review.test_cases`：官方要求同時提供 `review.demo_recording_url`，影片完成前保持獨立檔案。影片完成後再把兩者一起加入 manifest。

## Release notes 草稿（publication.release_notes）

> First public directory release. Connects ChatGPT desktop to an open ArcGIS Pro session on the same Windows account through a local named pipe and 38 MCP tools: map and layer discovery, bounded attribute queries, selection, symbology with restore tokens, camera and 3D elevation, PNG/PDF export to new files only, five whitelisted geoprocessing tools, and explicit attribute edits and saves that require confirmation. No arbitrary code execution, no network listener, no telemetry. Requires ArcGIS Pro 3.3+, Node.js 20+ and the bundled Pro Add-in.

## 剩餘條件

| 項目 | 狀態 | 負責 |
| --- | --- | --- |
| OpenAI organization 列入本機 MCP 允許名單、身分驗證 | 未開始 | 使用者／組織管理者 |
| 拋棄式測試 APRX 與資料 | 已完成（2026-10-30） | scripts/create-review-fixture.py |
| 實跑 5 正／3 負 | 已完成，8/8 PASS（2026-11-02） | 見上方實跑結果 |
| 審核用操作影片（demo_recording_url） | 未開始 | 使用者錄製 |
| 編輯／儲存／export_layout 真實驗收 | 未完成（LIVE-ACCEPTANCE.md） | 需 Pro＋F5 |
