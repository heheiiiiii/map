# Village Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오리지널 캐릭터와 음성으로 영상통화하는 공개 웹사이트. 음성 인식(Web Speech) → Claude 스트리밍 답변 → GPT-SoVITS TTS → 음량 기반 립싱크로 구성한다.

**Architecture:** 순수 HTML/CSS/JS 프런트와 Express 서버 한 개로 만든다. 서버가 Claude 스트림을 문장 단위로 자른 뒤 문장마다 TTS를 호출하고, SSE로 내려보낸다. TTS는 Modal 서버리스 GPU의 GPT-SoVITS가 맡는다. 로컬 개발과 테스트에서는 `mock` 제공자로 Claude와 TTS를 대체한다.

**Tech Stack:** Node 22 (ES modules), Express 4, `@anthropic-ai/sdk`, `node:test`, Playwright(사전 설치됨, 스모크 확인용), Python + Modal + GPT-SoVITS (tts-server).

**Spec:** `docs/superpowers/specs/2026-11-27-village-call-design.md`

## Global Constraints

- 모든 코드는 저장소 루트의 `village-call/` 아래에 둔다. 기존 지도 프로젝트 파일은 건드리지 않는다.
- `"type": "module"`, Node ≥ 20. 프런트는 빌드 도구 없이 `<script type="module">`로 로드한다.
- Claude 호출 설정은 다음과 같다.
  - 모델 `claude-opus-5-5`, `output_config: { effort: "low" }`
  - `client.beta.messages.stream`에 `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`
  - `max_tokens: 1024`. `thinking`은 생략한다.
- 비밀값(`ANTHROPIC_API_KEY`, `TTS_TOKEN`, `CALL_SECRET`)은 환경변수로만 받는다. 브라우저에 보내는 응답에 포함하지 않는다.
- 제한 기본값은 다음과 같고, 모두 env로 덮어쓸 수 있다.
  - `CALL_MAX_SECONDS=300`, `CALL_MAX_TURNS=30`
  - `IP_DAILY_CALLS=5`, `GLOBAL_DAILY_CALLS=300`
  - `MAX_UTTERANCE_CHARS=300`
- 브라우저가 보내는 대화 기록은 최근 20턴(40메시지)까지만 쓴다. 서버는 대화를 저장하지 않는다.
- 표정 값은 `neutral | happy | surprised | sad | thinking` 다섯 개다.
- 기본 탑재 이미지는 오리지널 플레이스홀더다. 기존 게임 캐릭터나 장면을 재현한 자산은 만들거나 넣지 않는다.
- 모델 가중치(`.ckpt`, `.pth`)와 `.env`는 git에 커밋하지 않는다 (`.gitignore`).

## Review Focus

1. **말 없이 끝난 인식이나 "음" 같은 1글자 발화:** 서버에 보내지 않고 조용히 다시 듣는다. (Task 8 `shouldSend` 테스트)
2. **마침표 없이 끝나는 Claude 응답:** 남은 텍스트도 마지막 문장으로 TTS·자막 처리한다. (Task 2 `flush` 테스트)
3. **표정 태그가 없거나 잘못된 응답:** neutral로 처리하고, 본문은 잘리지 않는다. (Task 2 태그 파싱 테스트)
4. **답변 중간 문장 하나의 TTS 실패:** 그 문장은 `audio: null`로 보내 자막만 표시하고, 나머지 문장은 순서대로 계속한다. (Task 5 테스트)
5. **통화 시간이나 턴 상한 초과:** `/api/chat`이 403 `{error:"call_over"}`를 반환하고, 앱은 작별 대사 후 종료 화면으로 간다. (Task 5, Task 8 테스트)

---

### Task 1: 프로젝트 골격, 캐릭터 설정, 서버 기동

**Files:**
- Create: `village-call/package.json`, `village-call/.gitignore`, `village-call/.env.example`
- Create: `village-call/character/character.json`
- Create: `village-call/server/config.js`, `village-call/server/app.js`, `village-call/server/index.js`
- Test: `village-call/test/app.test.js`

