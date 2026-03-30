# IwootCall 초보자 실행 가이드

이 문서는 개발 경험이 많지 않아도 `IwootCall`을 로컬에서 실행하고 직접 흐름을 확인할 수 있도록 순서를 아주 단순하게 정리한 안내서입니다.
프로젝트의 취지와 구조를 먼저 이해하고 싶다면 [서비스 개요 문서](./SERVICE_OVERVIEW_KO.md)를 먼저 읽는 것을 추천합니다.

## 0. 먼저 이해하면 좋은 것

이웃콜은 단순한 예약 폼이 아니라, 아래 흐름을 다루는 배차 플랫폼입니다.

- 고객이 호출을 만듭니다.
- 시스템이 가까운 기사 후보를 찾습니다.
- 기사 앱에 배차 이벤트가 도착합니다.
- 수락 또는 거절 결과가 고객과 관리자 화면에 실시간으로 반영됩니다.

처음에는 모든 기능을 다 보려고 하기보다, 아래 세 화면만 기억하면 쉽습니다.

- 고객 앱: 호출을 만드는 화면
- 기사 앱: 호출을 수락하는 화면
- 관리자 앱: 전체 상태를 보는 화면

## 1. 먼저 준비할 것

아래 3가지가 필요합니다.

1. `Node.js 20+`
2. `pnpm`
3. `Docker Desktop`

PowerShell에서 아래 명령으로 확인할 수 있습니다.

```powershell
node -v
pnpm -v
docker -v
```

## 2. 가장 쉬운 실행 순서

프로젝트 루트에서 아래 순서대로 실행하면 됩니다.

### 2.1 환경 파일 준비

```powershell
Copy-Item .env.example .env
```

이미 `.env`가 있으면 다시 만들지 않아도 됩니다.

### 2.2 패키지 설치

```powershell
pnpm install
```

### 2.3 PostgreSQL과 Redis 시작

```powershell
pnpm dev:stack
```

이 명령은 아래 작업을 자동으로 처리합니다.

- Docker Desktop 실행 여부 확인
- PostgreSQL, Redis 시작
- Prisma migration 적용
- 개발용 seed 실행

Docker Desktop이 꺼져 있으면 여기서 멈추고 이유를 알려줍니다.

### 2.4 API와 앱 시작

```powershell
pnpm dev:start
```

이 명령은 아래 4개를 백그라운드에서 시작합니다.

- API: `http://localhost:3001`
- 고객 앱: `http://localhost:3101`
- 기사 앱: `http://localhost:3102`
- 관리자 앱: `http://localhost:3103`

중요:

- `pnpm dev:stack`을 먼저 하지 않았다면, 이제 `dev:start`가 바로 멈추고 `pnpm dev:stack`을 먼저 실행하라고 알려줍니다.
- 실행 로그는 `output/runtime` 폴더에 저장됩니다.

### 2.5 자동 동작 확인

```powershell
pnpm smoke:local
```

이 명령은 아래를 자동으로 확인합니다.

- API `/health`
- 고객/기사/관리자 앱의 HTTP 응답
- 고객/기사 개발용 OTP 로그인
- 관리자 개발용 토큰 발급
- 기사 활성화와 온라인 상태 반영
- 고객 배차 요청 생성

중요:

- `smoke:local`도 PostgreSQL과 Redis가 없으면 요청을 보내기 전에 바로 멈추고 `pnpm dev:stack`을 먼저 하라고 안내합니다.

### 2.6 종료

앱만 종료:

```powershell
pnpm dev:stop
```

DB 컨테이너까지 종료:

```powershell
pnpm dev:stack:down
```

로컬 산출물 정리:

```powershell
pnpm clean:local
```

이 명령은 `output`, `.turbo`, 앱의 `.next`, 빌드된 `dist` 폴더처럼 공개배포 전에 지워도 되는 로컬 산출물을 정리합니다.

## 3. 접속 주소

- 고객 앱: `http://localhost:3101`
- 기사 앱: `http://localhost:3102`
- 관리자 앱: `http://localhost:3103`
- API health: `http://localhost:3001/health`

## 4. 처음 체험할 때 추천 순서

처음 실행했다면 아래 순서대로 한 번만 따라가 보세요.

1. 관리자 앱을 열고 개발용 토큰을 발급합니다.
2. 기사 앱에서 로그인한 뒤 온라인 상태를 켭니다.
3. 고객 앱에서 로그인한 뒤 `FreeCab` 또는 `FreeRun` 호출을 만듭니다.
4. 기사 앱에서 배차 이벤트를 보고 수락합니다.
5. 관리자 앱에서 기사 상태와 잡 상태가 함께 바뀌는지 확인합니다.

이 흐름을 한 번 보면, 이 프로젝트가 "여러 앱이 한 배차 코어를 공유하는 구조"라는 점이 쉽게 잡힙니다.

## 5. 화면에서 어떻게 써 보나요

### 고객 앱

1. `http://localhost:3101` 접속
2. `Register` 또는 `Login` 선택
3. OTP는 개발 모드에서 항상 `000000`
4. 로그인 후 `FreeCab`, `FreeDrive`, `FreeCargo`, `FreeRun`, `FreeShuttle` 화면 사용

### 기사 앱

1. `http://localhost:3102` 접속
2. OTP `000000`으로 로그인
3. 온라인 상태, 위치, 디바이스 토큰 입력 가능
4. `Active Job`, `Earnings` 화면에서 현재 상태 확인 가능

### 관리자 앱

1. `http://localhost:3103` 접속
2. `Generate local dev token` 버튼 클릭
3. 토큰이 자동 입력되면 바로 관리자 화면 접근 가능
4. 기사 상태 변경, 통계 확인, 셔틀 route/schedule 생성 가능

## 6. 자주 쓰는 명령

전체 테스트:

```powershell
pnpm test
```

전체 빌드:

```powershell
pnpm build
```

타입 검사:

```powershell
pnpm typecheck
```

Prisma 검증:

```powershell
pnpm --filter @iwootcall/api prisma:validate
```

Docker Compose 설정 확인:

```powershell
docker compose config
```

로컬 산출물 정리:

```powershell
pnpm clean:local
```

## 7. 자주 막히는 경우

### Docker가 꺼져 있는 경우

`pnpm dev:stack`에서 멈춥니다. 먼저 Docker Desktop을 켜세요.

### `pnpm dev:start`가 바로 멈추는 경우

대부분 PostgreSQL이나 Redis가 아직 없어서 그렇습니다.

순서대로 다시 실행하세요.

```powershell
pnpm dev:stack
pnpm dev:start
```

### `pnpm smoke:local`이 바로 멈추는 경우

이 경우도 거의 항상 DB/Redis가 준비되지 않은 상태입니다.

아래 순서로 다시 실행하세요.

```powershell
pnpm dev:stack
pnpm dev:start
pnpm smoke:local
```

### OTP가 안 되는 경우

개발 모드 OTP는 항상 `000000`입니다.

## 8. 중요한 주의사항

- `.env`는 GitHub에 올리면 안 됩니다.
- 실제 키, 토큰, 인증 파일은 프로젝트 폴더가 아니라 `C:\Users\sinmb\key` 아래에 두는 것이 안전합니다.
- 공개 업로드 전에는 반드시 `pnpm publish:check`를 실행하세요.

## 9. 같이 보면 좋은 문서

- [서비스 개요 문서](./SERVICE_OVERVIEW_KO.md)
- [GitHub 공개배포 가이드](./GITHUB_PUBLISHING_KO.md)
- [루트 README](../../README.md)
