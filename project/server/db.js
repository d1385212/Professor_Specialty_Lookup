const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 判斷是否在 Azure 環境 (Azure 自動提供此變數)
const isAzure = !!process.env.WEBSITE_SITE_NAME;

// 如果在 Azure，將資料庫放在可讀寫且不會被部署覆蓋的 /home/data 目錄
const DB_DIR = isAzure ? '/home/data' : __dirname;
const DB_PATH = path.join(DB_DIR, 'teachers.db');

// 【關鍵魔法】如果是 Azure 環境，且 /home/data 裡還沒有資料庫
// 就把 GitHub Actions 剛爬好、一起部署上來的初始資料庫「複製」過去當作基底
if (isAzure && !fs.existsSync(DB_PATH)) {
  const deployedDbPath = path.join(__dirname, 'teachers.db');
  if (fs.existsSync(deployedDbPath)) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.copyFileSync(deployedDbPath, DB_PATH);
    console.log('[DB] 成功將初始資料庫複製到安全且可寫入的目錄！');
  }
}
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] Failed to open SQLite database:', err.message);
  } else {
    console.log('[DB] Connected to SQLite database:', DB_PATH);
  }
});

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS teachers (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL,
          title       TEXT,
          category    TEXT,
          specialties TEXT,
          email       TEXT,
          image_url   TEXT,
          profile_url TEXT
        )`,
        (err) => {
          if (err) {
            reject(err);
          }
        },
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS reviews (
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id            INTEGER NOT NULL,
          department            TEXT,
          kindness_rating       INTEGER NOT NULL CHECK(kindness_rating BETWEEN 1 AND 5),
          recommendation_rating INTEGER NOT NULL CHECK(recommendation_rating BETWEEN 1 AND 5),
          workload_rating       INTEGER NOT NULL CHECK(workload_rating BETWEEN 1 AND 5),
          content               TEXT NOT NULL,
          created_at            TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
        )`,
        (err) => {
          if (err) {
            console.error('[DB] Failed to initialize tables:', err.message);
            reject(err);
          } else {
            console.log('[DB] teachers and reviews tables are ready.');
            resolve();
          }
        },
      );
    });
  });
}

function clearTeachers() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM teachers', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function insertTeacher(teacher) {
  return new Promise((resolve, reject) => {
    const { name, title, category, specialties, email, image_url, profile_url } = teacher;
    const specialtiesStr = Array.isArray(specialties) ? JSON.stringify(specialties) : specialties || '[]';

    db.run(
      `INSERT INTO teachers (name, title, category, specialties, email, image_url, profile_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, title, category, specialtiesStr, email, image_url, profile_url],
      function onInsert(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      },
    );
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

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
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
      }
    });
  });
}

function queryReviews(teacherId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT *
       FROM reviews
       WHERE teacher_id = ?
       ORDER BY datetime(created_at) DESC, id DESC`,
      [teacherId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      },
    );
  });
}

function insertReview(teacherId, review) {
  return new Promise((resolve, reject) => {
    const { department, kindness_rating, recommendation_rating, workload_rating, content } = review;

    db.run(
      `INSERT INTO reviews (
        teacher_id,
        department,
        kindness_rating,
        recommendation_rating,
        workload_rating,
        content
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [teacherId, department, kindness_rating, recommendation_rating, workload_rating, content],
      function onInsert(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      },
    );
  });
}

module.exports = {
  db,
  initDB,
  clearTeachers,
  insertTeacher,
  queryTeachers,
  queryReviews,
  insertReview,
};
