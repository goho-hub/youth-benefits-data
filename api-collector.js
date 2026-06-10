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

// 시군구 → 시도 매핑 (고유 시군구만)
const SIGUNGU_SIDO_MAP = {
  // 경상북도
  '울릉군':'경상북도','청도군':'경상북도','청송군':'경상북도','영양군':'경상북도',
  '봉화군':'경상북도','영덕군':'경상북도','의성군':'경상북도','군위군':'경상북도',
  '상주시':'경상북도','문경시':'경상북도','안동시':'경상북도','경주시':'경상북도',
  '포항시':'경상북도','구미시':'경상북도','김천시':'경상북도','영주시':'경상북도',
  '영천시':'경상북도','경산시':'경상북도','칠곡군':'경상북도','성주군':'경상북도',
  '고령군':'경상북도','예천군':'경상북도','울진군':'경상북도',
  // 경상남도
  '거창군':'경상남도','합천군':'경상남도','산청군':'경상남도','함양군':'경상남도',
  '하동군':'경상남도','남해군':'경상남도','통영시':'경상남도','거제시':'경상남도',
  '창녕군':'경상남도','의령군':'경상남도','함안군':'경상남도','밀양시':'경상남도',
  '양산시':'경상남도','진주시':'경상남도','사천시':'경상남도','김해시':'경상남도',
  '창원시':'경상남도','고성군':'경상남도',
  // 전라남도
  '목포시':'전라남도','여수시':'전라남도','순천시':'전라남도','나주시':'전라남도',
  '광양시':'전라남도','담양군':'전라남도','곡성군':'전라남도','구례군':'전라남도',
  '고흥군':'전라남도','보성군':'전라남도','화순군':'전라남도','장흥군':'전라남도',
  '강진군':'전라남도','해남군':'전라남도','영암군':'전라남도','무안군':'전라남도',
  '함평군':'전라남도','영광군':'전라남도','장성군':'전라남도','완도군':'전라남도',
  '진도군':'전라남도','신안군':'전라남도',
  // 전북특별자치도
  '전주시':'전북특별자치도','군산시':'전북특별자치도','익산시':'전북특별자치도',
  '정읍시':'전북특별자치도','남원시':'전북특별자치도','김제시':'전북특별자치도',
  '완주군':'전북특별자치도','진안군':'전북특별자치도','무주군':'전북특별자치도',
  '장수군':'전북특별자치도','임실군':'전북특별자치도','순창군':'전북특별자치도',
  '고창군':'전북특별자치도','부안군':'전북특별자치도',
  // 충청북도
  '청주시':'충청북도','충주시':'충청북도','제천시':'충청북도','보은군':'충청북도',
  '옥천군':'충청북도','영동군':'충청북도','증평군':'충청북도','진천군':'충청북도',
  '괴산군':'충청북도','음성군':'충청북도','단양군':'충청북도',
  // 충청남도
  '천안시':'충청남도','공주시':'충청남도','보령시':'충청남도','아산시':'충청남도',
  '서산시':'충청남도','논산시':'충청남도','계룡시':'충청남도','당진시':'충청남도',
  '금산군':'충청남도','부여군':'충청남도','서천군':'충청남도','청양군':'충청남도',
  '홍성군':'충청남도','예산군':'충청남도','태안군':'충청남도',
  // 강원특별자치도
  '춘천시':'강원특별자치도','원주시':'강원특별자치도','강릉시':'강원특별자치도',
  '동해시':'강원특별자치도','태백시':'강원특별자치도','속초시':'강원특별자치도',
  '삼척시':'강원특별자치도','홍천군':'강원특별자치도','횡성군':'강원특별자치도',
  '영월군':'강원특별자치도','평창군':'강원특별자치도','정선군':'강원특별자치도',
  '철원군':'강원특별자치도','화천군':'강원특별자치도','양구군':'강원특별자치도',
  '인제군':'강원특별자치도','고성군강원':'강원특별자치도','양양군':'강원특별자치도',
  // 경기도
  '수원시':'경기도','용인시':'경기도','고양시':'경기도','화성시':'경기도',
  '성남시':'경기도','부천시':'경기도','남양주시':'경기도','안산시':'경기도',
  '평택시':'경기도','안양시':'경기도','시흥시':'경기도','파주시':'경기도',
  '김포시':'경기도','의정부시':'경기도','광주시경기':'경기도','하남시':'경기도',
  '광명시':'경기도','군포시':'경기도','양주시':'경기도','오산시':'경기도',
  '이천시':'경기도','안성시':'경기도','의왕시':'경기도','구리시':'경기도',
  '포천시':'경기도','양평군':'경기도','여주시':'경기도','동두천시':'경기도',
  '과천시':'경기도','가평군':'경기도','연천군':'경기도',
  // 제주
  '제주시':'제주특별자치도','서귀포시':'제주특별자치도',
  // 세종
  '세종시':'세종특별자치시',
};

