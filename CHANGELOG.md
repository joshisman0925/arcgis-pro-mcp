# Changelog

## Unreleased

- list_sessions 的 PowerShell 探測逾時或失敗時回傳可行動的錯誤訊息，不再只回顯命令列；CI 於 Connector tests 前先暖機 Windows PowerShell。
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
