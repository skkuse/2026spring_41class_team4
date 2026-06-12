# SudoCampus User Module Design

> 목적: 이 문서는 SudoCampus MVP의 `UserModule` 설계 기준을 정의한다.  
> 사용 대상: 팀 개발자, Codex, NestJS 구현자  
> 기준 문서: `01-requirements-summary.md`, `02-database-spec.md`, `03-implementation-spec.md`, `04-system-architecture-backend.updated.md`

---

## 1. Purpose

`UserModule`은 SudoCampus 시스템의 내부 사용자 계정 정보를 관리하는 백엔드 모듈이다.

SudoCampus는 Google OAuth와 native email/password 로그인을 함께 지원한다. 사용자의 로그인 흐름은 `AuthModule`에서 시작되지만, 실제 내부 `users` 테이블의 생성, 조회, 수정 로직은 `UsersService`가 담당할 수 있다.

즉, `AuthModule`은 인증 흐름을 처리하고, `UserModule`은 내부 사용자 데이터 접근과 프로필 관리를 담당한다.

---

## 2. Module Responsibility

`UserModule`의 주요 책임은 다음과 같다.

| Responsibility              | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| Internal user lookup        | 내부 user ID, email 등을 기준으로 사용자 정보를 조회한다.            |
| Current user profile lookup | 로그인한 사용자의 프로필 정보를 조회한다.                            |
| User profile update         | 사용자가 수정 가능한 프로필 필드를 변경한다.                         |
| User creation support       | Google OAuth 및 native 회원가입 과정에서 필요한 내부 사용자 생성을 지원한다.     |
| Token version management    | 로그아웃 또는 토큰 무효화 시 `token_version` 갱신을 지원한다.        |
| User status validation      | 계정 상태가 `ACTIVE`인지 확인하여 비활성 계정 접근을 제한할 수 있다. |

MVP 기준으로 외부에 공개되는 `UserModule` API는 다음 기능만 포함한다.

1. 로그인한 사용자 프로필 조회
2. 로그인한 사용자 이름 수정

단, `AuthModule`에서 내부 사용자 생성, 조회, 토큰 버전 갱신이 필요할 수 있으므로 `UsersService`는 이를 지원하는 service method를 제공할 수 있다.

---

## 3. AuthModule vs UserModule Boundary

`AuthModule`과 `UserModule`의 책임은 다음과 같이 분리한다.

| Area                               | AuthModule             | UserModule |
| ---------------------------------- | ---------------------- | ---------- |
| Google OAuth token verification    | O                      | X          |
| OAuth login flow orchestration     | O                      | X          |
| JWT access/refresh token issuing   | O                      | X          |
| JWT validation                     | O                      | X          |
| Current user extraction from token | O                      | X          |
| Internal user creation             | Uses UsersService      | O          |
| User lookup by ID/email            | Uses UsersService      | O          |
| Current user profile response      | Can reuse UsersService | O          |
| User profile update                | X                      | O          |
| Token version increment            | Calls UsersService     | O          |
| Password login                     | O                      | Uses UsersService          |
| Password reset                     | X                      | X          |
| Local email verification           | X                      | X          |

### Design Rule

`AuthModule`은 인증(authentication) 흐름을 담당하고, `UserModule`은 내부 사용자 데이터(user data)를 담당한다.

```text
AuthModule = Google OAuth verification, native password verification, JWT issue, refresh, logout
UserModule = user creation, user lookup, profile update, token version update
```

---

## 4. Database Scope

`UserModule`은 기본적으로 `users` 테이블을 사용한다.

### 4.1 users

| Column              | Usage in UserModule                                       |
| ------------------- | --------------------------------------------------------- |
| `id`                | 내부 사용자 식별자                                        |
| `email`             | 사용자 이메일. Google OAuth에서 가져온 값                 |
| `name`              | 사용자 표시 이름                                          |
| `profile_image_url` | Google 프로필 이미지 URL                                  |
| `role`              | 사용자 권한. 기본값은 `USER`                              |
| `status`            | 계정 상태. 기본값은 `ACTIVE`                              |
| `token_version`     | refresh token 무효화 및 전체 로그아웃 처리를 위한 버전 값 |
| `email_verified_at`  | native 회원가입 인증번호 검증 완료 시각 |
| `created_at`        | 사용자 생성 시각                                          |
| `updated_at`        | 사용자 수정 시각                                          |

