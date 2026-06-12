import { AttemptStatus } from '../../quiz-attempts/enums/attempt-status.enum';

export interface MockExamLatestAttemptDto {
  attemptId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  totalQuizProblems: number | null;
  correctCount: number | null;
  score: number | null;
}

export interface MockExamListItemDto {
  mockExamId: string;
  quizId: string;
  subjectId: string;
  title: string;
  quizProblemCount: number;
  targetWeakKeywords: boolean;
  generatedFromMastery: boolean;
  createdAt: string;
  latestAttempt: MockExamLatestAttemptDto | null;
}
