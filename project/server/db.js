const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// 判斷是否在 Azure 環境 (Azure 自動提供此變數)
const isAzure = !!process.env.WEBSITE_SITE_NAME;

// Azure 環境：DB 放在 /home/data（持久目錄，不會被部署覆蓋）
// 本地環境：DB 放在 server 目錄下
const DB_DIR = isAzure ? '/home/data' : __dirname;
const DB_PATH = path.join(DB_DIR, 'teachers.db');

let db = null; // sql.js Database instance

/** 將記憶體中的 DB 寫回磁碟 */
function saveDB() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Failed to save database:', err.message);
  }
}

/** 初始化資料庫（載入現有 DB 或建立新的） */
async function initDB() {
  const SQL = await initSqlJs();

  let fileBuffer = null;

  if (isAzure) {
    if (fs.existsSync(DB_PATH)) {
      // Azure 持久目錄已有 DB，直接載入
      fileBuffer = fs.readFileSync(DB_PATH);
      console.log('[DB] Loaded existing database from:', DB_PATH);
    } else {
      // 第一次啟動：把部署包裡的初始 teachers.db 複製過去
      const deployedDbPath = path.join(__dirname, 'teachers.db');
      if (fs.existsSync(deployedDbPath)) {
        fileBuffer = fs.readFileSync(deployedDbPath);
        if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
        fs.writeFileSync(DB_PATH, fileBuffer);
        console.log('[DB] 成功將初始資料庫複製到安全且可寫入的目錄！');
      }
    }
  } else {
    if (fs.existsSync(DB_PATH)) {
      fileBuffer = fs.readFileSync(DB_PATH);
      console.log('[DB] Connected to SQLite database:', DB_PATH);
    }
  }

  if (fileBuffer) {
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new in-memory SQLite database');
  }

  // 建立資料表（若不存在）
  db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    title       TEXT,
    category    TEXT,
    specialties TEXT,
    email       TEXT,
    image_url   TEXT,
    profile_url TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id            INTEGER NOT NULL,
    department            TEXT,
    kindness_rating       INTEGER NOT NULL CHECK(kindness_rating BETWEEN 1 AND 5),
    recommendation_rating INTEGER NOT NULL CHECK(recommendation_rating BETWEEN 1 AND 5),
    workload_rating       INTEGER NOT NULL CHECK(workload_rating BETWEEN 1 AND 5),
    content               TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  )`);

  console.log('[DB] teachers and reviews tables are ready.');
}

function clearTeachers() {
  return new Promise((resolve, reject) => {
    try {
      db.run('DELETE FROM teachers');
      saveDB();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function insertTeacher(teacher) {
  return new Promise((resolve, reject) => {
    try {
      const { name, title, category, specialties, email, image_url, profile_url } = teacher;
      const specialtiesStr = Array.isArray(specialties) ? JSON.stringify(specialties) : specialties || '[]';

      db.run(
        `INSERT INTO teachers (name, title, category, specialties, email, image_url, profile_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, title, category, specialtiesStr, email, image_url, profile_url],
      );

      const result = db.exec('SELECT last_insert_rowid() as id');
      const id = result[0]?.values[0]?.[0];
      saveDB();
      resolve(id);
    } catch (err) {
      reject(err);
    }
  });
}

function parseSpecialties(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function queryTeachers(q, category) {
  return new Promise((resolve, reject) => {
    try {
      let sql = `
        SELECT
          teachers.*,
          COUNT(reviews.id) AS review_count,
          AVG(reviews.kindness_rating) AS kindness_avg,
          AVG(reviews.recommendation_rating) AS recommendation_avg,
          AVG(reviews.workload_rating) AS workload_avg
        FROM teachers
        LEFT JOIN reviews ON reviews.teacher_id = teachers.id
        WHERE 1 = 1
      `;
      const params = [];

      if (q) {
        sql += ' AND (teachers.name LIKE ? OR teachers.title LIKE ? OR teachers.specialties LIKE ?)';
        const like = `%${q}%`;
        params.push(like, like, like);
      }

      if (category && category !== '全部教授') {
        sql += ' AND teachers.category = ?';
        params.push(category);
      }

      sql += ' GROUP BY teachers.id ORDER BY teachers.id ASC';

      const stmt = db.prepare(sql);
      stmt.bind(params);

      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();

      resolve(
        rows.map((row) => ({
          ...row,
          specialties: parseSpecialties(row.specialties),
          reviews: [],
          review_summary: {
            count: row.review_count || 0,
            kindness: row.kindness_avg || 0,
            recommendation: row.recommendation_avg || 0,
            workload: row.workload_avg || 0,
          },
        })),
      );
    } catch (err) {
      reject(err);
    }
  });
}

function queryReviews(teacherId) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(
        `SELECT *
         FROM reviews
         WHERE teacher_id = ?
         ORDER BY datetime(created_at) DESC, id DESC`,
      );
      stmt.bind([teacherId]);

      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();

      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

function insertReview(teacherId, review) {
  return new Promise((resolve, reject) => {
    try {
      const { department, kindness_rating, recommendation_rating, workload_rating, content } = review;

      db.run(
        `INSERT INTO reviews (
          teacher_id, department, kindness_rating, recommendation_rating, workload_rating, content
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [teacherId, department, kindness_rating, recommendation_rating, workload_rating, content],
      );

      const result = db.exec('SELECT last_insert_rowid() as id');
      const id = result[0]?.values[0]?.[0];
      saveDB();
      resolve(id);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  initDB,
  clearTeachers,
  insertTeacher,
  queryTeachers,
  queryReviews,
  insertReview,
};