### 4.2 oauth_accounts

`oauth_accounts` 테이블은 Google OAuth provider 정보를 저장한다.

`UserModule`은 내부 사용자 정보 관리를 담당하고, OAuth provider 계정 연결 흐름은 `AuthModule`이 담당한다. 다만 `AuthModule`은 내부 사용자 생성이나 조회가 필요할 때 `UsersService`를 사용할 수 있다.

### 4.3 password_credentials

`password_credentials` 테이블은 native email/password 로그인에 필요한 bcrypt password hash를 저장한다.

`UserModule`은 `password_credentials`를 직접 관리하지 않는다. 비밀번호 hash 생성, 검증, credential 생성은 `AuthModule`의 책임이다. 단, `AuthModule`은 native 회원가입 시 `UsersService`를 사용해 내부 User를 생성하거나 email 중복 여부를 확인할 수 있다.

### 4.4 User Role

| Value   | Meaning                           |
| ------- | --------------------------------- |
| `USER`  | 기본 인증 사용자                  |
| `ADMIN` | 향후 관리자 기능을 위한 확장 권한 |

MVP에서는 관리자 API를 구현하지 않지만, `role` 필드는 인증/인가 확장을 고려하여 DB에 포함한다.

### 4.5 User Status

| Value       | Meaning                    |
| ----------- | -------------------------- |
| `ACTIVE`    | 정상 접근 가능한 계정      |
| `SUSPENDED` | 접근이 제한된 계정         |
| `DELETED`   | 논리적으로 비활성화된 계정 |

MVP에서는 계정 정지/삭제 관리 API를 제공하지 않는다. 다만 인증 또는 보호 API 접근 시 `status = ACTIVE` 여부를 확인할 수 있도록 설계한다.

---

## 5. API Design

## 5.1 GET `/users/me`

### Purpose

현재 로그인한 사용자의 프로필 정보를 조회한다.

### Authentication

Required.

### Request

No request body.

### Response

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "profileImageUrl": "https://...",
  "role": "USER",
  "status": "ACTIVE"
}
```

### Process

1. `JwtAuthGuard`를 통해 인증 여부를 확인한다.
2. JWT payload에서 `userId`를 가져온다.
3. `UsersService.findMe(userId)`를 호출한다.
4. `users` 테이블에서 사용자 정보를 조회한다.
5. 사용자 정보가 없으면 `404 Not Found`를 반환한다.
6. 사용자 상태가 `ACTIVE`가 아니면 접근 제한 정책에 따라 `403 Forbidden` 또는 인증 실패 응답을 반환할 수 있다.
7. 사용자 프로필 DTO를 반환한다.

---

## 5.2 PATCH `/users/me`

### Purpose

현재 로그인한 사용자의 수정 가능한 프로필 정보를 변경한다.

### Authentication

Required.

### Request

```json
{
  "name": "New User Name"
}
```

### Editable Fields for MVP

| Field             | Editable | Reason                                                           |
| ----------------- | -------: | ---------------------------------------------------------------- |
| `name`            |      Yes | 사용자가 표시 이름을 수정할 수 있다.                             |
| `email`           |       No | Google OAuth 계정 기준 식별 정보이므로 직접 수정하지 않는다.     |
| `profileImageUrl` |       No | Google OAuth에서 받은 값을 사용한다.                             |
| `role`            |       No | 권한 필드이므로 일반 사용자가 직접 수정할 수 없다.               |
| `status`          |       No | 계정 상태 필드이므로 일반 사용자가 직접 수정할 수 없다.          |
| `tokenVersion`    |       No | 토큰 무효화용 내부 필드이므로 일반 사용자가 직접 수정할 수 없다. |

### Response

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "New User Name",
  "profileImageUrl": "https://...",
  "role": "USER",
  "status": "ACTIVE"
}
```

### Process

