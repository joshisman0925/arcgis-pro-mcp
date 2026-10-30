# 維護紀錄

## 2026-10-20 — 工具外部存取宣告

- 起始工作目錄乾淨；已讀主要使用、安全、相容性與發布文件、launch.json，以及最近三筆 commit。專案搜尋未發現 AGENTS.md；遵守聊天提供的全域 F5 規則。
- 發現：server.mjs 對全部工具設定 openWorldHint=false，但 add_layer 支援 HTTPS 服務，既有安全文件也明示遠端圖層可能接觸 GIS 服務。這是信任邊界提示不準確，未證實可利用漏洞。
- 修正：只有 list_sessions、ping、list_geoprocessing_tools 保留 false，其餘保守設為 true。未修改工具參數、後端操作或其他安全提示。
- test-tools.mjs 新增 38 工具在 legacy/auto 模式的外部存取宣告斷言；SECURITY.md 補上宣告語意及官方依據。
- 靜態核對：檢查註冊迴圈、兩種協定的現有測試結構與建置來源；完成 git diff --check。這不是執行期驗證。
- 未執行：本次無可用 VSCode F5 控制，因此協定／工具／Plugin 測試未跑，不能宣稱通過。需要 F5「Connector — expanded tools tests」及「Connector — protocol and pipe tests」。
- 發布狀態：僅修改原始碼及文件；尚未重建或更新 plugins/arcgis-pro-mcp 的 bundle、安全文件副本及 dist，未變更版本、未提交、未推送或發布。
- 下一步：先完成上述 F5 驗證，使用 VSCode「Build portable plugin」工作重建，再 F5「Connector — isolated plugin bundle test」；之後檢查打包差異。另需整理 TOOLS.md／LIVE-ACCEPTANCE.md 與 README 的驗收狀態差異。

## 2026-10-20（Claude 排程首次執行）— Plugin bundle 同步與漂移檢查

- 接續上一筆未提交的 openWorldHint 修正（server.mjs、test-tools.mjs、SECURITY.md），確認屬於本維護工作後一併提交。
- 以專案建置腳本（同 VSCode 工作「Build portable plugin」）重建 plugins/arcgis-pro-mcp；差異只有 server.bundle.mjs 的宣告邏輯與 SECURITY.md 副本，esbuild 輸出穩定。
- test-plugin.mjs 新增：bundle 內 38 工具 openWorldHint 與原始碼規則一致；預設來源時 LICENSE、PRIVACY、SECURITY、TOOLS、COMPATIBILITY、INSTALL/UPDATE-PROMPT 副本須與根目錄相同，避免原始碼修正未進入套件。
- 靜態驗證：node --check 三個檔案通過；cmp 確認 7 份文件副本與根目錄一致；bundle 含新宣告邏輯。
- 未執行：本機 F5（expanded tools／protocol／isolated plugin）未跑。執行期驗證依 PR CI（windows-latest：npm test、npm run test:plugin、套件隱私檢查）。
- 版本：未變更版本號，CHANGELOG 列於 Unreleased；未發版（Add-in 未變更，需累積更多變更並完成 F5 後再評估）。
- 觀察：scripts/build-plugin.mjs 的 checksums.json 版本寫死 0.3.1、Plugin 為 0.3.2；Add-in 本身仍為 0.3.1，判定為刻意區分，下次發版時再統一來源。
- 下一步：P0 Pipe 存取控制與路徑驗證審查；同步 TOOLS／LIVE-ACCEPTANCE／README 驗收描述。

## 2026-10-20 — main CI 紅燈：list_sessions 在 MCP 用戶端環境下 20–30 秒

- PR #3 合併（e0e4da7）後 main 的 Connector tests 失敗，重跑仍失敗；test:plugin 的 list_sessions 約 30 秒逾時。
- 排除冷啟動：CI 直接啟動同一命令只需 0.4–3 秒。test-plugin 計時：connect 123 ms、listTools 22 ms、list_sessions 22–30 秒。
- PR #4 分支暫時加入 CI 診斷（合併前已移除）。以 MCP SDK StdioClientTransport 的環境變數白名單啟動時：exit 0.2–2 秒；Get-Process 20–42 秒；Select-Object／ConvertTo-Json 約 20 秒；Get-Command ConvertTo-Json 剛好 20003 ms。完整環境同命令約 0.3 秒。
- 中途嘗試補預設 PSModulePath、或只留 System32 模組路徑，CI 仍 30 秒，已撤回。結論：白名單環境下自動載入 Microsoft.PowerShell.Management／Utility 模組會卡約 20 秒，確切缺少的變數未定位。本機因快取無法重現（約 0.3–0.5 秒）。
- 影響：使用相同白名單環境的實際 MCP 用戶端也可能每次 list_sessions 需 20–30 秒或逾時，不只 CI。
- 修正：server.mjs 探測改用 [Diagnostics.Process]::GetProcessesByName 與語言內建語法，不呼叫任何 cmdlet；每行輸出「PID:Base64(UTF-8 標題)」，Node 端解析，非預期輸出回報錯誤。逾時與失敗回傳可行動訊息，逾時維持 30 秒。本機實跑 0.3 秒；以 explorer 代換驗證標題解碼。
- 測試：test-tools.mjs 以假 exec 驗證逾時、失敗、中文標題、空標題、空輸出、非預期輸出，並確認命令不含 cmdlet；test-plugin.mjs 記錄各階段計時，並要求 list_sessions 在白名單環境下少於 10 秒。
- 已重建 Plugin bundle；node --check 通過。本機 F5 未跑，以 PR CI 驗證。

