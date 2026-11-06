/*
 * 외대 제휴맵 데이터 파일
 * ------------------------------------------------------------
 * 이 파일만 고치면 지도에 반영됩니다. (코드 수정 불필요)
 *
 * ⚠️ 아래 PLACES 는 화면 구성을 보여주기 위한 "예시 데이터"입니다.
 *    실제 제휴 업체 정보로 교체한 뒤 각 항목의 sample: true 를 지워주세요.
 *    (모든 항목에서 sample 이 사라지면 상단의 '예시 데이터' 안내도 사라집니다.)
 *
 * 좌표(lat, lng) 얻는 법
 *   - 지도 화면에서 [+ 업체 추가] → 원하는 위치 클릭 → 저장 후
 *     [데이터 내보내기] 로 이 파일 형식 그대로 받을 수 있습니다.
 *   - 또는 카카오맵/네이버지도에서 장소 우클릭 → 좌표 복사
 *
 * 혜택(benefits) 형식
 *   { kind: "dept",    departments: ["경영학부"], text: "...", until: "2026-12-31" }  ← 학과(학생회) 제휴
 *   { kind: "student", text: "...", until: "2026-12-31" }                          ← 대학생 할인 (학교·학과 무관)
 *   departments 에 "전체 재학생" 을 넣으면 모든 학과에 해당하는 제휴(총학생회 등)로 처리됩니다.
 *   until 은 생략 가능 (상시 혜택).
 */

window.MAP_CONFIG = {
  title: "외대 제휴맵",
  subtitle: "이문동 · 회기 일대 학과 제휴와 대학생 할인",
  campus: { name: "한국외국어대학교 서울캠퍼스", address: "서울 동대문구 이문로 107", lat: 37.5970, lng: 127.0590 },
  zoom: 16,
  landmarks: [
    { name: "외대앞역", note: "1호선", lat: 37.5962, lng: 127.0636 },
    { name: "회기역", note: "1호선 · 경의중앙선 · 경춘선", lat: 37.5898, lng: 127.0580 },
    { name: "신이문역", note: "1호선", lat: 37.6015, lng: 127.0673 }
  ],
  departments: [
    "전체 재학생",
    "영미문학·문화학과", "ELLT학과", "EICC학과",
    "프랑스어학부", "독일어과", "노어과", "스페인어과", "이탈리아어과",
    "중국언어문화학부", "일본언어문화학부", "아랍어과", "베트남어과", "태국어과",
    "LD학부", "LT학부",
    "정치외교학과", "행정학과", "미디어커뮤니케이션학부",
    "국제통상학과", "경영학부", "경제학과",
    "영어교육과", "국제학부"
  ]
};

