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
DeskPal은 BusyPet 아이디어에서 출발한 공개 MIT Electron 데스크톱 앱입니다. macOS/Windows에서 픽셀 캐릭터, 앱/웹 바로가기, 로컬 육성 시스템을 제공합니다. 실제 배포와 사용자를 고려한 제품이라 Electron 보안, 오버레이 클릭 통과, 패키징, UI, 애니메이션, 성능 관리가 중요합니다. Codex로 위험한 변경을 검토하고 테스트와 문서를 보강해 더 안전하게 유지관리하고 싶습니다.
```

### Interest

Recommended selections:

```text
Codex
Security review
API credits
```

### API credit usage plan (500 characters max)

```text
API 크레딧은 오픈소스 유지보수에만 쓰겠습니다. PR 리뷰, 회귀 테스트 작성, Electron 보안 점검, 문서 보강, macOS/Windows 패키징 문제 분석, 이슈 분류에 사용할 계획입니다. 기본 앱은 로컬 우선 구조를 유지하고, 클라우드 AI·채팅·API 키 입력·화면 업로드 기능은 기본으로 넣지 않겠습니다.
```

### Additional information (500 characters max)

```text
DeskPal은 BusyPet 브라우저 확장 아이디어를 데스크톱 앱으로 발전시킨 프로젝트입니다. MIT 라이선스로 공개했고, 설정은 로컬에 저장하며 Electron contextIsolation을 사용합니다. 픽셀 애니메이션, 데스크톱 UX, 안전한 Electron 패턴, 크로스플랫폼 패키징에 관심 있는 기여자에게도 좋은 실험장이 될 수 있습니다.
```

## Fields that need owner confirmation

- Last name / Family name: likely `Lim`, but confirm before submitting.
- First name / Given name: likely `Sungmin`, but confirm before submitting.
- Email address: use the same email attached to the OpenAI account. Git is currently configured with `smlim0804@users.noreply.github.com`, but the form should use your real contact email if possible.
- OpenAI organization ID: copy from OpenAI Platform organization settings.

## Pre-submit checklist

- [x] Repository visibility is public.
- [x] GitHub license detection shows MIT.
- [x] README, SECURITY, CONTRIBUTING, and CODE_OF_CONDUCT are present.
- [x] `npm run check` passes.
- [x] No obvious secrets found with local `rg` scan.
- [ ] Owner confirms name, email, and OpenAI organization ID.
