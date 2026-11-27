// 음량(RMS) → 입 모양 단계(0~3). 브라우저와 node 테스트 양쪽에서 쓰는 순수 모듈.

export function rms(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export function createMouthDriver({ thresholds, attack, release }) {
  const d = {
    level: 0,
    update(x) {
      const k = x > d.level ? attack : release;
      d.level += (x - d.level) * k;
      let stage = 0;
      for (let i = 0; i < thresholds.length; i++) if (d.level >= thresholds[i]) stage = i + 1;
      return stage;
    },
  };
  return d;
}