1. `JwtAuthGuard`를 통해 인증 여부를 확인한다.
2. JWT payload에서 `userId`를 가져온다.
3. 요청 DTO를 검증한다.
4. 수정 가능한 필드만 업데이트한다.
5. `email`, `profileImageUrl`, `role`, `status`, `tokenVersion`은 요청 body에 포함되더라도 수정하지 않는다.
6. 업데이트된 사용자 프로필 DTO를 반환한다.

---

## 6. DTO Design

## 6.1 UserProfileDto

```ts
export interface UserProfileDto {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}
```

### Description

| Field             | Description                           |
| ----------------- | ------------------------------------- |
| `id`              | 내부 사용자 UUID                      |
| `email`           | Google OAuth에서 확인된 사용자 이메일 |
| `name`            | 사용자 표시 이름                      |
| `profileImageUrl` | Google profile image URL              |
| `role`            | 사용자 권한                           |
| `status`          | 계정 상태                             |

---

## 6.2 UpdateMeDto

```ts
export interface UpdateMeDto {
  name?: string;
}
```

### Validation Rules

| Field  | Rule                                   |
| ------ | -------------------------------------- |
| `name` | optional                               |
| `name` | string                                 |
| `name` | max length 100                         |
| `name` | empty string not allowed when provided |

NestJS DTO 예시는 다음과 같다.

```ts
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
```

---

## 6.3 GoogleUserProfile

`AuthModule`이 Google OAuth 검증 후 `UsersService`에 전달할 수 있는 내부 profile 형태이다.

```ts
export interface GoogleUserProfile {
  email: string;
  name: string;
  profileImageUrl?: string | null;
}
```

실제 Google provider user ID는 `oauth_accounts.provider_user_id`에 저장한다.  
`users` 테이블에는 Google provider ID를 직접 저장하지 않는다.

---

## 7. Service Design

## 7.1 UsersService

```ts
export interface UsersService {
  findById(userId: string): Promise<UserProfileDto>;

  findByEmail(email: string): Promise<UserProfileDto | null>;

  findByEmailAndName(email: string, name: string): Promise<UserProfileDto | null>;

  findMe(userId: string): Promise<UserProfileDto>;

  createFromGoogleProfile(profile: GoogleUserProfile): Promise<UserProfileDto>;

  createFromNativeSignup(input: { email: string; name: string }): Promise<UserProfileDto>;

  markEmailVerified(userId: string): Promise<void>;

  updateMe(userId: string, dto: UpdateMeDto): Promise<UserProfileDto>;

  incrementTokenVersion(userId: string): Promise<void>;
}
```

## 7.2 Method Description

| Method                    | Input                   | Output                   | Description                                                                     |
| ------------------------- | ----------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `findById`                | `userId`                | `UserProfileDto`         | 사용자 ID로 사용자 정보를 조회한다.                                             |
| `findByEmail`             | `email`                 | `UserProfileDto \| null` | 이메일로 내부 사용자를 조회한다.                                                |
| `findByEmailAndName`       | `email`, `name`         | `UserProfileDto \| null` | 아이디 찾기와 비밀번호 찾기에서 이메일/이름 일치 여부를 확인한다. |
| `findMe`                  | `userId`                | `UserProfileDto`         | 현재 로그인한 사용자 정보를 조회한다.                                           |
| `createFromGoogleProfile` | `GoogleUserProfile`     | `UserProfileDto`         | Google OAuth profile을 기반으로 내부 사용자를 생성한다.                         |
| `createFromNativeSignup`   | `{ email, name }`       | `UserProfileDto`         | Native 회원가입 정보를 기반으로 내부 사용자를 생성한다. Password hash 저장은 AuthModule에서 처리한다. |
| `markEmailVerified`        | `userId`                | `void`                  | 회원가입 인증번호 검증 성공 후 `email_verified_at`을 설정한다. |
| `createFromNativeSignup` | `{ email, name }` | `UserProfileDto` | Native 회원가입 정보를 기반으로 내부 사용자를 생성한다. Password hash 저장은 AuthModule에서 처리한다. |
| `updateMe`                | `userId`, `UpdateMeDto` | `UserProfileDto`         | 현재 로그인한 사용자의 수정 가능한 프로필 정보를 변경한다.                      |
| `incrementTokenVersion`   | `userId`                | `void`                   | refresh token 무효화 또는 전체 로그아웃 처리를 위해 token version을 증가시킨다. |