window.PLACES = [
  {
    id: "p01", name: "골목국밥", category: "food", sample: true,
    lat: 37.5958, lng: 127.0622, address: "이문로 일대",
    hours: "매일 10:00 – 22:00",
    benefits: [
      { kind: "dept", departments: ["경영학부", "경제학과"], text: "국밥 전 메뉴 1,000원 할인", until: "2026-12-31" },
      { kind: "student", text: "학생증 제시 시 공기밥 무료" }
    ],
    conditions: "학생증 또는 모바일 학생증 제시"
  },
  {
    id: "p02", name: "모퉁이 김밥", category: "food", sample: true,
    lat: 37.5949, lng: 127.0611, address: "이문로 일대",
    hours: "평일 07:30 – 20:00 · 일 휴무",
    benefits: [
      { kind: "student", text: "김밥 2줄 이상 주문 시 라면 500원 할인" }
    ],
    conditions: "포장 주문 포함"
  },
  {
    id: "p03", name: "이문 돈가스 연구소", category: "food", sample: true,
    lat: 37.5975, lng: 127.0628, address: "이문동 골목",
    hours: "11:00 – 21:00 (브레이크 15:00 – 17:00)",
    benefits: [
      { kind: "dept", departments: ["프랑스어학부", "독일어과", "스페인어과"], text: "전 메뉴 10% 할인", until: "2026-12-31" },
      { kind: "dept", departments: ["전체 재학생"], text: "총학생회 제휴 · 음료 1잔 서비스", until: "2027-02-28" }
    ],
    conditions: "1인 1메뉴 주문 시"
  },
  {
    id: "p04", name: "회기 쌀국수", category: "food", sample: true,
    lat: 37.5905, lng: 127.0575, address: "회기역 인근",
    hours: "11:00 – 21:30",
    benefits: [
      { kind: "dept", departments: ["베트남어과", "태국어과"], text: "곱빼기 무료 업그레이드", until: "2026-12-31" },
      { kind: "student", text: "평일 점심 15% 할인" }
    ]
  },
  {
    id: "p05", name: "세계 백반", category: "food", sample: true,
    lat: 37.5939, lng: 127.0598, address: "이문로 남측",
    hours: "평일 08:00 – 20:00",
    benefits: [
      { kind: "dept", departments: ["LD학부", "LT학부", "국제학부"], text: "식권 10장 구매 시 1장 추가", until: "2026-11-30" }
    ]
  },
  {
    id: "p06", name: "모닝빈 커피", category: "cafe", sample: true,
    lat: 37.5963, lng: 127.0615, address: "외대앞 사거리 인근",
    hours: "매일 08:00 – 23:00",
    benefits: [
      { kind: "student", text: "아메리카노 2,000원 (시험기간 상시)" },
      { kind: "dept", departments: ["미디어커뮤니케이션학부"], text: "음료 20% 할인", until: "2026-12-31" }
    ],
    conditions: "테이크아웃 · 매장 동일"
  },
  {
    id: "p07", name: "북쪽 정원 카페", category: "cafe", sample: true,
    lat: 37.5981, lng: 127.0641, address: "이문동 주택가",
    hours: "11:00 – 22:00 · 월 휴무",
    benefits: [
      { kind: "dept", departments: ["영미문학·문화학과", "ELLT학과", "EICC학과", "영어교육과"], text: "디저트 1개 무료 (음료 2잔 이상)", until: "2026-12-31" }
    ]
  },
  {
    id: "p08", name: "로스터리 회기", category: "cafe", sample: true,
    lat: 37.5944, lng: 127.0587, address: "회기로 일대",
    hours: "09:00 – 22:00",
    benefits: [
      { kind: "student", text: "스탬프 2배 적립" }
    ]
  },
  {
    id: "p09", name: "신이문 브루어리", category: "cafe", sample: true,
    lat: 37.6008, lng: 127.0662, address: "신이문역 인근",
    hours: "10:00 – 21:00",
    benefits: [
      { kind: "dept", departments: ["중국언어문화학부", "일본언어문화학부"], text: "모든 음료 사이즈업 무료", until: "2026-12-31" }
    ]
  },
  {
    id: "p10", name: "포차 이문", category: "pub", sample: true,
    lat: 37.5952, lng: 127.0634, address: "외대앞역 먹자골목",
    hours: "17:00 – 03:00",
    benefits: [
      { kind: "dept", departments: ["정치외교학과", "행정학과"], text: "단체(8인 이상) 안주 1개 서비스", until: "2026-12-31" },
      { kind: "dept", departments: ["전체 재학생"], text: "총학생회 제휴 · 계산 금액 5% 할인", until: "2027-02-28" }
    ],
    conditions: "만 19세 이상 · 단체 예약 시 학과명 말하기"
  },
  {
    id: "p11", name: "달빛 호프", category: "pub", sample: true,
    lat: 37.5986, lng: 127.0619, address: "이문동 골목",
    hours: "18:00 – 02:00 · 일 휴무",
    benefits: [
      { kind: "dept", departments: ["노어과", "아랍어과", "이탈리아어과"], text: "생맥주 첫 잔 무료", until: "2026-10-31" },
      { kind: "student", text: "평일 감자튀김 무료" }
    ],
    conditions: "만 19세 이상"
  },
  {
    id: "p12", name: "헤어룸 이문", category: "life", sample: true,
    lat: 37.5935, lng: 127.0617, address: "이문로 남측",
    hours: "10:00 – 20:00 · 화 휴무",
    benefits: [
      { kind: "student", text: "커트 20% 할인 (학생증)" },
      { kind: "dept", departments: ["국제통상학과"], text: "펌·염색 30% 할인", until: "2026-12-31" }
    ]
  },
  {
    id: "p13", name: "밝은 안경", category: "life", sample: true,
    lat: 37.5927, lng: 127.0590, address: "회기역 북측",
    hours: "10:00 – 21:00",
    benefits: [
      { kind: "student", text: "안경 맞춤 시 렌즈 업그레이드 무료" }
    ]
  },
  {
    id: "p14", name: "이문 피트니스", category: "life", sample: true,
    lat: 37.5920, lng: 127.0612, address: "회기 일대",
    hours: "평일 06:00 – 24:00 · 주말 10:00 – 20:00",
    benefits: [
      { kind: "dept", departments: ["전체 재학생"], text: "총학생회 제휴 · 3개월 등록 시 1개월 추가", until: "2027-02-28" },
      { kind: "student", text: "운동복·수건 무료" }
    ]
  },
  {
    id: "p15", name: "스트라이크 볼링장", category: "fun", sample: true,
    lat: 37.5968, lng: 127.0650, address: "외대앞역 동측",
    hours: "12:00 – 02:00",
    benefits: [
      { kind: "student", text: "평일 게임당 1,000원 할인" },
      { kind: "dept", departments: ["경영학부"], text: "학과 행사 대관 20% 할인", until: "2026-12-31" }
    ]
  },
  {
    id: "p16", name: "하모니 코인노래방", category: "fun", sample: true,
    lat: 37.5946, lng: 127.0645, address: "외대앞역 남측",
    hours: "24시간",
    benefits: [
      { kind: "student", text: "학생증 제시 시 30분 추가" }
    ]
  },
  {
    id: "p17", name: "외대앞 프린트", category: "study", sample: true,
    lat: 37.5961, lng: 127.0603, address: "캠퍼스 인근",
    hours: "평일 09:00 – 21:00 · 토 10:00 – 18:00",
    benefits: [
      { kind: "dept", departments: ["전체 재학생"], text: "제본 30% 할인", until: "2026-12-31" },
      { kind: "student", text: "흑백 출력 장당 40원" }
    ]
  },
  {
    id: "p18", name: "포커스 스터디카페", category: "study", sample: true,
    lat: 37.5991, lng: 127.0605, address: "이문동 북측",
    hours: "24시간",
    benefits: [
      { kind: "dept", departments: ["독일어과", "노어과", "LD학부"], text: "4주권 10% 할인", until: "2026-12-31" },
      { kind: "student", text: "첫 방문 2시간 무료" }
    ]
  }
];
