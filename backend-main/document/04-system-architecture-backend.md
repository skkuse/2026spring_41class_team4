# SudoCampus Backend System Architecture

## 1. Architecture Direction

SudoCampus 諛깆뿏?쒕뒗 Google OAuth? native email/password 湲곕컲 ?몄쬆, 怨쇰ぉ蹂?PDF ?숈뒿?먮즺 愿由? 臾몄꽌 ?⑥쐞 遺꾩꽍, ?ㅼ썙??湲곕컲 ?댁쫰 ?앹꽦, ?ъ슜?????湲곕줉 湲곕컲 Mastery 愿由? 留욎땄??Mock Exam ?앹꽦??吏?먰븯?꾨줉 ?ㅺ퀎?쒕떎.

諛깆뿏?쒕뒗 NestJS 湲곕컲??Modular Architecture瑜??ъ슜?섎ŉ, 媛?湲곕뒫? ?낅┰?곸씤 Module濡?遺꾨━?쒕떎.

### 1.1 Technology Stack

| Area | Technology |
|---|---|
| Backend Framework | NestJS 11 |
| Database ORM | TypeORM |
| Database | PostgreSQL |
| Authentication | Google OAuth + Native Email/Password + Verification Code + JWT |
| AI Integration | OpenAI API |
| File Upload | multipart/form-data + local or object storage |

---

## 2. Authentication Policy

MVP?먯꽌??**Google OAuth + Native Email/Password + Verification Code** 諛⑹떇???④퍡 吏?먰븳??

?ъ슜?먮뒗 Google 怨꾩젙?쇰줈 濡쒓렇?명븷 ???덇퀬, 蹂꾨룄???대쫫/?대찓??鍮꾨?踰덊샇 湲곕컲 ?뚯썝媛??諛?濡쒓렇?몄쓣 ?ъ슜???섎룄 ?덈떎. Native ?뚯썝媛?낆? ?몄쬆踰덊샇 寃利앹쓣 ?꾩닔濡??섎ŉ, 鍮꾨?踰덊샇??`password_credentials`??bcrypt hash濡???ν븳??

?꾩씠??李얘린?먯꽌 SudoCampus???꾩씠?붾뒗 ?대찓??二쇱냼濡??뺤쓽?쒕떎. ?꾩씠??李얘린???대찓??二쇱냼? ?대쫫???낅젰諛쏆븘 媛???뺣낫 ?쇱튂 ?щ?瑜??뺤씤?섍퀬, ?쇱튂?섎뒗 寃쎌슦 ?대찓??二쇱냼瑜?諛섑솚?섍굅??留덉뒪?뱁븯??諛섑솚?쒕떎.

鍮꾨?踰덊샇 李얘린???대찓??二쇱냼? ?대쫫 ?뺤씤 ???몄쬆踰덊샇瑜?諛쒖넚?섍퀬, ?ъ슜?먭? ?몄쬆踰덊샇? ??鍮꾨?踰덊샇瑜??쒖텧?섎㈃ 鍮꾨?踰덊샇瑜??ъ꽕?뺥븯??諛⑹떇?쇰줈 泥섎━?쒕떎.

### 2.1 Included in MVP

| Feature | Description |
|---|---|
| Google OAuth 濡쒓렇??| Google 怨꾩젙???댁슜??濡쒓렇??|
| Native ?뚯썝媛??| ?대쫫, ?대찓?? 鍮꾨?踰덊샇, ?몄쬆踰덊샇 湲곕컲 ?뚯썝媛??|
| ?뚯썝媛???몄쬆踰덊샇 諛쒖넚 諛?寃利?| ?뚯썝媛?????대찓???몄쬆踰덊샇瑜?諛쒖넚?섍퀬 ?뚯썝媛????寃利?|
| Native 濡쒓렇??| ?대찓?쇨낵 鍮꾨?踰덊샇瑜?寃利앺븳 ??JWT 諛쒓툒 |
| ?꾩씠??李얘린 | ?대찓??二쇱냼? ?대쫫?쇰줈 媛???뺣낫 ?쇱튂 ?щ? ?뺤씤 |
| 鍮꾨?踰덊샇 李얘린 | ?대찓??二쇱냼? ?대쫫 ?뺤씤 ???몄쬆踰덊샇 諛쒖넚 |
| 鍮꾨?踰덊샇 ?ъ꽕??| ?몄쬆踰덊샇 寃利???`password_credentials.password_hash` 媛깆떊 |
| ?대? User ?앹꽦 ?먮뒗 議고쉶 | Google profile ?먮뒗 native ?뚯썝媛???뺣낫瑜?湲곕컲?쇰줈 `users` ?곗씠???앹꽦 ?먮뒗 議고쉶 |
| OAuth 怨꾩젙 ?곌껐 | `oauth_accounts` ?뚯씠釉붿뿉 Google provider ?뺣낫 ???|
| Password credential ???| `password_credentials` ?뚯씠釉붿뿉 bcrypt hash ???|
| Verification code ???| `auth_verification_codes` ?뚯씠釉붿뿉 ?몄쬆踰덊샇 hash ???|
| JWT access/refresh token 諛쒓툒 | 濡쒓렇???깃났 ???쒕퉬???먯껜 JWT 諛쒓툒 |
| JWT 湲곕컲 API 蹂댄샇 | ?몄쬆???꾩슂??API??`JwtAuthGuard` ?곸슜 |

### 2.2 Excluded from MVP

| Feature | Reason |
|---|---|
| Google 怨꾩젙怨?native 怨꾩젙 ?먮룞 ?곌껐 | ?대찓?쇰쭔?쇰줈 ?먮룞 ?곌껐?섎㈃ 怨꾩젙 ?덉랬 ?꾪뿕???덉쑝誘濡??쒖쇅 |
| ?щ윭 OAuth provider | ?꾩옱??Google留?吏??|
| SMS ?몄쬆 ?ㅺ뎄??| ?꾩옱 ?뚯썝媛?낆뿉???대???踰덊샇瑜??섏쭛?섏? ?딆쑝誘濡??대찓??諛쒖넚???곗꽑 援ы쁽 |
| 2FA | MVP 踰붿쐞瑜?珥덇낵?섎뒗 蹂댁븞 湲곕뒫 |
| 怨꾩젙 ?좉툑 ?뺤콉 怨좊룄??| ?몄쬆踰덊샇 ?쒕룄 ?잛닔 ?쒗븳 ?뺣룄留??곗꽑 ?곸슜 |

