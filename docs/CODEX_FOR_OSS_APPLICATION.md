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
DeskPal은 BusyPet에서 출발한 공개 MIT Electron 데스크톱 앱입니다. 투명 오버레이 위에서 픽셀 캐릭터가 작업 화면을 부드럽게 돌아다니고, 클릭하면 사용자가 등록한 웹사이트나 로컬 앱을 바로 열 수 있습니다. 캐릭터별 속도·크기·마우스 반응·이동 영역·이펙트 위치를 조절할 수 있고, CPU/RAM 같은 벤치마킹 상태를 작은 말풍선으로 보여줍니다. 실제 데스크톱과 상호작용하는 앱이라 안정성, 성능, 보안 검토가 계속 필요합니다.
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
API 크레딧은 사용자 런타임 기능이 아니라 오픈소스 유지보수에 쓰겠습니다. Codex로 PR 리뷰, Electron preload IPC 점검, 클릭 통과/오버레이 회귀 테스트, 업데이트 다운로드 검증, macOS/Windows 패키징 분석, 성능 병목 찾기, README와 보안 문서 보강을 진행하고 싶습니다. 향후 AI 캐릭터 기능도 기본 앱은 로컬 우선으로 유지하고, 명시적 opt-in·권한 설명·데이터 전송 제한을 지키는 방향으로 설계하겠습니다.
```

### Additional information (500 characters max)

```text
Codex Security가 필요한 이유는 DeskPal이 일반 웹앱이 아니라 사용자의 데스크톱 위에서 동작하는 Electron 앱이기 때문입니다. preload IPC, 로컬 앱 바로가기 실행, 투명 오버레이 클릭 통과, 업데이트 다운로드, 시스템 벤치마킹 표시가 모두 보안 검토 대상입니다. 현재 공개 버전은 AI와 화면 읽기 없이 동작하지만, 장기적으로 사용자가 선택한 AI를 캐릭터에 연결하려면 권한 흐름과 데이터 범위를 미리 안전하게 설계해야 합니다.
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
