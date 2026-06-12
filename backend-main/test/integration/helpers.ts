import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PasswordCredential } from '../../src/auth/entities/password-credential.entity';
import { User } from '../../src/user/user.entity';
import { UserRole } from '../../src/user/enums/user-role.enum';
import { UserStatus } from '../../src/user/enums/user-status.enum';

/**
 * main.ts bootstrap과 동일한 글로벌 파이프 구성으로 앱을 부팅한다.
 * `configure`로 외부 경계(예: AI 서비스)를 overrideProvider 할 수 있다.
 */
export async function createTestingApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (configure) {
    builder = configure(builder);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return app;
}

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
}

/**
 * 회원가입은 SMTP 인증코드가 필요하므로, 유저를 DB에 직접 시딩한 뒤
 * 실제 /auth/login 엔드포인트로 로그인해 토큰을 받는다.
 */
export async function createAndLoginTestUser(
  app: INestApplication,
): Promise<TestUser> {
  const dataSource = app.get(DataSource);
  const email = `int-${randomUUID()}@example.com`;
  const password = 'IntegrationTest1!';

  const userRepository = dataSource.getRepository(User);
  const user = await userRepository.save(
    userRepository.create({
      email,
      name: 'Integration Test',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    }),
  );

  const credentialRepository = dataSource.getRepository(PasswordCredential);
  await credentialRepository.save(
    credentialRepository.create({
      userId: user.id,
      passwordHash: await hash(password, 4),
    }),
  );

  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });
  if (!response.body?.accessToken) {
    throw new Error(
      `Test login failed (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }

  return {
    userId: user.id,
    email,
    password,
    accessToken: response.body.accessToken as string,
  };
}

/** suite 종료 시 테스트 DB의 모든 도메인 테이블을 비운다 (마이그레이션 이력은 유지). */
export async function truncateAllTables(
  dataSource: DataSource,
): Promise<void> {
  const rows: Array<{ tablename: string }> = await dataSource.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename NOT IN ('migrations')`,
  );
  if (rows.length === 0) {
    return;
  }
  const tables = rows.map((row) => `"${row.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tables} CASCADE`);
}