**Interfaces:**
- Produces:
  - `loadConfig(env = process.env) -> Config`. 필드: `{ port, provider: { chat: "anthropic"|"mock", tts: "gptsovits"|"mock" }, ttsUrl, ttsToken, callSecret, limits: { callMaxSeconds, callMaxTurns, ipDailyCalls, globalDailyCalls, maxUtteranceChars } }`
  - `loadCharacter(path?) -> Character`
  - `createApp({ config, character, deps }) -> express.Application`. `deps`는 `{ chat, tts, limits }`이며 Task 5에서 채운다.
  - `GET /api/character` 응답은 `{ name, layout, lipsync, simpleMode, assets }`다. **persona 프롬프트는 응답에서 제외한다.**
  - `npm start`는 `node server/index.js`, `npm test`는 `node --test`를 실행한다.

`character.json` 키:
- `name: "보리"`
- `persona`: 수달, 섬 안내소 직원. 부지런하고 다정하며 가끔 덤벙대고, 밝은 존댓말 "~랍니다!"를 쓴다.
- `greeting: "안녕하세요~! 섬 안내소 보리랍니다. 오늘은 무슨 일로 전화하셨어요?"`
- `farewell: "벌써 시간이 이렇게 됐네요! 오늘 통화 즐거웠어요. 또 전화 주세요~!"`
- `fallbackLines: ["앗, 전파가 약한가 봐요… 다시 한 번 말해줄래요?"]`
- `layout: { x: 0.5, bottom: 0.0, height: 0.78 }` (화면 대비 비율)
- `lipsync: { thresholds: [0.02, 0.06, 0.12], attack: 0.6, release: 0.15 }`
- `simpleMode: false`
- `assets`: 6장의 파일명 맵

package.json 의존성: `express`, `@anthropic-ai/sdk`, `dotenv`.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/app.test.js`)

`createApp`을 mock deps로 띄우고 `fetch`로 `/api/character`를 호출해 다음을 확인한다.
  - 응답 `name === "보리"`
  - `"persona" in body === false`
  - `GET /`는 200이고 `text/html`

`loadConfig({})`의 `limits.callMaxSeconds === 300`이고, `ipDailyCalls === 5`인지도 확인한다.

- [ ] **Step 2: `cd village-call && npm install && npm test`.** 모듈이 없어서 FAIL이 나야 한다.
- [ ] **Step 3: 위 Interfaces대로 구현한다.** `index.js`는 dotenv를 로드하고 `listen(config.port || 3000)`만 한다. 정적 파일은 `public/`에서 서빙하고, `/assets`는 `character/assets`에, `/audio`는 `character/fallback-audio`에 매핑한다. 이 단계에서는 `public/index.html`을 한 줄짜리 자리표시로 둔다.
- [ ] **Step 4: `npm test`.** PASS여야 한다.
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): 골격과 캐릭터 설정`.

---

### Task 2: 텍스트 유틸 (문장 분할, 표정 태그, 발화 정리)

**Files:**
- Create: `village-call/server/text.js`
- Test: `village-call/test/text.test.js`

**Interfaces:**
- Produces:
  - `createSentenceSplitter() -> { push(chunk: string): string[], flush(): string[] }`. `. ! ? ~ …` 다음에 공백이나 끝이 오거나, 줄바꿈이 오면 문장이 끝난다. 공백뿐인 문장은 버린다.
  - `parseExpression(text: string) -> { expression: Expression, rest: string }`. 앞쪽 공백 뒤의 `[word]` 하나만 인식한다.
  - `cleanForSpeech(text: string) -> string`. 이모지, 마크다운 기호(`* _ # \``), `[...]` 태그를 지우고 공백을 정리한다.
  - `EXPRESSIONS = ["neutral","happy","surprised","sad","thinking"]`

- [ ] **Step 1: 실패하는 테스트 작성**
  - `push("안녕하세요! 반가")` → `["안녕하세요!"]`. 이어서 `push("워요. 오늘")` → `["반가워요."]`. 이어서 `flush()` → `["오늘"]`.
  - `push("정말요?!")`와 `push(" 와~")` 다음에 `flush()` → 합쳐서 `["정말요?!", "와~"]`.
  - `parseExpression("[happy] 좋아요!")` → `{expression:"happy", rest:"좋아요!"}`
  - `parseExpression("[angry] 흥")` → `{expression:"neutral", rest:"흥"}`
  - `parseExpression("좋아요")` → `{expression:"neutral", rest:"좋아요"}`
  - `cleanForSpeech("**정말** 좋아요 😊")` → `"정말 좋아요"`
