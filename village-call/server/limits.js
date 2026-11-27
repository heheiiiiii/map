import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// 단일 인스턴스용 인메모리 카운터. 날짜가 바뀌면 이전 날짜 키를 비운다.
export function createMemoryStore() {
  const map = new Map();
  return {
    incr(key) {
      const v = (map.get(key) || 0) + 1;
      map.set(key, v);
      return v;
    },
    get(key) {
      return map.get(key) || 0;
    },
    prune(prefixToKeep) {
      for (const k of map.keys()) if (k.startsWith("d:") && !k.startsWith(prefixToKeep)) map.delete(k);
    },
  };
}

export function createLimits({ limits, secret, now = () => Date.now(), store = createMemoryStore() }) {
  const sign = (payload) => createHmac("sha256", secret).update(payload).digest("base64url");

  function verify(token) {
    if (typeof token !== "string") return null;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = Buffer.from(sign(payload));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    try {
      return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  }

  return {
    startCall(ip) {
      const t = now();
      const d = `d:${day(t)}:`;
      store.prune?.(d);
      if (store.get(`${d}global`) >= limits.globalDailyCalls) return { ok: false, reason: "closed_today" };
      if (store.get(`${d}ip:${ip}`) >= limits.ipDailyCalls) return { ok: false, reason: "ip_limit" };
      store.incr(`${d}global`);
      store.incr(`${d}ip:${ip}`);
      const expiresAt = t + limits.callMaxSeconds * 1000;
      const payload = Buffer.from(JSON.stringify({ id: randomUUID(), exp: expiresAt })).toString("base64url");
      return { ok: true, token: `${payload}.${sign(payload)}`, expiresAt };
    },
    checkTurn(token) {
      const data = verify(token);
      if (!data || typeof data.id !== "string" || typeof data.exp !== "number") return { ok: false, reason: "invalid" };
      if (now() > data.exp) return { ok: false, reason: "call_over" };
      const turns = store.incr(`d:${day(now())}:turns:${data.id}`); // 날짜 키에 묶어 함께 정리
      if (turns > limits.callMaxTurns) return { ok: false, reason: "call_over" };
      return { ok: true };
    },
  };
}
