import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunkEntity } from '../document/entities/document-chunk.entity';
import { DocumentEntity } from '../document/entities/document.entity';
import { SubjectsModule } from '../subjects/subjects.module';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';
import { KeywordChunkEntity } from './entities/keyword-chunk.entity';
import { Keyword } from './entities/keyword.entity';

@Module({
  imports: [
    SubjectsModule,
    TypeOrmModule.forFeature([Keyword, KeywordChunkEntity, DocumentEntity, DocumentChunkEntity]),
  ],
  controllers: [KeywordsController],
  providers: [KeywordsService],
  exports: [KeywordsService],
})
export class KeywordsModule {}
