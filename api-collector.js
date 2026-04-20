import fs from 'fs/promises';

// GitHub Actions에서 Secrets로 주입됨. 로컬 실행 시 .env 또는 직접 설정.
const KEYS = {
  YOUTH_CENTER: process.env.YOUTH_CENTER_KEY ?? '',
  DATA_GO_KR:   process.env.DATA_GO_KR_KEY   ?? '',
};

// ─── 지역명 정규화 ─────────────────────────────────────────────
const SIDO_LIST = [
  '서울특별시','부산광역시','대구광역시','인천광역시','광주광역시',
  '대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도',
  '충청북도','충청남도','전라남도','경상북도','경상남도',
  '전북특별자치도','제주특별자치도',
];
const SIDO_ALIASES_MAP = {
  '서울':'서울특별시','부산':'부산광역시','대구':'대구광역시',
  '인천':'인천광역시','광주':'광주광역시','대전':'대전광역시',
  '울산':'울산광역시','세종':'세종특별자치시','경기':'경기도',
  '강원':'강원특별자치도','충북':'충청북도','충남':'충청남도',
  '전남':'전라남도','경북':'경상북도','경남':'경상남도',
  '전북':'전북특별자치도','제주':'제주특별자치도',
  '전라북도':'전북특별자치도','강원도':'강원특별자치도','제주도':'제주특별자치도',
};

function normalizeSido(raw) {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim();
  // "청" 접미사 제거 (울릉군청 → 울릉군, 부산시청 → 부산시)
  if (s.endsWith('청')) s = s.slice(0, -1);
  // 정확히 일치
  if (SIDO_LIST.includes(s)) return s;
  if (SIDO_ALIASES_MAP[s]) return SIDO_ALIASES_MAP[s];
  // 포함(contains) — "경상북도 울릉군", "경북 청도군청" 등
  for (const sido of SIDO_LIST) {
    if (s.includes(sido)) return sido;
  }
  for (const [alias, sido] of Object.entries(SIDO_ALIASES_MAP)) {
    if (alias.length >= 2 && s.includes(alias)) return sido;
  }
  return null;
}

const today = new Date().toISOString().split('T')[0];

function convertYouthPolicy(p, index) {
  const currentYear = 2026;
  const minAge = parseInt(p.sprtTrgtMinAge) || 19;
  const maxAge = parseInt(p.sprtTrgtMaxAge) || 39;

  const categoryMap = {
    '주거': '주거', '일자리': '취업', '교육': '교육',
    '복지문화': '문화', '참여권리': '문화',
  };
  const category = categoryMap[p.lclsfNm] || '금융';

  const eligibleSidos = [];
  const regionStr = p.rgtrHghrkInstCdNm || p.rgtrUpInstCdNm || '';
  const normalizedSido = normalizeSido(regionStr);
  if (normalizedSido) eligibleSidos.push(normalizedSido);

  let deadline = null;
  if (p.aplyYmd) {
    const match = p.aplyYmd.match(/(\d{8})\s*~\s*(\d{8})/);
    if (match) {
      const end = match[2];
      deadline = `${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}`;
    }
  }

  const flags = [];
  if (p.sprtArvlSeqYn === 'Y') flags.push('FIRST_COME');
  if (deadline) {
    const daysLeft = (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 7 && daysLeft >= 0) flags.push('URGENT');
  }

  const title = p.plcyNm || '';
  const applyUrl = p.aplyUrlAddr || p.refUrlAddr1 || 'https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch';
  const requirements = (p.plcyAplyMthdCn || '').split('\n').filter(s => s.trim()).slice(0, 5);

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title,
    category,
    amount: 0,
    amountLabel: (p.plcySprtCn || '').slice(0, 80) || '공고 확인 필요',
    eligibleJobs: [],
    eligibleSidos,
    minBirthYear: currentYear - maxAge,
    maxBirthYear: currentYear - minAge,
    requirements,
    applyUrl,
    deadline,
    difficulty: '중',
    flags,
    summary: {
      what: title.slice(0, 15),
      who: eligibleSidos.length > 0 ? `${eligibleSidos[0]} 거주 청년` : '청년 누구나',
      how: '온통청년 홈페이지 신청',
    },
  };
}