### 2.3 Design Decision

Auth Module? Google OAuth? native email/password ?몄쬆??紐⑤몢 ?대떦?쒕떎. ?먰븳 ?뚯썝媛???몄쬆踰덊샇, ?꾩씠??李얘린, 鍮꾨?踰덊샇 ?ъ꽕???먮쫫???대떦?쒕떎.

MVP Auth Module???듭떖 梨낆엫? ?ㅼ쓬怨?媛숇떎.

1. Google ID token??寃利앺븳??
2. Google profile ?뺣낫瑜??대? `users` 怨꾩젙怨??곌껐?쒕떎.
3. `oauth_accounts`瑜??듯빐 Google provider 怨꾩젙怨??대? User瑜?留ㅽ븨?쒕떎.
4. Native ?뚯썝媛???몄쬆踰덊샇瑜??앹꽦?섍퀬 寃利앺븳??
5. Native ?뚯썝媛???붿껌??寃利앺븯怨?`users`? `password_credentials`瑜??앹꽦?쒕떎.
6. Native 濡쒓렇???붿껌??鍮꾨?踰덊샇瑜?bcrypt濡?寃利앺븳??
7. ?꾩씠??李얘린 ?붿껌?먯꽌 email/name ?쇱튂 ?щ?瑜??뺤씤?쒕떎.
8. 鍮꾨?踰덊샇 ?ъ꽕???몄쬆踰덊샇瑜??앹꽦?섍퀬 寃利앺븳??
9. 鍮꾨?踰덊샇 ?ъ꽕????`password_credentials.password_hash`瑜?媛깆떊?섍퀬 `users.token_version`??利앷??쒗궓??
10. ?쒕퉬???먯껜 JWT access/refresh token??諛쒓툒?쒕떎.
11. ?댄썑 API ?붿껌?먯꽌 JWT瑜?寃利앺븳??

### 2.4 Database Implication

MVP 湲곗??쇰줈 `users` ?뚯씠釉붿뿉??`password_hash` 而щ읆??吏곸젒 異붽??섏? ?딅뒗??

鍮꾨?踰덊샇 湲곕컲 ?몄쬆 ?뺣낫??`password_credentials` ?뚯씠釉붿뿉 遺꾨━?쒕떎. ?몄쬆踰덊샇??`auth_verification_codes` ?뚯씠釉붿뿉 hash濡???ν븳?? ?대젃寃??섎㈃ Google 濡쒓렇???ъ슜?먯? native 濡쒓렇???ъ슜?먮? 紐⑤몢 ?숈씪??`users.id` 湲곗??쇰줈 ?ㅻ（硫댁꽌?? 濡쒓렇???섎떒蹂??몄쬆 ?뺣낫瑜?紐낇솗??遺꾨━?????덈떎.

```text
password_credentials
- id
- user_id
- password_hash
- created_at
- updated_at

auth_verification_codes
- id
- user_id nullable
- email
- purpose
- code_hash
- expires_at
- verified_at
- consumed_at
- attempt_count
- delivery_channel
- created_at
```

MVP?먯꽌???대찓??諛쒖넚???곗꽑 援ы쁽?쒕떎. SMS 諛쒖넚? ?대???踰덊샇 ?섏쭛 ?뺤콉??異붽??????뺤옣?쒕떎.

---

## 3. Overall Backend Module Structure

?꾩옱 DB ?ㅽ럺 湲곗??쇰줈 諛깆뿏??紐⑤뱢? ?ㅼ쓬怨?媛숈씠 援ъ꽦?쒕떎.

| Module | Main Responsibility |
|---|---|
| Auth Module | Google OAuth 濡쒓렇?? native ?뚯썝媛??濡쒓렇?? ?몄쬆踰덊샇, ?꾩씠??李얘린, 鍮꾨?踰덊샇 ?ъ꽕?? JWT 諛쒓툒, ?몄쬆 Guard |
| Users Module | ?대? ?ъ슜???뺣낫 愿由?|
| Subjects Module | ?ъ슜?먮퀎 怨쇰ぉ 愿由?|
| Documents Module | PDF ?낅줈?? cleaned markdown 異붿텧, document chunk ??? 臾몄꽌 愿由?|
| Keywords Module | 臾몄꽌蹂?keyword? keyword-source chunk 愿由?|
| quiz Module | Lecture quiz / mock exam quiz set 愿由?|
| QuizProblems Module | 媛쒕퀎 臾몄젣, ?좏깮吏, 臾몄젣-keyword ?곌껐 愿由?|
| QuizAttempts Module | ?댁쫰 ?묒떆 ?몄뀡怨?臾몄젣蹂??듭븞 湲곕줉 愿由?|
| Mastery Module | user-keyword ?댄빐???먯닔 愿由?|
| MockExams Module | 痍⑥빟 媛쒕뀗 湲곕컲 mock exam ?앹꽦 |

---

# 4. Module Design

## 4.1 Auth Module

### Purpose

Auth Module? Google OAuth, native email/password 濡쒓렇?? ?뚯썝媛???몄쬆踰덊샇, ?꾩씠??李얘린, 鍮꾨?踰덊샇 ?ъ꽕?? JWT ?몄쬆???대떦?쒕떎.

?ъ슜?먭? Google 怨꾩젙?쇰줈 濡쒓렇?명븯硫? 諛깆뿏?쒕뒗 Google?먯꽌 諛쏆? ?ъ슜???뺣낫瑜?湲곕컲?쇰줈 ?대? `users` ?곗씠?곕? ?앹꽦?섍굅??湲곗〈 ?ъ슜?먮? 議고쉶?쒕떎. ?댄썑 `oauth_accounts`瑜??듯빐 Google provider 怨꾩젙怨??대? User瑜??곌껐?쒕떎.

