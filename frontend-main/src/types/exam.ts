import { Question } from './quiz';
import { Keyword } from './subject';

export interface UserMastery {
  subjectId: string;
  overallMastery: number;
  weakKeywords: Keyword[];
}

export interface CreateMockExamRequest {
  quizProblemCount: number; // 필수값, 1에서 50 사이
  documentIds?: string[];
  targetWeakKeywords?: boolean; // 안넣으면 기본 true
  keywordIds?: string[]; 
}

export interface CreateMockExamResponse {
  mockExamId: string;
  quizId: string;
  quizType: 'MOCK_EXAM';
  quizProblemCount: number;
}

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

export interface MockExamLatestAttempt {
  attemptId: string;
  status: AttemptStatus;
  startedAt: string; // ISO 포맷 시간
  submittedAt: string | null; // 제출 안했으면 null
  totalQuizProblems: number | null;
  correctCount: number | null;
  score: number | null;
}

export interface MockExamListItem {
  mockExamId: string;
  quizId: string;
  subjectId: string;
  title: string;
  quizProblemCount: number;
  targetWeakKeywords: boolean;
  generatedFromMastery: boolean;
  createdAt: string; // 만든 시간
  latestAttempt: MockExamLatestAttempt | null;
}

export interface QuestionResult {
  question: Question;
  userAnswer: unknown;
  isCorrect: boolean;
  explanation: string;
  keywords: string[];
  correctAnswer: string;
  choices?: { id: string; choiceText: string; isCorrect: boolean }[];
}

export interface ReviewResult {
  attemptId: string;
  subjectId: string;
  title: string;
  finalScore: number;
  results: QuestionResult[];
}