function convertApplyhome(p, index) {
  const flags = [];
  if (p.RCEPT_ENDDE) {
    const daysLeft = (new Date(p.RCEPT_ENDDE) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 7 && daysLeft >= 0) flags.push('URGENT');
  }

  const regionMap = {
    '100': '서울특별시', '200': '경기도', '300': '대전광역시',
    '400': '인천광역시', '500': '광주광역시', '600': '부산광역시',
    '700': '대구광역시', '800': '울산광역시', '311': '충청북도',
    '312': '충청남도', '411': '강원특별자치도', '510': '전라북도',
    '511': '전라남도', '610': '경상북도', '621': '경상남도',
    '690': '제주특별자치도',
  };

  const sido = regionMap[p.SUBSCRPT_AREA_CODE] || p.SUBSCRPT_AREA_CODE_NM || '';

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title: p.HOUSE_NM || '',
    category: '주거',
    amount: 0,
    amountLabel: `${p.HOUSE_DTL_SECD_NM || ''} | 총 ${p.TOT_SUPLY_HSHLDCO || ''}세대`,
    eligibleJobs: [],
    eligibleSidos: sido ? [sido] : [],
    minBirthYear: 1987,
    maxBirthYear: 2007,
    requirements: [
      `청약 접수: ${p.RCEPT_BGNDE || ''} ~ ${p.RCEPT_ENDDE || ''}`,
      `시공사: ${p.CNSTRCT_ENTRPS_NM || ''}`,
      `입주예정: ${p.MVN_PREARNGE_YM || ''}`,
    ],
    applyUrl: p.PBLANC_URL || 'https://www.applyhome.co.kr',
    deadline: p.RCEPT_ENDDE || null,
    difficulty: '중',
    flags,
    summary: {
      what: '아파트 청약 분양',
      who: '청약 자격 충족자',
      how: '청약홈 온라인 신청',
    },
  };
}

// ─── 복지로 지자체 XML 파싱 → JSON 변환 ───────────────────
function convertWelfareLocal(item, index) {
  const title = item.servNm || '';
  const region = item.ctpvNm || '';
  const org = item.jurMnofNm || '';
  const desc = item.servDgst || '';
  const link = item.servDtlLink || '';

  // 카테고리 추정
  let category = '금융';
  if (title.includes('주거') || title.includes('임대') || title.includes('전세') || title.includes('월세')) category = '주거';
  else if (title.includes('취업') || title.includes('일자리') || title.includes('고용') || title.includes('채용')) category = '취업';
  else if (title.includes('교육') || title.includes('훈련') || title.includes('장학') || title.includes('학자금')) category = '교육';
  else if (title.includes('건강') || title.includes('의료') || title.includes('심리') || title.includes('치료')) category = '건강';
  else if (title.includes('문화') || title.includes('여행') || title.includes('체육') || title.includes('예술')) category = '문화';

  const eligibleSidos = [];
  const normalizedSido = normalizeSido(region);
  if (normalizedSido) eligibleSidos.push(normalizedSido);

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title,
    category,
    amount: 0,
    amountLabel: desc ? desc.slice(0, 80) : '공고 확인 필요',
    eligibleJobs: [],
    eligibleSidos,
    minBirthYear: 1987,
    maxBirthYear: 2007,
    requirements: [org ? `담당기관: ${org}` : ''].filter(Boolean),
    applyUrl: link || 'https://www.bokjiro.go.kr',
    deadline: null,
    difficulty: '중',
    flags: [],
    summary: {
      what: title.slice(0, 15),
      who: eligibleSidos.length > 0 ? `${eligibleSidos[0]} 거주 청년` : '청년 누구나',
      how: '복지로 홈페이지 신청',
    },
  };
}

// ─── XML 파싱 유틸 ─────────────────────────────────────────
function extractItems(xml) {
  const items = [];
  const itemRegex = /<servList>([\s\S]*?)<\/servList>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const obj = {};
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let t;
    while ((t = tagRegex.exec(m[1])) !== null) {
      obj[t[1]] = t[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    }
    items.push(obj);
  }
  return items;
}

