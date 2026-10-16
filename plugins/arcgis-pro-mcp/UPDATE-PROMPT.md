# 交給 AI 的更新提示詞

適用於已有 ArcGIS Pro MCP 的使用者。使用能操作本機 Windows 檔案與程式的 AI；第一次安裝請用 [安裝提示詞](INSTALL-PROMPT.md)。

```text
請幫我更新 ArcGIS Pro MCP：
https://github.com/joshisman0925/arcgis-pro-mcp

先閱讀目標版本的 README.md、COMPATIBILITY.md、PRIVACY.md、SECURITY.md 與發行說明。
更新前簡要提醒：資料可能送到模型服務、通道信任同一 Windows 帳號，
confirm 參數不取代使用者授權；查詢只取必要欄位，儲存可能包含人工編輯。
這是本機 stdio MCP，另有安裝在 ArcGIS Pro 的 C# Add-in，兩者須分別確認。

1. 先查目前安裝來源、MCP 設定實際指向的位置、Plugin/MCP 版本、
   Pro 與 Node.js 版本。若 Pro 已開啟且 MCP 可用，用 list_sessions、ping
   記錄每個相關工作階段載入的 Add-in 版本與 actions；不要為檢查強制啟動 Pro。
   不要把 repo 最新 commit、下載成功或磁碟上的版本當成執行中版本。

2. 按既有來源更新，不另裝第二份 MCP：
   - Marketplace Plugin：先查看目前客戶端的官方說明或 CLI help，
     使用其支援的 marketplace 同步與 plugin 更新流程。不要猜測 update 指令，
     不直接修改客戶端管理的 plugin cache。同步 marketplace 不等於已更新 plugin，
     必須確認實際啟用的套件版本與位置。
   - Windows ZIP：找 GitHub Releases 最新正式版（排除 draft/prerelease），
     下載 Windows ZIP 與同版 SHA256SUMS，核對該檔案 SHA-256。
     解壓到使用者可寫的全新版本目錄，保留舊目錄；不要覆蓋正在使用的套件。
     ZIP 內 Plugin 根目錄為 plugins/arcgis-pro-mcp。
     若原本是本機 marketplace，使用客戶端支援的方式更新來源與套件；
     若是手動 MCP 設定，先備份，只將此 connector 的路徑切換到新版。
   - 原始碼：先查工作目錄與分支狀態，保留本機變更，不 reset、不強制覆蓋。
     說明正式發行包與自行建置的差別；只有我選擇繼續原始碼流程才建置。
   無法確認來源、校驗失敗或下載不可用時，保留原安裝並回報原因。
   不要求我貼 token 或密碼；需要登入時使用既有的 GitHub 登入工具。

3. 確認新版套件完整後，檢視其 scripts/install-addin.ps1 與 native/checksums.json。
   執行同一支安裝／更新腳本，先加 -CheckOnly，查看 installedVersion、packageVersion、
   packageAlreadyMatches、updateRequired 與 downgradeBlocked。
   套件相同就跳過複製；若舊來源帶的 Add-in 比已安裝版本更舊，停止並取得正確套件，
   不自動降版。Pro 3.3 為實測基準；後續 3.x 仍須如實說明驗證範圍。

4. 只有 Add-in 需要更換時，請我儲存工作並關閉所有 Pro 工作階段。
   不 kill Pro、不代我儲存 GIS 編輯。關閉後執行相同腳本，不加 -CheckOnly。
   腳本只更新自己的 Add-in，並備份舊套件。不要繞過組織簽章政策。
   如果需等待我關閉 Pro，保留進度並明確說明尚未完成。

5. 讓客戶端重新載入 MCP；需要時請我正常開啟 Pro 與地圖。
   經真正 MCP transport 呼叫 list_sessions、ping、get_map，核對 MCP 初始化版本、
   各相關 Pro 工作階段的 Add-in 版本及目標工具 actions。不要用資料編輯或儲存作為測試。
   安裝及日常使用不需要 VSCode F5；開發專案的啟動／測試遵循該專案 launch.json。

6. 回報更新前後版本、套件來源、啟用路徑、設定與 Add-in 備份位置、驗證結果。
   失敗時不要宣稱更新成功，說明是否已切換設定或更新 Add-in。
   回復時需將 MCP 設定／Plugin 與相容的 Add-in 一起考慮；保留先前套件及備份。
   手動還原 Add-in 前同樣先關閉 Pro，不直接修改客戶端 plugin cache。
   不刪除舊版與備份，除非我另行要求。
```

更新由使用者發起；此流程不會背景自動下載、強制關閉 Pro 或自動降版。安裝與更新共用 `scripts/install-addin.ps1`，不需另一套更新 EXE。
