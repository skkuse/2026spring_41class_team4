<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## SudoCampus — 로컬 실행 & 테스트 가이드

> 위 보일러플레이트는 pnpm 기준이지만, 현재 로컬 점검은 npm으로 진행되고 있다 (패키지 매니저 기준은 [`../docs/open-issues.md`](../docs/open-issues.md) ISSUE-003 참고).
> 환경 변수·시스템 요구사항: [`../docs/environment.md`](../docs/environment.md)

### 실행

```bash
# 1) 의존성 설치 (pull 직후 항상)
npm install

# 2) 로컬 DB (repo 루트에서)
docker compose up -d db

# 3) 마이그레이션 + dev 서버
npm run migration:run
npm run start:dev        # PORT는 .env 기준
```

⚠️ PDF 업로드/파싱은 호스트에 **java 런타임(JDK)** 이 필요하다 (`@opendataloader/pdf`가 jar 실행).

### 테스트

| 명령 | 대상 | 비고 |
|---|---|---|
| `npm test` | **단위 테스트** (`src/**/*.spec.ts`, 소스 옆 co-located) | 외부 의존 전부 mock — DB 불필요, 수 초 내 완료 |
| `npm run test:watch` | 단위 테스트 watch 모드 | TDD red→green 루프용 |
| `npm run test:cov` | 단위 + 커버리지 (`coverage/`) | |
| `npm run test:integration` | **통합 테스트** (`test/integration/*.int-spec.ts`) | 실제 앱 부팅 + supertest, 아래 전제조건 필요 |
| `npm run test:e2e` | e2e (`test/*.e2e-spec.ts`) | 통합과 동일 전제조건 |

특정 파일만 실행: `npm test -- src/quiz/quiz.service.spec.ts`

#### 통합/e2e 전제조건 (최초 1회)

통합·e2e는 **테스트 전용 DB `sudocampus_test`** 를 자동 생성·마이그레이션한다 (dev 데이터는 건드리지 않음).

```bash
# 1) Postgres 기동 (repo 루트)
docker compose up -d db

# 2) role에 DB 생성 권한 부여 (최초 1회)
docker exec ai-tutor-postgres psql -U postgres -c "ALTER ROLE sudocampus_user CREATEDB;"
```

java 런타임도 필요하다 (업로드 통합 테스트가 실제 PDF 파서를 돌린다).

#### 새 테스트 작성

- **단위 테스트는 소스 파일 옆에** `*.spec.ts`로 둔다 (NestJS 컨벤션). 복붙용 템플릿과 mocking 패턴: [`test/README.md`](./test/README.md)
- 통합 테스트 헬퍼(`createTestingApp`, `createAndLoginTestUser` 등): `test/integration/helpers.ts`
- 전체 테스트 전략·우선순위·명세 매핑: [`../docs/backend-tdd-plan.md`](../docs/backend-tdd-plan.md)

#### 알려진 함정

- `test:integration`/`test:e2e`에서 모든 업로드가 400으로 거부되면 → `--experimental-vm-modules` 누락 (npm 스크립트를 그대로 쓰면 자동 적용됨)
- 통합 테스트 DB 생성 실패 → 위 `CREATEDB` 권한 명령을 실행했는지 확인
- 업로드 관련 테스트 실패 → `java -version` 확인

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