## 2026-10-22（Claude 排程）— outputPath Win32 別名路徑強化

- 起始：main 落後 origin 2 筆（PR #2 dependabot 合併），已 fast-forward；未追蹤 docs/claude-schedule-handoff.md 保留不提交。
- P0 審查 Pipe 與路徑：Named Pipe 已使用 PipeOptions.CurrentUserOnly、單一連線、10 秒讀取期限與 1 MiB 上限，未發現需修正項。
- 發現：tools.mjs 的 outputPath 只檢查磁碟代號開頭與 `..`。`D:/x/a.txt:s.png`（替代資料流）、`D:/exports/NUL.png`（保留裝置）、`D:/a/b.png.`（結尾句點被 Win32 去除）都能通過，Add-in NewOutput 的 File.Exists 也擋不住寫入既有檔案的資料流，可繞過「只寫新檔」規則。
- 修正：新增 outputPathProblem()，export_map／export_layout／run_geoprocessing 共用；拒絕 UNC／裝置前綴、`..`、`.`、空片段、結尾句點／空白、`: < > " | ? *` 與控制字元、CON/PRN/AUX/NUL/COM*/LPT*/CONIN$/CONOUT$。Add-in 未修改（不需重新編譯或發 Add-in）。
- 測試：test-tools.mjs 新增 4 筆經 MCP 的拒絕案例，以及 6 筆允許／19 筆拒絕的純函式案例；validation 報告加 outputPathRules。
- 證據：node --check（tools、test-tools、bundle）通過；git diff --check 乾淨；以臨時腳本直接呼叫 outputPathProblem 純函式，6 允許／23 拒絕全部符合預期（非完整測試套件）。已用 build-plugin 重建，bundle 與 SECURITY.md／TOOLS.md 副本一致。
- 未執行：本機 F5「Connector — expanded tools tests」、「protocol and pipe tests」、「isolated plugin bundle test」未跑，以 PR CI（windows-latest）驗證。
- 已知限制（已寫入 SECURITY.md）：對應網路磁碟機代號仍視為本機；Add-in NewOutput 未重複片段規則。
- 下一步：Add-in NewOutput 補同等檢查與 DriveType.Network 拒絕（需 Pro SDK 建置、隨下次 Add-in 版本發布）；依賴與供應鏈巡檢（npm audit 結果紀錄）；同步 TOOLS／LIVE-ACCEPTANCE／README 驗收描述。

## 2026-10-23（Claude 排程，週五）— 供應鏈 lockfile 檢查、驗收文件同步、官方資格查核

- 起始：main 與 origin 同步、無開啟中 PR、最近 main CI／Security Scan 皆成功；未追蹤 docs/claude-schedule-handoff.md 保留不提交。專案無 AGENTS.md。
- 依賴巡檢：`npm audit --registry=https://registry.npmjs.org/` 0 漏洞（prod 1、dev 178）。`npm outdated` 只有 dev 依賴 @modelcontextprotocol/inspector 2.11.0 → 2.12.0，交 Dependabot（7 天冷卻）處理，不手動升。觀察：本機 npm 使用者設定 registry 為 `http://registry.npmjs.org/`（明文），audit 回 426；repo lockfile 不受影響，但建議使用者把本機設定改回 https。
- 新增 scripts/check-lockfile.mjs：每個 lock 套件須 `https://registry.npmjs.org/` 來源與 sha512 integrity、lockfileVersion ≥ 2；接到 `npm test` 最前面（CI Connector tests 會執行）。test-tools.mjs 加 1 筆允許、7 筆拒絕（HTTP、git+ssh、其他網域、`registry.npmjs.org.evil.example`、缺 resolved、sha1、lockfile v1）。SECURITY.md 補說明。
- 驗收文件同步：依本機 validation-live.json（2026-10-16，Add-in 0.3.1，唯讀 PASS、未寫入）與 validation-live-safe.json（28 個工具 PASS、未存專案／未改資料），更新 TOOLS.md「驗證界線」與 LIVE-ACCEPTANCE.md 狀態表；明列未驗收：update_attributes、create_feature、save_edits、save_project、export_layout。validation 報告仍不入版控，文件不含其中私人路徑。
- 官方查核（2026-10-23）：寫入 PUBLISHING.md「提交資格查核」表。OpenAI 本機 MCP 仍限允許名單合作夥伴；submission 頁新列 5 正／3 負測試案例、審核影片、release notes、logo／composerIcon、四個 HTTPS 網址。MCP Registry 需先發布公開 npm 套件並加 mcpName／server.json。
- 證據：`node scripts/check-lockfile.mjs` 對實際 lockfile 通過（181 套件）；scratchpad 臨時腳本直接呼叫 lockfileProblems 純函式，1 允許／7 拒絕符合預期；node --check（test-tools、check-lockfile）通過；build-plugin 重建後 TOOLS.md、SECURITY.md 副本 cmp 一致，bundle 無差異。
- 未執行：本機 F5「Connector — expanded tools tests」「protocol and pipe tests」「isolated plugin bundle test」未跑，以 PR CI（windows-latest）驗證。
- 版本：未變更版本、未發版（只有文件與測試，無可發布執行期變更）。
- 下一步：撰寫官方審核用 5 正／3 負測試案例與 release notes 草稿；Add-in NewOutput 同等路徑檢查（需 Pro SDK）；隔離專案驗收編輯／儲存／export_layout（需使用者提供拋棄式 APRX＋F5）。