- [ ] **Step 2: `node --test test/text.test.js`.** FAIL이어야 한다.
- [ ] **Step 3: 구현한다.** 스플리터는 내부 버퍼 문자열 하나와 정규식 `/[.!?~…]+(?=\s|$)|\n/`로 반복 분리한다. 단, `push` 중에는 버퍼 끝에 걸친 종결부호를 확정하지 않는다. 다음 청크가 `?!`처럼 이어질 수 있기 때문이다.
- [ ] **Step 4: 다시 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): 문장 분할과 표정 태그`.

---

### Task 3: 남용 방지 (통화 토큰, IP·전역 일일 상한, 턴 수)

**Files:**
- Create: `village-call/server/limits.js`
- Test: `village-call/test/limits.test.js`

**Interfaces:**
- Produces:
  - `createLimits({ limits, secret, now = () => Date.now(), store = createMemoryStore() })`. 아래 메서드를 가진 객체를 반환한다.
    - `startCall(ip: string) -> { ok: true, token: string, expiresAt: number } | { ok: false, reason: "ip_limit" | "closed_today" }`
    - `checkTurn(token: string) -> { ok: true } | { ok: false, reason: "invalid" | "call_over" }`. 통과할 때마다 턴 수를 1 증가시킨다.
  - `createMemoryStore() -> { incr(key): number, get(key): number }`. 날짜 키(`YYYY-MM-DD` UTC)가 바뀌면 이전 키는 무시한다.
  - 토큰 형식은 `base64url(JSON{id, exp}).hmacSHA256` (`node:crypto`)이다. 턴 카운트는 store에 `turns:<id>`로 저장한다.

- [ ] **Step 1: 실패하는 테스트 작성** (`now`를 주입해 시간 이동)
  - 같은 IP로 `startCall`을 5번 하면 ok, 6번째는 `ip_limit`이다.
  - `globalDailyCalls: 2`로 설정하면 서로 다른 IP 3번째 호출이 `closed_today`다.
  - `checkTurn`: 유효한 토큰은 ok이다. 서명 1글자를 바꾸면 `invalid`다. `now`를 301초 뒤로 옮기면 `call_over`다. `callMaxTurns: 2`일 때 3번째 호출이 `call_over`다.
  - 날짜를 다음 날로 옮기면 IP 카운트가 리셋된다.
- [ ] **Step 2: 실행해서 FAIL을 확인한다.**
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): 통화 토큰과 사용 상한`.

---

### Task 4: TTS 클라이언트 (GPT-SoVITS HTTP + mock)

**Files:**
- Create: `village-call/server/tts.js`, `village-call/server/wav.js`
- Test: `village-call/test/tts.test.js`

**Interfaces:**
- Produces:
  - `createTts(config, fetchImpl = fetch) -> { synthesize(text: string): Promise<{ audio: Buffer, durationMs: number }>, warm(): Promise<boolean> }`
    - `config.provider.tts === "gptsovits"`일 때:
      - `POST ${ttsUrl}/tts`. 헤더 `Authorization: Bearer ${ttsToken}`, 본문 `{text}`, 응답은 `audio/wav`.
      - `warm`은 `GET ${ttsUrl}/warm`이며, 200이면 true다.
      - 타임아웃은 synthesize 20초, warm 45초다. 실패하면 throw한다.
    - `"mock"`일 때는 글자당 90ms 길이의 220Hz 사인파 wav(16kHz mono)를 생성하고, 진폭을 음절마다 출렁이게 한다. 립싱크 확인용이다.
  - `wavDurationMs(buf: Buffer) -> number`. RIFF 헤더의 byteRate와 data 청크 크기로 계산한다.
  - `makeSineWav(ms, { hz, sampleRate }) -> Buffer`

- [ ] **Step 1: 실패하는 테스트 작성**
  - `wavDurationMs(makeSineWav(1000, {hz:220, sampleRate:16000}))`가 1000±1이다.
  - mock `synthesize("안녕")`의 `durationMs`가 180±1이다.
  - gptsovits 제공자에 가짜 fetch를 주입해 요청 URL, 헤더, 본문을 검증한다. 가짜 fetch가 500을 반환하면 reject한다.
