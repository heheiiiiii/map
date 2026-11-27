# TTS 서버 (GPT-SoVITS on Modal)

학습한 GPT-SoVITS 목소리를 Modal의 서버리스 GPU에서 돌립니다. 요청이 없으면 5분 뒤 자동으로 꺼져서, 쓴 만큼만 비용이 나갑니다.

## 1. 준비

```bash
pip install -r requirements.txt
modal setup                      # 브라우저로 Modal 로그인
```

## 2. 모델 파일 올리기

아래 네 파일을 이 이름 그대로 Volume에 올립니다.

| 파일 | 내용 |
|---|---|
| `gpt.ckpt` | GPT 가중치 (학습 결과 `GPT_weights*/…ckpt`) |
| `sovits.pth` | SoVITS 가중치 (학습 결과 `SoVITS_weights*/…pth`) |
| `ref.wav` | 참조 음성, 3~10초, 잡음 없는 한 문장 |
| `ref.txt` | `ref.wav`에서 말하는 대사 그대로 (한 줄) |

```bash
modal volume create village-call-models
modal volume put village-call-models ./gpt.ckpt   /gpt.ckpt
modal volume put village-call-models ./sovits.pth /sovits.pth
modal volume put village-call-models ./ref.wav    /ref.wav
modal volume put village-call-models ./ref.txt    /ref.txt
```

## 3. 토큰 만들기

웹 서버만 이 TTS를 부를 수 있도록 비밀 토큰을 정합니다. 같은 값을 웹 서버의 `TTS_TOKEN`에도 넣으세요.

```bash
modal secret create village-call-tts TTS_TOKEN=$(openssl rand -hex 24)
```

## 4. 배포

```bash
GSV_VERSION=v2 modal deploy modal_app.py
```

- 배포가 끝나면 `https://<워크스페이스>--village-call-tts-voice-web.modal.run` 같은 주소가 나옵니다. 이 주소를 웹 서버의 `TTS_URL`에 넣으세요.
- `GSV_VERSION`은 모델을 학습한 GPT-SoVITS 버전입니다 (`v2`, `v2Pro`, `v2ProPlus`, `v3`, `v4` 등).
- 학습에 쓴 GPT-SoVITS가 많이 오래된 버전이라면, `GSV_REF` 환경변수로 그 시점의 커밋이나 태그를 지정하세요.

> ⚠️ **모델 버전 확인 필요:** 아직 실제 모델 파일로 테스트하지 않았습니다. 처음 배포한 뒤 아래 5번으로 꼭 들어보세요.

## 5. 확인

```bash
curl -X POST "$TTS_URL/tts" -H "Authorization: Bearer $TTS_TOKEN" \
  -H "Content-Type: application/json" -d '{"text":"안녕하세요, 반가워요!"}' -o test.wav
```

- **첫 호출:** 컨테이너가 켜지는 콜드스타트 때문에 20~40초 걸릴 수 있습니다. 웹사이트에서는 이 시간을 "연결 중…" 화면이 가려줍니다.
- **문제 해결:** 소리가 이상하면 `ref.wav`를 더 깨끗한 문장으로 바꾸거나, `ref.txt`가 음성과 정확히 같은지 확인하세요.

## 비용 감각

- L4 GPU 기준으로 문장 하나에 1초 안팎이 걸리고, 쓰지 않을 때는 0원입니다.
- 웹 서버의 사용 제한(통화 5분, IP당 하루 5통, 전체 하루 300통)이 최대 사용량을 묶어줍니다.
