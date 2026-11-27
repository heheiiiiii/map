export const EXPRESSIONS = ["neutral", "happy", "surprised", "sad", "thinking"];

// 종결부호 뒤에 공백이 와야 문장을 확정한다(push 중). 버퍼 끝의 종결부호는
// 다음 청크에서 "?!"처럼 이어질 수 있으므로 flush 때만 확정한다.
const PENDING = /[.!?~…]+(?=\s)|\n/;
const FINAL = /[.!?~…]+(?=\s|$)|\n/;

export function createSentenceSplitter() {
  let buf = "";
  const drain = (re) => {
    const out = [];
    let m;
    while ((m = re.exec(buf))) {
      const end = m.index + m[0].length;
      const s = buf.slice(0, end).trim();
      buf = buf.slice(end);
      if (s) out.push(s);
    }
    return out;
  };
  return {
    push(chunk) {
      buf += chunk;
      return drain(PENDING);
    },
    flush() {
      const out = drain(FINAL);
      const rest = buf.trim();
      buf = "";
      if (rest) out.push(rest);
      return out;
    },
  };
}

export function parseExpression(text) {
  const m = /^\s*\[([A-Za-z]+)\]\s*/.exec(text);
  if (!m) return { expression: "neutral", rest: text.trim() };
  const tag = m[1].toLowerCase();
  return {
    expression: EXPRESSIONS.includes(tag) ? tag : "neutral",
    rest: text.slice(m[0].length).trim(),
  };
}

export function cleanForSpeech(text) {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
