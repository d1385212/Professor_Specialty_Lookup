/**
 * scraper.js
 * 逢甲大學資工系師資爬蟲腳本
 * 執行方式: node scraper.js
 *
 * 實際 HTML 結構（逢甲資工系）：
 *   .isotope-item 的 class 包含分類關鍵字：
 *     major       → 系主任 (現任 + 歷任)
 *     FT          → 專任教師
 *     PT          → 兼任教師 (Part-time)
 *     CP / DP     → 特聘/兼任特聘教授 (皆含 FT)
 *     Honor       → 榮譽教授
 *     administration → 行政教師
 *     retiree     → 退休教師
 *
 *   每筆資料欄位用 <strong class="iecs-darkfont"> 包裹：
 *     "信箱：xxx@fcu.edu.tw"
 *     "研究專長：A、B、C"
 *     "職稱：教授"
 *     "分機：#XXXX"
 */

const axios    = require('axios');
const cheerio  = require('cheerio');
const { initDB, clearTeachers, insertTeacher } = require('./db');

const BASE_URL   = 'https://www.iecs.fcu.edu.tw';
const TARGET_URL = `${BASE_URL}/teacher/`;

/** class 關鍵字 → 中文分類（priority 順序很重要） */
const CATEGORY_RULES = [
  // 注意：CP/DP 同時含 FT，需要先判斷
  { key: 'major',          label: '系主任'   },
  { key: 'CP',             label: '特聘教授'  },
  { key: 'DP',             label: '特聘教授'  },
  { key: 'Honor',          label: '榮譽教授'  },
  { key: 'FT',             label: '專任教師'  },
  { key: 'PT',             label: '兼任教師'  },
  { key: 'administration', label: '行政教師'  },
  { key: 'retiree',        label: '退休教師'  },
];

/**
 * 從 class 字串解析出最優先的分類
 */
function parseCategory(classStr) {
  for (const rule of CATEGORY_RULES) {
    // 用空白邊界做精確比對，避免 "FT" 誤匹配 "isotope-item"
    if (new RegExp(`(^|\\s)${rule.key}(\\s|$)`).test(classStr)) {
      return rule.label;
    }
  }
  return '其他';
}

/**
 * 補齊相對路徑為絕對 URL
 */
function toAbsUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * 解析「研究專長」字串為陣列
 * 支援：、，,/；\n 作為分隔符
 */
