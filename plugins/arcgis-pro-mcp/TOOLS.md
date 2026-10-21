# 工具使用指南（0.3.0）

共 38 個 MCP 工具，對應 Pro Add-in 37 個操作（`list_sessions` 由 Node.js 處理）。新增工具需要 Add-in 0.3.0；若仍載入舊版，Server 會回傳升級提示。

## 功能分類

| 分類 | 工具 |
| --- | --- |
| 連線與專案狀態 | `list_sessions`, `ping`, `get_map`, `get_project_state` |
| 屬性、資料來源、柵格 | `get_fields`, `get_selection`, `query_features`, `get_layer_source`, `get_raster_info` |
| 條件選取 | `select_features`, `clear_selection` |
| 縮放與相機 | `zoom_to`, `get_camera`, `set_camera` |
| 符號 | `get_renderer`, `set_simple_renderer`, `set_graduated_renderer`, `restore_renderer` |
| 顯示與名稱 | `set_visibility`, `rename_layer`, `set_transparency` |
| 圖層組織 | `add_layer`, `remove_layer`, `create_group`, `move_layer` |
| 地圖 | `list_maps`, `activate_map` |
| 3D 高程 | `set_layer_elevation`, `set_vertical_exaggeration` |
| 版面與匯出 | `list_layouts`, `export_map`, `export_layout` |
| 地理處理 | `list_geoprocessing_tools`, `run_geoprocessing` |
| 資料編輯 | `update_attributes`, `create_feature` |
| 儲存 | `save_edits`, `save_project` |

所有工具的完整參數、預設值與限制由 `tools/list` 傳回的 schema 提供，原始定義在 `tools.mjs`。不要把本文件中的示例 processId、URI 或欄位名稱直接套在其他專案。

## 基本使用順序

1. `list_sessions` 取得 processId。
2. `ping` 確認 Add-in 版本及支援的 actions。
3. `get_map` 取得目前圖層 URI 與高程表面 URI；名稱可能重複，要使用 URI。
4. 查詢前用 `get_fields` 確認實際欄位。

除了 `list_sessions`，每個工具都需要 processId。針對目前地圖的操作以執行當下的作用中地圖為準；`activate_map` 可先切換目標地圖。

## 查詢與選取

```json
{
  "processId": 123,
  "layerUri": "從 get_map 取得",
  "fields": ["Name", "Length", "Slope"],
  "filters": [{"field": "Length", "operator": "gt", "value": 100}],
  "selectedOnly": false,
  "limit": 100,
  "offset": 0
}
```

`query_features` 回傳屬性，不回傳幾何。最多 1000 筆、50 欄，並受約 4 MiB 序列化字元預算限制；用 `hasMore`、`nextOffset` 繼續查詢。游標順序由資料來源提供，分頁期間請保持資料不變；不保證跨資料變動的穩定頁面。

filters 採 AND，支援 `eq/ne/gt/ge/lt/le/is_null/not_null`；目前比較支援數值及字串，其他型別可做空值篩選。沒有 raw SQL 入口。超過 JavaScript 安全整數範圍的整數請用字串傳遞。

`select_features` 使用相同 filters，或提供 `objectIds` 字串陣列；可指定 `new/add/remove/intersect`。沒有條件與 ID 的選取會被拒絕，避免意外全選。`clear_selection` 可指定圖層，省略 layerUri 則清除目前地圖全部圖徵選取。

## 符號與 3D

`get_renderer`、`set_simple_renderer`、`set_graduated_renderer` 會建立還原 token。`restore_renderer` 只能還原同一個 Pro 工作階段、同一專案、地圖與圖層的快照；最多保留最近 100 個。

分級設色只接受數值欄位，支援 NaturalBreaks、EqualInterval、Quantile，2–20 級及起訖 RGB 顏色。單一符號支援點、線、面、Multipatch；size 對點為大小、線為寬度，不調整面及網格尺寸。

`set_camera` 的 XY／Z 沿用目前相機座標參考與單位，只改傳入的屬性。高程模式支援 on_ground、relative_to_ground、absolute；高程 offset 沿用 Pro 設定的高程單位。`set_vertical_exaggeration` 指定 `get_map` 的高程表面 URI。

## 匯出與地理處理

`export_map`／`export_layout` 支援 PNG、PDF 與 72–600 DPI，要求本機絕對路徑及已存在的父資料夾。輸出副檔名必須相符；寫入前檢查既有目標並拒絕覆寫；替代資料流、保留裝置名稱、結尾句點／空白等 Windows 別名路徑也會被拒絕（見 SECURITY.md「輸出路徑」，地理處理 outputPath 相同）。地圖匯出可指定像素寬高，版面依其頁面尺寸。

`run_geoprocessing` 限定五項：

| tool | 輸入圖層 | 額外參數 |
| --- | --- | --- |
| buffer | 1 | distance、distanceUnit |
| clip | 2，依序為輸入與裁切面 | 無 |
| intersect | 2–10，仍受授權限制 | 無 |
| project | 1 | targetWkid |
| copy_features | 1 | 無 |

需指定新 outputPath 與 `confirm: true`，SDK overwriteoutput 設為 false。輸入的選取及定義查詢可能影響結果。輸出立即落地，不能藉由不儲存 APRX 撤銷；工具不會自動將結果加入地圖，之後可用 `add_layer`。

Project 工具目前不提供自訂 datum transformation；涉及不同 datum 時請先評估轉換需求。地理處理可能超過一般工具時間，AI 用戶端 timeout 建議至少 180 秒；Server 等待 Pro 上限為 120 秒。逾時後先確認輸出現況，再決定是否重試。

## 編輯與儲存

- `update_attributes`：明確指定最多 100 個 Object ID、最多 50 個可編輯欄位，以一個 EditOperation 修改。可提供 expectedValues 做修改前比對；任何一筆不符會拒絕整批。回傳前後值，報告太大時會在執行前拒絕。
- `create_feature`：提供 Esri JSON geometry，座標參考必須與圖徵類別一致；支援 Point／Multipoint／Polyline／Polygon／Multipatch，仍受資料來源及 Pro 編輯能力限制。attributes 可為空，讓資料來源套用預設值。幾何應符合資料集的 Z／M 要求。
- 編輯需要先在 Pro 啟用。使用 Pro 的 EditOperation 與 Undo 記錄，不會自動儲存；不要將工具執行成功等同於已存入資料庫。
- `save_edits`：`confirmAllPendingEdits: true` 明確表示會儲存整個專案所有尚未儲存的資料編輯，包括其他人工作或手動操作產生的編輯。
- `save_project`：`confirmEntireProject: true` 會儲存現有 APRX 的整體地圖／版面設定，不儲存資料編輯。新專案須先在 Pro 手動另存 APRX。

`confirm` 類參數用來表明呼叫意圖，不取代 AI 用戶端本身的工具權限或使用者授權。

## 驗證界線

0.3.0 已完成 Pro 3.3 SDK 編譯、38 工具的新舊 MCP 流程、參數拒絕與舊 Add-in 防護測試，以及官方 Inspector 嚴格 schema 檢查。模擬測試驗證 MCP 的參數、分派與錯誤，不代表已在真實 Pro 執行所有 SDK 操作。

真實環境驗收需在專案副本及測試資料上，安裝 0.3.0 Add-in 後進行。屬性編輯、建立圖徵、地理處理、3D 高程與匯出等新操作尚待此輪真實環境驗證。
