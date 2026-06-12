import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentModule } from './document/document.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { KeywordsModule } from './keywords/keywords.module';
import { SubjectsModule } from './subjects/subjects.module';
import { MasteryScore } from './mastery/entities/mastery-score.entity';
import { MasteryModule } from './mastery/mastery.module';
import { QuizProblemKeyword } from './quiz/entities/quiz-problem-keyword.entity';
import { QuizModule } from './quiz/quiz.module';
import { QuizAttemptsModule } from './quiz-attempts/quiz-attempts.module';
import { MockExamModule } from './mock-exam/mock-exam.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UserModule,
    DocumentModule,
    KeywordsModule,
    SubjectsModule,
    MasteryModule,
    QuizModule,
    QuizAttemptsModule,
    MockExamModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    TypeOrmModule.forFeature([MasteryScore, QuizProblemKeyword]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: false,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
