/**
 * buildBenefitsJson.mjs
 * scripts/output/ 의 가장 최신 JSON을 정제해 benefits.json으로 출력.
 * GitHub Actions에서 api-collector.js 실행 후 자동 호출됨.
 *
 * Fallback 전략: 특정 소스(복지로·온통청년)가 0개면
 * 이전 benefits.json에서 해당 소스 항목을 보존해 데이터 공백을 방지.
 */

import fs from 'fs';
import path from 'path';

const OUT_DIR   = path.resolve('scripts/output');
const OUTPUT    = path.resolve('benefits.json');

// 가장 최신 날짜 파일 자동 탐색
const files = fs.readdirSync(OUT_DIR)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .reverse();

if (!files.length) {
  console.error('❌ scripts/output/ 에 JSON 파일이 없습니다.');
  process.exit(1);
}

const INPUT = path.join(OUT_DIR, files[0]);
console.log(`입력 파일: ${files[0]} (${(fs.statSync(INPUT).size / 1024).toFixed(0)} KB)`);

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
console.log(`읽기 완료: ${raw.length}건`);

// ── 유효 청년 연도 범위 ──────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const MIN_VALID_BIRTH = CURRENT_YEAR - 50;
const MAX_VALID_BIRTH = CURRENT_YEAR - 14;
const DEFAULT_MIN_BIRTH = CURRENT_YEAR - 39;
const DEFAULT_MAX_BIRTH = CURRENT_YEAR - 18;

function cleanAmountLabel(label) {
  if (!label) return '';
  const first = label.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
  return first.length > 100 ? first.slice(0, 97) + '...' : first;
}

let fixedBirth = 0;
let cleaned = raw.map(b => {
  let minBirth = b.minBirthYear;
  let maxBirth = b.maxBirthYear;
  if (!minBirth || minBirth < MIN_VALID_BIRTH || minBirth > MAX_VALID_BIRTH) {
    minBirth = DEFAULT_MIN_BIRTH;
    fixedBirth++;
  }
  if (!maxBirth || maxBirth < MIN_VALID_BIRTH || maxBirth > MAX_VALID_BIRTH) {
    maxBirth = DEFAULT_MAX_BIRTH;
  }
  return { ...b, minBirthYear: minBirth, maxBirthYear: maxBirth, amountLabel: cleanAmountLabel(b.amountLabel) };
});

// 중복 id 제거
const seen = new Map();
for (const b of cleaned) seen.set(b.id, b);
cleaned = [...seen.values()];

// ── Fallback: 수집 실패한 소스는 이전 benefits.json에서 보완 ──────────────
const FALLBACK_SOURCES = [
  { key: '복지로',   check: b => b.summary?.how?.includes('복지로') },
  { key: '온통청년', check: b => b.summary?.how?.includes('온통청년') },
];

if (fs.existsSync(OUTPUT)) {
  let prevData = null;
  try { prevData = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); } catch { /* ignore */ }

  if (prevData && Array.isArray(prevData)) {
    for (const src of FALLBACK_SOURCES) {
      const todayCount = cleaned.filter(src.check).length;
      if (todayCount > 0) continue; // 오늘 정상 수집됨

      const prevItems = prevData.filter(src.check);
      if (!prevItems.length) continue;

      console.log(`⚠️  ${src.key} 0건 감지 — 이전 데이터 ${prevItems.length}건으로 보완`);

      // 기존 ID 그대로 유지 (이미 중복 없음)
      for (const item of prevItems) {
        if (!seen.has(item.id)) {
          seen.set(item.id, item);
        }
      }
    }
    cleaned = [...seen.values()];
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(cleaned), 'utf8');

const sizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ benefits.json 생성 완료`);
console.log(`   항목 수:    ${cleaned.length}건`);
console.log(`   연도 보정:  ${fixedBirth}건`);
console.log(`   파일 크기:  ${sizeKB} KB`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