- [ ] **Step 2: 실행해서 FAIL을 확인한다.**
- [ ] **Step 3: 구현한다.** 타임아웃은 `AbortSignal.timeout`으로 건다.
- [ ] **Step 4: 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): TTS 클라이언트`.

---

### Task 5: 통화·채팅 API (Claude 스트리밍 → 문장별 TTS → SSE)

**Files:**
- Create: `village-call/server/chat.js`
- Modify: `village-call/server/app.js` (라우트 추가), `village-call/server/index.js` (실제 deps 조립)
- Test: `village-call/test/chat.test.js`

**Interfaces:**
- Consumes: Task 2의 `createSentenceSplitter`, `parseExpression`, `cleanForSpeech`. Task 3의 `createLimits`. Task 4의 `createTts`.
- Produces:
  - `createChat({ config, character, anthropic? }) -> { stream(messages): AsyncIterable<string> }`. 텍스트 델타를 yield한다.
    - anthropic 제공자: `anthropic.beta.messages.stream({...Global Constraints 값, system: buildSystemPrompt(character), messages})`를 호출하고, `content_block_delta`/`text_delta` 이벤트만 넘긴다. 최종 `stop_reason === "refusal"`이면 throw한다.
    - mock 제공자: `"[happy] 우와, 그랬군요! 정말 재미있었겠어요. 또 얘기해 주세요~"`를 3글자씩 yield한다.
  - `buildSystemPrompt(character) -> string`. persona와 공통 규칙(스펙 5.4: 한국어 1~3문장, 이모지·마크다운 금지, 맨 앞 표정 태그 하나, 캐릭터 이탈 요청은 캐릭터로서 넘김)을 합친다.
  - 라우트:
    - `POST /api/call/start` → `200 {token, expiresAt, maxSeconds}` 또는 `429 {error: reason}`. 성공하면 `tts.warm()`을 기다리지 않고 백그라운드로 호출한다.
    - `GET /api/warm` → `{ready: boolean}`. `tts.warm()` 결과다. 프런트 ringing 단계가 폴링한다.
    - `POST /api/chat`: 헤더 `Authorization: Bearer <token>`, 본문 `{messages:[{role,content}]}`.
      - 검증: 토큰이 invalid면 401, `call_over`면 403 `{error:"call_over"}`. 마지막 user 메시지가 `maxUtteranceChars`를 넘거나 비었으면 400. `messages`는 마지막 40개로 자른다.
      - 응답은 `text/event-stream`이다.
        - `event: expression` / `data: {"expression":"happy"}` (첫 문장보다 먼저 1회)
        - `event: sentence` / `data: {"index":0,"text":"...","audio":"<base64 wav>|null","durationMs":1234}`
        - `event: done` / `data: {"text":"<표정 태그 뺀 전체 답변>"}`
        - `event: error` / `data: {"error":"chat_failed"}` (Claude 실패 시. 프런트가 `/audio/fallback_0.wav`를 재생한다)
      - TTS 요청은 문장이 완성되는 즉시 시작한다(병렬). 전송은 index 순서로 한다. TTS가 실패한 문장은 `audio:null`이고, `durationMs`는 글자수×110이다.
      - 클라이언트가 연결을 끊으면(`req.on("close")`) Claude 스트림을 abort한다.

- [ ] **Step 1: 실패하는 테스트 작성.** mock chat과 mock tts를 쓰고, SSE 본문을 이벤트 배열로 파싱하는 헬퍼를 둔다.
  - start → chat 흐름의 이벤트 순서가 `expression(happy)`, `sentence`×3(index 0,1,2, audio가 비어 있지 않음), `done`이다.
  - 2번째 문장만 실패하는 tts를 주입하면 index 1의 `audio === null`이고 index 2는 정상이다. 순서도 유지된다.
  - throw하는 chat을 주입하면 `error` 이벤트가 온다.
  - 토큰이 없으면 401이다. `callMaxTurns:1`에서 두 번째 chat은 403 `call_over`다.
  - 301자 발화는 400이다.
  - 6번째 start는 429 `ip_limit`이다.
  - `buildSystemPrompt(character)`에 persona 문장과 `[표정]` 규칙이 포함된다.
- [ ] **Step 2: 실행해서 FAIL을 확인한다.**
- [ ] **Step 3: 구현한다.** 순서 보장은 문장별 TTS Promise 배열을 순서대로 await하는 방식으로 한다. `index.js`는 `ANTHROPIC_API_KEY`가 없고 `CHAT_PROVIDER`도 지정되지 않으면 mock으로 시작하고 경고 로그를 남긴다.
- [ ] **Step 4: `npm test`를 전부 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): 통화/채팅 SSE API`.