function normalizeSido(raw) {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim();
  // "청" 접미사 제거 (울릉군청 → 울릉군)
  if (s.endsWith('청')) s = s.slice(0, -1);
  // 정확히 일치 (시도명)
  if (SIDO_LIST.includes(s)) return s;
  if (SIDO_ALIASES_MAP[s]) return SIDO_ALIASES_MAP[s];
  // 정확히 일치 (시군구명)
  if (SIGUNGU_SIDO_MAP[s]) return SIGUNGU_SIDO_MAP[s];
  // 포함(contains) — "경상북도 울릉군", "경북 청도군청" 등
  for (const sido of SIDO_LIST) {
    if (s.includes(sido)) return sido;
  }
  for (const [alias, sido] of Object.entries(SIDO_ALIASES_MAP)) {
    if (alias.length >= 2 && s.includes(alias)) return sido;
  }
  // 시군구명 포함 — "울릉군청" → "울릉군" 포함
  for (const [sg, sido] of Object.entries(SIGUNGU_SIDO_MAP)) {
    if (s.includes(sg)) return sido;
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
  // ctpvNm(시도명) 우선, 없으면 signguNm(시군구명)으로 시도 추출
  const sigunguNm = item.signguNm || '';
  const normalizedSido = normalizeSido(region) || normalizeSido(sigunguNm);
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

// ─── 부산 공공데이터 odcloud 헬퍼 ────────────────────────────
async function fetchOdcloud(namespace, uddiPath) {
  const results = [];
  let page = 1;
  while (true) {
    const url = `https://api.odcloud.kr/api/${namespace}/v1/${uddiPath}` +
      `?serviceKey=${KEYS.DATA_GO_KR}&page=${page}&perPage=100&returnType=json`;
    const data = await fetchJSON(url);
    if (!data?.data?.length) break;
    results.push(...data.data);
    console.log(`  [${namespace}]: ${results.length}개 수집 중...`);
    const total = data.totalCount ?? data.matchCount ?? Infinity;
    if (results.length >= total || data.data.length < 100) break;
    page++;
    await sleep(300);
  }
  return results;
}

// 부산교통공사 신규채용인원 현황 → 취업 카드 (연도별 통계)
function convertBMTCHire(item, index) {
  const year       = item['연도'] ?? '';
  const regular    = (item['정규직(일반)'] ?? 0) + (item['정규직(장애)'] ?? 0);
  const intern     = (item['인턴(일반)'] ?? 0) + (item['인턴(장애인)'] ?? 0);
  const gongmu     = item['공무직'] ?? 0;
  const total      = regular + intern + gongmu;

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title: `부산교통공사 ${year}년 신규채용 현황`,
    category: '취업',
    amount: 0,
    amountLabel: `총 ${total}명 채용 (정규직 ${regular}명, 인턴 ${intern}명)`,
    eligibleJobs: [],
    eligibleSidos: ['부산광역시'],
    minBirthYear: 1987,
    maxBirthYear: 2007,
    requirements: [
      `정규직(일반): ${item['정규직(일반)'] ?? 0}명`,
      `정규직(장애): ${item['정규직(장애)'] ?? 0}명`,
      `인턴(일반): ${item['인턴(일반)'] ?? 0}명`,
      `공무직: ${gongmu}명`,
    ],
    applyUrl: 'https://www.humetro.busan.kr/',
    deadline: null,
    difficulty: '중',
    flags: [],
    summary: {
      what: '부산교통공사 신규채용',
      who: '부산 거주 구직 청년',
      how: '부산교통공사 채용공고 지원',
    },
  };
}

// 부산도시공사 임대주택 현황 → 주거 카드
function convertBUDCRental(item, index) {
  const name  = item['지구명'] || '';
  const type  = item['유형'] || '';
  const count = item['세대수'] ?? '';
  const addr  = item['소재지'] || '';

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title: name ? `[부산도시공사] ${name}` : '부산도시공사 임대주택',
    category: '주거',
    amount: 0,
    amountLabel: [type, count && `${count}세대`].filter(Boolean).join(' | ') || '임대주택 공급',
    eligibleJobs: [],
    eligibleSidos: ['부산광역시'],
    minBirthYear: 1987,
    maxBirthYear: 2007,
    requirements: [
      addr  ? `위치: ${addr}` : '',
      type  ? `임대유형: ${type}` : '',
      count ? `세대수: ${count}세대` : '',
    ].filter(Boolean),
    applyUrl: 'https://www.bmc.busan.kr/',
    deadline: null,
    difficulty: '중',
    flags: [],
    summary: {
      what: type || '공공임대주택',
      who: '부산 거주 청년·신혼부부',
      how: '부산도시공사 청약 신청',
    },
  };
}

