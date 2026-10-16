# ArcGIS Pro 版本相容性策略

維護**一套 MCP**。MCP 協定、工具 schema 與 AI 客戶端設定，不隨 Pro 小版本複製。差異集中在 C# Add-in 所引用的 SDK、目標 .NET runtime 與個別 API。

| Pro 版本 | runtime／SDK 差異 | 本專案策略 | 驗證狀態 |
| --- | --- | --- | --- |
| 2.x | 與 3.x 有破壞性 API 差異 | 不支援；有明確需求才獨立實作舊版 Add-in | 未測 |
| 3.0–3.2 | .NET 6；無法載入本版 .NET 8 binary | 若需要，使用實際舊 SDK 建立 net6 Add-in 相容 target，MCP 沿用 | 未提供 binary，未測 |
| 3.3 | .NET 8 | 目前最低編譯基準，使用同一套 Add-in | 本機 Pro 3.3.0.52636 實測 |
| 3.4–3.6 | .NET 8；官方前向相容原則 | 先用同一個 3.3 編譯套件驗證，沒有必要不分支 | 尚未在本機測試 |
| 3.7 | Pro runtime 轉至 .NET 10；重新引用 3.7 SDK 編譯需 net10 | 官方說已部署的 3.0–3.6 Add-in 可在 3.7 執行；先驗證現有 binary，有需求才新增編譯 target | 尚未在本機測試 |
| 其他未來主版本 | 尚未查證 | 安裝腳本拒絕，先做相容性評估 | 不宣稱支援 |

不能只改 Config.daml 的 desktopVersion 來假裝支援舊 Pro。`desktopVersion=3.3.0` 是目前編譯基準，不是 MCP 工具版本。

## 什麼情況才建立版本差異

1. 實際存在不能載入的 runtime 差異（例如需要支援 Pro 3.2）。
2. 使用者的版本真的缺少某個公開 API，且無法由共用 API 完成相同行為。
3. 有重現案例及對應版本測試資料，可驗證不同分支。

有差異時優先在同一份 C# 原始碼使用 target framework、SDK reference 路徑與少量相容 adapter；以 capability actions 告知 MCP 可用功能。不要為 3.3、3.4、3.5 各複製一份 Node.js Server。

目前僅安裝了 3.3 SDK，沒有拿 3.3 DLL 假冒舊版編譯，也沒有產出未測試的 3.2 或 3.7 專用套件。

## 官方依據

- [Esri SDK FAQ：.NET 8、.NET 10、3.x 前向相容與 2.x 遷移](https://doc.esri.com/en/arcgis-pro/latest/sdk/api-reference/conceptdocs/docs/FAQ.html)
- [Esri SDK Releases](https://github.com/Esri/arcgis-pro-sdk/releases)

官方前向相容宣告不等同於本專案已跑過各版本驗收；釋出紀錄必須分開標示。
