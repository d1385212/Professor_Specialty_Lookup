/**
 * server.js
 * 逢甲資工系教授查詢系統 — Express API 伺服器
 * 啟動方式: node server.js
 */

const express = require('express');
const cors    = require('cors');
const { initDB, queryTeachers } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(express.json());

// CORS：允許前端開發伺服器 (Vite, port 5173) 與任意本機來源存取
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
  ],
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
}));

// ── Helper ────────────────────────────────────────────────
/**
 * 統一成功回應格式
 */
function sendSuccess(res, data, meta = {}) {
  res.json({ success: true, ...meta, data });
}

/**
 * 統一錯誤回應格式
 */
function sendError(res, statusCode, message) {
  res.status(statusCode).json({ success: false, message });
}

// ── Routes ────────────────────────────────────────────────

/**
 * GET /
 * 健康檢查 (Health Check)
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '逢甲大學資工系教授查詢 API 伺服器運行中',
    version: '1.0.0',
    endpoints: {
      teachers:   'GET /api/teachers?q=<keyword>&category=<category>',
      categories: 'GET /api/categories',
    },
  });
});

/**
 * GET /api/teachers
 * 取得教師列表，支援關鍵字搜尋與分類篩選
 *
 * Query Parameters:
 *   q        {string}  關鍵字（姓名、專長模糊搜尋），選擇性
 *   category {string}  分類精確過濾（如: 專任教師），選擇性
 *
 * Response:
 *   { success, total, data: Teacher[] }
 */
app.get('/api/teachers', async (req, res) => {
  try {
    const q        = (req.query.q        || '').trim();
    const category = (req.query.category || '').trim();

    const teachers = await queryTeachers(q, category);

    sendSuccess(res, teachers, { total: teachers.length });
  } catch (err) {
    console.error('[API] /api/teachers 發生錯誤:', err.message);
    sendError(res, 500, '伺服器內部錯誤，請稍後再試');
  }
});

/**
 * GET /api/categories
 * 取得所有可用分類列表（供前端篩選按鈕使用）
 *
 * Response:
 *   { success, data: string[] }
 */
app.get('/api/categories', async (req, res) => {
  try {
    // 從資料庫動態取得所有分類（去重、排序）
    const allTeachers = await queryTeachers('', '');
    const categorySet = new Set(allTeachers.map(t => t.category));

    // 依照指定顯示順序排列
    const ORDER = ['系主任', '特聘教授', '榮譽教授', '專任教師', '兼任教師', '行政教師', '其他'];
    const categories = ORDER.filter(c => categorySet.has(c));

    // 將 Set 中其他未列入 ORDER 的分類補在最後
    categorySet.forEach(c => {
      if (!ORDER.includes(c)) categories.push(c);
    });

    sendSuccess(res, categories);
  } catch (err) {
    console.error('[API] /api/categories 發生錯誤:', err.message);
    sendError(res, 500, '伺服器內部錯誤，請稍後再試');
  }
});

/**
 * 404 處理
 */
app.use((req, res) => {
  sendError(res, 404, `找不到路由: ${req.method} ${req.path}`);
});

// ── 啟動伺服器 ─────────────────────────────────────────────
(async () => {
  try {
    await initDB();
    console.log('[Server] 資料庫初始化完成');

    app.listen(PORT, () => {
      console.log(`[Server] ✅ 伺服器已啟動：http://localhost:${PORT}`);
      console.log(`[Server] API 端點：`);
      console.log(`         GET http://localhost:${PORT}/api/teachers`);
      console.log(`         GET http://localhost:${PORT}/api/teachers?q=機器學習`);
      console.log(`         GET http://localhost:${PORT}/api/teachers?category=專任教師`);
      console.log(`         GET http://localhost:${PORT}/api/categories`);
    });
  } catch (err) {
    console.error('[Server] 啟動失敗:', err);
    process.exit(1);
  }
})();
