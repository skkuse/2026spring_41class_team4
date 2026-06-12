export interface KeywordSourceRefDto {
  chunkId: string;
  pageNumber: number;
  heading?: string | null;
  evidenceText?: string | null;
  relevanceScore?: number | null;
}

export interface KeywordResponseDto {
  id: string;
  documentId: string;
  subjectId?: string | null;
  documentTitle?: string | null;
  name: string;
  description?: string | null;
  importanceScore?: number | null;
  isLearningObjectiveCore?: boolean;
  appearsMultipleTimes?: boolean;
  isPrerequisiteForOtherConcepts?: boolean;
  isUsedInAssessment?: boolean;
  sourceRefs?: KeywordSourceRefDto[];
}
