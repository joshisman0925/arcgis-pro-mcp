# ArcGIS Pro Local MCP

使用自然語言，透過本機 MCP 讀取與操作已開啟的 ArcGIS Pro 地圖及場景。

此為自訂整合專案，非 Esri 官方產品。MCP Server 與 Pro Add-in 目前都為 **0.3.1**。新增工具需要重新安裝新版 Add-in，再重新開啟 Pro。

```text
AI 用戶端（Codex／其他支援本機 stdio MCP 的軟體）
  → Node.js MCP Server（官方 MCP SDK）
  → Windows Named Pipe（同一 Windows 帳號）
  → ArcGIS Pro C# Add-in
  → ArcGIS Pro SDK／目前開啟的地圖
```

## Codex Plugin

前往 [v0.3.1 Release](https://github.com/joshisman0925/arcgis-pro-mcp/releases/tag/v0.3.1)，下載 Windows ZIP 與 SHA256SUMS。已包含 MCP 執行依賴及編譯好的 Pro Add-in，使用者不需要 Git、npm install 或 .NET SDK。需要 Windows、Node.js 20+ 與已授權的 Pro 3.3 或相容的後續 3.x。

**把 [安裝提示詞](INSTALL-PROMPT.md) 交給你的 AI，即可引導檢查、備份與安裝。** 不支援本機 stdio／本機檔案操作的雲端 AI 無法直接安裝。

Codex 使用自訂市集：

```text
codex plugin marketplace add joshisman0925/arcgis-pro-mcp
codex plugin add arcgis-pro-mcp@joshisman-gis
```

安裝後執行 setup skill 安裝 Add-in，正常開啟 Pro 與地圖，再重新連線。已有手動 MCP 的使用者應先備份設定，驗證後只保留一個來源。這是公開自訂市集，尚未通過 OpenAI 官方目錄審核；申請條件見 [PUBLISHING.md](PUBLISHING.md)。

Pro 版本策略見 [COMPATIBILITY.md](COMPATIBILITY.md)：共用一份 MCP，只有 SDK 二進位相容性需要時才增加 Add-in 建置版本，目前實測基準為 Pro 3.3。

## 已提供的工具

| 工具 | 功能 |
| --- | --- |
| `list_sessions` | 列出 Pro 工作階段與 processId |
| `ping` | 確認指定 Pro 工作階段的 Add-in 連線 |
| `get_map` | 目前地圖、圖層 URI、群組、高程表面及顯示狀態 |
| `get_fields` | 圖徵圖層的欄位名稱、別名與型別 |
| `get_selection` | 選取數量與前 1000 筆 Object ID（字串，保留 64 位元精度） |
| `set_visibility` | 切換圖層顯示 |
| `rename_layer` | 重新命名圖層 |

以上七項保留原有相容性。0.3.0 另外加入 31 個工具，涵蓋屬性查詢、資料來源、條件選取、縮放、單一／分級設色與還原、透明度、圖層新增／移除／分組／排序、地圖切換、柵格、相機與高程、版面匯出、五項白名單地理處理、屬性編輯、建立圖徵及儲存。

**完整 38 個工具及操作限制見 [TOOLS.md](TOOLS.md)。** Pro 3.3 已通過真實讀取及可還原操作測試；資料編輯、儲存及版面匯出仍需獨立測試專案驗收。

所有地圖工具都明確指定 processId，圖層工具以 URI 定位，避免同名圖層混淆。修改不會自動儲存 Pro 專案。

## 需求

- Windows；已安裝並授權的 ArcGIS Pro。
- 目前 Add-in 在 ArcGIS Pro **3.3 / .NET 8** 編譯及實測；其他版本需另行驗證。
- Node.js **20 以上**；若執行 Inspector 開發測試，需要 **22.19 以上**。
- 建置 Add-in 需要 .NET 8 SDK。

## 從原始碼安裝（開發者）

1. 下載或 clone 本專案，保留整個專案資料夾。
2. 在專案目錄安裝執行期相依性：`npm ci --omit=dev --ignore-scripts`。
3. 建置 Add-in：使用 VSCode 的 **Terminal → Run Build Task → Build and package connector**，會執行 `build.ps1` 產生 `LocalProConnector.esriAddinX`。此步驟只建置及打包。
4. 雙擊 `.esriAddinX` 使用 Esri 安裝程式安裝。若組織禁止未簽署的 Add-in，請依組織規定處理。
5. 正常開啟 Pro，再開啟專案與地圖／場景。
6. 在 AI 用戶端加入 MCP 設定，並重新載入連線。

日常使用不需要 VSCode 或 F5。AI 用戶端會自動啟動 Node.js MCP 程式，Pro 則負責載入 Add-in。

### AI 用戶端設定

- Codex：參考 `codex-mcp.example.toml`，將區段合併到用戶端的 `config.toml`。
- 支援傳統本機 MCP JSON 設定的 Claude Desktop：參考 `claude-mcp.example.json`，合併到既有 `mcpServers`，不要覆寫其他設定。
- 修改範例中的專案路徑；若 `node` 不在用戶端的 PATH，將 command 改成 `node.exe` 的完整路徑。
- 已提供 Codex Plugin 與 Add-in 安裝腳本；其他 AI 使用 [安裝提示詞](INSTALL-PROMPT.md)。Claude Desktop 實機相容性尚未驗證。
- 地理處理可能較久，用戶端工具 timeout 建議設為 180 秒。

首次連線先呼叫 `list_sessions`，再用取得的 processId 呼叫 `ping` 與 `get_map`。

## 開發與驗證

安裝開發相依性：`npm ci --ignore-scripts`。測試會啟動本機 MCP 子程序；不會啟動或重啟 Pro。

使用 VSCode F5 選擇：

| Configuration | 驗證內容 |
| --- | --- |
| Connector — protocol and pipe tests | 官方 Client、stdio、新舊協定、模擬 Pro、輸入驗證與錯誤處理 |
| Connector — expanded tools tests | 38 個工具分派、schema、舊版 Add-in 防護與 27 種無效輸入 |
| Connector — live MCP read-only test | 對已開啟的 Pro 執行唯讀 MCP 端到端測試 |
| Connector — Inspector read-only test | 官方 Inspector 嚴格工具 schema 檢查與真實 Pro 查詢 |
| ArcGIS Pro — launch installed connector | 開發 Add-in 時建置並啟動 Pro 偵錯 |

F5 的 Add-in 建置只會重新打包，不會更新已安裝的套件。若修改 C#，請先儲存專案並關閉 Pro、安裝新套件，再啟動 Pro。若只修改 MCP 程式，重新連線即可。

供 CI 或已授權的終端機自動化使用：`npm test`、`npm run test:tools`、`npm run test:pro`、`npm run test:inspector`。最後兩項要求已開啟 Pro 並載入 Add-in。`npm test` 會執行兩組模擬測試。

測試報告輸出成 `validation-*.json`，可能包含本機工作階段和圖層名稱，因此不加入版本庫。

### 已完成的驗證

- 官方 MCP Server／Client SDK 2.3.1。
- MCP `2025-11-25` 初始化流程與 `2026-07-28` 新版流程。
- 官方 Inspector 2.11.0 嚴格 schema 檢查。
- 真實 Pro 的地圖、欄位與選取資訊查詢。
- Pro 圖層顯示功能已於初版實測；新版 MCP 的修改工具有模擬測試。
- 0.3.1：真實 Pro 3.3 通過查詢、圖層組織、選取、符號還原、相機與高程、地圖切換、PNG／PDF 地圖匯出，以及五項 GP 白名單操作。測試只修改暫存資料，完成後移除暫存圖層並還原視圖；不儲存專案。資料編輯、save_edits、save_project、export_layout 尚未在隔離專案驗收。

以上是互通性測試，並非官方認證，也未經 Claude 目錄審核。

## 連線與操作限制

- 不開放網路連接埠；每個 Pro processId 有自己的 pipe，同一個 Server 程序內對同一 Pro 的要求會排隊執行。
- Named Pipe 限定同一 Windows 帳號；同帳號本機程式也可能使用此通道。
- 固定工具白名單，不提供任意 Python、C# 或 SQL 執行。
- 資料回傳到 AI 用戶端後，可能送至其模型服務處理。
- 已送到 Pro 的修改不會因用戶端取消或逾時而自動復原。逾時後先查現況，再決定是否重試。
- 只涵蓋已列出的 38 個工作工具，不是整個 Pro SDK 的所有方法。工具適用的圖層型別、資料來源、Pro 授權及編輯能力仍受 SDK 限制。

## 專案結構

```text
server.mjs              官方 SDK 工具註冊與 stdio 入口
tools.mjs               38 個工具定義、schema 與跨參數驗證
bridge.mjs              Named Pipe、排隊、連線重試與逾時
addin/                  C# Add-in、資料／圖層／視圖／GP 操作與 DAML
build.ps1               編譯並產生 .esriAddinX
test*.mjs               模擬、真實 Pro 與 Inspector 測試
.vscode/                開發啟動與建置設定
*-mcp.example.*         用戶端設定範例
```

解除安裝：在 Pro Add-In Manager 移除此 Add-in，並移除 AI 用戶端對應的 MCP 設定。

## 參考

- [Esri ArcGIS Pro SDK](https://developers.arcgis.com/documentation/arcgis-pro-sdk/)
- [官方 MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [官方 MCP Inspector](https://github.com/modelcontextprotocol/inspector)
