# 系統規格書 (System Specifications)

## 1. 開發環境與技術限制
*   **前端框架**: Vue 3 (使用 Vite 作為建置工具)。
*   **後端框架**: Node.js + Express.js。
*   **資料庫**: SQLite3。
*   **語言限制**: 僅限使用 HTML, CSS, JavaScript (禁用 TypeScript)。
*   **樣式限制**: 強制使用原生 CSS (Vanilla CSS)，禁用 TailwindCSS 等外部 CSS 框架。

## 2. 目錄結構 (Directory Structure)
```text
/project
│
├── /server                 # 後端 API 伺服器
│   ├── package.json
│   ├── server.js           # Express 進入點與 API 路由
│   ├── db.js               # SQLite 連線與初始化設定
│   └── scraper.js          # 資料爬蟲腳本 (負責解析 IECS 網頁)
│
└── /client                 # 前端 Vue 應用程式
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── /src
    │   ├── main.js         # Vue 進入點
    │   ├── App.vue         # 根元件 (包含狀態管理與 API 呼叫)
    │   ├── /components     # UI 元件 (SearchBar.vue, TeacherCard.vue)
    │   └── /assets         # 靜態資源與全域 CSS (index.css)
```

## 3. 爬蟲規格 (Scraper Specification)
*   **套件使用**: `axios` (發送 HTTP 請求), `cheerio` (解析 HTML DOM)。
*   **目標網址**: `https://www.iecs.fcu.edu.tw/teacher/#FT`
*   **資料清洗**: 
    *   從 `<div class="isotope-item ...">` 中擷取教授類別 (`category`)。
    *   解析 `<h3>` 取得姓名，過濾掉歷史徽章等雜訊。
    *   解析內文取得「職稱」、「信箱」以及「研究專長」。
    *   將相對路徑的圖片網址與個人頁面網址補齊為絕對路徑。

## 4. API 規格定義 (API Specification)

所有 API 皆以 JSON 格式回應。

### 4.1. 取得資工系教授列表
*   **Endpoint**: `GET /api/teachers`
*   **Query Parameters**:
    *   `q` (字串, 選擇性): 關鍵字搜尋 (對應姓名、職稱、專業領域進行模糊搜尋)。
    *   `category` (字串, 選擇性): 指定分類過濾 (如: 專任教師)。
*   **Response (Success)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "name": "陳錫民",
          "title": "教授兼系主任",
          "category": "系主任",
          "specialties": ["軟體工程", "DevOps技術", "服務導向運算"],
          "email": "hsiminc@fcu.edu.tw",
          "image_url": "https://www.iecs.fcu.edu.tw/...",
          "profile_url": "https://www.iecs.fcu.edu.tw/..."
        }
      ]
    }
    ```
