import { execSync } from 'child_process';
import fs from 'fs';

function getNextRunTime() {
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  return next;
}

function scheduleNext() {
  const next = getNextRunTime();
  const delay = next - Date.now();
  const h = Math.floor(delay / 3600000);
  const m = Math.floor((delay % 3600000) / 60000);
  console.log(`⏰ 다음 실행: ${next.toLocaleString('ko-KR')} (${h}시간 ${m}분 후)`);

  setTimeout(() => {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n🚀 [${today}] 자동 수집 시작...`);
    try {
      execSync('node api-collector.js', { stdio: 'inherit', cwd: process.cwd() });
      console.log(`✅ [${today}] 완료`);
      fs.appendFileSync('scheduler.log', `[${new Date().toISOString()}] SUCCESS\n`);
    } catch (e) {
      console.error(`❌ 실패:`, e.message);
      fs.appendFileSync('scheduler.log', `[${new Date().toISOString()}] FAILED: ${e.message}\n`);
    }
    scheduleNext();
  }, delay);
}

console.log('📅 스케줄러 시작 (매일 새벽 3시 자동 수집)');
console.log('   Ctrl+C로 중지\n');
scheduleNext();