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
DeskPal은 BusyPet 아이디어에서 출발한 공개 MIT Electron 데스크톱 앱입니다. 작은 픽셀 캐릭터가 화면 위를 부드럽게 돌아다니고, 클릭하면 자주 쓰는 웹사이트와 로컬 앱 바로가기를 바로 열 수 있습니다. 캐릭터/이펙트/이동 영역을 사용자가 조절하고, CPU·RAM 같은 벤치마킹 상태를 말풍선으로 보여줍니다. 앞으로는 사용자가 명시적으로 켠 AI를 캐릭터에 연결하는 것이 목표라 Electron 보안, 클릭 통과, 성능, 패키징, UX 검토가 중요합니다.
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

### API credit usage plan (500 characters max)

```text
API 크레딧은 런타임 사용자 기능이 아니라 오픈소스 유지보수에 쓰겠습니다. Codex로 PR 리뷰, Electron 보안 점검, 오버레이 클릭 통과 회귀 테스트, 성능 병목 분석, macOS/Windows 패키징 문제, 문서와 이슈 분류를 처리하고 싶습니다. 향후 AI 캐릭터 기능을 설계할 때도 기본 앱은 로컬 우선·토큰 안전 구조를 유지하고, AI는 명시적 opt-in과 투명한 권한 흐름으로만 실험하겠습니다.
```

### Additional information (500 characters max)

```text
Codex Security가 필요한 이유는 DeskPal이 Electron 데스크톱 앱이라 preload IPC, 투명 오버레이의 클릭 통과, 로컬 앱 바로가기 실행, 업데이트 다운로드 같은 보안 표면이 있기 때문입니다. 현재 공개 버전은 클라우드 AI 없이 로컬에서 동작하지만, 장기적으로 사용자가 선택한 AI를 캐릭터에 연결하려면 권한 흐름과 데이터 전송 범위를 엄격하게 설계해야 합니다.
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
