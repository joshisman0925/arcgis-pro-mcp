# 發布與官方目錄

## GitHub 與 Codex 自訂市集

本專案採 MIT 授權。預先打包的 Plugin 位於 `plugins/arcgis-pro-mcp`，市集索引位於 `.agents/plugins/marketplace.json`。

```text
codex plugin marketplace add joshisman0925/arcgis-pro-mcp
codex plugin add arcgis-pro-mcp@joshisman-gis
```

安裝後執行 Plugin 的 setup skill，檢查 Pro、備份並安裝 Add-in。Node.js 20+ 必須事先安裝。請參考 INSTALL-PROMPT.md。既有手動 MCP 設定應先備份，完成驗證後只保留一個連線來源。

## OpenAI 官方目錄

自訂市集可安裝不等於已通過官方目錄審核。目前包含 local MCP 的 desktop-only plugins 只接受已獲核准的合作夥伴；OpenAI organization 必須先列入允許名單，並完成發布者身分驗證。需要由組織管理者透過 OpenAI 聯絡窗口取得資格，再在平台提交。此專案沒有宣稱已取得資格或通過審核。

準備的 `arcgis-pro-mcp-plugin-0.3.1.zip` 以 Plugin 本身為根目錄，包含 portable manifest、MCP、skills、原生套件及授權。提交前再次確認入口網站對 ZIP 格式與本機 MCP 的最新規定。公開網址、隱私說明與 MIT 授權已包含在 manifest；沒有生命週期 hooks。審核者仍需 Windows、Node.js 和已授權的 ArcGIS Pro。

官方來源：

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/plugins/deploy/submission

## 提交資格查核（2026-10-23）

三條管道分開看，自訂市集可安裝不等於官方收錄：

| 管道 | 目前要求（官方來源） | 本專案狀態 |
| --- | --- | --- |
| OpenAI 官方 Plugin 目錄 | 本機 stdio MCP 只限核准合作夥伴：須由 OpenAI 窗口把 organization ID 列入允許名單，完成個人／企業身分驗證；入口網站選「Skills only」上傳含本機 MCP 設定的 ZIP。另需 logo／composerIcon、網站／支援／隱私／條款四個 HTTPS 網址、5 個正向與 3 個負向測試案例、可供審核者觀看的操作影片、release notes 與政策聲明；不可含 lifecycle hooks、apps 參照或憑證；每個 Plugin 只能一個 MCP Server。來源：[submission](https://developers.openai.com/plugins/deploy/submission)、[desktop-only](https://developers.openai.com/plugins/deploy/desktop-only) | 套件結構、圖示、四個網址、單一 stdio MCP、無 hooks 已具備。**阻礙**：organization 未列入允許名單、身分驗證未完成（需使用者／組織管理者向 OpenAI 申請）；測試案例、操作影片與 release notes 尚未備妥；資料編輯／儲存工具尚未真實驗收（見 LIVE-ACCEPTANCE.md） |
| MCP Registry | 只存 metadata：套件須先發布到公開 registry（npm 等），package.json 加 `mcpName`，以 `mcp-publisher` 送出 server.json（name 與 mcpName 相同、描述 ≤100 字元、transport stdio）；GitHub 登入時名稱須為 `io.github.<帳號>/…`。來源：[quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) | 尚未發布 npm（package.json 為 private），也沒有 server.json。另需注意 MCP Server 單獨安裝不含 Pro Add-in，使用者仍須另外安裝 Add-in。是否發布 npm 套件需使用者決定 |
| 自訂市集（GitHub） | 本 repo 的 `.agents/plugins/marketplace.json`，見上方指令 | 可用；非官方收錄 |

下次查核時重新開啟以上連結，記錄差異與查核日期。

## 維護者建置與驗證

以 VSCode 建置工作產生 Add-in，然後執行 `Build portable plugin` 工作。F5 有協定、工具、真實 Pro、Plugin bundle 等驗證設定。測試只連接已開啟的 Pro；不會啟動或終止 Pro。

`scripts/package-release.ps1` 將 Plugin、Windows 市集版、獨立 Add-in 與 SHA256SUMS 寫入 `dist/`。Plugin 發行版本同步於 package.json 與 manifests；MCP Server 與 Add-in 依各自變更決定版本，原生套件校驗資訊必須符合實際 DLL／DAML。發布前跑完驗證並檢查 diff，避免加入私人 GIS 資料或 validation 報告。Release 建置會映射來源路徑並關閉 PDB；CI 的 `scripts/check-package-privacy.ps1` 檢查發布 DLL 不含本機絕對路徑。

## PR 與中央檢覈

從功能分支開 PR 至 `main`，不得直接推送。`.github/workflows/ci.yml` 與 `security.yml` 呼叫 `singi0771/ci-standards@v2`，沿用中央版更新；非 Python／Docker 專案關閉對應檢查，開啟 workflow lint 與所有中央安全掃描。Dependabot 管理 npm 與 GitHub Actions 更新。

另外的 Windows `Connector tests` 執行協定與工具模擬測試、隔離 Plugin 測試及 DLL 路徑檢查，不啟動 ArcGIS Pro。C# 完整建置與真實 Pro 驗證仍需本機 SDK／Pro，透過 VSCode 建置工作與 F5 執行；GitHub runner 不附帶 Esri SDK。

主分支的 required checks 應使用 GitHub 實際回報的 `ci / CI Gate`、`security / Security Gate` 與 `Connector tests`。要求 PR、對話已解決、禁止 force push／刪除，且不設 bypass actor。Required approvals 為 0，允許單人維護者經 PR 並通過檢查後合併；這不等同強制另一人審核。