?ъ슜?먭? native ?뚯썝媛?낆쓣 ?섎㈃ 癒쇱? ?대찓???몄쬆踰덊샇瑜??붿껌?섍퀬, 理쒖쥌 ?뚯썝媛?????대쫫, ?대찓?? 鍮꾨?踰덊샇, ?몄쬆踰덊샇瑜??쒖텧?쒕떎. 諛깆뿏?쒕뒗 ?몄쬆踰덊샇瑜?寃利앺븳 ??`users`瑜??앹꽦?섍퀬, bcrypt濡?hash 泥섎━??鍮꾨?踰덊샇瑜?`password_credentials`????ν븳??

### Main Responsibilities

- Google ID token 寃利?
- Google profile ?뺣낫 ?섏떊
- Native ?뚯썝媛???몄쬆踰덊샇 ?앹꽦 諛?諛쒖넚 ?붿껌
- Native ?뚯썝媛???몄쬆踰덊샇 寃利?
- Native ?뚯썝媛???붿껌 泥섎━
- Native 濡쒓렇???붿껌 泥섎━
- ?꾩씠??李얘린 泥섎━
- 鍮꾨?踰덊샇 ?ъ꽕???몄쬆踰덊샇 ?앹꽦 諛?諛쒖넚 ?붿껌
- 鍮꾨?踰덊샇 ?ъ꽕???몄쬆踰덊샇 寃利?
- `users` ?뚯씠釉붿뿉???ъ슜??議고쉶 ?먮뒗 ?앹꽦
- `oauth_accounts` ?뚯씠釉붿뿉??provider 怨꾩젙 ?곌껐 愿由?
- `password_credentials` ?뚯씠釉붿뿉??password hash ???諛?寃利?
- `auth_verification_codes` ?뚯씠釉붿뿉??verification code hash ???諛?寃利?
- JWT access/refresh token 諛쒓툒
- JWT ?몄쬆 Guard ?쒓났
- ?꾩옱 濡쒓렇?명븳 ?ъ슜???뺣낫 ?쒓났

### Not Responsibilities

Auth Module? MVP?먯꽌 ?ㅼ쓬 湲곕뒫???대떦?섏? ?딅뒗??

- Google 怨꾩젙怨?native 怨꾩젙 ?먮룞 ?곌껐
- Google ??OAuth provider 泥섎━
- ?ъ슜???꾨줈???섏젙
- SMS ?몄쬆 ?ㅺ뎄??

### Main Components

| Component | Role |
|---|---|
| `AuthController` | Google OAuth, native register/login, find ID, password reset, refresh, logout route 泥섎━ |
| `AuthService` | Google profile ?먮뒗 native credential???대? User? ?곌껐?섍퀬 JWT token ?앹꽦 |
| `VerificationCodeService` | ?몄쬆踰덊샇 ?앹꽦, hash ??? 寃利? ?뚮퉬 泥섎━ |
| `MailService` | ?뚯썝媛??鍮꾨?踰덊샇 ?ъ꽕???몄쬆踰덊샇 ?대찓??諛쒖넚 |
| `GoogleTokenVerifier` ?먮뒗 `GoogleStrategy` | Google ID token 寃利??먮뒗 OAuth ?꾨왂 泥섎━ |
| `JwtStrategy` | ?대씪?댁뼵???붿껌??JWT token 寃利?|
| `JwtAuthGuard` | ?몄쬆???꾩슂??API 蹂댄샇 |
| `CurrentUser Decorator` | Controller?먯꽌 ?꾩옱 濡쒓렇?명븳 ?ъ슜???뺣낫 ?ъ슜 吏??|

### Related Tables

- `users`
- `oauth_accounts`
- `password_credentials`
- `auth_verification_codes`

### Main Flow: Google Login

1. ?ъ슜?먭? Google Login 踰꾪듉???꾨Ⅸ??
2. ?꾨줎?몄뿏?쒕뒗 Google ?몄쬆 ??Google ID token???띾뱷?쒕떎.
3. ?대씪?댁뼵?멸? `POST /auth/google`濡?ID token???꾨떖?쒕떎.
4. AuthService媛 Google ID token??寃利앺븳??
5. AuthService媛 `provider_user_id`濡?`oauth_accounts`瑜?議고쉶?쒕떎.
6. 湲곗〈 ?곌껐???덉쑝硫??대떦 User瑜?議고쉶?쒕떎.
7. 湲곗〈 ?곌껐???놁쑝硫?`users`? `oauth_accounts`瑜??앹꽦?쒕떎.
8. AuthService媛 JWT access/refresh token??諛쒓툒?쒕떎.
9. ?대씪?댁뼵?몃뒗 ?댄썑 ?붿껌?먯꽌 `Authorization` header??token???ы븿?쒕떎.

### Main Flow: Native Register/Login

1. ?ъ슜?먭? ?대찓?쇰줈 ?뚯썝媛???몄쬆踰덊샇瑜??붿껌?쒕떎.
2. AuthService媛 ?대찓??以묐났???뺤씤?쒕떎.
3. VerificationCodeService媛 ?몄쬆踰덊샇瑜??앹꽦?섍퀬 hash濡???ν븳??
4. MailService媛 ?대찓?쇰줈 ?몄쬆踰덊샇瑜?諛쒖넚?쒕떎.
5. ?ъ슜?먭? ?대쫫, ?대찓?? 鍮꾨?踰덊샇, ?몄쬆踰덊샇濡??뚯썝媛?낆쓣 ?붿껌?쒕떎.
6. AuthService媛 ?몄쬆踰덊샇瑜?寃利앺븳??
7. ?좉퇋 ?대찓?쇱씠硫?`users`瑜??앹꽦?섍퀬 `email_verified_at`???ㅼ젙?쒕떎.
8. 鍮꾨?踰덊샇??bcrypt濡?hash 泥섎━?섏뿬 `password_credentials`????ν븳??
9. ?뚯썝媛???깃났 ??JWT access/refresh token??諛쒓툒?쒕떎.
10. 濡쒓렇???쒖뿉???대찓?쇰줈 User? PasswordCredential??議고쉶?섍퀬 bcrypt濡?鍮꾨?踰덊샇瑜?寃利앺븳??
11. 寃利??깃났 ??JWT access/refresh token??諛쒓툒?쒕떎.

