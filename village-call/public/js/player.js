import { rms } from "./lipsync.js";

// 문장 음성 재생 큐. 모든 소리는 AnalyserNode를 거쳐 립싱크용 음량을 제공한다.
export function createPlayer(ctx) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.connect(ctx.destination);
  const buf = new Float32Array(analyser.fftSize);

  const queue = [];
  let playing = false;
  let current = null; // { source } | { fakeUntil }
  let startCb = () => {};
  let idleCb = () => {};

  const decode = async (ab) => {
    if (!ab) return null;
    try {
      return await ctx.decodeAudioData(ab.slice(0));
    } catch {
      return null;
    }
  };

  async function next() {
    if (playing) return;
    const item = queue.shift();
    if (!item) {
      current = null;
      idleCb();
      return;
    }
    playing = true;
    const audioBuffer = await item.decoded;
    startCb(item, audioBuffer ? audioBuffer.duration * 1000 : item.durationMs);
    await new Promise((resolve) => {
      if (audioBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        source.onended = resolve;
        current = { source, resolve };
        source.start();
      } else {
        const id = setTimeout(resolve, item.durationMs);
        current = { fakeUntil: performance.now() + item.durationMs, resolve, id };
      }
    });
    playing = false;
    next();
  }

  return {
    enqueue({ audio, text, durationMs }) {
      queue.push({ text, durationMs, decoded: decode(audio) });
      next();
    },
    onSentenceStart(cb) {
      startCb = cb;
    },
    onIdle(cb) {
      idleCb = cb;
    },
    isIdle: () => !playing && queue.length === 0,
    level() {
      if (!current) return 0;
      if (current.fakeUntil) {
        // 음성이 없는 문장: 말하는 듯한 가짜 음량
        return performance.now() < current.fakeUntil ? 0.075 + 0.025 * Math.sin(performance.now() / 70) : 0;
      }
      analyser.getFloatTimeDomainData(buf);
      return rms(buf);
    },
    stop() {
      queue.length = 0;
      if (current?.source) {
        current.source.onended = null;
        try { current.source.stop(); } catch {}
      }
      if (current?.id) clearTimeout(current.id);
      current?.resolve?.();
      current = null;
    },
  };
}
