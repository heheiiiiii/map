import { createStt } from "./stt.js";
import { createPlayer } from "./player.js";
import { createMouthDriver, rms } from "./lipsync.js";
import { createCaptions } from "./captions.js";
import { createAvatar } from "./avatar.js";
import { shouldSend, nextState, parseSSE } from "./callflow.js";

const WARM_POLL_MS = 1500;
const WARM_TIMEOUT_MS = 40_000;
const BACK_TO_LISTEN_MS = 600;
const FALLBACK_MS_PER_CHAR = 110;
const LIMIT_MESSAGES = {
  ip_limit: "오늘은 통화를 많이 했어요. 내일 또 걸어주세요!",
  closed_today: "오늘은 안내소 영업이 끝났어요. 내일 다시 걸어주세요!",
};

const $ = (s) => document.querySelector(s);
const app = $("#app");
const notice = $("#notice");
const captions = createCaptions($("#captions"));

let info;
let avatar;
let stt;
let ctx;
let player;
let mouth;
let micAnalyser;
let micBuf;
let state = "start";
let call = null; // { token, maxSeconds, startedAt, history, muted, abort, chatDone, gotSentence, ending }

// ── 상태 ─────────────────────────────────
function dispatch(event) {
  const prev = state;
  state = nextState(state, event);
  if (state === prev) return;
  app.dataset.state = state;
  const mode = { speaking: "speaking", greeting: "speaking", listening: "listening", thinking: "thinking" }[state] || "idle";
  avatar?.setMode(mode);
  if (state === "listening") enterListening();
  if (state !== "listening") stt?.stop();
}

function enterListening() {
  avatar.setExpression("neutral");
  captions.showUser("", false);
  if (!call.muted) stt.start();
}

// ── 초기화 ───────────────────────────────
async function init() {
  info = await (await fetch("/api/character")).json();
  document.querySelectorAll(".char-name").forEach((el) => (el.textContent = info.name));
  document.title = `${info.name} · 영상통화`;
  $(".bg").style.setProperty("--bg-url", `url("/assets/${info.assets.background}")`);
  $("#captions").style.setProperty("--name", JSON.stringify(info.name));
  avatar = createAvatar($("#avatar-root"), info);
  buildPortrait();

  stt = createStt({
    onInterim: (t) => state === "listening" && captions.showUser(t, false),
    onFinal: onUserFinal,
    onError: (code) => {
      if (code === "not-allowed") showNotice("마이크 권한을 허용해야 통화할 수 있어요.");
    },
  });
  if (!stt.supported) {
    $("#dial").disabled = true;
    showNotice("이 브라우저는 음성 인식을 지원하지 않아요. 크롬, 엣지, 사파리에서 열어주세요.");
  }
  $("#dial").addEventListener("click", dial);
  $("#redial").addEventListener("click", dial);
  $("#hangup").addEventListener("click", () => endCall("hangup"));
  $("#mute").addEventListener("click", toggleMute);
  requestAnimationFrame(frame);
}

function buildPortrait() {
  const p = $("#portrait");
  const a = info.assets;
  const files = info.simpleMode ? [a.full.neutral] : [a.base, a.eyes.open, a.mouth[0]];
  for (const f of files) {
    const im = document.createElement("img");
    im.src = `/assets/${f}`;
    im.alt = "";
    p.append(im);
  }
}

function showNotice(text) {
  notice.textContent = text;
}