### Main Flow: Find ID

1. ?ъ슜?먭? ?대찓??二쇱냼? ?대쫫???낅젰?쒕떎.
2. AuthService媛 `users.email`怨?`users.name`???쇱튂?섎뒗 ?ъ슜?먮? 議고쉶?쒕떎.
3. ?쇱튂?섎뒗 ?ъ슜?먭? ?덉쑝硫??대찓??二쇱냼瑜?諛섑솚?쒕떎.
4. 蹂댁븞???묐떟?먯꽌???대찓?쇱쓣 留덉뒪?뱁븷 ???덈떎.

### Main Flow: Password Reset

1. ?ъ슜?먭? ?대찓??二쇱냼? ?대쫫???낅젰?섏뿬 鍮꾨?踰덊샇 ?ъ꽕???몄쬆踰덊샇瑜??붿껌?쒕떎.
2. AuthService媛 ?ъ슜???뺣낫瑜??뺤씤?쒕떎.
3. ?쇱튂?섎뒗 ?ъ슜?먭? ?덉쑝硫?VerificationCodeService媛 ?몄쬆踰덊샇瑜??앹꽦?섍퀬 hash濡???ν븳??
4. MailService媛 ?대찓?쇰줈 ?몄쬆踰덊샇瑜?諛쒖넚?쒕떎.
5. ?ъ슜?먭? ?대찓?? ?대쫫, ?몄쬆踰덊샇, ??鍮꾨?踰덊샇瑜??쒖텧?쒕떎.
6. AuthService媛 ?몄쬆踰덊샇瑜?寃利앺븳??
7. ??鍮꾨?踰덊샇瑜?bcrypt濡?hash 泥섎━?섏뿬 `password_credentials.password_hash`瑜?媛깆떊?쒕떎.
8. 湲곗〈 refresh token 臾댄슚?붾? ?꾪빐 `users.token_version`??利앷??쒗궓??
9. ?몄쬆踰덊샇瑜?consumed 泥섎━?쒕떎.

---

## 4.2 Users Module

### Purpose

Users Module? SudoCampus ?대? ?ъ슜???뺣낫瑜?愿由ы븳??

Google 怨꾩젙 ?뺣낫??`oauth_accounts`????ν븯怨? ?쒕퉬???대???湲곗? ?ъ슜???뺣낫??`users`????ν븳??

### Main Responsibilities

- ?대? User ?앹꽦
- User ?④굔 議고쉶
- ?꾩옱 濡쒓렇?명븳 ?ъ슜???뺣낫 議고쉶
- OAuth 怨꾩젙怨??곌껐??User 議고쉶 吏??
- Google OAuth ?먮뒗 native ?뚯썝媛??email 湲곗? 以묐났 ?щ? ?뺤씤
- email/name 湲곗? User 議고쉶 吏??
- email_verified_at ?낅뜲?댄듃 吏??
- token_version 利앷? 吏??

### Not Responsibilities

Users Module? MVP?먯꽌 ?ㅼ쓬 湲곕뒫???대떦?섏? ?딅뒗??

- password hash ???
- email/password credential 愿由?
- 鍮꾨?踰덊샇 蹂寃?
- password hash 吏곸젒 ???
- ?몄쬆踰덊샇 ?앹꽦/寃利?
- 鍮꾨?踰덊샇 ?ъ꽕??濡쒖쭅 吏곸젒 泥섎━

### Main Components

| Component | Role |
|---|---|
| `UsersController` | ?꾩옱 ?ъ슜???뺣낫 議고쉶 API ?쒓났 |
| `UsersService` | User ?앹꽦怨?議고쉶 ?대떦 |

### Related Tables

- `users`
- `oauth_accounts`
- `subjects`
- `documents`
- `quiz`
- `quiz_attempts`
- `quiz_problem_attempts`
- `mastery_scores`
- `mock_exams`

### Difficulty Control and Assessment Metadata

QuizProblems Module uses an evidence-based difficulty control strategy instead of trusting the LLM's difficulty label directly.

The strategy combines:

| Concept | Architectural Role |
|---|---|
| Bloom's Taxonomy | Defines the cognitive level of a quiz problem. |
| Webb's Depth of Knowledge (DOK) | Defines the reasoning depth required to solve the quiz problem. |
| Evidence-Centered Design (ECD) | Connects each quiz problem to a keyword mastery claim and evidence chunks. |
| Automatic Item Generation (AIG) | Structures the LLM prompt as an item model with constraints. |

The LLM must return assessment metadata such as `bloomLevel`, `dokLevel`, `difficultyFeatures`, `modelPredictedDifficulty`, `difficultyConfidence`, and `difficultyRationale`.

However, the final difficulty stored in `quiz_problems.difficulty` is calculated by the backend.

```text
requestedDifficulty      = generation direction
modelPredictedDifficulty = LLM estimate
finalDifficulty          = backend-calculated value saved to DB
```

MVP implementation should avoid a large schema change. It may store only `finalDifficulty` in the existing `quiz_problems.difficulty` column, while keeping detailed metadata in validation logs or internal AI response objects. Later, the table can be extended with metadata columns if needed.

Recommended internal component:

```text
QuizProblemsService
  └─ DifficultyCalculator
       ├─ calculateDifficulty(difficultyFeatures)
       └─ returns EASY | MEDIUM | HARD
```

The difficulty calculator should use factors such as:

- number of concepts required
- number of reasoning steps
- whether inference is required
- whether the answer is explicitly stated in the material
- whether comparison or application is required
- distractor complexity
- question type

This design protects the Mastery Module from distorted scoring caused by unreliable LLM difficulty labels.

### Design Note

`users` ?뚯씠釉붿뿉??Google provider ID瑜?吏곸젒 ??ν븯吏 ?딅뒗??

Google provider ID??`oauth_accounts.provider_user_id`????ν븳??

