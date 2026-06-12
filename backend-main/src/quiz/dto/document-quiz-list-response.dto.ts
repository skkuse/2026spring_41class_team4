import { AttemptStatus } from '../../quiz-attempts/enums/attempt-status.enum';
import { QuizType } from '../enums/quiz-type.enum';

export interface DocumentQuizLatestAttemptDto {
  attemptId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  totalQuizProblems: number | null;
  correctCount: number | null;
  score: number | null;
}

export interface DocumentQuizListItemDto {
  quizId: string;
  title: string;
  quizType: QuizType;
  quizProblemCount: number | null;
  createdAt: string;
  latestAttempt: DocumentQuizLatestAttemptDto | null;
}
