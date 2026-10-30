# 持續維護計畫

更新日期：2026-10-30（Asia/Taipei）。每週五 03:00 接續，每次優先完成一項可驗證改善。進度與實際驗證見 maintenance-log.md。

| 優先 | 工作 | 驗收條件 | 依賴／阻礙 |
| --- | --- | --- | --- |
| P0 | 修正工具外部存取宣告 | 遠端資料相關工具不宣告封閉環境；兩種 MCP 模式發現結果一致 | 2026-10-20 已重建 Plugin、加 bundle 一致性測試並開 PR；本機 F5 未跑，以 PR CI（Windows）驗證 |
| P0 | 審查 Pipe、輸入／路徑驗證與寫入授權 | 每項發現附程式證據、必要拒絕案例與驗證結果 | 不能把 confirm 參數當成人員授權。2026-10-22：Pipe 已限同帳號；MCP 端 outputPath 已擋 Win32 別名路徑。剩 Add-in NewOutput 同等檢查與網路磁碟機（需 Pro SDK 建置） |
| P0 | 依賴與供應鏈巡檢 | 記錄漏洞來源、影響及修復證據；不盲升主版本 | 2026-10-23：npm audit 0 漏洞；lockfile 181 套件皆 HTTPS＋sha512，已加 CI 檢查。後續每週記錄 audit 結果 |
| P1 | 同步驗收文件與隔離測試 | README、TOOLS、LIVE-ACCEPTANCE 狀態一致；編輯、儲存及版面匯出有隔離資料驗收 | 2026-10-23 文件已同步 0.3.1 實測證據。剩編輯／儲存／export_layout 隔離驗收，需測試 APRX（含版面）、複製資料與 Pro F5 |
| P1 | 安裝更新及打包驗證 | F5 協定、工具及隔離 Plugin 測試通過；版本及校驗值相符 | 原始碼修正不會自動更新已打包／已安裝 Plugin |
| P2 | GIS skills | 盤點現有 skills，選一項高價值流程，包含觸發條件、資料最小化及成功／拒絕案例 | 使用 skill-creator，沿用 plugin-template 建置流程 |
| P2 | 官方提交準備 | 分開列 OpenAI Plugin 目錄、MCP Registry、自訂市集要求；附官方來源、日期、資格與剩餘材料 | 2026-10-23 已查核並寫入 PUBLISHING.md。2026-10-30：5 正／3 負案例、release notes 草稿與 manifest 上限檢查已完成（docs/submission）。阻礙：OpenAI 允許名單與身分驗證（需使用者）；拋棄式 fixture 已可由 scripts/create-review-fixture.py 產生（D:/review），待在 Pro 開啟後實跑；操作影片（需使用者）；MCP Registry 需公開 npm 套件（需使用者決定） |

每次執行（每週五）查核官方規範，有實質進度時提供週摘要。公開發布、遠端操作及正式提交先備妥可審閱成果，再依授權規則辦理。

## 驗證規則

本機測試及啟動使用 .vscode/launch.json 的 VSCode F5 設定。不能操作 F5 時記錄未測，不改用終端測試。只在拋棄式資料驗證修改操作，不儲存使用者待存編輯。保留未提交修改；不將私人 GIS 資料或 validation 報告加入版本庫。