// ── 통화 걸기 ─────────────────────────────
async function dial() {
  showNotice("");
  ctx ??= new AudioContext();
  await ctx.resume();
  player ??= createPlayer(ctx);
  player.onSentenceStart(onSentenceStart);
  player.onIdle(onPlayerIdle);
  mouth = createMouthDriver(info.lipsync);

  if (!micAnalyser) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 1024;
      micBuf = new Float32Array(micAnalyser.fftSize);
      ctx.createMediaStreamSource(stream).connect(micAnalyser);
    } catch {
      showNotice("마이크 권한을 허용해야 통화할 수 있어요. 주소창의 권한 설정을 확인해주세요.");
      return;
    }
  }

  let res;
  try {
    res = await fetch("/api/call/start", { method: "POST" });
  } catch {
    showNotice("연결이 불안정해요. 잠시 후 다시 걸어주세요.");
    return;
  }
  if (res.status === 429) {
    const { error } = await res.json();
    showNotice(LIMIT_MESSAGES[error] || "지금은 통화할 수 없어요.");
    return;
  }
  if (!res.ok) {
    showNotice("지금은 통화할 수 없어요. 잠시 후 다시 걸어주세요.");
    return;
  }
  const { token, maxSeconds } = await res.json();
  call = { token, maxSeconds, startedAt: 0, history: [], muted: false, abort: null, chatDone: true, gotSentence: false, ending: false };
  captions.clear();
  avatar.setExpression("neutral");
  dispatch("dial");
  const ring = startRingtone();
  const ready = await waitForWarm();
  ring.stop();
  if (state !== "ringing") return; // 연결 중 끊음
  if (!ready) {
    dispatch("warm_timeout");
    showNotice("지금은 전화를 받을 수 없어요. 잠시 후 다시 걸어주세요.");
    return;
  }
  call.startedAt = performance.now();
  dispatch("warm_ready");
  avatar.setExpression("happy");
  await playLine("greeting", info.greeting ?? "");
}

async function waitForWarm() {
  const until = performance.now() + WARM_TIMEOUT_MS;
  while (performance.now() < until && state === "ringing") {
    try {
      const { ready } = await (await fetch("/api/warm")).json();
      if (ready) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, WARM_POLL_MS));
  }
  return false;
}

