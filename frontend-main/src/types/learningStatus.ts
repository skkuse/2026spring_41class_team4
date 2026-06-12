export interface LearningStatusKeyword {
  keywordId: string;
  name: string;
  masteryScore: number; // 0.0 ~ 1.0
}

export interface SubjectLearningStatusResponse {
  subjectId: string;
  mastery: number; // 0.0 ~ 1.0
  coverage: number; // 0.0 ~ 1.0
  strongKeywords: LearningStatusKeyword[];
  weakKeywords: LearningStatusKeyword[];
}

export interface DocumentLearningStatusResponse {
  documentId: string;
  mastery: number; // 0.0 ~ 1.0
  coverage: number; // 0.0 ~ 1.0
  strongKeywords: LearningStatusKeyword[];
  weakKeywords: LearningStatusKeyword[];
}
