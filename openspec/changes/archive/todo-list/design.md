# 系統設計文件 (System Design)

## 1. 系統架構圖 (Architecture)

使用者瀏覽器 (Client) <---> Express 伺服器 (API) <---> SQLite 資料庫

*   **Client**: Vue 3 + Vite, 負責呈現搜尋畫面與結果。使用 Fetch API 或 Axios 呼叫後端 API。
*   **API Server**: Node.js + Express, 接收前端搜尋請求，轉譯為 SQL 語法向 SQLite 查詢，並回傳 JSON 格式結果。
*   **Database**: SQLite, 儲存教授資料。由後台爬蟲腳本定期或一次性寫入。

## 2. 使用者介面設計 (UI/UX)
參考使用者提供的截圖與 `RateMinistere` 專案的現代化網頁設計原則：

1.  **Header**: 網站 Logo 與標題 (FCU IECS Professor Search)。
2.  **Filter Section (篩選區塊)**:
    *   以按鈕群組的方式列出逢甲資工系師資分類：`系主任`、`專任教師`、`兼任教師`、`特聘教授`、`講座教授` 等。
    *   點擊按鈕可快速切換搜尋範圍，選中的按鈕會有視覺反饋 (Active state)。
3.  **Search Bar (搜尋列)**:
    *   置中的大型輸入框，Placeholder 文字設計為：「輸入教授姓名 或 專業領域」。
    *   右側附帶「搜尋」按鈕圖示。
4.  **Results Section (搜尋結果區塊)**:
    *   以卡片 (Card) 網格形式呈現。
    *   每筆資料包含：教授照片(若無則顯示預設頭像)、姓名、職稱、專業領域標籤 (Tags)、聯絡信箱及系網個人頁面連結。

## 3. 資料庫結構設計 (Database Schema)

採用單一表格設計，確保查詢效率。

### Table: `teachers`
| 欄位名稱 (Column) | 型別 (Type) | 說明 (Description) |
| :--- | :--- | :--- |
| `id` | INTEGER | 主鍵 (Primary Key, Auto Increment) |
| `name` | TEXT | 教授姓名 |
| `title` | TEXT | 職稱 (例如: 教授, 副教授) |
| `category` | TEXT | 分類 (例如: 專任教師, 兼任教師, 系主任) |
| `specialties` | TEXT | 專業領域 (以 JSON 陣列字串儲存，方便前端呈現 Tag) |
| `email` | TEXT | 聯絡信箱 |
| `image_url` | TEXT | 教授照片網址 |
| `profile_url` | TEXT | 學校個人介紹網頁連結 |

## 4. 樣式設計 (Styling)
*   **純 CSS (Vanilla CSS)**: 完全使用原生 CSS 進行排版與美化，不引入 Tailwind 等框架。
*   **現代化美學**: 實作深色模式 (Dark Mode)、玻璃擬物化 (Glassmorphism) 卡片設計，並加入 Hover 懸浮微動畫提升質感。
*   利用 Flexbox 與 CSS Grid 進行版面配置，並具備響應式設計 (RWD)。