---

## 8. Controller Design

## 8.1 UsersController

Base path:

```text
/users
```

Endpoints:

| Method | Path  | Guard          | Service Method            |
| ------ | ----- | -------------- | ------------------------- |
| GET    | `/me` | `JwtAuthGuard` | `usersService.findMe()`   |
| PATCH  | `/me` | `JwtAuthGuard` | `usersService.updateMe()` |

### Controller Rule

Controller는 요청과 응답을 연결하는 역할만 담당한다.

사용자 조회, 예외 처리, 데이터 수정 로직은 `UsersService`에 둔다.

---

## 9. API Boundary Note: `/auth/me` vs `/users/me`

SudoCampus 문서에는 현재 사용자 조회 API로 `GET /auth/me`와 `GET /users/me`가 함께 언급되어 있다.

MVP 구현에서는 다음 기준을 따른다.

| API             | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `GET /auth/me`  | 현재 JWT 인증 상태 확인 및 인증된 사용자 정보 반환 |
| `GET /users/me` | 현재 로그인한 사용자의 프로필 정보 조회            |

두 API는 같은 `UserProfileDto`를 반환할 수 있다.

단, 구현 단순화를 위해 MVP에서는 둘 중 하나만 먼저 구현할 수 있다. 이 경우 `UserModule`의 대표 API로 `GET /users/me`를 우선 구현하고, `AuthModule`은 로그인, refresh, logout에 집중한다.

---

## 10. Authorization Rules

`UserModule`의 `/users/me` API는 URL에 user ID를 받지 않는다.

즉, 사용자가 다음과 같이 다른 사용자의 ID를 넣어서 접근하는 구조를 만들지 않는다.

```text
GET /users/:userId
PATCH /users/:userId
```

MVP에서는 항상 JWT에서 가져온 현재 사용자 ID만 사용한다.

```text
currentUser.id === targetUser.id
```

따라서 `/users/me`는 별도의 ownership check가 단순하다.

```text
target user = current authenticated user
```

향후 관리자 기능이 추가될 경우에만 다음 API를 별도로 설계한다.

```text
GET /admin/users/:userId
PATCH /admin/users/:userId/status
PATCH /admin/users/:userId/role
```

MVP에서는 위 관리자 API를 구현하지 않는다.

---

## 11. Status and Token Policy

## 11.1 User Status Policy

`status`는 계정 접근 가능 여부를 나타낸다.

| Status      | API Access |
| ----------- | ---------- |
| `ACTIVE`    | 허용       |
| `SUSPENDED` | 차단 가능  |
| `DELETED`   | 차단 가능  |

MVP에서는 계정 정지/삭제 API를 구현하지 않는다.  
다만 Auth 또는 Guard 레벨에서 `status !== ACTIVE`인 사용자의 접근을 막을 수 있도록 구조를 유지한다.

---

## 11.2 Token Version Policy

`token_version`은 refresh token 무효화에 사용한다.

예시:

1. 사용자가 로그아웃한다.
2. `UsersService.incrementTokenVersion(userId)`를 호출한다.
3. `users.token_version` 값이 증가한다.
4. 기존 refresh token에 들어 있던 token version과 DB의 token version이 달라진다.
5. 기존 refresh token은 더 이상 사용할 수 없다.

이 로직은 주로 `AuthModule`의 logout 또는 refresh token 검증 과정에서 사용한다.

---

## 12. Error Handling

| Situation                   | HTTP Status | Description                                           |
| --------------------------- | ----------: | ----------------------------------------------------- |
| Missing or invalid token    |         401 | 인증 토큰이 없거나 유효하지 않음                      |
| User not found              |         404 | JWT의 userId에 해당하는 사용자가 없음                 |
| Suspended or deleted user   |         403 | 계정 상태가 접근 가능한 상태가 아님                   |
| Invalid name                |         400 | 이름 형식이 유효하지 않음                             |
| Updating non-editable field |         400 | email, role, status 등 수정 불가 필드를 변경하려고 함 |

