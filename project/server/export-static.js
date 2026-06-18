/**
 * export-static.js
 * 執行爬蟲並將結果匯出為靜態 JSON 檔案（供 GitHub Pages 使用）
 * 執行方式: node export-static.js [--output-dir ../client/public/api]
 *
 * 輸出：
 *   teachers.json  → { success: true, total: N, data: [...] }
 *   categories.json → { success: true, data: [...] }
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.iecs.fcu.edu.tw';
const TARGET_URL = `${BASE_URL}/teacher/`;

/** class 關鍵字 → 中文分類（priority 順序很重要） */
const CATEGORY_RULES = [
  { key: 'major', label: '系主任' },
  { key: 'CP', label: '特聘教授' },
  { key: 'DP', label: '特聘教授' },
  { key: 'Honor', label: '榮譽教授' },
  { key: 'FT', label: '專任教師' },
  { key: 'PT', label: '兼任教師' },
  { key: 'administration', label: '行政教師' },
  { key: 'retiree', label: '退休教師' },
];

function parseCategory(classStr) {
  for (const rule of CATEGORY_RULES) {
    if (new RegExp(`(^|\\s)${rule.key}(\\s|$)`).test(classStr)) {
      return rule.label;
    }
  }
  return '其他';
}

function toAbsUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function parseSpecialties(text) {
  if (!text) return [];
  return text
    .replace(/研究專長[：:：]?\s*/i, '')
    .split(/[、，,\/；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60);
}

async function scrapeTeachers() {
  console.log('[Scraper] 開始抓取教師資料...');
  console.log(`[Scraper] 目標網址: ${TARGET_URL}`);

  let html;
  try {
    const response = await axios.get(TARGET_URL, {
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    html = response.data;
    console.log('[Scraper] 網頁抓取成功，HTML 大小:', html.length, 'bytes');
  } catch (err) {
    console.error('[Scraper] 無法抓取網頁:', err.message);
    process.exit(1);
  }

  const $ = cheerio.load(html);
  const teachers = [];
  let idCounter = 1;

  $('.isotope-item').each((index, el) => {
    const $el = $(el);
    const classStr = $el.attr('class') || '';

    const category = parseCategory(classStr);
    if (category === '退休教師') return;

    const profileHref = $el
      .find('a')
      .filter((i, a) => {
        const href = $(a).attr('href') || '';
        return href.startsWith('/teacher/') && href !== '/teacher/';
      })
      .first()
      .attr('href') || '';
    const profile_url = toAbsUrl(profileHref);

    const $h3 = $el.find('h3').first().clone();
    $h3.find('span, small, .badge, .label, strong').remove();
    let name = $h3.text().trim().replace(/\s+/g, '');

    if (!name && profileHref) {
      name = decodeURIComponent(profileHref.replace('/teacher/', '').replace(/\/$/, ''));
    }

    if (!name) return;

    const imgSrc = $el.find('img').first().attr('src') || '';
    const image_url = toAbsUrl(imgSrc);

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

      if (!specialtiesText && text.includes('研究專長')) {
        specialtiesText = text;
      }
    });

    if (!email) {
      const fullText = $el.text();
      const emailMatch = fullText.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i);
      if (emailMatch) email = emailMatch[0].toLowerCase();
    }

    if (!title) {
      const titleMap = {
        系主任: '教授兼系主任',
        特聘教授: '特聘教授',
        榮譽教授: '榮譽教授',
        專任教師: '教授',
        兼任教師: '兼任教師',
        行政教師: '教師',
      };
      title = titleMap[category] || '';
    }

    if (!specialtiesText) {
      const fullText = $el.text();
      const m = fullText.match(/研究專長[：:：]?\s*([^\n]{3,200})/);
      if (m) specialtiesText = m[0];
    }

    const specialties = parseSpecialties(specialtiesText);

    // 輸出格式與後端 API 一致（含 review_summary 空值）
    teachers.push({
      id: idCounter++,
      name,
      title,
      category,
      specialties,
      email,
      image_url,
      profile_url,
      review_summary: { count: 0, kindness: 0, recommendation: 0, workload: 0 },
    });
  });

  console.log(`[Scraper] 共解析出 ${teachers.length} 位教師資料`);

  const stats = {};
  teachers.forEach((t) => {
    stats[t.category] = (stats[t.category] || 0) + 1;
  });
  console.log('[Scraper] 分類統計:', stats);

  return teachers;
}

async function main() {
  // 解析 --output-dir 參數
  const argIdx = process.argv.indexOf('--output-dir');
  const outputDir =
    argIdx !== -1 && process.argv[argIdx + 1]
      ? path.resolve(process.argv[argIdx + 1])
      : path.resolve(__dirname, '../client/public/api');

  // 確保輸出目錄存在
  fs.mkdirSync(outputDir, { recursive: true });

  const teachers = await scrapeTeachers();

  if (teachers.length === 0) {
    console.error('[Export] 警告：未抓到任何教師，中止匯出。');
    process.exit(1);
  }

  // 匯出 teachers.json
  const teachersJson = JSON.stringify(
    { success: true, total: teachers.length, data: teachers },
    null,
    2,
  );
  const teachersPath = path.join(outputDir, 'teachers.json');
  fs.writeFileSync(teachersPath, teachersJson, 'utf-8');
  console.log(`[Export] ✅ teachers.json 已寫出 → ${teachersPath} (${teachers.length} 筆)`);

  // 匯出 categories.json
  const categories = [...new Set(teachers.map((t) => t.category).filter(Boolean))];
  const categoriesJson = JSON.stringify({ success: true, data: categories }, null, 2);
  const categoriesPath = path.join(outputDir, 'categories.json');
  fs.writeFileSync(categoriesPath, categoriesJson, 'utf-8');
  console.log(`[Export] ✅ categories.json 已寫出 → ${categoriesPath} (${categories.length} 類)`);
}

main().catch((err) => {
  console.error('[Export] 未預期錯誤:', err);
  process.exit(1);
});
