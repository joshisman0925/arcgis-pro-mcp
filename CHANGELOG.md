# Changelog

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
