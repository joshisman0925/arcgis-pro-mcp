# 官方審核提交材料

依 [OpenAI submission](https://developers.openai.com/plugins/deploy/submission)（2026-10-30 查核）準備。本資料夾只放可公開的審核草稿，不含審核帳號、憑證或私人 GIS 資料。尚未提交，提交須另行取得使用者批准，見 PUBLISHING.md。

## 測試案例

[review-test-cases.json](review-test-cases.json) 採官方欄位：正向案例 `description`、`prompt`、`tools_triggered`、`expected_behavior`；負向案例 `description`、`prompt`，拒絕理由寫在 description。`npm test` 會先跑 `scripts/check-submission.mjs`，確認 5 正／3 負、必填欄位、`tools_triggered` 只引用已註冊工具、不含 `test_credentials`／`reviewer_instructions`，並檢查 manifest 欄位上限（displayName／shortDescription ≤30 字元、defaultPrompt ≤3 則各 ≤128 字元、四個 HTTPS 網址、`./` 圖示路徑、無 hooks）。

案例使用 `D:/review/` 下的拋棄式資料：一份含 Roads（Name、Length）、Parcels（數值欄位 Area）、Wells 圖層的測試 APRX，`D:/review/exports/` 資料夾及其中既有的 `existing-report.pdf`，以及 `D:/review/scratch.gdb`。官方要求提交前以測試帳號逐一實跑正向案例；目前**尚未實跑**，測試 APRX 也尚未建立。

暫不寫入 plugin.json 的 `review.test_cases`：官方要求同時提供 `review.demo_recording_url`，影片完成前保持獨立檔案。影片完成後再把兩者一起加入 manifest。

## Release notes 草稿（publication.release_notes）

> First public directory release. Connects ChatGPT desktop to an open ArcGIS Pro session on the same Windows account through a local named pipe and 38 MCP tools: map and layer discovery, bounded attribute queries, selection, symbology with restore tokens, camera and 3D elevation, PNG/PDF export to new files only, five whitelisted geoprocessing tools, and explicit attribute edits and saves that require confirmation. No arbitrary code execution, no network listener, no telemetry. Requires ArcGIS Pro 3.3+, Node.js 20+ and the bundled Pro Add-in.

## 剩餘條件

| 項目 | 狀態 | 負責 |
| --- | --- | --- |
| OpenAI organization 列入本機 MCP 允許名單、身分驗證 | 未開始 | 使用者／組織管理者 |
| 拋棄式測試 APRX 與資料、實跑 5 正／3 負 | 未開始 | 需 Pro＋F5 |
| 審核用操作影片（demo_recording_url） | 未開始 | 使用者錄製 |
| 編輯／儲存／export_layout 真實驗收 | 未完成（LIVE-ACCEPTANCE.md） | 需 Pro＋F5 |
