// 통화 흐름의 순수 로직: 발화 필터, 상태 전이, SSE 파싱.

export function shouldSend(transcript) {
  return typeof transcript === "string" && transcript.replace(/\s/g, "").length >= 2;
}

const TABLE = {
  start: { dial: "ringing" },
  ringing: { warm_ready: "greeting", warm_timeout: "failed" },
  greeting: { playback_idle: "listening" },
  listening: { final_transcript: "thinking" },
  thinking: { first_sentence: "speaking", chat_error: "speaking" },
  speaking: { playback_idle: "listening", chat_error: "speaking" },
  ended: { dial: "ringing" },
  failed: { dial: "ringing" },
};
const IN_CALL = new Set(["ringing", "greeting", "listening", "thinking", "speaking"]);
const END_EVENTS = new Set(["hangup", "call_over", "time_up"]);

export function nextState(state, event) {
  if (END_EVENTS.has(event) && IN_CALL.has(state)) return "ended";
  return TABLE[state]?.[event] ?? state;
}

export function parseSSE(chunk, carry) {
  const text = carry + chunk;
  const blocks = text.split("\n\n");
  const rest = blocks.pop();
  const events = [];
  for (const block of blocks) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) continue;
    try {
      events.push({ event, data: JSON.parse(data) });
    } catch {
      /* 깨진 이벤트는 버린다 */
    }
  }
  return { events, carry: rest };
}