function parseSpecialties(text) {
  if (!text) return [];
  return text
    .replace(/研究專長[：:：]?\s*/i, '')
    .split(/[、，,\/；;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 60);
}

/**
 * 主爬蟲函式
 */
async function scrape() {
  console.log('[Scraper] 開始抓取教師資料...');
  console.log(`[Scraper] 目標網址: ${TARGET_URL}`);

  // ── 1. 抓取 HTML ──────────────────────────────────────
  let html;
  try {
    const response = await axios.get(TARGET_URL, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    html = response.data;
    console.log('[Scraper] 網頁抓取成功，HTML 大小:', html.length, 'bytes');
  } catch (err) {
    console.error('[Scraper] 無法抓取網頁:', err.message);
    process.exit(1);
  }

  // ── 2. 解析 HTML ──────────────────────────────────────
  const $ = cheerio.load(html);
  const teachers = [];

  $('.isotope-item').each((index, el) => {
    const $el = $(el);
    const classStr = $el.attr('class') || '';

    // ── 分類 ────────────────────────────────────────────
    const category = parseCategory(classStr);

    // 跳過「退休教師」區塊（非現任師資）
    if (category === '退休教師') return;

    // ── 個人頁面 URL ─────────────────────────────────────
    // href="/teacher/陳錫民"
    const profileHref = $el.find('a').filter((i, a) => {
      const href = $(a).attr('href') || '';
      return href.startsWith('/teacher/') && href !== '/teacher/';
    }).first().attr('href') || '';
    const profile_url = toAbsUrl(profileHref);

    // ── 姓名 ────────────────────────────────────────────
    // 從 <h3> 取出，移除 badge 等雜訊
    const $h3 = $el.find('h3').first().clone();
    $h3.find('span, small, .badge, .label, strong').remove();
    let name = $h3.text().trim().replace(/\s+/g, '');

    // 若 h3 抓不到，從 profile_url 路徑取
    if (!name && profileHref) {
      name = decodeURIComponent(profileHref.replace('/teacher/', '').replace(/\/$/, ''));
    }

    if (!name) return; // 仍無姓名則跳過

    // ── 圖片 ─────────────────────────────────────────────
    const imgSrc = $el.find('img').first().attr('src') || '';
    const image_url = toAbsUrl(imgSrc);

    // ── 欄位解析（信箱、職稱、研究專長）───────────────────
    // 欄位格式：<strong class="iecs-darkfont">職稱：教授</strong>
    // 或 純文字段落
    let title = '';
    let email = '';
    let specialtiesText = '';

    $el.find('strong.iecs-darkfont').each((i, strongEl) => {
      const text = $(strongEl).text().trim();

      if (!email) {
        const emailMatch = text.match(/信箱[：:：]?\s*([\w.+%-]+@[\w.-]+\.[a-z]{2,})/i);
        if (emailMatch) email = emailMatch[1].toLowerCase();
      }

      if (!title) {
        const titleMatch = text.match(/職稱[：:：]?\s*(.+)/i);
        if (titleMatch && titleMatch[1].length < 30) {
          title = titleMatch[1].trim();
        }
      }

      if (!specialtiesText) {
        if (text.includes('研究專長')) {
          specialtiesText = text;
        }
      }
    });

    // 若 strong 取不到信箱，嘗試從全文正規化取
    if (!email) {
      const fullText = $el.text();
      const emailMatch = fullText.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i);
      if (emailMatch) email = emailMatch[0].toLowerCase();
    }

    // 若職稱仍未取得，使用分類推測
    if (!title) {
      const titleMap = {
        '系主任': '教授兼系主任',
        '特聘教授': '特聘教授',
        '榮譽教授': '榮譽教授',
        '專任教師': '教授',
        '兼任教師': '兼任教師',
        '行政教師': '教師',
      };
      title = titleMap[category] || '';
    }

    // 研究專長：也嘗試從整個卡片的文字中找
    if (!specialtiesText) {
      const fullText = $el.text();
      const m = fullText.match(/研究專長[：:：]?\s*([^\n]{3,200})/);
      if (m) specialtiesText = m[0];
    }

    const specialties = parseSpecialties(specialtiesText);

    teachers.push({
      name,
      title,
      category,
      specialties,
      email,
      image_url,
      profile_url,
    });
  });

  console.log(`[Scraper] 共解析出 ${teachers.length} 位教師資料`);

  // ── 3. 分類統計 ──────────────────────────────────────
  const stats = {};
  teachers.forEach(t => {
    stats[t.category] = (stats[t.category] || 0) + 1;
  });
  console.log('[Scraper] 分類統計:', stats);

  if (teachers.length === 0) {
    console.error('[Scraper] 警告：未解析到任何教師！');
    return;
  }

  // ── 4. 寫入資料庫 ─────────────────────────────────────
  console.log('\n[Scraper] 清空舊資料並寫入 SQLite...');
  await clearTeachers();

  let successCount = 0;
  for (const teacher of teachers) {
    try {
      const id = await insertTeacher(teacher);
      const sp = teacher.specialties.slice(0, 2).join('、') || '(無專長)';
      console.log(`  [+] ID=${String(id).padStart(3)} | ${teacher.category.padEnd(4)} | ${teacher.name.padEnd(4)} | ${teacher.email || '(無信箱)'} | ${sp}`);
      successCount++;
    } catch (err) {
      console.error(`  [!] 插入失敗 (${teacher.name}):`, err.message);
    }
  }

  console.log(`\n[Scraper] ✅ 完成！成功寫入 ${successCount} / ${teachers.length} 筆教師資料`);
  console.log('[Scraper] 資料庫位置: teachers.db');
}

// ── 進入點 ────────────────────────────────────────────────
(async () => {
  try {
    await initDB();
    await scrape();
  } catch (err) {
    console.error('[Scraper] 未預期錯誤:', err);
  } finally {
    setTimeout(() => process.exit(0), 500);
  }
})();
