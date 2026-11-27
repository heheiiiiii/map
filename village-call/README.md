# village-call · 섬 안내소 영상통화

캐릭터와 음성으로 1:1 영상통화를 하는 웹사이트입니다.

**동작 흐름:** 통화 걸기 → 연결음 → 캐릭터 첫 인사 → 내가 말함(브라우저 음성 인식) → Claude가 캐릭터답게 답변 → GPT-SoVITS 목소리로 말하며 립싱크 → 다시 내 차례

```
브라우저 ──▶ Node 서버(Express) ──▶ Claude API (스트리밍, 문장 단위)
                    └──────────────▶ Modal GPU: GPT-SoVITS (tts-server/)
```

## 바로 실행해보기 (API 키·GPU 없이)

```bash
npm install
npm start            # http://localhost:3000 을 크롬으로 열기
```

키가 없으면 **mock 모드**로 켜집니다.
- 답변: 정해진 문장으로 대답해요.
- 음성: 삐- 소리로 나와요.

화면, 립싱크, 통화 흐름은 mock 모드에서도 모두 확인할 수 있어요.

## 실제로 쓰기

1. `cp .env.example .env` 후 값을 채웁니다.

   | 변수 | 설명 |
   |---|---|
   | `ANTHROPIC_API_KEY` | Claude API 키 |
   | `CHAT_PROVIDER` | `anthropic` (mock으로 강제하려면 `mock`) |
   | `TTS_PROVIDER` | `gptsovits` |
   | `TTS_URL`, `TTS_TOKEN` | `tts-server/README.md`대로 배포한 주소와 토큰 |
   | `CALL_SECRET` | 통화 토큰 서명용 긴 랜덤 문자열 (`openssl rand -hex 32`). 실제 Claude를 쓸 때 없으면 서버가 시작되지 않아요 |
   | `TRUST_PROXY_HOPS` | 앞단 프록시 개수 (Render 등 호스팅은 기본값 1, 프록시 없이 직접 노출하면 0) |
   | `CALL_MAX_SECONDS` | 통화 최대 시간 (기본 300초) |
   | `CALL_MAX_TURNS` | 통화당 최대 대화 수 (기본 30) |
   | `IP_DAILY_CALLS` | IP당 하루 통화 수 (기본 5) |
   | `GLOBAL_DAILY_CALLS` | 사이트 전체 하루 통화 수 (기본 300) |
   | `MAX_UTTERANCE_CHARS` | 한 번에 말할 수 있는 최대 글자 수 (기본 300) |

2. 첫 인사·작별·실패 대사 음성을 미리 만듭니다. 이 음성은 즉시 재생되고 GPU 비용도 들지 않아요.
   ```bash
   npm run prebake
   ```
3. `npm start`

## 배포 (예: Render)

- **새 Web Service 설정:** Build `npm ci && npm run prebake`, Start `npm start`, Root Directory `village-call`
- **환경변수:** 위 표의 값을 모두 넣습니다. HTTPS는 호스팅이 제공합니다. 마이크는 HTTPS에서만 동작해요.
- **인스턴스 수:** 사용 제한 카운터가 메모리에 있으므로 **인스턴스 1개**로 운영하세요. 여러 대로 늘리려면 `server/limits.js`의 store를 Redis 같은 공용 저장소로 바꾸면 됩니다.

## 캐릭터 바꾸기

- **이름·성격·인사말·립싱크 감도:** `character/character.json`
- **이미지:** [docs/ASSETS.md](docs/ASSETS.md)를 참고하세요. 레이어 모드와 두 장짜리 간이 모드를 지원해요.
- 캐릭터나 대사를 바꿨다면 `npm run prebake`를 다시 실행하세요.

## 개발

```bash
npm test            # 단위 테스트
npm run smoke       # 브라우저로 통화 한 사이클 자동 확인 (mock 모드, 스크린샷: scripts/out/)
```

## 지원 브라우저

크롬, 엣지, 사파리에서 동작해요. 파이어폭스는 음성 인식을 지원하지 않아서 안내 문구가 표시됩니다.