---

### Task 6: 립싱크·자막 계산 (순수 모듈) + 재생 큐

**Files:**
- Create: `village-call/public/js/lipsync.js`, `village-call/public/js/captions.js`, `village-call/public/js/player.js`
- Test: `village-call/test/lipsync.test.js`, `village-call/test/captions.test.js`

**Interfaces:**
- Produces:
  - `lipsync.js`
    - `rms(samples: Float32Array) -> number`
    - `createMouthDriver({thresholds, attack, release}) -> { update(rmsValue: number): 0|1|2|3, level: number }`. 지수 스무딩을 쓰며, 값이 오를 때는 `attack`, 내릴 때는 `release` 계수를 쓴다.
  - `captions.js`
    - `charSchedule(text: string, durationMs: number) -> number[]`. 각 글자가 나타나는 ms다. 공백은 0 가중치이고, 쉼표·마침표 뒤에 가중치 3을 더해 쉼을 표현한다. 마지막 값은 `durationMs*0.95` 이하다.
    - `createCaptions(el: HTMLElement) -> { showSentence(text, durationMs), showUser(text, final: boolean), clear() }`
  - `player.js`
    - `createPlayer(audioCtx: AudioContext) -> { enqueue({audio: ArrayBuffer|null, text, durationMs}): void, onSentenceStart(cb), onIdle(cb), level(): number, stop(): void }`. 소스를 `AnalyserNode`(fftSize 1024)에 연결한 뒤 destination으로 보낸다. `level()`은 현재 RMS를 반환한다. `audio:null`인 문장은 `durationMs`만큼 가짜 레벨(0.05~0.1 사이 진동)을 낸다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `rms(new Float32Array([0.5,-0.5]))`가 0.5다.
  - 드라이버: 0.2를 연속 입력하면 3, 이후 0을 연속 입력하면 몇 프레임 뒤 0으로 내려간다. 0.2 입력 직후 1프레임 만에 0으로 떨어지지 않는다(release 확인).
  - `charSchedule("안녕, 보리", 1000)`은 길이가 6이고, 단조 증가하며, 마지막 값 ≤ 950이다. 쉼표 다음 글자 간격이 다른 간격보다 크다.