??援ъ“瑜??ъ슜?섎㈃ ?섏쨷??Kakao, GitHub ???ㅻⅨ OAuth provider瑜?異붽??????덈떎.

?먰븳 MVP?먯꽌??`users.password_hash` 而щ읆??留뚮뱾吏 ?딅뒗?? Native 鍮꾨?踰덊샇 ?몄쬆 ?뺣낫??`password_credentials.password_hash`????ν븯怨? AuthModule??bcrypt 湲곕컲 寃利앹쓣 ?대떦?쒕떎.

---

## 4.3 Subjects Module

### Purpose

Subjects Module? ?ъ슜?먭? ?앹꽦??怨쇰ぉ ?먮뒗 媛뺤쓽 ?⑥쐞瑜?愿由ы븳??

Subject??臾몄꽌, ?ㅼ썙?? ?댁쫰, mastery score???곸쐞 湲곗????쒕떎.

### Main Responsibilities

- Subject ?앹꽦
- Subject 紐⑸줉 議고쉶
- Subject ?④굔 議고쉶
- Subject ?섏젙
- Subject ??젣
- ?ъ슜?먮퀎 Subject ?뚯쑀沅?寃利?

### Main Components

| Component | Role |
|---|---|
| `SubjectsController` | Subject CRUD API 泥섎━ |
| `SubjectsService` | Subject ?앹꽦, 議고쉶, ?섏젙, ??젣 濡쒖쭅怨??뚯쑀沅?寃利??대떦 |

### Related Tables

- `subjects`
- `documents`
- `keywords`
- `quiz`
- `mastery_scores`
- `mock_exams`

### Ownership Rule

```text
User 1 ?? N Subject
```

?ъ슜?먮뒗 ?먯떊??Subject留??묎렐?????덉뼱???쒕떎.

---

## 4.4 Documents Module

### Purpose

Documents Module? PDF 媛뺤쓽?먮즺 ?낅줈?쒖? 遺꾩꽍 ?곹깭 愿由щ? ?대떦?쒕떎.

?꾩옱 MVP?먯꽌??臾몄꽌 ?⑥쐞 遺꾩꽍??湲곗??쇰줈 ?쒕떎.

### Main Responsibilities

- PDF ?뚯씪 ?낅줈??
- ?뚯씪 硫뷀??곗씠?????
- Document 遺꾩꽍 ?곹깭 愿由?
- PDF page count 硫뷀??곗씠?????
- PDF 臾몄꽌 ?띿뒪??異붿텧
- 臾몄꽌 ?꾩껜 ?붿빟 ???
- `keywords` ???
- OpenAI API 遺꾩꽍 ?붿껌 ?쒖뼱

### Main Components

| Component | Role |
|---|---|
| `DocumentsController` | PDF ?낅줈?? 臾몄꽌 議고쉶, ??젣 API 泥섎━ |
| `DocumentsService` | 臾몄꽌 硫뷀??곗씠????κ낵 遺꾩꽍 ?먮쫫 ?쒖뼱 |
| `PdfParserService` | PDF?먯꽌 臾몄꽌 ?띿뒪??異붿텧 |
| `DocumentAiService` | OpenAI API瑜??듯빐 ?붿빟, ?ㅼ썙?? ?댁쫰 ?앹꽦 ?붿껌 |

### Related Tables

- `documents`
- `document_chunks`
- `keywords`
- `keyword_chunks`
- `quiz`
- `quiz_problems`

### Document Status

| Status | Meaning |
|---|---|
| `UPLOADED` | PDF ?낅줈?쒓? ?꾨즺???곹깭 |
| `PROCESSING` | PDF ?뚯떛 ?먮뒗 AI 遺꾩꽍??吏꾪뻾 以묒씤 ?곹깭 |
| `ANALYZED` | 遺꾩꽍???꾨즺???곹깭 |
| `FAILED` | ?뚯떛 ?먮뒗 AI 遺꾩꽍 以??ㅻ쪟媛 諛쒖깮???곹깭 |

### Main Flow

1. ?ъ슜?먭? ?뱀젙 Subject??PDF瑜??낅줈?쒗븳??
2. DocumentsController媛 `multipart/form-data` ?붿껌??諛쏅뒗??
3. JwtAuthGuard媛 ?ъ슜?먮? ?몄쬆?쒕떎.
4. DocumentsService媛 `subject_id`? current user瑜?湲곗??쇰줈 ?뚯쑀沅뚯쓣 寃利앺븳??
5. PDF ?뚯씪 ?뺤떇怨??ш린瑜?寃利앺븳??
6. `documents` ?뚯씠釉붿뿉 硫뷀??곗씠?곕? ??ν븳??
7. `analysis_status`瑜?`UPLOADED`濡??ㅼ젙?쒕떎.
8. PdfParserService媛 cleaned markdown only 異붿텧???섑뻾?쒕떎. ??寃쎈줈?먯꽌???대?吏 異붿텧怨?raw JSON ?곗텧臾??앹꽦???ㅽ뻾?섏? ?딅뒗??
9. DocumentsService媛 cleaned markdown??`document_chunks`濡??뚯떛?섏뿬 ??ν븳??
10. DocumentAiService媛 document chunks 湲곕컲?쇰줈 臾몄꽌 ?꾩껜 ?붿빟怨?keyword extraction???붿껌?쒕떎.
11. Keyword extraction? keyword ?대쫫肉??꾨땲??sourceRefs(chunk/page/evidenceText)瑜?諛섑솚?쒕떎.
12. `documents.overall_summary`, `keywords`, `keyword_chunks`瑜???ν븳??
13. `analysis_status`瑜?`ANALYZED`濡?蹂寃쏀븳??

---

## 4.5 Keywords Module

### Purpose

Keywords Module? 臾몄꽌 ?⑥쐞 ?듭떖 媛쒕뀗怨??대떦 媛쒕뀗??媛뺤쓽?먮즺 洹쇨굅 chunk瑜?愿由ы븳??

?꾩옱 DB ?ㅽ럺?먯꽌??Keyword媛 Subject媛 ?꾨땲??Document???랁븳??

### Main Responsibilities

