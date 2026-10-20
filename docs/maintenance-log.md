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