- [ ] **Step 2: 실행해서 FAIL을 확인한다.**
- [ ] **Step 3: 구현한다.** `player.js`는 DOM/WebAudio에 의존하므로 단위 테스트하지 않고 Task 8 스모크에서 확인한다.
- [ ] **Step 4: 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): 립싱크·자막 계산과 재생 큐`.

---

### Task 7: 아바타 레이어 + 오리지널 플레이스홀더 자산

**Files:**
- Create: `village-call/public/js/avatar.js`, `village-call/public/js/motion.js`
- Create: `village-call/character/assets/` 아래 9개 파일 (오리지널 SVG 플레이스홀더, 모두 같은 viewBox `0 0 800 1000`)
  - `background.svg`
  - `character_base.svg`
  - `mouth_0.svg` ~ `mouth_3.svg`
  - `eyes_open.svg`, `eyes_closed.svg`, `eyes_happy.svg`
- Create: `village-call/docs/ASSETS.md`
- Test: `village-call/test/motion.test.js`

**Interfaces:**
- Consumes: Task 1 `/api/character`의 `layout`, `lipsync`, `simpleMode`, `assets`
- Produces:
  - `motion.js` (순수 함수)
    - `bobOffset(level: number, t: number) -> {y: number, rot: number}`. y는 0~3px, rot은 ±1.2deg다.
    - `breath(t: number) -> number`. scaleY 1.000~1.010, 주기 4000ms다.
    - `nextBlinkDelay(rand = Math.random) -> number`. 2000~6000ms다.
  - `avatar.js`: `createAvatar(rootEl, characterInfo) -> { setMouth(0|1|2|3), setExpression(Expression), setMode("idle"|"listening"|"thinking"|"speaking"), gesturePulse(), tick(level: number, t: number) }`
    - 레이어는 절대 배치된 `<img>`로 쌓는다. 순서는 base → eyes → mouth다.
    - 표정용 눈 파일이 assets에 없으면 `eyes_open`을 쓴다. happy일 때는 깜빡임을 멈춘다.
    - `simpleMode:true`이면 `full_neutral`과 `full_talk` 두 장만 쓰고, 입 단계가 1 이상일 때 talk를 보여준다.
    - listening 모드에서는 `tick`에 사용자 음량을 넘긴다. 0.04를 넘는 상태가 600ms 이상 이어지면 가끔(최소 2.5초 간격) 끄덕이는 CSS 애니메이션을 재생한다.
    - thinking 모드에서는 고개를 5deg 기울이고 눈을 위로 3px 올린다.

플레이스홀더 캐릭터는 둥근 갈색 수달 안내원이다. 단순한 도형으로 그리고, 노란색 계열 개 캐릭터나 머리 방울 같은 특정 게임 캐릭터의 특징은 피한다. 배경은 나무 벽, 창, 책상, 화분이 있는 단순한 방이다. `ASSETS.md`에는 스펙 6장의 표와 정렬 규칙, 간이 모드, 교체 방법(파일명 유지 또는 `character.json`의 `assets` 수정)을 적는다.

- [ ] **Step 1: 실패하는 테스트 작성** (motion.js)
  - `bobOffset(0, t).y === 0`, `bobOffset(1, t).y <= 3`
  - `breath`의 최소값과 최대값이 1.000~1.010 범위 안이다.
  - `nextBlinkDelay(()=>0) === 2000`, `nextBlinkDelay(()=>0.999) < 6000`
- [ ] **Step 2: 실행해서 FAIL을 확인한다.**
- [ ] **Step 3: `motion.js`와 `avatar.js`를 구현하고 SVG 자산을 그린다.**
- [ ] **Step 4: `npm test`를 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): 아바타 레이어와 플레이스홀더 자산`.

---

### Task 8: 음성 인식, 통화 상태 머신, 화면

**Files:**
- Create: `village-call/public/index.html`, `village-call/public/css/style.css`, `village-call/public/js/stt.js`, `village-call/public/js/app.js`, `village-call/public/js/callflow.js`
- Create: `village-call/scripts/smoke.mjs` (Playwright)
- Test: `village-call/test/callflow.test.js`