// 부산관광공사 채용정보 → 취업 카드
function convertBTORecruit(item, index) {
  const title    = item['공고명'] || '';
  const jobType  = item['일반전형'] || '';
  const dept     = item['담당부서'] || '';
  const contact  = item['연락처'] || '';
  const method   = item['접수방법'] || '';
  const rawDl    = item['접수마감일'] || item['공고마감일'] || null;
  const startDt  = item['공고시작일'] || '';
  const applyDt  = item['임용시기'] || '';

  let deadline = null;
  if (rawDl) {
    const m = String(rawDl).match(/(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);
    if (m) deadline = `${m[1]}-${m[2]}-${m[3]}`;
  }

  // 이미 마감된 공고는 deadline을 null로 처리 (buildBenefitsJson에서 필터링)
  const flags = [];
  if (deadline) {
    const daysLeft = (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 7 && daysLeft >= 0) flags.push('URGENT');
  }

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title: title || '부산관광공사 채용',
    category: '취업',
    amount: 0,
    amountLabel: jobType || '공고 확인 필요',
    eligibleJobs: [],
    eligibleSidos: ['부산광역시'],
    minBirthYear: 1987,
    maxBirthYear: 2007,
    requirements: [
      jobType   ? `전형: ${jobType}` : '',
      dept      ? `담당부서: ${dept}` : '',
      method    ? `접수방법: ${method}` : '',
      applyDt   ? `임용시기: ${applyDt}` : '',
      contact   ? `연락처: ${contact}` : '',
    ].filter(Boolean),
    applyUrl: 'https://www.bto.or.kr/',
    deadline,
    difficulty: '중',
    flags,
    summary: {
      what: (title || '부산관광공사 채용').slice(0, 15),
      who: '부산 거주 구직 청년',
      how: '부산관광공사 채용공고 지원',
    },
  };
}

