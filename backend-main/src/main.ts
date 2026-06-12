import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolveUploadRoot } from './common/upload-path.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadRoot = resolveUploadRoot(process.env.UPLOAD_ROOT);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useStaticAssets(uploadRoot, {
    prefix: '/uploads/',
  });
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://sudocampus-frontend.vercel.app',
      'http://178.105.207.147:3000',
      'http://178.105.207.147',
      'http://sudocampus.site',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