- keyword ?앹꽦
- 媛숈? Document ?덉뿉??Keyword ?대쫫 以묐났 諛⑹?
- QuizProblem怨?Keyword ?곌껐
- Mastery 怨꾩궛??湲곗? ?쒓났

### Main Components

| Component | Role |
|---|---|
| `KeywordsController` | Keyword 議고쉶 API ?쒓났 |
| `KeywordsService` | Keyword ?앹꽦, 議고쉶, ?곌껐 泥섎━ ?대떦 |

### Related Tables

- `keywords`
- `keyword_chunks`
- `document_chunks`
- `quiz_problem_keywords`
- `mastery_scores`

### Design Note

Keyword???ъ슜?먯쓽 ?댄빐?꾨? 怨꾩궛?섎뒗 ?듭떖 ?⑥쐞?대ŉ, 媛?keyword???섎굹??Document???랁븯怨?媛뺤쓽?먮즺??洹쇨굅 chunk? ?곌껐?섏뼱???쒕떎.

```text
Subject 1 ?? N Document
Document 1 ?? N Keyword
Keyword N ?? M DocumentChunk
Keyword N ?? M QuizProblem
Keyword 1 ?? N MasteryScore
```

---

## 4.6 quiz Module

### Purpose

quiz Module? ?댁쫰 ?명듃瑜?愿由ы븳??

?꾩옱 DB ?ㅽ럺?먯꽌??lecture quiz? mock exam??紐⑤몢 `quiz` ?뚯씠釉붿뿉 ??ν븯怨? `quiz_type`?쇰줈 援щ텇?쒕떎.

### Main Responsibilities

- Lecture quiz ?앹꽦
- Mock exam quiz ?앹꽦
- Quiz 紐⑸줉 議고쉶
- Quiz ?④굔 議고쉶
- Quiz? QuizProblem ?곌껐 愿由?
- Quiz type 愿由?

### Main Components

| Component | Role |
|---|---|
| `quizController` | Quiz ?앹꽦, 議고쉶 API 泥섎━ |
| `quizService` | Quiz set ?앹꽦怨?議고쉶 ?대떦 |

### Related Tables

- `quiz`
- `quiz_problems`
- `quiz_attempts`
- `mock_exams`
- `documents`
- `subjects`
- `users`

### Quiz Type

| Type | Meaning |
|---|---|
| `LECTURE` | PDF 臾몄꽌 湲곕컲?쇰줈 ?앹꽦??媛뺤쓽 ?댁쫰 |
| `MOCK_EXAM` | ?ъ슜?먯쓽 mastery score瑜?湲곕컲?쇰줈 ?앹꽦??紐⑥쓽怨좎궗 |

### Design Note

Mock exam??臾몄젣 ???援ъ“???쇰컲 quiz? ?숈씪?섎?濡?`quiz`瑜??ъ궗?⑺븳??

`mock_exams` ?뚯씠釉붿? `MOCK_EXAM` ???quiz??異붽? ?ㅼ젙 ?뺣낫瑜???ν븳??

---

## 4.7 QuizProblems Module

### Purpose

QuizProblems Module? ?댁쫰 ?덉쓽 媛쒕퀎 臾몄젣瑜?愿由ы븳??

?섎굹??Quiz???щ윭 QuizProblem??媛吏꾨떎. QuizProblem? ?좏깮吏, ?뺣떟, ?댁꽕, ?쒖씠?? ?뚰듃, 愿??keyword ?뺣낫瑜??ы븿?쒕떎.

### Main Responsibilities

- QuizProblem ?앹꽦
- QuizProblem 議고쉶
- QuizProblem choice 愿由?
- ?뺣떟 諛??댁꽕 ???
- ?쒖씠?????
- ?뚰듃 ???
- 臾몄젣? Keyword ?곌껐

### Main Components

| Component | Role |
|---|---|
| `QuizProblemsController` | 臾몄젣 議고쉶 API ?쒓났 |
| `QuizProblemsService` | 臾몄젣 ?앹꽦, 議고쉶, ?좏깮吏 ??? keyword ?곌껐 泥섎━ ?대떦 |

### Related Tables

- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`
- `quiz_problem_attempts`
- `mock_exam_problems`

### Design Note

臾몄젣 ?먮낯怨??ъ슜?????湲곕줉? 遺꾨━?쒕떎.

| Entity | Meaning |
|---|---|
| `QuizProblem` | 臾몄젣 ?먮낯 |
| `QuizProblemAttempt` | ?ъ슜?먭? ?대떦 臾몄젣???쒖텧???듭븞 |

---

## 4.8 QuizAttempts Module

### Purpose

QuizAttempts Module? ?ъ슜?먯쓽 ?댁쫰 ????몄뀡怨?臾몄젣蹂??듭븞 湲곕줉??愿由ы븳??

?꾩옱 DB ?ㅽ럺? ???④퀎濡????湲곕줉????ν븳??

| Table | Meaning |
|---|---|
| `quiz_attempts` | ?댁쫰 ?꾩껜 ?묒떆 ?몄뀡 |
| `quiz_problem_attempts` | 媛?臾몄젣蹂??ъ슜?먯쓽 ?듭븞怨?寃곌낵 |

### Main Responsibilities

- Quiz attempt ?쒖옉
- Quiz ?듭븞 ?쒖텧
- 臾몄젣蹂??뺣떟 ?щ? ?먮떒
- `quiz_problem_attempts` ???
- `quiz_attempts` ?먯닔 怨꾩궛
- ???湲곕줉 議고쉶
- MasteryService ?몄텧

### Main Components

| Component | Role |
|---|---|
| `QuizAttemptsController` | ?댁쫰 ?쒖옉, ?듭븞 ?쒖텧, 湲곕줉 議고쉶 API 泥섎━ |
| `QuizAttemptsService` | ?묒떆 ?몄뀡 ?앹꽦, ?듭븞 梨꾩젏, 寃곌낵 ????대떦 |

### Related Tables

- `quiz_attempts`
- `quiz_problem_attempts`
- `quiz`
- `quiz_problems`
- `quiz_problem_choices`
- `mastery_scores`

### Main Flow

1. ?ъ슜?먭? Quiz瑜??쒖옉?쒕떎.
2. QuizAttemptsService媛 `quiz_attempts` row瑜??앹꽦?쒕떎.
3. ?ъ슜?먭? 臾몄젣蹂??듭븞???쒖텧?쒕떎.
4. QuizAttemptsService媛 `quiz_problems`? choices瑜?議고쉶?쒕떎.
5. 媛??듭븞???뺣떟 ?щ?瑜??먮떒?쒕떎.
6. `quiz_problem_attempts`??臾몄젣蹂?寃곌낵瑜???ν븳??
7. `quiz_attempts`??`correct_count`? `score`瑜?媛깆떊?쒕떎.
8. MasteryService瑜??몄텧?섏뿬 keyword蹂?mastery score瑜?媛깆떊?쒕떎.

---

## 4.9 Mastery Module

### Purpose

Mastery Module? ?ъ슜?먮퀎, 臾몄꽌 ?ㅼ썙?쒕퀎 ?꾩옱 ?댄빐???곹깭瑜?愿由ы븳??

`mastery_scores`??keyword 湲곗???理쒖떊 ?곹깭瑜???ν븯怨? ?곸꽭 ?대젰? `quiz_attempts`? `quiz_problem_attempts`?먯꽌 異붿쟻?쒕떎.

### Main Responsibilities

- User + Keyword 湲곗? mastery score ?앹꽦
- QuizProblemAttempt 寃곌낵 湲곕컲 mastery score 媛깆떊
- 理쒓렐 ?뺣떟瑜?怨꾩궛
- ?쒖씠??媛以??먯닔 怨꾩궛
- ?뚰듃 ?ъ슜 ?щ? 諛섏쁺
- 痍⑥빟 keyword 議고쉶

### Main Components

| Component | Role |
|---|---|
| `MasteryService` | mastery score 怨꾩궛怨?媛깆떊 ?대떦 |
| `MasteryController` | MVP ?댄썑 dashboard API媛 遺꾨━??寃쎌슦 異붽? 媛??|

珥덇린 MVP?먯꽌??Controller ?놁씠 Service 以묒떖?쇰줈 援ы쁽?대룄 ?쒕떎. ?꾩슂?섎㈃ ?섏쨷??MasteryController瑜?異붽??섏뿬 dashboard API瑜??쒓났?????덈떎.

### Related Tables

- `mastery_scores`
- `quiz_problem_attempts`
- `quiz_problem_keywords`
- `keywords`
- `subjects`
- `users`

### MVP Calculation

臾몄꽌??怨듭떇? ?좎??섎릺, 援ы쁽? ?④퀎?곸쑝濡??⑥닚?뷀븷 ???덈떎.

```text
mastery_score =
  0.7 * recent_correct_rate
+ 0.2 * difficulty_weighted_score
+ 0.1 * no_hint_bonus
```

珥덇린 援ы쁽?먯꽌???ㅼ쓬泥섎읆 ?⑥닚?뷀븷 ???덈떎.

```text
recent_correct_rate = correct_count / attempts
difficulty_weighted_score = recent_correct_rate
no_hint_bonus = 1.0 if no hint was used, otherwise 0.0
```

---

## 4.10 MockExams Module

### Purpose

MockExams Module? ?ъ슜?먯쓽 mastery score瑜?湲곕컲?쇰줈 痍⑥빟 媛쒕뀗 以묒떖??紐⑥쓽怨좎궗瑜??앹꽦?쒕떎.

Mock exam? ?ㅼ젣 臾몄젣 紐⑸줉??吏곸젒 ??ν븯吏 ?딄퀬, `quiz`? `quiz_problems` 援ъ“瑜??ъ궗?⑺븳??

### Main Responsibilities

- 痍⑥빟 keyword 議고쉶
- 痍⑥빟 keyword? ?곌껐??quiz problem ?좏깮
- `MOCK_EXAM` ???quiz ?앹꽦
- `mock_exams` 硫뷀??곗씠?????
- `mock_exam_problems`??臾몄젣 ?쒖꽌 ???

### Main Components

| Component | Role |
|---|---|
| `MockExamsController` | Mock exam ?앹꽦, 議고쉶 API 泥섎━ |
| `MockExamsService` | 痍⑥빟 keyword 議고쉶, 臾몄젣 ?좏깮, MOCK_EXAM quiz ?앹꽦 ?대떦 |

### Related Tables

- `mock_exams`
- `mock_exam_problems`
- `quiz`
- `quiz_problems`
- `mastery_scores`
- `keywords`

### Main Flow

1. ?ъ슜?먭? ?뱀젙 Subject?????mock exam ?앹꽦???붿껌?쒕떎.
2. MockExamsService媛 MasteryService?먯꽌 痍⑥빟 keyword瑜?議고쉶?쒕떎.
3. 痍⑥빟 keyword? ?곌껐??quiz problems瑜?議고쉶?쒕떎.
4. 臾몄젣 ?섏? ?쒖씠??湲곗???留욊쾶 臾몄젣瑜??좏깮?쒕떎.
5. `quiz` ?뚯씠釉붿뿉 `quiz_type = MOCK_EXAM`??quiz瑜??앹꽦?쒕떎.
6. `mock_exams` ?뚯씠釉붿뿉 ?ㅼ젙 ?뺣낫瑜???ν븳??
7. `mock_exam_problems`??臾몄젣 ?쒖꽌瑜???ν븳??
8. ?앹꽦??mock exam???ъ슜?먯뿉寃?諛섑솚?쒕떎.

---

# 5. Recommended Development Phases

## Phase 1. Auth / User / Subject

### Target Modules

- Auth Module
- Users Module
- Subjects Module

### Target Tables

- `users`
- `oauth_accounts`
- `subjects`

### Target APIs

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /users/me`
- `POST /subjects`
- `GET /subjects`
- `GET /subjects/:id`
- `PATCH /subjects/:id`
- `DELETE /subjects/:id`