**Interfaces:**
- Consumes: Task 5 API와 SSE 이벤트, Task 6 `createPlayer`·`createMouthDriver`·`createCaptions`, Task 7 `createAvatar`
- Produces:
  - `callflow.js` (순수 함수)
    - `shouldSend(transcript: string) -> boolean`. 공백을 제거한 길이가 2 이상이어야 true다.
    - `nextState(state, event) -> state`. 전이는 스펙 5.2를 따른다.
      - `start + dial → ringing`
      - `ringing + warm_ready → greeting`
      - `ringing + warm_timeout → failed`
      - `greeting + playback_idle → listening`
      - `listening + final_transcript → thinking`
      - `thinking + first_sentence → speaking`
      - `thinking|speaking + chat_error → speaking` (fallback 재생)
      - `speaking + playback_idle → listening`
      - `* + hangup|call_over|time_up → ended`
    - `parseSSE(chunk: string, carry: string) -> { events: {event, data}[], carry }`
  - `stt.js`: `createStt({ onInterim(text), onFinal(text), onError(code) }) -> { start(), stop(), supported: boolean }`. `webkitSpeechRecognition || SpeechRecognition`을 `ko-KR`, `interimResults=true`, `continuous=false`로 쓴다. `no-speech`와 빈 결과는 `onFinal("")`로 넘긴다.
  - `app.js`가 연결하는 것:
    - "통화 걸기" 클릭 시 `AudioContext`를 생성·resume하고 `getUserMedia({audio:true})`로 마이크 음량 분석을 시작한다(PiP 링과 듣기 모션용). 이어서 `/api/call/start`를 호출하고, 1.5초 간격으로 `/api/warm`을 폴링한다. 40초가 지나면 failed다.
    - greeting: `/audio/greeting.wav`가 있으면 재생하고, 없으면 `audio:null` 문장으로 처리한다.
    - listening에서 `onFinal`이 오면 `shouldSend` 결과에 따라 thinking으로 가거나 다시 `stt.start()`를 한다.
    - thinking/speaking 중에는 `stt.stop()`을 한다. speaking이 끝나면 0.6초 뒤 `stt.start()`를 한다.
    - `requestAnimationFrame` 루프에서 `player.level()` → `mouthDriver.update` → `avatar.setMouth`와 `avatar.tick`을 처리한다.
    - 403 `call_over`이거나 타이머가 `maxSeconds`에 도달하면 `character.farewell`을 (`/audio/farewell.wav` 또는 자막으로) 재생한 뒤 ended로 간다.
    - 미지원 브라우저면 시작 화면에 "크롬, 엣지, 사파리에서 열어주세요"를 표시한다. 마이크 권한이 거부되면 권한 안내를 띄운다. start가 429면 사유별 문구를 띄운다(`ip_limit`: "오늘은 통화를 많이 했어요. 내일 또 걸어주세요!", `closed_today`: "오늘은 안내소 영업이 끝났어요").
  - 화면은 스펙 5.2 레이아웃이다.
    - 상단 바: 이름, 통화 시간
    - 무대: 배경 + 아바타, 배경 오버레이(햇살 일렁임, 먼지)는 `prefers-reduced-motion`이면 끔
    - 우하단 "나" PiP와 마이크 링
    - 하단: 캐릭터 자막(크림색 둥근 박스), 내 자막, 음소거·종료 버튼
    - 시작 화면과 종료 화면("통화 종료 · mm:ss", 다시 걸기)
    - 360px 폭에서도 가로 스크롤이 없어야 한다

- [ ] **Step 1: 실패하는 테스트 작성** (callflow.js)
  - `shouldSend("")`, `shouldSend(" 음 ")`는 false이고 `shouldSend("안녕")`은 true다.
  - 위 전이표의 각 행을 `nextState`로 확인한다. 정의되지 않은 전이는 상태를 그대로 둔다.
  - `parseSSE`: 이벤트 두 개와 잘린 세 번째 이벤트가 섞인 청크에서 2개를 파싱하고 carry를 남긴다. 이어지는 청크와 합치면 세 번째가 완성된다.
- [ ] **Step 2: 실행해서 FAIL을 확인한다.**
- [ ] **Step 3: callflow.js, stt.js, app.js, html/css를 구현한다.**
- [ ] **Step 4: `npm test`를 실행해서 PASS를 확인한다.**
- [ ] **Step 5: 스모크 확인.** `scripts/smoke.mjs`를 작성한다.
  - mock 제공자로 서버를 띄운다.
  - Chromium을 `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`로 실행한다.
  - `webkitSpeechRecognition`은 `page.addInitScript`로 가짜 객체를 주입한다. start 1초 뒤 `"오늘 날씨 좋네요"`로 onresult와 onend를 발생시킨다.
  - 시나리오: 통화 걸기 → listening → speaking 진입 → 자막에 "우와" 포함 → speaking 중 입 레이어 src가 2종 이상 관측 → listening 복귀
  - 1280×720과 390×844에서 스크린샷을 `village-call/scripts/out/`에 저장한다(gitignore).
  - 실행: `node scripts/smoke.mjs`. 기대 출력은 `SMOKE OK`이고, 스크린샷을 눈으로 확인한다.
- [ ] **Step 6: 커밋한다.** 메시지는 `feat(village-call): 통화 화면과 상태 머신`.

---

### Task 9: GPT-SoVITS TTS 서버 (Modal) + prebake + 배포 문서

**Files:**
- Create: `village-call/tts-server/modal_app.py`, `village-call/tts-server/requirements.txt`, `village-call/tts-server/README.md`
- Create: `village-call/scripts/prebake.mjs`
- Create: `village-call/README.md`

