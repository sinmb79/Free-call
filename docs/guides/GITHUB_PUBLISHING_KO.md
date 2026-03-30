# IwootCall GitHub 공개배포 가이드

이웃콜을 GitHub 공개 저장소에 안전하게 올리기 위한 절차를 정리한 안내서입니다.

---

## 공개 전 반드시 알아야 할 것

### 절대 올리면 안 되는 파일

| 파일 | 이유 |
|------|------|
| `.env` | 데이터베이스·JWT 시크릿·API 키 포함 |
| `*.pem`, `*.key`, `*.p12`, `*.crt` | 개인 인증서·암호화 키 |
| Firebase 서비스 계정 JSON | Google 클라우드 권한 포함 |
| 개인 메모·핸드오프 문서 | 내부 정보 |
| `node_modules/` | 빌드 산출물, 용량만 차지 |
| `dist/`, `.next/` | 빌드 결과물 |
| `output/runtime/` | 런타임 로그 |

**이 저장소는 `.gitignore`에 위 항목이 이미 포함되어 있습니다.**
단, `.env`를 `git add` 로 강제로 추가하면 추적될 수 있으니 항상 확인하세요.

---

## 1. 공개 전 사전 점검

루트 디렉터리에서 아래 명령을 실행합니다.

```powershell
pnpm publish:check
```

이 명령은 아래 항목을 자동으로 확인합니다.

- `.env` 등 민감한 파일 존재 여부
- 로그·출력물 존재 여부
- Git 추적 중인 파일에 민감 파일이 포함되어 있는지

---

## 2. 권장 검증 순서

공개 전에 아래 순서대로 전체 검증을 진행하세요.

### 코드 품질 검증

```powershell
pnpm test
pnpm build
pnpm typecheck
pnpm --filter @iwootcall/api prisma:validate
docker compose config
```

### 로컬 실행 검증 (선택 권장)

```powershell
pnpm dev:stack
pnpm dev:start
pnpm smoke:local
pnpm dev:stop
pnpm dev:stack:down
```

### 공개 안전성 점검

```powershell
pnpm clean:local    # 로컬 산출물 정리
pnpm publish:check  # 민감 파일 점검
```

---

## 3. 처음 공개 업로드하는 경우

아직 Git 저장소가 아니라면:

```powershell
git init -b main
git remote add origin https://github.com/sinmb79/Free-call.git
```

이미 설정되어 있으면 이 단계는 건너뜁니다.

---

## 4. 업로드 순서

### 4.1 현재 상태 확인

```powershell
git status
```

아래 파일이 보이면 반드시 제외해야 합니다.

- `.env`
- `*.pem`, `*.key`, `*.p12`
- `node_modules/`
- `dist/`
- `output/runtime/`

### 4.2 파일 추가

```powershell
git add .
git status    # 반드시 한 번 더 확인
```

`git add .` 후 `git status`를 다시 확인해 민감한 파일이 포함되지 않았는지 검토하세요.

### 4.3 커밋

```powershell
git commit -m "Initial public release of IwootCall"
```

### 4.4 푸시

```powershell
git push -u origin main
```

---

## 5. 공개 저장소에 포함할 것 vs 제외할 것

### 포함해야 할 것

- `README.md`
- `LICENSE`
- `.env.example` (실제 값이 아닌 예시만 포함)
- `docs/guides/` 문서들
- 소스 코드 (`apps/`, `packages/`)
- 테스트 코드 (`*.test.ts`, `*.spec.ts`)
- 설정 파일 (`turbo.json`, `pnpm-workspace.yaml`, `docker-compose.yml` 등)

### 제외해야 할 것

- `.env` (실제 값이 담긴 파일)
- 개인 인증서·키
- Firebase 서비스 계정 JSON
- 빌드 결과물 (`node_modules/`, `dist/`, `.next/`)
- 런타임 로그 (`output/runtime/`)
- 개인 메모나 핸드오프 문서

---

## 6. 자주 하는 실수

### 실수 1 — `.env`를 같이 올림

가장 위험하고 가장 흔한 실수입니다.
데이터베이스 주소, JWT 시크릿, API 키가 공개되면 즉시 보안 사고로 이어질 수 있습니다.

```powershell
# 올리기 전 항상 두 번 확인
git status
pnpm publish:check
```

### 실수 2 — `node_modules/`, `dist/`를 같이 올림

저장소 크기가 수백 MB로 불어나고, 코드 리뷰가 어려워집니다.
`.gitignore`에 이미 포함되어 있지만 강제로 추가하지 않도록 주의하세요.

### 실수 3 — 테스트 없이 바로 푸시

첫 공개 커밋은 신뢰가 중요합니다.
최소한 `pnpm test`와 `pnpm build`가 통과한 뒤 올리세요.

---

## 7. 최종 체크리스트

공개 전 아래 순서만 기억하면 충분합니다.

```
□ pnpm publish:check   — 민감 파일 없는지 확인
□ pnpm test            — 전체 테스트 통과
□ pnpm build           — 전체 빌드 성공
□ pnpm clean:local     — 로컬 산출물 정리
□ git status           — 추가될 파일 최종 확인
□ git add .
□ git status           — 한 번 더 확인
□ git commit
□ git push
```
