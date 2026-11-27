// Web Speech API 래퍼. 한 번 말하고 멈추면 onFinal(최종 문장)을 부른다. 아무 말 없으면 onFinal("").
export function createStt({ onInterim = () => {}, onFinal = () => {}, onError = () => {} } = {}) {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) return { supported: false, start() {}, stop() {} };

  let rec = null;
  let finalText = "";

  const create = () => {
    const r = new SR();
    r.lang = "ko-KR";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onInterim((finalText + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") onError("not-allowed");
      else if (e.error !== "no-speech" && e.error !== "aborted") onError(e.error);
    };
    r.onend = () => {
      rec = null;
      onFinal(finalText.trim());
    };
    return r;
  };

  return {
    supported: true,
    start() {
      if (rec) return;
      finalText = "";
      rec = create();
      try {
        rec.start();
      } catch {
        rec = null;
      }
    },
    stop() {
      if (!rec) return;
      // 이전 인식기의 늦은 이벤트는 무시하고 바로 새로 시작할 수 있게 한다.
      const old = rec;
      rec = null;
      old.onresult = old.onerror = old.onend = null;
      try {
        old.abort();
      } catch {}
    },
  };
}
