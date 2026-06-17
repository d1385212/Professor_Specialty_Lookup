# 專案任務清單 (Task List)

此清單將作為我們分階段開發的追蹤依據。在您確認完成目前文件後，我們將**一階段一階段**進行實作。

## Phase 1: 專案結構初始化 (Environment Setup)
- [x] 建立 `/project` 根目錄。
- [x] 建立 `/project/server` 資料夾，初始化 `npm init -y`，並安裝後端套件 (`express`, `sqlite3`, `cors`, `axios`, `cheerio`)。
- [x] 建立 `/project/client` 資料夾，透過 Vite 初始化 Vue 專案，並安裝前端套件。

## Phase 2: 爬蟲開發與資料庫建置 (Scraper & Database)
- [x] 於 `/server/db.js` 中撰寫 SQLite 資料庫初始化程式碼 (`teachers` 表格)。
- [x] 於 `/server/scraper.js` 中撰寫爬蟲腳本，抓取 `iecs.fcu.edu.tw/teacher` 網頁。
- [x] 執行爬蟲測試，確認能正確將資工系教授資料清洗並存入 SQLite 中。

## Phase 3: 後端 API 開發 (API Development)
- [x] 於 `/server/server.js` 建立 Express 伺服器與 CORS 設定。
- [x] 實作 `GET /api/teachers` 路由，支援關鍵字 `q` 與分類 `category` 篩選。
- [x] 使用瀏覽器或工具測試 API 回傳的 JSON 格式是否正確。

## Phase 4: 前端介面開發 (Frontend UI)
- [ ] 於 `/client/src/assets/index.css` 撰寫全域 CSS，實作現代化深色玻璃擬物風格。
- [ ] 開發 `SearchBar.vue` 元件 (包含搜尋輸入框與分類過濾按鈕)。
- [ ] 開發 `TeacherCard.vue` 元件 (用於呈現教授照片、姓名、專長標籤等資訊)。

## Phase 5: 前後端整合與測試 (Integration & Polish)
- [ ] 於 `/client/src/App.vue` 實作 Fetch API 呼叫後端取得資料。
- [ ] 將狀態 (Loading, Error, 資料陣列) 綁定至前端元件。
- [ ] 測試點擊分類按鈕與輸入關鍵字時，畫面是否能正確更新。
- [ ] 最終畫面細節微調與除錯。
