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
