# Codex for OSS Application Draft

Official form: https://openai.com/ko-KR/form/codex-for-oss/

## Values to paste

### GitHub username

```text
smlim0804
```

### GitHub repository URL

```text
https://github.com/smlim0804/deskpal-desktop
```

Status: public repository, MIT license detected by GitHub.

### Role

```text
Primary maintainer
```

### Why is this repository a good fit? (500 characters max)

```text
DeskPal은 공개 MIT Electron 데스크톱 앱입니다. 항상 위에 뜨는 투명 오버레이에서 픽셀 캐릭터가 실제 데스크톱을 돌아다니고, 사용자가 등록한 웹/로컬 앱 바로가기를 실행합니다. CPU/RAM 벤치마킹 말풍선, 캐릭터별 이동 영역·마우스 반응·이펙트 위치·FPS/성능 설정이 포함됩니다. 웹앱보다 IPC, 클릭 통과, 네이티브 실행, 패키징 안정성이 핵심이라 Codex가 리뷰·테스트 자동화·문서화에 바로 기여할 수 있습니다.
```

### Interest

Recommended selections:

```text
Codex
Security review
API credits
```

### OpenAI organization ID

```text
org-hk8WAPrFjq3WS72DsSrEoJOZ
```

### Codex Security justification (500 characters max)

```text
Codex Security는 Electron 데스크톱 앱의 위험 지점을 초기에 닫기 위해 필요합니다. DeskPal은 preload IPC로 renderer와 main이 통신하고, 투명 오버레이의 클릭 통과 상태를 바꾸며, 사용자가 입력한 로컬 앱 경로/웹 URL/업데이트 다운로드를 처리합니다. 검증이 약하면 원치 않는 앱 실행, 클릭 방해, 신뢰되지 않은 파일 열기, 시스템 정보 노출로 이어질 수 있습니다. 향후 AI 연결 전 권한·데이터 경계를 먼저 점검하겠습니다.
```

### API credit usage plan (500 characters max)

```text
API 크레딧은 앱 안의 유료 AI 기능이 아니라 공개 repo 유지보수에 쓰겠습니다. Codex로 PR 리뷰, preload IPC allowlist 점검, 앱 경로/URL 검증 테스트, 오버레이 클릭 통과 회귀 테스트, macOS/Windows 패키징 오류 분석, 업데이트 다운로드 검증, CPU/RAM 벤치마킹 부하 점검을 반복하겠습니다. 향후 AI 기능은 opt-in, API 키 비노출, 화면 데이터 전송 제한을 기준으로 설계하고 테스트하겠습니다.
```

### Additional information (500 characters max)

```text
DeskPal은 작은 캐릭터 앱처럼 보이지만 실제로는 데스크톱 UX, 네이티브 실행, 보안 경계가 만나는 프로젝트입니다. 지금은 AI 없이 바로가기와 벤치마킹 중심으로 안정성을 먼저 다지고 있고, 제가 실제 작업 환경에서 매일 쓰며 클릭 방해·성능 저하·설정 저장 문제를 계속 고치고 있습니다. 다음 단계는 Windows/macOS 실행 품질과 안전한 권한 모델입니다. 이후 AI는 사용자가 직접 켠 경우에만 동작하게 만들겠습니다.
```

## Fields that need owner confirmation

- Last name / Family name: likely `Lim`, but confirm before submitting.
- First name / Given name: likely `Sungmin`, but confirm before submitting.
- Email address: use the same email attached to the OpenAI account. Git is currently configured with `smlim0804@users.noreply.github.com`, but the form should use your real contact email if possible.
- OpenAI organization ID: `org-hk8WAPrFjq3WS72DsSrEoJOZ`.

## Pre-submit checklist

- [x] Repository visibility is public.
- [x] GitHub license detection shows MIT.
- [x] README, SECURITY, CONTRIBUTING, and CODE_OF_CONDUCT are present.
- [x] `npm run check` passes.
- [x] No obvious secrets found with local `rg` scan.
- [x] Owner confirms name, email, and OpenAI organization ID.
