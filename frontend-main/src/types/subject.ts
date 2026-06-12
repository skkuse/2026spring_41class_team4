export interface Subject {
  id: string;
  title: string;
  progress: number;
  imageUrl: string;
}

import { MockExamListItem } from './exam';

export interface SubjectResponse {
  id: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubjectDto {
  title: string;
  description?: string;
  imageFile: File | null;
}

export interface CreateSubjectRequest {
  name: string;
  description?: string | null;
}

export interface UpdateSubjectRequest {
  name?: string;
  description?: string;
  thumbnailUrl?: string | null;
}

export interface Lecture {
  id: string;
  title: string;
}

export type Keyword = string;

export interface DashboardInfo {
  subjectId: string;
  subjectName: string;
  lectures: Lecture[];
  mastery: number;
  coverage: number;
  strongKeywords: Keyword[];
  weakKeywords: Keyword[];
  history: MockExamListItem[];
}

export interface LectureDetail {
  materialId: string;
  title: string;
  pdfUrl: string;
  summaryText: string;
  strongKeywords: Keyword[];
  weakKeywords: Keyword[];
  masteryScore: number;
  coverageScore: number;
}

// Document API DTOs
export interface UploadDocumentResponse {
  documentId: string;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  canAnalyze: boolean;
}

export interface DocumentKeyword {
  id: string;
  name: string;
  importanceScore: number;
}

export interface DocumentDetailResponse {
  documentId: string;
  subjectId?: string;
  title?: string;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  overallSummary: string;
  keywordCount?: number;
  keywords: DocumentKeyword[];
}

export interface DocumentMetadataResponse {
  documentId: string;
  subjectId?: string | null;
  title?: string | null;
  originalFileName?: string | null;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}
