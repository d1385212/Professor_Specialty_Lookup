const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'teachers.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] 無法開啟資料庫:', err.message);
  } else {
    console.log('[DB] 成功連線至 SQLite 資料庫:', DB_PATH);
  }
});

/**
 * 初始化資料庫：建立 teachers 資料表（若不存在）
 */
function initDB() {
  return new Promise((resolve, reject) => {
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
          console.error('[DB] 建立資料表失敗:', err.message);
          reject(err);
        } else {
          console.log('[DB] teachers 資料表已就緒');
          resolve();
        }
      }
    );
  });
}

/**
 * 清空 teachers 資料表（爬蟲重新執行前使用）
 */
function clearTeachers() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM teachers', (err) => {
      if (err) {
        console.error('[DB] 清空資料失敗:', err.message);
        reject(err);
      } else {
        console.log('[DB] teachers 資料表已清空');
        resolve();
      }
    });
  });
}

/**
 * 插入一筆教授資料
 * @param {Object} teacher - { name, title, category, specialties, email, image_url, profile_url }
 */
function insertTeacher(teacher) {
  return new Promise((resolve, reject) => {
    const { name, title, category, specialties, email, image_url, profile_url } = teacher;
    const specialtiesStr = Array.isArray(specialties)
      ? JSON.stringify(specialties)
      : specialties || '[]';

    db.run(
      `INSERT INTO teachers (name, title, category, specialties, email, image_url, profile_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, title, category, specialtiesStr, email, image_url, profile_url],
      function (err) {
        if (err) {
          console.error('[DB] 插入資料失敗:', err.message);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

/**
 * 查詢所有教授（支援 keyword 與 category 過濾）
 * @param {string} q        - 關鍵字（姓名、職稱、專長模糊搜尋）
 * @param {string} category - 分類精確過濾
 */
function queryTeachers(q, category) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM teachers WHERE 1=1';
    const params = [];

    if (q) {
      sql += ` AND (name LIKE ? OR title LIKE ? OR specialties LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (category && category !== '全部') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ' ORDER BY id ASC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[DB] 查詢失敗:', err.message);
        reject(err);
      } else {
        // 將 specialties JSON 字串還原為陣列
        const parsed = rows.map((row) => ({
          ...row,
          specialties: (() => {
            try { return JSON.parse(row.specialties); }
            catch { return []; }
          })()
        }));
        resolve(parsed);
      }
    });
  });
}

module.exports = { db, initDB, clearTeachers, insertTeacher, queryTeachers };
