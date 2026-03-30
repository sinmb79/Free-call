# IwootCall GitHub 공개배포 가이드

이 문서는 `IwootCall`을 GitHub 공개 저장소에 올릴 때 민감한 파일을 빼고, 초보자도 순서대로 안전하게 올릴 수 있도록 정리한 안내서입니다.

대상 저장소:

- [sinmb79/Free-call](https://github.com/sinmb79/Free-call)

## 1. 공개 전에 절대 올리면 안 되는 것

아래 파일은 기본적으로 GitHub에 올리면 안 됩니다.

- `.env`
- `.env.local`
- 인증서/키 파일 (`.pem`, `.pfx`, `.p12`, `.key`, `.crt`)
- 개인 메모
- 로그 파일
- 로컬 캐시
- 빌드 결과물

현재 저장소는 아래 항목을 기본적으로 Git 추적에서 제외하도록 설정되어 있습니다.

- `.env`
- `node_modules`
- `.turbo`
- `dist`
- `coverage`
- `output/runtime`
- `docs/superpowers`
- `*_handoff.md`

## 2. 업로드 전에 가장 먼저 할 것

루트에서 아래 명령을 실행하세요.

```powershell
pnpm publish:check
```

이 명령은 아래를 확인합니다.

- 민감한 로컬 파일 존재 여부
- 로그/출력물 존재 여부
- Git 저장소 여부
- Git에 올라가면 안 되는 파일이 추적 중인지 여부

## 3. 아직 Git 저장소가 아니라면

현재 폴더가 Git 저장소가 아니라면 아래 두 줄만 먼저 실행하면 됩니다.

```powershell
git init -b main
git remote add origin https://github.com/sinmb79/Free-call.git
```

이미 Git 저장소라면 다시 실행하지 마세요.

## 4. 공개 전에 권장하는 검증 순서

```powershell
pnpm test
pnpm build
pnpm typecheck
pnpm --filter @iwootcall/api prisma:validate
docker compose config
pnpm publish:check
```

로컬 실행까지 확인하고 싶다면 아래 순서도 권장합니다.

```powershell
pnpm dev:stack
pnpm dev:start
pnpm smoke:local
pnpm dev:stop
pnpm dev:stack:down
```

중요:

- `pnpm dev:start`와 `pnpm smoke:local`은 이제 PostgreSQL/Redis가 없으면 바로 멈추고 `pnpm dev:stack`을 먼저 하라고 알려줍니다.
- 공개 푸시 직전에는 `pnpm clean:local`로 로컬 산출물을 먼저 정리하는 편이 좋습니다.

## 5. 실제 업로드 순서

### 5.1 현재 상태 확인

```powershell
git status
```

여기서 아래 파일이 보이면 다시 확인해야 합니다.

- `.env`
- 인증서/키 파일
- `node_modules`
- `dist`
- `coverage`
- `output/runtime`

### 5.2 필요한 파일만 추가

```powershell
git add .
git status
```

`git add .` 뒤에는 반드시 `git status`를 다시 확인하세요.

### 5.3 첫 커밋

```powershell
git commit -m "Initial public release of IwootCall"
```

### 5.4 GitHub로 푸시

```powershell
git push -u origin main
```

## 6. 공개 저장소에 포함하면 좋은 파일

- `README.md`
- `LICENSE`
- `.env.example`
- `docs/guides/BEGINNER_GUIDE_KO.md`
- `docs/guides/GITHUB_PUBLISHING_KO.md`
- 실제 소스 코드
- 테스트 코드

## 7. 공개 저장소에 넣지 않는 것이 좋은 파일

- 개인 환경 파일
- 개인 토큰
- 개인 인증서
- 빌드 결과물
- 로컬 로그
- 캐시 파일
- 개인 메모

## 8. 초보자가 많이 하는 실수

### 실수 1. `.env`를 같이 올림

가장 위험하고 가장 흔한 실수입니다.

공개 전에 항상 아래 두 개를 확인하세요.

```powershell
git status
pnpm publish:check
```

### 실수 2. `node_modules`, `dist`까지 같이 올림

저장소가 무거워지고 공개 코드 리뷰가 어려워집니다.

### 실수 3. 테스트 없이 바로 푸시

첫 공개 커밋은 신뢰가 중요합니다. 최소한 `pnpm test`와 `pnpm build`는 통과한 뒤 올리는 편이 좋습니다.

## 9. 마지막 체크리스트

아래 순서만 기억해도 충분합니다.

1. `pnpm publish:check`
2. `pnpm test`
3. `pnpm build`
4. `git status`
5. `git add .`
6. `git status`
7. `git commit`
8. `git push`

권장 추가 한 줄:

```powershell
pnpm clean:local
```