## 2026-10-30（Claude 排程，週五）— 官方審核測試案例與 manifest 上限檢查

- 起始：main 與 origin 同步、無開啟中 PR、main 最近 CI／Security Scan 成功；未追蹤 docs/claude-schedule-handoff.md 保留不提交。專案無 AGENTS.md。
- 依賴巡檢：`npm audit --registry=https://registry.npmjs.org/` 0 漏洞。`npm outdated`：@modelcontextprotocol/server、client 2.3.1 → 2.4.0（server 為執行期依賴，次版更新），inspector 2.11.0 → 2.13.0；交 Dependabot（7 天冷卻）處理，不手動升。
- 官方查核（2026-10-30）：submission、desktop-only、build/plugins、MCP Registry quickstart 四頁皆可開啟；資格不變（本機 MCP 仍限允許名單合作夥伴）。新明列測試案例欄位格式與 manifest 欄位上限，寫入 PUBLISHING.md。submission 頁內容較長，後段欄位上限取自摘要，提交前需在入口網站再確認。
- 發現：plugin.json 的 shortDescription 為 52 字元，超過官方 30 字元上限，入口網站可能拒收。已縮為「ArcGIS Pro maps and GIS tools」（29 字元），重建 Plugin，bundle 只有兩份 manifest 變動。
- 新增 docs/submission/review-test-cases.json（5 正：列圖層、讀選取屬性、暫時分級設色並還原、匯出新 PNG、Buffer 至新輸出；3 負：任意 Python、覆寫既有匯出、刪除全部圖徵並靜默儲存）、docs/submission/README.md（release notes 草稿、測試資料需求、剩餘條件）。
- 新增 scripts/check-submission.mjs 並接進 `npm test`；test-tools.mjs 加 7 筆 manifest 拒絕與 6 筆案例拒絕案例。
- 證據：`node scripts/check-submission.mjs` 修正前回報 shortDescription 52 > 30，修正後通過；scratchpad 臨時腳本直接呼叫純函式 15 項全部符合預期；node --check（test-tools、check-submission）通過。
- 未執行：本機 F5「Connector — expanded tools tests」「isolated plugin bundle test」未跑，以 PR CI（windows-latest）驗證。測試案例尚未以拋棄式 APRX 實跑。
- 版本：未變更版本、未發版（manifest 文字與文件／檢查變更）。
- 下一步：建立拋棄式測試 APRX 後實跑案例並錄影（需使用者＋Pro）；Add-in NewOutput 同等路徑檢查（需 Pro SDK）；評估 GIS skill（P2）。

## 2026-10-30（使用者授權自建拋棄式 APRX）— 審核用 fixture 產生腳本

- 使用者明確授權自行建立拋棄式 APRX。新增 scripts/create-review-fixture.py（arc_env ArcPy 3.3），以 Pro 內建 Blank.aprx 另存 D:/review/review.aprx，刪除範本空地圖與 createMap 自動加入的線上底圖，建立 Review Map、Review Layout，及 review-data.gdb（Roads 6、Parcels 16、Wells 8，TWD97 TM2 合成資料）、空的 scratch.gdb、exports/existing-report.pdf。
- 安全：只寫入 --root；非空且無標記檔的資料夾拒絕（以 scratchpad 內放有使用者檔案的資料夾實測，檔案未被動到）；已有 fixture 需 --replace。
- 證據：實際產生 D:/review；ArcPy 回讀只有 Review Map／Review Layout、三圖層來源皆指向 review-data.gdb、無底圖、Area 為 Double、預設 gdb 為 scratch.gdb、PDF 7813 bytes、Buffer／PNG 輸出目標不存在。
- 未執行：5 正／3 負實跑。目前 Pro 開的是使用者專案（05_Guoyingkeng_Shengfukeng），不在使用者專案上操作；需在 Pro 開啟 review.aprx 後實跑。
