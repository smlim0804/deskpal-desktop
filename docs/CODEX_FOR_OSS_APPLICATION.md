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
DeskPal is a public MIT Electron desktop app inspired by BusyPet. It brings pixel companions, app/web shortcuts, and local companion-game systems to macOS and Windows. The project has a real user-facing surface and needs careful maintenance across Electron security, overlay click-through behavior, packaging, UI, animation, and performance. Codex can help review risky changes, expand tests, and keep the app safer for users.
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
I would use credits only for open-source maintenance: code review, regression test generation, Electron security checks, documentation, cross-platform packaging diagnostics, and issue triage. The default DeskPal app will remain local-first and token-safe, with no built-in cloud AI or hidden screen upload. Credits would support maintainer productivity, not runtime user features.
```

### Additional information (500 characters max)

```text
DeskPal grew from the BusyPet browser-extension idea into a desktop companion app. The open-source version is MIT licensed, keeps user settings local, uses contextIsolation in Electron, and avoids AI/chat/API-key flows by default. The project is useful for contributors interested in desktop UX, pixel animation, packaging, and safer Electron patterns.
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
