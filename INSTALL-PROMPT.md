# 交給 AI 的安裝提示詞

已安裝的使用者請改用 [更新提示詞](UPDATE-PROMPT.md)，保留既有設定與安裝來源。

先選擇能存取本機檔案與執行本機程式的 AI 客戶端。純網頁對話無法直接安裝。此專案在 Windows 執行，使用者需自行具備合法 ArcGIS Pro 授權。

將以下整段貼給 Codex、Claude Code、Cursor 或其他具本機操作能力的 AI。不要把 GitHub 網址直接當成遠端 HTTP MCP URL。

```text
請幫我安裝 ArcGIS Pro MCP：
https://github.com/joshisman0925/arcgis-pro-mcp

請先閱讀這個 repo 的 README.md、COMPATIBILITY.md、PRIVACY.md 與 SECURITY.md，
再按以下範圍執行。這是本機 stdio MCP，另需在 Pro 安裝 C# Add-in。

1. 檢查原生 Windows、ArcGIS Pro 版本、目前 AI 軟體是否支援本機 stdio MCP，
   以及 Node.js 是否至少 20。不要在 WSL/Linux 中啟動這個 Named Pipe server。
   安裝前先向我說明：資料可能送到模型服務、通道信任同一 Windows 帳號，
   confirm 參數不取代使用者授權；查詢應指定必要欄位，整體儲存可能包含人工編輯。
   若缺必要程式，說明缺什麼，使用官方來源；不要靜默安裝未授權的軟體。
   Pro 3.3 是已測基準；較新 3.x 是待驗證的相容候選；3.0–3.2/2.x 不適用此 binary。

2. 優先下載 GitHub Releases 的 v0.3.2 發行檔與 SHA256SUMS，
   驗證 SHA-256，再解壓到使用者可寫的固定位置，例如
   %LOCALAPPDATA%\Programs\ArcGISProMcp\0.3.2。
   發行檔已包含 MCP dependencies 與編譯好的 Pro Add-in，
   不需 Git、npm install、.NET SDK 或自行編譯。
   若發行檔不可取得，先說明；只有我明確選擇從原始碼建置時才改走開發流程。
   不要求我貼 token 或密碼；若 repo/下載需要登入，使用系統已登入的 GitHub 工具。

3. Windows ZIP 解壓後，Plugin 根目錄為 plugins/arcgis-pro-mcp。
   檢視該根目錄內 scripts/install-addin.ps1，先執行 -CheckOnly。
   只有需要更新 Add-in 時，請我先儲存並關閉 Pro；不要 kill、不要代我儲存 GIS 編輯。
   關閉後執行安裝腳本。只安裝此套件自己的 Add-in，保留舊包備份，
   不停用組織安全政策、不更動防火牆、不修改 GIS 資料。

4. 依我使用的 AI 軟體設定，先備份並只合併此 MCP 的設定，
   不覆寫既有 servers 或使用者偏好，不同時安裝 Plugin 與重複的手動 MCP entry：

   - Codex：優先使用此 repo 的 marketplace 與 arcgis-pro-mcp Plugin。
     若已安裝 Git 且要追蹤 repo，可執行：
     codex plugin marketplace add joshisman0925/arcgis-pro-mcp
     codex plugin add arcgis-pro-mcp@joshisman-gis
     若使用下載的 Windows 發行 ZIP，裡面已有 .agents/plugins/marketplace.json，
     使用 codex plugin marketplace add <解壓根目錄>，再安裝同名 plugin。

   - Claude Code：依已安裝 CLI 的 help，使用：
     claude mcp add --transport stdio --scope user arcgis-pro-local -- <node.exe完整路徑> <server.bundle.mjs完整路徑>

   - Claude Desktop：依版本確認支援的本機 MCP 設定入口，
     在 mcpServers 合併 command 與 args；不要將它加成 HTTPS custom connector。

   - Cursor、VSCode/Copilot 或其他客戶端：查該軟體目前官方文件，
     使用其本機 stdio MCP 格式；不要假設所有軟體都用 mcpServers 這個根鍵。

   通用啟動參數為：
   command = node.exe 的完整路徑
   args = [Plugin 根目錄中 server/server.bundle.mjs 的完整路徑]
   地理處理可能較久，支援設定 timeout 時用至少 180 秒。
   程式由 AI 客戶端管理，不要另外手動常駐一份。

5. 請我正常開啟 Pro、開啟地圖並重新連接 MCP。
   安裝及日常使用不需要 VSCode F5。
   請透過真正的 MCP transport 呼叫 list_sessions、ping、get_map 做唯讀驗證，
   確認載入的 Add-in 版本及 actions，不把複製檔案成功當成連線成功。
   不要以編輯資料、儲存全部 edits 或任意執行 Python/C# 作為安裝測試。

6. 回報安裝位置、Pro/Node/Add-in/MCP 版本、AI 設定入口、驗證結果，
   以及如何更新和解除安裝。未完成的步驟要明確說明。
```

若 AI 無法讀取 repo，可以直接下載這份文件後提供給它。GitHub Release 是公開分發來源；OpenAI 官方目錄是否上架是另一個審核流程，不影響直接安裝本機套件。
