// 최소한의 WAV(PCM) 유틸.

export function wavDurationMs(buf) {
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") {
      if (!byteRate) break;
      const dataSize = Math.min(size, buf.length - off - 8);
      return (dataSize / byteRate) * 1000;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("invalid wav");
}

export function encodeWav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// syllableMs를 주면 음절마다 진폭이 출렁이는 소리를 만든다 (립싱크 확인용).
export function makeSineWav(ms, { hz = 220, sampleRate = 16000, syllableMs = 0, amp = 0.4 } = {}) {
  const n = Math.round((ms / 1000) * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (syllableMs) {
      const phase = ((t * 1000) % syllableMs) / syllableMs;
      env = Math.sin(Math.PI * phase);
    }
    out[i] = amp * env * Math.sin(2 * Math.PI * hz * t);
  }
  return encodeWav(out, sampleRate);
}