???④퀎?먯꽌??Google OAuth 濡쒓렇?? native ?뚯썝媛??濡쒓렇?? JWT ?몄쬆, 洹몃━怨??ъ슜?먮퀎 Subject CRUD瑜?援ы쁽?쒕떎. ?대찓???몄쬆怨?鍮꾨?踰덊샇 李얘린??援ы쁽?섏? ?딅뒗??

## Phase 2. Document Upload / Text Extraction

### Target Modules

- Documents Module

### Target Tables

- `documents`

### Target APIs

- `POST /subjects/:subjectId/documents`
- `GET /subjects/:subjectId/documents`
- `GET /documents/:documentId`
- `DELETE /documents/:documentId`

???④퀎?먯꽌??PDF ?낅줈?? 臾몄꽌 硫뷀??곗씠????? 臾몄꽌 ?띿뒪??異붿텧源뚯? 援ы쁽?쒕떎. AI 遺꾩꽍? placeholder濡??????덈떎.

## Phase 3. Cleaned Markdown Chunk / Keyword / Summary

### Target Modules

- Keywords Module
- Documents Module

### Target Tables

- `document_chunks`
- `keywords`
- `keyword_chunks`

### Target APIs

- `GET /subjects/:subjectId/keywords`
- `GET /documents/:documentId/keywords`

???④퀎?먯꽌??cleaned markdown 湲곕컲 document chunk ??? chunk-grounded keyword extraction, keyword-source mapping, AI 遺꾩꽍 寃곌낵 ???援ъ“瑜??꾩꽦?쒕떎.

## Phase 4. Quiz / QuizProblem

### Target Modules

- quiz Module
- QuizProblems Module

### Target Tables

- `quiz`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`

### Target APIs

- `POST /documents/:documentId/quiz`
- `GET /subjects/:subjectId/quiz`
- `GET /quiz/:quizId`
- `GET /quiz/:quizId/problems`

???④퀎?먯꽌??lecture quiz ?앹꽦怨?臾몄젣 ???援ъ“瑜?援ы쁽?쒕떎.

## Phase 5. QuizAttempt / Mastery

### Target Modules

- QuizAttempts Module
- Mastery Module

### Target Tables

- `quiz_attempts`
- `quiz_problem_attempts`
- `mastery_scores`

### Target APIs

- `POST /quiz/:quizId/attempts`
- `POST /quiz-attempts/:attemptId/submit`
- `GET /quiz-attempts/:attemptId`
- `GET /subjects/:subjectId/mastery`

???④퀎?먯꽌???ъ슜?먯쓽 ???湲곕줉怨?mastery score 媛깆떊??援ы쁽?쒕떎.

## Phase 6. MockExam

### Target Modules

- MockExams Module

### Target Tables

- `mock_exams`
- `mock_exam_problems`
- `quiz`
- `quiz_problems`

### Target APIs

- `POST /subjects/:subjectId/mock-exams`
- `GET /subjects/:subjectId/mock-exams`
- `GET /mock-exams/:mockExamId`

???④퀎?먯꽌??痍⑥빟 keyword 湲곕컲 mock exam ?앹꽦??援ы쁽?쒕떎.

---

# 6. Recommended Folder Structure

```text
src/
  app.module.ts

  common/
    decorators/
      current-user.decorator.ts
    guards/
      jwt-auth.guard.ts
    types/
      current-user.type.ts

  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    dto/
      register.dto.ts
      login.dto.ts
      google-login.dto.ts
      auth-response.dto.ts
    strategies/
      jwt.strategy.ts
    providers/
      google-token-verifier.ts
      password-hasher.ts

  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    entities/
      user.entity.ts
      oauth-account.entity.ts
      password-credential.entity.ts

  subjects/
    subjects.module.ts
    subjects.controller.ts
    subjects.service.ts
    entities/
      subject.entity.ts
    dto/
      create-subject.dto.ts
      update-subject.dto.ts

  documents/
    documents.module.ts
    documents.controller.ts
    documents.service.ts
    pdf-parser.service.ts
    document-ai.service.ts
    entities/
      document.entity.ts
      document-chunk.entity.ts
    dto/
      upload-document.dto.ts

  keywords/
    keywords.module.ts
    keywords.controller.ts
    keywords.service.ts
    entities/
      keyword.entity.ts
      keyword-chunk.entity.ts

  quiz/
    quiz.module.ts
    quiz.controller.ts
    quiz.service.ts
    entities/
      quiz.entity.ts
    dto/
      create-quiz.dto.ts

  quiz-problems/
    quiz-problems.module.ts
    quiz-problems.controller.ts
    quiz-problems.service.ts
    entities/
      quiz-problem.entity.ts
      quiz-problem-choice.entity.ts
      quiz-problem-keyword.entity.ts

  quiz-attempts/
    quiz-attempts.module.ts
    quiz-attempts.controller.ts
    quiz-attempts.service.ts
    entities/
      quiz-attempt.entity.ts
      quiz-problem-attempt.entity.ts
    dto/
      start-quiz-attempt.dto.ts
      submit-quiz-attempt.dto.ts

  mastery/
    mastery.module.ts
    mastery.controller.ts
    mastery.service.ts
    entities/
      mastery-score.entity.ts

  mock-exams/
    mock-exams.module.ts
    mock-exams.controller.ts
    mock-exams.service.ts
    entities/
      mock-exam.entity.ts
      mock-exam-problem.entity.ts
    dto/
      create-mock-exam.dto.ts
```

---

# 7. MVP Authentication Summary

MVP ?몄쬆 踰붿쐞???ㅼ쓬 ??臾몄옣?쇰줈 ?뺣━?????덈떎.

> SudoCampus MVP??Google OAuth? native email/password 濡쒓렇?몄쓣 紐⑤몢 吏?먰븯怨? 紐⑤뱺 ?몄쬆 ?깃났 寃곌낵瑜??대? User? ?쒕퉬???먯껜 JWT濡??듯빀?섏뿬 蹂댄샇 API ?묎렐???쒖뼱?쒕떎.

?곕씪??MVP?먯꽌??`password_credentials.password_hash`? bcrypt 寃利앹? 援ы쁽?섏?留? ?대찓???몄쬆怨?鍮꾨?踰덊샇 李얘린??援ы쁽?섏? ?딅뒗??


