"""GPT-SoVITS 추론 서버 (Modal 서버리스 GPU).

계약 (village-call/server/tts.js가 기대하는 형식):
  POST /tts   {"text": "..."}  + Authorization: Bearer <TTS_TOKEN>  ->  audio/wav
  GET  /warm                   + Authorization: Bearer <TTS_TOKEN>  ->  200 {"ready": true}

모델 파일은 Modal Volume "village-call-models"에 올려 둔다 (README.md 참고):
  /models/gpt.ckpt     GPT(t2s) 가중치
  /models/sovits.pth   SoVITS(vits) 가중치
  /models/ref.wav      참조 음성 3~10초
  /models/ref.txt      참조 음성의 대사 (한 줄)
"""

import io
import os
import sys
import wave

import modal

# 사용자 모델을 학습한 GPT-SoVITS와 같은 계열의 커밋으로 고정한다. 모델 버전이 다르면 바꾸세요.
GSV_REF = os.environ.get("GSV_REF", "6d51ffc")
# 학습에 쓴 버전: v2 | v2Pro | v2ProPlus | v3 | v4 ...  (.pth에서 자동 감지되기도 함)
MODEL_VERSION = os.environ.get("GSV_VERSION", "v2")
HF = "https://huggingface.co/XXXXRT/GPT-SoVITS-Pretrained/resolve/main"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "wget", "unzip", "build-essential", "cmake")
    .run_commands(
        "git clone https://github.com/RVC-Boss/GPT-SoVITS.git /gsv",
        f"cd /gsv && git checkout {GSV_REF}",
        "pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126",
        "cd /gsv && pip install -r extra-req.txt --no-deps && pip install -r requirements.txt",
        # 사전학습 모델(hubert, roberta 등)과 텍스트 처리용 데이터
        f"cd /gsv && wget -q {HF}/pretrained_models.zip && unzip -q -o pretrained_models.zip -d GPT_SoVITS && rm pretrained_models.zip",
        f"cd /gsv && wget -q {HF}/G2PWModel.zip && unzip -q -o G2PWModel.zip -d GPT_SoVITS/text && rm G2PWModel.zip",
        f"cd /gsv && wget -q {HF}/nltk_data.zip && unzip -q -o nltk_data.zip -d /usr/local/share && rm nltk_data.zip",
    )
    .env({"GSV_VERSION": MODEL_VERSION})
)

app = modal.App("village-call-tts")
models = modal.Volume.from_name("village-call-models", create_if_missing=True)


@app.cls(
    image=image,
    gpu="L4",
    volumes={"/models": models},
    secrets=[modal.Secret.from_name("village-call-tts")],
    scaledown_window=300,  # 5분 동안 요청이 없으면 0으로 축소
    timeout=120,
)
class Voice:
    @modal.enter()
    def load(self):
        os.chdir("/gsv")
        sys.path[:0] = ["/gsv", "/gsv/GPT_SoVITS"]
        from GPT_SoVITS.TTS_infer_pack.TTS import TTS, TTS_Config

        cfg = TTS_Config(
            {
                "custom": {
                    "device": "cuda",
                    "is_half": True,
                    "version": os.environ.get("GSV_VERSION", "v2"),
                    "t2s_weights_path": "/models/gpt.ckpt",
                    "vits_weights_path": "/models/sovits.pth",
                    "bert_base_path": "GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large",
                    "cnhuhbert_base_path": "GPT_SoVITS/pretrained_models/chinese-hubert-base",
                }
            }
        )
        self.tts = TTS(cfg)
        self.tts.init_t2s_weights("/models/gpt.ckpt")
        self.tts.init_vits_weights("/models/sovits.pth")
        with open("/models/ref.txt", encoding="utf-8") as f:
            self.prompt_text = f.read().strip()
        self.token = os.environ["TTS_TOKEN"]
        self.synthesize("안녕하세요.")  # 첫 요청이 느리지 않도록 예열

    def synthesize(self, text: str) -> bytes:
        import numpy as np

        sr, audio = None, []
        for sr, chunk in self.tts.run(
            {
                "text": text,
                "text_lang": "ko",
                "ref_audio_path": "/models/ref.wav",
                "prompt_text": self.prompt_text,
                "prompt_lang": "ko",
                "text_split_method": "cut5",
                "batch_size": 1,
                "speed_factor": 1.0,
                "streaming_mode": False,
                "return_fragment": False,
            }
        ):
            audio.append(chunk)
        pcm = np.concatenate(audio).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm.tobytes())
        return buf.getvalue()

    @modal.asgi_app()
    def web(self):
        from fastapi import FastAPI, Header, HTTPException
        from fastapi.responses import Response
        from pydantic import BaseModel

        api = FastAPI()

        class Body(BaseModel):
            text: str

        def check(auth: str | None):
            if auth != f"Bearer {self.token}":
                raise HTTPException(status_code=401)

        @api.get("/warm")
        def warm(authorization: str | None = Header(default=None)):
            check(authorization)
            return {"ready": True}

        @api.post("/tts")
        def tts(body: Body, authorization: str | None = Header(default=None)):
            check(authorization)
            text = body.text.strip()[:300]
            if not text:
                raise HTTPException(status_code=400)
            return Response(content=self.synthesize(text), media_type="audio/wav")

        return api