// 부산관광공사 유니크베뉴 → 문화 카드
function convertBTOVenue(item, index) {
  const name = item['베뉴명'] || '';
  const loc  = item['위치'] || '';  // 구 단위 위치

  return {
    id: `benefit-${String(index).padStart(3, '0')}`,
    title: name ? `[부산 유니크베뉴] ${name}` : '부산 특별 이벤트 공간',
    category: '문화',
    amount: 0,
    amountLabel: loc ? `부산 ${loc} 소재 특별 공간` : '공간 대관 문의',
    eligibleJobs: [],
    eligibleSidos: ['부산광역시'],
    minBirthYear: 1987,
    maxBirthYear: 2007,
    requirements: [
      loc ? `위치: 부산 ${loc}` : '',
      '부산관광공사 유니크베뉴 예약 가능',
    ].filter(Boolean),
    applyUrl: 'https://www.bto.or.kr/',
    deadline: null,
    difficulty: '하',
    flags: [],
    summary: {
      what: (name || '부산 유니크베뉴').slice(0, 15),
      who: '부산 거주 청년·창업자',
      how: '부산관광공사 문의 및 예약',
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

  // ── 4. 부산교통공사 신규채용인원 현황 ──
  if (dataKeySet) {
    console.log(`\n📡 부산교통공사 신규채용인원 현황 수집 중...`);
    const items = await fetchOdcloud('15145396', 'uddi:73eb3674-9759-4856-b041-f7c63c73eedd');
    items.forEach(p => allBenefits.push(convertBMTCHire(p, idCounter++)));
    console.log(`  부산교통공사: ${items.length}개 변환됨`);
  }

  // ── 5. 부산도시공사 임대주택 현황 ──
  if (dataKeySet) {
    console.log(`\n📡 부산도시공사 임대주택 현황 수집 중...`);
    // 두 데이터셋이 동일 구조 — totalCount가 더 많은 두 번째 사용
    const items = await fetchOdcloud('15129641', 'uddi:40253ad8-6a09-42a7-8023-e229b5e4ae49');
    items.forEach(p => allBenefits.push(convertBUDCRental(p, idCounter++)));
    console.log(`  부산도시공사: ${items.length}개 변환됨`);
  }

  // ── 6. 부산관광공사 채용정보 ──
  if (dataKeySet) {
    console.log(`\n📡 부산관광공사 채용정보 수집 중...`);
    const items = await fetchOdcloud('15144999', 'uddi:f1042c4c-2b26-4948-808f-da3b84100ea2');
    items.forEach(p => allBenefits.push(convertBTORecruit(p, idCounter++)));
    console.log(`  부산관광공사 채용: ${items.length}개 변환됨`);
  }

  // ── 7. 부산관광공사 유니크베뉴 ──
  if (dataKeySet) {
    console.log(`\n📡 부산관광공사 유니크베뉴 수집 중...`);
    const items = await fetchOdcloud('15156491', 'uddi:cf14a586-03cb-4672-a766-9e4ee46db1e0');
    items.forEach(p => allBenefits.push(convertBTOVenue(p, idCounter++)));
    console.log(`  부산관광공사 유니크베뉴: ${items.length}개 변환됨`);
  }

  const outputPath = `scripts/output/${today}.json`;
  await fs.writeFile(outputPath, JSON.stringify(allBenefits, null, 2), 'utf-8');

  // 결과 샘플 출력
  console.log(`\n📋 샘플 (첫 3개):`);
  allBenefits.slice(0, 3).forEach(b => {
    console.log(`  - ${b.title} | ${b.category} | ${b.eligibleSidos.join(',') || '전국'}`);
  });

  // 소스별 통계
  const youthCount   = allBenefits.filter(b => b.summary.how.includes('온통청년')).length;
  const housingCount = allBenefits.filter(b => b.summary.how.includes('청약홈')).length;
  const welfareCount = allBenefits.filter(b => b.summary.how.includes('복지로')).length;
  const bmtcCount    = allBenefits.filter(b => b.summary.how.includes('부산교통공사')).length;
  const budcCount    = allBenefits.filter(b => b.summary.how.includes('부산도시공사')).length;
  const btoRCount    = allBenefits.filter(b => b.summary.how.includes('부산관광공사 채용')).length;
  const btoVCount    = allBenefits.filter(b => b.summary.how.includes('부산관광공사 문의')).length;

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`✅ 완료!`);
  console.log(`📄 JSON 저장: ${outputPath}`);
  console.log(`📊 총 변환: ${allBenefits.length}개`);
  console.log(`   ├─ 온통청년:          ${youthCount}개`);
  console.log(`   ├─ 청약홈:            ${housingCount}개`);
  console.log(`   ├─ 복지로:            ${welfareCount}개`);
  console.log(`   ├─ 부산교통공사:      ${bmtcCount}개`);
  console.log(`   ├─ 부산도시공사:      ${budcCount}개`);
  console.log(`   ├─ 부산관광공사 채용: ${btoRCount}개`);
  console.log(`   └─ 부산관광공사 베뉴: ${btoVCount}개`);
}

main().catch(e => { console.error('오류:', e); process.exit(1); });