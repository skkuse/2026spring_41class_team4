import { AttemptStatus } from '../enums/attempt-status.enum';

export interface SubmitAttemptResponseDto {
  attemptId: string;
  status: AttemptStatus;
  totalQuizProblems: number;
  correctCount: number;
  score: number;
}
