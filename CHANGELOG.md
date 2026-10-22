# Changelog

## Unreleased

- 新增 scripts/check-lockfile.mjs，npm test 先檢查 package-lock.json 每個套件都來自 HTTPS npm registry 並附 sha512 integrity；test-tools 新增 HTTP、git、偽造網域、缺 integrity 等拒絕案例；SECURITY.md 補供應鏈說明。
- 同步 TOOLS.md、LIVE-ACCEPTANCE.md 的真實 Pro 驗收狀態為 0.3.1（2026-10-16 唯讀與 28 個可還原工具通過；資料編輯、儲存與 export_layout 尚待驗收）；PUBLISHING.md 新增三管道提交資格查核表。
- 加強 export_map／export_layout／run_geoprocessing 的 outputPath 檢查：拒絕替代資料流（`:`）、保留裝置名稱（CON、NUL、COM1…）、結尾句點／空白、`.`／空片段及 Windows 保留字元，避免繞過「只寫新檔」規則；test-tools 新增對應拒絕與允許案例，SECURITY.md 補說明與限制。

- 修正 list_sessions 在 MCP 用戶端環境變數白名單下每次需 20–30 秒、可能逾時的問題：探測改用 .NET Process API，不再載入 Get-Process／ConvertTo-Json 所屬模組；視窗標題以 UTF-8 Base64 傳回，不受主控台字碼頁影響；逾時或失敗改回傳可行動的錯誤訊息。
- 修正工具 openWorldHint：除 list_sessions、ping、list_geoprocessing_tools 外標示可能接觸外部資料（Pro 專案可含遠端服務）；SECURITY.md 補宣告語意。
- 重建 Plugin bundle；isolated plugin 測試新增 bundle 宣告與政策文件副本一致性檢查，避免原始碼修正未進入套件。

## 0.3.1

- 加入可攜 Codex Plugin、自訂市集、跨 AI 安裝提示詞、MIT 授權與隱私說明。
- MCP 執行依賴預先打包，附 Pro Add-in 與 SHA256；安裝腳本檢查版本、備份舊套件並要求 Pro 關閉。
- 修正新開地圖 pane 尚未初始化時 activate_map 發生 null reference 的問題。
- 加入獨立 Plugin bundle 測試及真實 Pro 可還原操作驗收。
- 保留共用 MCP，依 SDK 相容性規劃原生 Add-in；目前實測 Pro 3.3。

## 0.3.0

- 從 7 個工具擴充為 38 個，加入屬性、資料來源、選取、縮放、符號快照、圖層組織、地圖切換、柵格、相機／高程、版面、匯出、白名單地理處理、資料編輯與儲存。
- MCP Server 與 Pro Add-in 都升為 0.3.0；新工具執行前檢查 Add-in actions，舊版回傳明確升級提示。
- 新增 schema 的跨參數驗證、工具 title、依行為設定的 read/write、destructive 與 idempotent hints。
- 匯出及地理處理拒絕既有輸出；編輯使用 EditOperation、明確 Object ID、修改前比對及前後值回傳。
- 地理處理 timeout 上限 120 秒；用戶端建議設為 180 秒。
- 新增 38 工具分派與 27 種無效輸入測試；新 SDK 行為仍需安裝新版 Add-in 後進行 Pro 實測。

## 0.2.0

- 改用官方 MCP SDK 2.3.1，加入官方 Client 與 Inspector 驗證。
- 提供最初七個工具；Pro Add-in 版本為 0.1.0。