**Interfaces:**
- Consumes: Task 4가 기대하는 HTTP 계약 (`POST /tts {text}` + Bearer → `audio/wav`, `GET /warm` → 200)
- Produces:
  - `modal_app.py`
    - Modal App `village-call-tts`
    - 이미지: GPT-SoVITS 저장소를 **사용자 모델 버전에 맞는 태그**로 clone하고, requirements와 사전학습 모델(hubert, roberta 등 해당 버전 README가 요구하는 것)을 이미지 빌드 단계에서 다운로드한다.
    - Volume `village-call-models`의 `/models/gpt.ckpt`, `/models/sovits.pth`, `/models/ref.wav`, `/models/ref.txt`를 쓴다.
    - GPU `L4`, 유휴 축소 300초
    - 클래스 `@modal.enter`에서 `TTS_infer_pack.TTS`를 초기화한다. `init_t2s_weights(gpt.ckpt)`와 `init_vits_weights(sovits.pth)`를 호출한다.
    - `@modal.fastapi_endpoint` 또는 `@modal.asgi_app`으로 `/tts`와 `/warm`을 연다.
    - `/tts`는 `text_lang="ko"`, `prompt_lang="ko"`, `ref_audio_path=/models/ref.wav`, `prompt_text=ref.txt 내용`으로 `tts.run(...)`을 호출하고 결과를 wav로 인코딩해 반환한다.
    - 토큰은 Modal Secret `village-call-tts`의 `TTS_TOKEN`과 비교한다. 다르면 401이다.
  - `tts-server/README.md`: Modal 설치·로그인, `modal volume put`으로 모델 4개 업로드, `modal secret create`, `modal deploy`, 나온 URL을 `TTS_URL`에 넣는 방법을 적는다.
  - `prebake.mjs`: `createTts(loadConfig())`로 `greeting`, `farewell`, `fallbackLines[i]`를 합성해 `character/fallback-audio/{greeting,farewell,fallback_<i>}.wav`로 저장한다.
  - 루트 `README.md`에는 로컬 실행(mock 모드 포함), 환경변수 표, 웹 배포(Render 예시: build `npm ci`, start `npm start`, env 설정), 비용·제한값 조절, 이미지 교체(`docs/ASSETS.md` 링크)를 적는다.

- [ ] **Step 1: 사용자 모델 확인.** 사용자가 `.ckpt`/`.pth`를 제공하면 `python3 -I -c "import torch; d=torch.load(p, map_location='cpu', weights_only=False); print(d.keys(), d.get('config'), d.get('info'))"`로 버전과 설정을 확인하고, clone 태그와 사전학습 모델 목록을 확정한다. 아직 제공되지 않았으면 최신 안정 버전 기준으로 작성하고, README에 "모델 버전 확인 필요"로 표시한다.
- [ ] **Step 2: `modal_app.py`를 작성한다.** `python3 -m py_compile village-call/tts-server/modal_app.py`가 오류 없이 통과해야 한다.
- [ ] **Step 3: `prebake.mjs`를 작성한다.** `TTS_PROVIDER=mock node scripts/prebake.mjs`를 실행하면 wav 파일 3개 이상이 생성되어야 한다. 생성물은 커밋하지 않는다. 배포 시 실제 TTS로 다시 생성한다.
- [ ] **Step 4: README 2개를 작성한다.** `npm test`가 전체 PASS인지 확인한다.
- [ ] **Step 5: 커밋한다.** 메시지는 `feat(village-call): GPT-SoVITS Modal 서버와 배포 문서`.
- [ ] **Step 6 (사용자 계정이 필요한 단계, 사용자와 함께 진행):**
  1. 사용자의 Modal 계정에 배포한다.
  2. `curl -X POST $TTS_URL/tts -H "Authorization: Bearer $TTS_TOKEN" -d '{"text":"안녕하세요"}' -o out.wav`로 음성을 받아 직접 들어본다.
  3. 실제 TTS로 prebake를 다시 실행한다.
  4. Anthropic 키를 넣고 실제 통화를 수동 체크리스트(스펙 7장)대로 확인한다.
