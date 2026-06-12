import { AttemptStatus } from '../enums/attempt-status.enum';

export interface QuizAttemptStartResponseDto {
  attemptId: string;
  quizId: string;
  status: AttemptStatus;
}