---

## 13. MVP Exclusions

다음 기능은 MVP의 `UserModule`에서 구현하지 않는다.

| Feature | Reason |
|---|---|
| Password hash 생성/검증 | AuthModule 책임 |
| Password reset flow orchestration | AuthModule 책임 |
| Verification code generation/validation | AuthModule 또는 VerificationCodeService 책임 |
| User list API | 관리자 기능에 가까움 |
| User search API | 관리자 기능에 가까움 |
| User role update API | `role` 필드는 존재하지만 일반 사용자 API에서는 수정하지 않음 |
| User status update API | `status` 필드는 존재하지만 일반 사용자 API에서는 수정하지 않음 |
| Public user profile | 현재 학습 플랫폼 핵심 흐름에 필요하지 않음 |

`role`, `status`, `token_version`, `email_verified_at`은 DB와 인증/인가 정책을 위해 존재하지만, 일반 사용자에게 직접 수정 API를 제공하지 않는다.

---

## 14. File Structure Recommendation

NestJS 기준 권장 파일 구조는 다음과 같다.

```text
src/user/
  user.module.ts
  user.controller.ts
  user.service.ts
  user.entity.ts
  dto/
    update-me.dto.ts
    user-profile.dto.ts
```

또는 프로젝트에서 복수형 디렉터리 네이밍을 사용한다면 다음 구조를 사용할 수 있다.

```text
src/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  user.entity.ts
  dto/
    update-me.dto.ts
    user-profile.dto.ts
```

기존 프로젝트에 `user` 또는 `users` 디렉터리가 이미 있다면 새로 중복 생성하지 않고 기존 구조를 따른다.

---

## 15. Implementation Checklist

| Item                                                 | Status |
| ---------------------------------------------------- | ------ |
| `UsersModule` or `UserModule` exists                 | TODO   |
| `UsersController` or `UserController` exists         | TODO   |
| `UsersService` or `UserService` exists               | TODO   |
| User entity matches DB spec                          | TODO   |
| `role`, `status`, `token_version` fields exist       | TODO   |
| `GET /users/me` implemented                          | TODO   |
| `PATCH /users/me` implemented                        | TODO   |
| `JwtAuthGuard` applied                               | TODO   |
| `UpdateMeDto` validation added                       | TODO   |
| Only `name` is editable through `/users/me`          | TODO   |
| `role/status/tokenVersion` cannot be updated by user | TODO   |
| `findById` implemented                               | TODO   |
| `findByEmail` implemented                            | TODO   |
| `findByEmailAndName` implemented                      | TODO   |
| `createFromNativeSignup` implemented                  | TODO   |
| `markEmailVerified` implemented                       | TODO   |
| `createFromGoogleProfile` implemented                | TODO   |
| `incrementTokenVersion` implemented                  | TODO   |
| User not found error handled                         | TODO   |
| Suspended/deleted user access policy considered      | TODO   |
| Controller has no complex business logic             | TODO   |
| Existing `User` entity reused                        | TODO   |
| Password credential is not managed by UserModule      | TODO   |
| No admin user management API added                   | TODO   |

---

## 16. Design Decision Summary

| Decision                | Result                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| Login method            | Google OAuth + Native email/password                                     |
| User creation           | AuthModule flow starts creation, UsersService performs user data creation |
| User profile management | UserModule                                                                |
| Main external User APIs | `GET /users/me`, `PATCH /users/me`                                        |
| Editable field in MVP   | `name` only                                                               |
| Password features       | Register/login은 AuthModule에서 처리, UserModule에서는 credential 직접 관리 제외 |
| Admin user management   | Excluded                                                                  |
| `role`                  | Exists in DB, not editable by normal user                                 |
| `status`                | Exists in DB, not editable by normal user                                 |
| `token_version`         | Exists in DB, managed internally for token invalidation                   |
| Google provider ID      | Stored in `oauth_accounts`, not in `users`                                |
