// 자막: 문장 음성 길이에 글자를 비례 배분해 한 글자씩 보여준다.

const PAUSE_AFTER = /[,.!?~…]/;

export function charSchedule(text, durationMs) {
  const chars = [...text];
  if (!chars.length) return [];
  const weights = chars.map((c) => (/\s/.test(c) ? 0 : 1) + (PAUSE_AFTER.test(c) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = durationMs * 0.9;
  const out = [];
  let acc = 0;
  for (let i = 0; i < chars.length; i++) {
    out.push(Math.round((acc / total) * span));
    acc += weights[i];
  }
  return out;
}

export function createCaptions(el) {
  el.innerHTML = '<div class="cap-character" aria-live="polite"></div><div class="cap-user"></div>';
  const charEl = el.querySelector(".cap-character");
  const userEl = el.querySelector(".cap-user");
  let timers = [];

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  return {
    showSentence(text, durationMs) {
      // 직전 문장이 남아 있으면 즉시 완성시킨다.
      clearTimers();
      charEl.querySelectorAll(".line").forEach((l) => (l.textContent = l.dataset.full));
      const line = document.createElement("div");
      line.className = "line";
      line.dataset.full = text;
      charEl.append(line);
      while (charEl.children.length > 2) charEl.firstElementChild.remove();
      const chars = [...text];
      charSchedule(text, durationMs).forEach((t, i) => {
        timers.push(setTimeout(() => (line.textContent = chars.slice(0, i + 1).join("")), t));
      });
      charEl.parentElement.classList.add("has-character");
    },
    showUser(text, final) {
      userEl.textContent = text;
      userEl.classList.toggle("final", !!final);
    },
    clear() {
      clearTimers();
      charEl.replaceChildren();
      userEl.textContent = "";
      el.classList.remove("has-character");
    },
  };
}
