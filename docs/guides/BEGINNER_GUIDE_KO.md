# IwootCall 초보자 실행 가이드

개발 경험이 많지 않아도 이 문서를 따라하면 이웃콜을 로컬에서 직접 실행하고 배차 흐름을 체험할 수 있습니다.

> 프로젝트의 취지와 구조를 먼저 이해하고 싶다면 [서비스 개요](./SERVICE_OVERVIEW_KO.md)를 먼저 읽으세요.

---

## 이웃콜이 하는 일 — 핵심만

이웃콜은 단순한 예약 폼이 아닙니다. **배차 흐름 전체**를 다룹니다.

```
고객이 호출 생성
    ↓
시스템이 가까운 기사 후보 탐색
    ↓
기사 앱으로 배차 요청 전송
    ↓
기사 수락 또는 거절
    ↓
결과가 고객·관리자 화면에 실시간 반영
```

처음에는 아래 3개 화면만 기억하면 됩니다.

| 앱 | 주소 | 역할 |
|----|------|------|
| 고객 앱 | http://localhost:3101 | 호출을 만드는 화면 |
| 기사 앱 | http://localhost:3102 | 호출을 수락하는 화면 |
| 관리자 앱 | http://localhost:3103 | 전체 상태를 보는 화면 |

---

## 1. 준비물 설치

아래 3가지가 필요합니다.

### Node.js 20+

https://nodejs.org 에서 LTS 버전을 설치합니다.

### pnpm

Node.js 설치 후 터미널에서:

```powershell
npm install -g pnpm
```

### Docker Desktop

https://www.docker.com/products/docker-desktop 에서 설치합니다.
설치 후 Docker Desktop을 실행해 두세요 (시스템 트레이에 고래 아이콘이 보여야 함).

### 설치 확인

```powershell
node -v     # v20.x.x 이상이어야 함
pnpm -v     # 9.x.x 이상이어야 함
docker -v
```

---

## 2. 실행 순서 (4단계)

### 2.1 저장소 다운로드

```powershell
git clone https://github.com/sinmb79/Free-call.git
cd Free-call
```

### 2.2 환경 파일 준비

```powershell
Copy-Item .env.example .env
```

`.env` 파일을 열어 아래 항목을 확인합니다. 로컬 테스트는 기본값으로 바로 사용 가능합니다.

```env
DATABASE_URL=postgresql://iwootcall:iwootcall@localhost:5432/iwootcall
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-this-in-production-min-32-chars
```

> 실제 운영에서는 `JWT_SECRET`을 반드시 긴 랜덤 문자열로 변경하세요.

### 2.3 패키지 설치

```powershell
pnpm install
```

> 처음 설치 시 수분이 걸릴 수 있습니다.

### 2.4 DB 시작 → 앱 시작

```powershell
# PostgreSQL + Redis 시작 (DB 마이그레이션과 시드 자동 실행)
pnpm dev:stack

# API + 고객/기사/관리자 앱 시작
pnpm dev:start
```

> **순서가 중요합니다.** `dev:stack`을 먼저 실행해야 `dev:start`가 작동합니다.
> `dev:start`는 DB가 없으면 즉시 멈추고 이유를 알려줍니다.

---

## 3. 실행 확인

브라우저에서 아래 주소로 접속합니다.

| 주소 | 정상 응답 |
|------|----------|
| http://localhost:3001/health | `{"status":"ok"}` |
| http://localhost:3101 | 고객 앱 화면 |
| http://localhost:3102 | 기사 앱 화면 |
| http://localhost:3103 | 관리자 앱 화면 |

자동으로 전체 동작을 확인하려면:

```powershell
pnpm smoke:local
```

이 명령은 API, 앱, OTP 로그인, 배차 요청 생성까지 순서대로 확인합니다.

---

## 4. 처음 체험 순서

아래 순서로 한 번만 따라가 보세요.

### 4.1 관리자 앱

1. http://localhost:3103 접속
2. `Generate local dev token` 버튼 클릭
3. 토큰이 자동 입력되면 관리자 화면 진입

### 4.2 기사 앱

1. http://localhost:3102 접속
2. 전화번호 입력 (아무 번호나 가능)
3. OTP 입력: **`000000`** (개발 모드 고정값)
4. 로그인 후 온라인 상태 켜기

### 4.3 고객 앱

1. http://localhost:3101 접속
2. 전화번호 입력 (기사와 다른 번호 사용)
3. OTP 입력: **`000000`**
4. `FreeCab` 또는 `FreeRun` 화면에서 호출 생성

### 4.4 결과 확인

- **기사 앱**에서 배차 이벤트가 도착하면 수락
- **관리자 앱**에서 기사 상태·잡 상태가 실시간으로 바뀌는 것 확인
- **고객 앱**에서 기사 배정 결과 확인

이 흐름을 한 번 보면 이웃콜이 "여러 앱이 하나의 배차 코어를 공유하는 구조"라는 점이 자연스럽게 이해됩니다.

---

## 5. 종료 방법

```powershell
# 앱만 종료 (DB는 유지)
pnpm dev:stop

# DB 컨테이너까지 종료
pnpm dev:stack:down

# 로컬 산출물 정리 (output, .turbo, .next, dist)
pnpm clean:local
```

---

## 6. 자주 쓰는 명령

```powershell
pnpm test                                         # 전체 테스트
pnpm build                                        # 전체 빌드
pnpm typecheck                                    # 타입 검사
pnpm --filter @iwootcall/api prisma:validate      # Prisma 스키마 검증
docker compose config                             # Docker Compose 설정 확인
```

---

## 7. 자주 막히는 경우

### Docker가 꺼져 있는 경우

`pnpm dev:stack`이 멈춥니다.
Docker Desktop을 실행하고 시스템 트레이에서 고래 아이콘이 초록색인지 확인하세요.

### `pnpm dev:start`가 즉시 멈추는 경우

PostgreSQL·Redis가 아직 준비되지 않은 것입니다. 아래 순서대로 다시 실행하세요.

```powershell
pnpm dev:stack
pnpm dev:start
```

### `pnpm smoke:local`이 즉시 멈추는 경우

```powershell
pnpm dev:stack
pnpm dev:start
pnpm smoke:local
```

### OTP가 안 되는 경우

개발 모드 OTP는 항상 `000000`입니다. 숫자 6자리 그대로 입력하세요.

### 포트가 이미 사용 중인 경우

3001, 3101, 3102, 3103 포트 중 하나가 이미 사용 중이면 충돌이 발생합니다.

```powershell
# 어떤 프로세스가 쓰는지 확인
netstat -ano | findstr :3001
```

해당 프로세스를 종료한 뒤 다시 실행하세요.

### `pnpm install` 후 패키지 오류가 발생하는 경우

```powershell
pnpm clean:local
pnpm install
```

---

## 8. 주의사항

- `.env` 파일은 GitHub에 올리면 안 됩니다. (`.gitignore`에 이미 포함되어 있습니다)
- 공개 업로드 전에는 반드시 `pnpm publish:check`를 실행하세요.
- 실 키·토큰·인증서는 프로젝트 폴더 외부에 별도 보관하세요.

---

## 같이 보면 좋은 문서

- [서비스 개요](./SERVICE_OVERVIEW_KO.md) — 구조와 흐름 이해
- [GitHub 공개배포 가이드](./GITHUB_PUBLISHING_KO.md) — 안전한 공개 업로드
- [루트 README](../../README.md) — 전체 명령어 참조