function startRingtone() {
  let stopped = false;
  const beep = () => {
    if (stopped) return;
    const t = ctx.currentTime;
    for (const [hz, start] of [[660, 0], [880, 0.18]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz;
      o.type = "sine";
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(0.12, t + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t + start);
      o.stop(t + start + 0.4);
    }
  };
  beep();
  const id = setInterval(beep, 1600);
  return { stop: () => { stopped = true; clearInterval(id); } };
}

// 미리 생성된 음성(/audio/<name>.wav)이 있으면 재생하고, 없으면 자막만으로 말한다.
async function playLine(file, text) {
  let audio = null;
  try {
    const r = await fetch(`/audio/${file}.wav`);
    if (r.ok) audio = await r.arrayBuffer();
  } catch {}
  player.enqueue({ audio, text, durationMs: [...text].length * FALLBACK_MS_PER_CHAR });
}

// ── 내 차례 ───────────────────────────────
function onUserFinal(text) {
  if (state !== "listening") return;
  if (!shouldSend(text)) {
    captions.showUser("", false);
    if (!call.muted) setTimeout(() => state === "listening" && !call.muted && stt.start(), 250);
    return;
  }
  captions.showUser(text, true);
  call.history.push({ role: "user", content: text.slice(0, 300) });
  dispatch("final_transcript");
  sendChat();
}

async function sendChat() {
  call.chatDone = false;
  call.gotSentence = false;
  call.abort = new AbortController();
  let res;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${call.token}` },
      body: JSON.stringify({ messages: call.history.slice(-40) }),
      signal: call.abort.signal,
    });
  } catch {
    if (call && !call.ending) return chatFailed();
    return;
  }
  if (res.status === 403 || res.status === 401) return endCall("call_over");
  if (!res.ok || !res.body) return chatFailed();

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let carry = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const parsed = parseSSE(value, carry);
      carry = parsed.carry;
      for (const ev of parsed.events) handleEvent(ev);
    }
  } catch {
    if (call && !call.ending && !call.chatDone) chatFailed();
    return;
  }
  if (call && !call.chatDone) {
    call.chatDone = true;
    maybeBackToListening();
  }
}

function handleEvent({ event, data }) {
  if (!call || call.ending) return;
  if (event === "expression") avatar.setExpression(data.expression);
  if (event === "sentence") {
    if (!call.gotSentence) {
      call.gotSentence = true;
      dispatch("first_sentence");
    }
    player.enqueue({ audio: data.audio ? b64ToBuffer(data.audio) : null, text: data.text, durationMs: data.durationMs });
  }
  if (event === "done") {
    if (data.text) call.history.push({ role: "assistant", content: data.text });
    call.chatDone = true;
    maybeBackToListening();
  }
  if (event === "error") chatFailed();
}

function chatFailed() {
  if (!call) return;
  // 이미 말하던 문장이 있으면 그대로 마무리하고, 없으면 실패 대사를 한다.
  if (!call.gotSentence) {
    call.gotSentence = true;
    dispatch("chat_error");
    avatar.setExpression("surprised");
    call.history.pop(); // 답을 못 받은 질문은 기록에서 뺀다
    playLine("fallback_0", info.fallbackLines?.[0] ?? "");
  }
  call.chatDone = true;
  maybeBackToListening();
}

function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// ── 재생 ─────────────────────────────────
function onSentenceStart(item, ms) {
  if (call?.ending === "farewell") call.farewellPlaying = true;
  captions.showSentence(item.text, ms);
  avatar.gesturePulse();
}

function onPlayerIdle() {
  if (!call) return;
  if (call.ending) {
    if (call.farewellPlaying) finishEnd();
    return;
  }
  if (state === "greeting") return dispatch("playback_idle");
  maybeBackToListening();
}

function maybeBackToListening() {
  if (!call || state === "listening") return;
  if (state === "thinking" && call.chatDone && !call.gotSentence) {
    // 문장 없이 끝난 응답: 말한 것으로 치고 곧바로 내 차례로
    call.gotSentence = true;
    dispatch("first_sentence");
  }
  if (state !== "speaking" || !call.chatDone || !player.isIdle()) return;
  setTimeout(() => {
    if (call && !call.ending && state === "speaking" && player.isIdle()) dispatch("playback_idle");
  }, BACK_TO_LISTEN_MS);
}

// ── 종료 ─────────────────────────────────
function endCall(reason) {
  if (!call || call.ending) return;
  call.ending = true;
  call.abort?.abort();
  stt.stop();
  player.stop();
  if (reason === "hangup" || state === "ringing") {
    finishEnd();
    return;
  }
  // 시간 초과 등: 작별 인사를 하고 끊는다.
  avatar.setExpression("happy");
  avatar.setMode("speaking");
  call.ending = "farewell";
  playLine("farewell", info.farewell ?? "");
}

function finishEnd() {
  const secs = call?.startedAt ? Math.round((performance.now() - call.startedAt) / 1000) : 0;
  $("#end-time").textContent = `통화 시간 ${fmt(secs)}`;
  call = null;
  captions.clear();
  dispatch("hangup");
  if (state !== "ended") {
    state = "ended";
    app.dataset.state = "ended";
  }
  avatar.setMode("idle");
  avatar.setMouth(0);
}

function toggleMute() {
  if (!call) return;
  call.muted = !call.muted;
  $("#mute").setAttribute("aria-pressed", String(call.muted));
  $("#mute").setAttribute("aria-label", call.muted ? "마이크 켜기" : "마이크 끄기");
  app.dataset.muted = String(call.muted);
  if (call.muted) stt.stop();
  else if (state === "listening") stt.start();
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── 애니메이션 루프 ───────────────────────
function frame(t) {
  requestAnimationFrame(frame);
  if (!avatar) return;
  const speaking = state === "speaking" || state === "greeting" || call?.ending === "farewell";
  const charLevel = speaking && player ? player.level() : 0;
  const stage = mouth ? mouth.update(charLevel) : 0;
  avatar.setMouth(speaking ? stage : 0);

  let micLevel = 0;
  if (micAnalyser && call && !call.muted) {
    micAnalyser.getFloatTimeDomainData(micBuf);
    micLevel = rms(micBuf);
  }
  avatar.tick(speaking ? charLevel : micLevel, t);
  $("#pip-ring").style.setProperty("--mic", String(1 + Math.min(micLevel * 4, 0.35)));

  if (call?.startedAt) {
    const secs = Math.floor((performance.now() - call.startedAt) / 1000);
    $("#timer").textContent = fmt(secs);
    if (secs >= call.maxSeconds && !call.ending) endCall("time_up");
  }
}

init();
