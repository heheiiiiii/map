# 이미지 교체 가이드

캐릭터와 배경은 `character/assets/` 폴더의 파일과 `character/character.json`만 바꾸면 교체됩니다. 코드는 수정할 필요가 없어요.

## 레이어 모드 (기본, 권장)

| 키 (`character.json` → `assets`) | 필수 | 내용 |
|---|---|---|
| `background` | ✔ | 배경 한 장. 16:9, 1920×1080 권장 (PNG/JPG/SVG) |
| `base` | ✔ | 입·눈이 없는 캐릭터 몸통. 투명 PNG |
| `mouth` (배열 4개) | ✔ | 입 모양 4단계: 닫힘 / 살짝 / 중간 / 크게 |
| `eyes.open`, `eyes.closed` | ✔ | 기본 눈, 깜빡임용 감은 눈 |
| `eyes.happy`, `eyes.surprised`, `eyes.sad`, `eyes.thinking` | 선택 | 없으면 `eyes.open` 사용 |

- **정렬 규칙:** `base`, `mouth`, `eyes` 파일은 **모두 같은 캔버스 크기**여야 하고, 서로 겹쳤을 때 제자리에 오도록 그려야 합니다. 비어 있는 부분은 투명으로 두세요.
- **위치와 크기:** `character.json`의 `layout`으로 조절합니다.
  - `x`: 가로 중심 (0~1)
  - `bottom`: 아래 여백 (화면 높이 대비 비율)
  - `height`: 캐릭터 높이 (화면 높이 대비 비율)

## 간이 모드 (레이어를 나누기 어려울 때)

`"simpleMode": true`로 바꾸고 아래 두 장만 준비하세요. 말하는 동안 음량에 맞춰 두 장이 번갈아 보입니다.

```json
"assets": {
  "background": "background.png",
  "full": { "neutral": "full_neutral.png", "talk": "full_talk.png" }
}
```

## 립싱크 미세 조정

`character.json`의 `lipsync` 값으로 조정합니다.

| 값 | 의미 | 조정 방법 |
|---|---|---|
| `thresholds` | 입 1·2·3단계가 열리는 음량 | 목소리가 작아서 입이 덜 벌어지면 낮추세요 |
| `attack` | 입이 열리는 속도 (0~1) | 클수록 빠르게 열려요 |
| `release` | 입이 닫히는 속도 (0~1) | 작을수록 천천히 닫혀요 |

## 교체 방법

1. 새 파일을 `character/assets/`에 넣습니다.
2. 파일명을 기존과 같게 덮어쓰거나, `character.json`의 `assets`에 새 파일명을 적습니다.
3. 서버를 다시 시작합니다.

기본으로 들어 있는 이미지는 이 프로젝트용 오리지널 플레이스홀더입니다. 새 이미지를 넣을 때는 사용할 권리가 있는지 직접 확인해주세요.