function getTotalCount(xml) {
  const m = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  return m ? parseInt(m[1]) : 0;
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    return await res.json();
  } catch (e) {
    console.warn(`    ⚠️ 요청 실패: ${e.message}`);
    return null;
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    return await res.text();
  } catch (e) {
    console.warn(`    ⚠️ 요청 실패: ${e.message}`);
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\n🚀 청년혜택 수집기 + JSON 변환기`);
  console.log(`📅 날짜: ${today}\n`);

  const youthKeySet = KEYS.YOUTH_CENTER !== '여기에_온통청년_키_입력';
  const dataKeySet  = KEYS.DATA_GO_KR   !== '여기에_공공데이터포털_키_입력';
  console.log(`🔑 온통청년: ${youthKeySet ? '✅' : '❌'}  공공데이터: ${dataKeySet ? '✅' : '❌'}\n`);

  await fs.mkdir('scripts/output', { recursive: true });

  const allBenefits = [];
  let idCounter = 1;

  // ── 1. 온통청년 수집 ──
  if (youthKeySet) {
    console.log(`📡 온통청년 청년정책 수집 중...`);
    let page = 1;
    while (true) {
      const url = `https://www.youthcenter.go.kr/go/ythip/getPlcy?apiKeyNm=${KEYS.YOUTH_CENTER}&pageNum=${page}&pageSize=100&rtnType=json`;
      const data = await fetchJSON(url);
      if (!data) break;
      const items = data?.result?.youthPolicyList || [];
      if (!items.length) break;
      items.forEach(p => allBenefits.push(convertYouthPolicy(p, idCounter++)));
      console.log(`  온통청년: ${allBenefits.length}개 변환됨`);
      if (items.length < 100) break;
      page++;
      await sleep(300);
    }
  }

  // ── 2. 청약홈 수집 ──
  if (dataKeySet) {
    console.log(`\n📡 청약홈 분양정보 수집 중...`);
    let page = 1;
    let housingCount = 0;
    while (true) {
      const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=${KEYS.DATA_GO_KR}&page=${page}&perPage=100`;
      const data = await fetchJSON(url);
      if (!data?.data?.length) break;
      data.data.forEach(p => allBenefits.push(convertApplyhome(p, idCounter++)));
      housingCount += data.data.length;
      console.log(`  청약홈: ${housingCount}개 변환됨`);
      if (data.data.length < 100) break;
      page++;
      await sleep(300);
    }
  }

  // ── 3. 복지로 지자체 복지서비스 수집 ──
  if (dataKeySet) {
    console.log(`\n📡 복지로 지자체 복지서비스 수집 중...`);
    let page = 1;
    let welfareCount = 0;
    while (true) {
      const url = `https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist?serviceKey=${KEYS.DATA_GO_KR}&callTp=L&pageNo=${page}&numOfRows=100`;
      const text = await fetchText(url);
      if (!text) break;

      // 에러 체크
      if (text.includes('Unexpected errors') || text.includes('SERVICE_KEY_IS_NOT_REGISTERED')) {
        console.warn(`    ⚠️ 복지로 지자체 API 오류 — 건너뜀`);
        break;
      }

      const items = extractItems(text);
      if (!items.length) {
        // totalCount 확인해서 0이면 정상 종료
        const total = getTotalCount(text);
        if (total === 0 || page > 1) break;
        console.log(`  응답 미리보기: ${text.slice(0, 300)}`);
        break;
      }

      items.forEach(item => {
        allBenefits.push(convertWelfareLocal(item, idCounter++));
      });
      welfareCount += items.length;
      console.log(`  복지로 지자체: ${welfareCount}개 변환됨`);

      // totalCount 넘으면 종료
      const total = getTotalCount(text);
      if (total > 0 && welfareCount >= total) break;
      if (items.length < 100) break;

      page++;
      await sleep(400);
    }
  }

  const outputPath = `scripts/output/${today}.json`;
  await fs.writeFile(outputPath, JSON.stringify(allBenefits, null, 2), 'utf-8');

  // 결과 샘플 출력
  console.log(`\n📋 샘플 (첫 3개):`);
  allBenefits.slice(0, 3).forEach(b => {
    console.log(`  - ${b.title} | ${b.category} | ${b.eligibleSidos.join(',') || '전국'}`);
  });

  // 소스별 통계
  const youthCount = allBenefits.filter(b => b.summary.how.includes('온통청년')).length;
  const housingCount = allBenefits.filter(b => b.summary.how.includes('청약홈')).length;
  const welfareCount = allBenefits.filter(b => b.summary.how.includes('복지로')).length;

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`✅ 완료!`);
  console.log(`📄 JSON 저장: ${outputPath}`);
  console.log(`📊 총 변환: ${allBenefits.length}개`);
  console.log(`   ├─ 온통청년: ${youthCount}개`);
  console.log(`   ├─ 청약홈:   ${housingCount}개`);
  console.log(`   └─ 복지로:   ${welfareCount}개`);
}

main().catch(e => { console.error('오류:', e); process.exit(1); });