// 아바타 모션용 순수 함수.

export function bobOffset(level, t) {
  const l = Math.max(0, Math.min(1, level / 0.15));
  if (!l) return { y: 0, rot: 0 };
  const y = 3 * l * (0.5 + 0.5 * Math.sin(t / 90));
  const rot = 1.2 * l * Math.sin(t / 260);
  return { y, rot };
}

export function breath(t) {
  return 1 + 0.005 * (1 + Math.sin((2 * Math.PI * t) / 4000));
}

export function nextBlinkDelay(rand = Math.random) {
  return 2000 + rand() * 4000;
}
