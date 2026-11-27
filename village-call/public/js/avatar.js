import { bobOffset, breath, nextBlinkDelay } from "./motion.js";

const EYE_KEYS = { neutral: "open", happy: "happy", surprised: "surprised", sad: "sad", thinking: "thinking" };
const NOD_GAP_MS = 2500;
const NOD_AFTER_MS = 600;
const LISTEN_LEVEL = 0.04;

const img = (src, cls) => {
  const el = document.createElement("img");
  el.src = src;
  el.className = `layer ${cls}`;
  el.alt = "";
  el.draggable = false;
  return el;
};

// characterInfo: GET /api/character 응답. 이미지는 /assets/<파일명>.
export function createAvatar(root, info, assetBase = "/assets/") {
  const a = info.assets;
  const url = (f) => assetBase + f;
  const L = info.layout;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.style.setProperty("--x", L.x);
  avatar.style.setProperty("--bottom", L.bottom);
  avatar.style.setProperty("--h", L.height);
  const rig = document.createElement("div");
  rig.className = "rig";
  avatar.append(rig);
  root.append(avatar);

  let mouthEls = [];
  let eyesEl = null;
  let closedEl = null;
  let fullEls = null;

  if (info.simpleMode) {
    fullEls = { neutral: img(url(a.full.neutral), "full"), talk: img(url(a.full.talk), "full") };
    fullEls.talk.hidden = true;
    rig.append(fullEls.neutral, fullEls.talk);
  } else {
    rig.append(img(url(a.base), "base"));
    eyesEl = img(url(a.eyes.open), "eyes");
    closedEl = img(url(a.eyes.closed), "eyes closed");
    closedEl.hidden = true;
    rig.append(eyesEl, closedEl);
    mouthEls = a.mouth.map((f, i) => {
      const m = img(url(f), `mouth m${i}`);
      m.hidden = i !== 0;
      rig.append(m);
      return m;
    });
  }

  let mouth = 0;
  let expression = "neutral";
  let mode = "idle";
  let loudSince = 0;
  let lastNod = 0;

  // 눈 깜빡임
  let blinkTimer;
  const scheduleBlink = () => {
    blinkTimer = setTimeout(() => {
      if (closedEl && expression !== "happy") {
        closedEl.hidden = false;
        eyesEl.hidden = true;
        setTimeout(() => {
          closedEl.hidden = true;
          eyesEl.hidden = false;
        }, 120);
      }
      scheduleBlink();
    }, nextBlinkDelay());
  };
  scheduleBlink();

  const pulse = (cls, ms) => {
    rig.classList.remove(cls);
    void rig.offsetWidth; // 애니메이션 재시작
    rig.classList.add(cls);
    setTimeout(() => rig.classList.remove(cls), ms);
  };

  return {
    el: avatar,
    setMouth(stage) {
      if (stage === mouth) return;
      mouth = stage;
      if (fullEls) {
        fullEls.talk.hidden = stage < 1;
        fullEls.neutral.hidden = stage >= 1;
        return;
      }
      mouthEls.forEach((m, i) => (m.hidden = i !== stage));
    },
    setExpression(exp) {
      expression = exp;
      if (!eyesEl) return;
      const file = a.eyes[EYE_KEYS[exp]] || a.eyes.open;
      eyesEl.src = url(file);
    },
    setMode(m) {
      mode = m;
      avatar.dataset.mode = m;
      loudSince = 0;
    },
    gesturePulse() {
      pulse("gesture", 700);
    },
    // level: speaking이면 캐릭터 음량, listening이면 사용자 마이크 음량
    tick(level, t) {
      let y = 0;
      let rot = 0;
      if (mode === "speaking") ({ y, rot } = bobOffset(level, t));
      if (mode === "listening") {
        if (level > LISTEN_LEVEL) {
          loudSince ||= t;
          if (t - loudSince > NOD_AFTER_MS && t - lastNod > NOD_GAP_MS) {
            lastNod = t;
            pulse("nod", 900);
          }
        } else loudSince = 0;
      }
      rig.style.setProperty("--bob-y", `${-y}px`);
      rig.style.setProperty("--bob-rot", `${rot}deg`);
      rig.style.setProperty("--breath", breath(t));
    },
    destroy() {
      clearTimeout(blinkTimer);
      avatar.remove();
    },
  };
}
