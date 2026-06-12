export interface SubjectMasteryKeywordDto {
  keywordId: string;
  name: string;
  masteryScore: number;
}

export interface SubjectMasteryResponseDto {
  subjectId: string;
  overallMastery: number;
  strongKeywords: SubjectMasteryKeywordDto[];
  weakKeywords: SubjectMasteryKeywordDto[];
}

export interface RecentQuizAttemptDto {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
}

export interface SubjectDashboardDocumentDto {
  documentId: string;
  title: string | null;
  analysisStatus: string;
  keywordCount: number;
}

export interface SubjectDashboardResponseDto extends SubjectMasteryResponseDto {
  coverage: number;
  documents: SubjectDashboardDocumentDto[];
  recentQuizAttempts: RecentQuizAttemptDto[];
}

export interface SubjectLearningStatusResponseDto {
  subjectId: string;
  mastery: number;
  coverage: number;
  strongKeywords: SubjectMasteryKeywordDto[];
  weakKeywords: SubjectMasteryKeywordDto[];
}

export interface DocumentLearningStatusResponseDto {
  documentId: string;
  mastery: number;
  coverage: number;
  strongKeywords: SubjectMasteryKeywordDto[];
  weakKeywords: SubjectMasteryKeywordDto[];
}
