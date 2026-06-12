import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeywordsModule } from '../keywords/keywords.module';
import { MasteryModule } from '../mastery/mastery.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { DocumentAnalysisAiService } from './document-analysis-ai.service';
import { DocumentController } from './document.controller';
import { DocumentFileStorageService } from './document-file-storage.service';
import { DocumentPreprocessingService } from './document-preprocessing.service';
import { DocumentService } from './document.service';
import { DocumentChunkEntity } from './entities/document-chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import { PdfParserService } from './pdf-parser.service';

@Module({
  imports: [
    SubjectsModule,
    KeywordsModule,
    MasteryModule,
    TypeOrmModule.forFeature([DocumentEntity, DocumentChunkEntity]),
  ],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    PdfParserService,
    DocumentPreprocessingService,
    DocumentFileStorageService,
    DocumentAnalysisAiService,
  ],
})
export class DocumentModule {}
