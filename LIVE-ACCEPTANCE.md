# 0.3.0 真實 Pro 驗收

狀態：新 SDK 操作尚待執行。0.3.0 已編譯通過並完成 MCP 模擬與 Inspector schema 測試；本次真實 Pro 驗證時仍載入 Add-in 0.1.0，原有查詢與舊版防護通過，新增操作未執行。

## 準備

使用測試用 APRX 與**複製的測試資料**，不要只複製 APRX 卻繼續連到正式 geodatabase。準備一個可編輯的圖徵類別（含字串、數值與 null）、TIFF、2D 地圖、3D 場景及一份版面。確認 Pro 授權可執行要測的 GP 工具。

儲存並關閉原本的 Pro 工作階段，安裝 0.3.0 `.esriAddinX`，正常重新開啟測試專案。重新連線 MCP；用 `ping` 確認版本及 actions。不要手動覆寫正在載入的 DLL。

## 唯讀自動測試

VSCode F5 選 **Connector — live MCP read-only test**，會用官方 Client 經 stdio 查詢連線、地圖、欄位、選取、專案狀態、地圖／版面清單、相機、GP 白名單、屬性、資料來源、符號與第一個 TIFF／RasterLayer（若存在）。

如果仍為舊 Add-in，只驗證原有相容路徑與升級防護，報告會明示新增功能未測。`get_renderer` 會建立暫存快照，不變更地圖符號。

F5 **Connector — Inspector read-only test** 則檢查 schema、工作階段與地圖。自動報告 `validation-*.json` 不加入 Git。

## 操作驗收矩陣

| 類別 | 操作與核對 | 還原方式 |
| --- | --- | --- |
| 屬性查詢 | 選兩筆圖徵，用 selectedOnly 比對屬性表；limit=1 分頁；測 null、單引號及 Int64 字串 | 唯讀 |
| 條件選取 | 數值條件、Object ID、new/add/remove/intersect，核對數量；無條件應被拒絕 | clear_selection |
| 資料來源 | 核對 TIFF 實際路徑；測一個來源失效的圖層 | 唯讀 |
| 柵格 | 比對像元大小、波段、座標參考、範圍與 NoData | 唯讀 |
| 縮放 | full、layer、selection；零選取應明確失敗 | 還原原相機 |
| 相機 | get_camera 後改 heading/pitch，核對 3D；測 2D 適用參數 | 傳回原相機值 |
| 單一符號 | 對測試點／線／面／Multipatch 改色 | restore_renderer token |
| 分級設色 | 數值欄位分五級，核對分類方法及顏色；字串欄位應被拒絕 | restore_renderer token |
| 快照 | 還原正確 token；跨圖層或重新開啟 Pro 後 token 應被拒絕 | 保留測試專案副本 |
| 圖層外觀 | 顯示、名稱、透明度，核對 before/after | 回傳原值 |
| 圖層管理 | 新增資料、建立群組、移入／移出／排序；拒絕群組循環 | 移除測試圖層及群組 |
| 移除圖層 | remove_layer 應只移除 TOC 項目，不刪除資料 | 重新新增來源或重開未儲存的副本 |
| 地圖／版面 | list_maps、activate_map、list_layouts，核對 URI 及作用中視窗 | 切回原地圖 |
| 3D 高程 | 三種模式、offset、表面垂直誇張，與 Pro 圖層屬性核對 | 回填原設定或重開副本 |
| 匯出 | 地圖／版面 PNG/PDF，核對像素／DPI／頁面及可開啟性；既有輸出應被拒絕 | 刪除測試輸出 |
| GP | Buffer、Clip、Intersect、Project、CopyFeatures，核對筆數／範圍／座標系統；既有輸出應失敗 | 僅刪除測試輸出；不動輸入 |
| 更新屬性 | 明確 ID，核對 before/after；expectedValues 不符、唯讀欄位、型別不符時應整批失敗 | Pro Undo，或不儲存資料編輯 |
| 建立圖徵 | 同座標參考及類型幾何；錯誤 SR／類型應失敗；核對預設值及 Z/M 約束 | Pro Undo，或不儲存資料編輯 |
| 儲存資料 | 僅在隔離測試資料上 save_edits，再關閉重開核對 | 從測試資料備份重建 |
| 儲存專案 | save_project 後重開副本，核對圖層／符號／版面；資料編輯仍須分開儲存 | 從 APRX 備份重建 |

測完記錄實際 Pro 版本、資料來源類型及授權；不要把某一個資料來源的成功當成所有來源都已支援。
