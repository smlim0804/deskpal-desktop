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
DeskPal은 BusyPet에서 출발한 공개 MIT Electron 데스크톱 앱입니다. 투명 오버레이 위에서 픽셀 캐릭터가 작업 화면을 부드럽게 돌아다니고, 클릭하면 사용자가 등록한 웹사이트/로컬 앱을 즉시 열 수 있습니다. 캐릭터별 속도·크기·마우스 반응·이동 영역·이펙트 위치를 조절하고 CPU/RAM 벤치마킹 상태를 말풍선으로 보여줍니다. 저는 이 프로젝트를 단발성 장난감이 아니라 오래 쓰는 데스크톱 동료로 만들겠다는 확신과 간절함이 있습니다.
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
Codex Security가 꼭 필요합니다. DeskPal은 브라우저 안이 아니라 사용자의 데스크톱 위에서 동작하는 Electron 앱이라 preload IPC, 투명 오버레이 클릭 통과, 로컬 앱 바로가기 실행, 업데이트 다운로드, 시스템 벤치마킹 표시가 모두 보안 표면입니다. 지금은 AI와 화면 읽기 없이 안전하게 출발했지만, 향후 opt-in AI를 연결하려면 권한과 데이터 전송 범위를 처음부터 엄격히 설계해야 합니다.
```

### API credit usage plan (500 characters max)

```text
API 크레딧은 사용자 런타임 소비가 아니라 오픈소스 유지보수에 집중해 쓰겠습니다. Codex로 PR 리뷰, Electron 보안 점검, 클릭 통과/오버레이 회귀 테스트, 업데이트 다운로드 검증, macOS/Windows 패키징 분석, 성능 병목 찾기, 문서 보강을 꾸준히 진행하겠습니다. 저는 DeskPal을 실제 사용자에게 안전하게 배포되는 오픈소스 앱으로 키우고 싶고, Codex가 가장 현실적인 유지보수 파트너라고 확신합니다.
```

### Additional information (500 characters max)

```text
이 프로젝트는 제가 직접 사용하며 계속 다듬는 앱입니다. 목표는 화려한 기능을 억지로 넣는 것이 아니라, 작업 중 외롭지 않게 도와주는 작은 픽셀 동료를 안정적으로 만드는 것입니다. 현재는 바로가기와 벤치마킹 말풍선 중심으로 단단히 만들고, 이후 AI는 사용자가 명확히 선택했을 때만 연결하겠습니다. 오래 유지하고 싶은 프로젝트라 코드 품질, 보안, 문서화를 진심으로 챙기고 싶습니다.
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
