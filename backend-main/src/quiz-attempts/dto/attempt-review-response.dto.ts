import { AttemptStatus } from '../enums/attempt-status.enum';
import { DifficultyLevel } from '../../quiz/enums/difficulty-level.enum';
import { QuizProblemType } from '../../quiz/enums/quiz-problem-type.enum';

export interface AttemptReviewKeywordDto {
  keywordId: string;
  name: string;
  weight: number | null;
}

export interface AttemptReviewChoiceDto {
  id: string;
  choiceText: string;
  displayOrder: number;
  isCorrect: boolean;
}

export interface AttemptReviewProblemDto {
  quizProblemId: string;
  displayOrder: number;
  problemText: string;
  quizProblemType: QuizProblemType;
  difficulty: DifficultyLevel;
  userAnswer: string | null;
  selectedChoiceIds?: string[];
  isUnanswered: boolean;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  feedback: string | null;
  choices: AttemptReviewChoiceDto[];
  keywords: AttemptReviewKeywordDto[];
}

export interface AttemptReviewResponseDto {
  attemptId: string;
  quizId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  totalQuizProblems: number;
  correctCount: number;
  score: number;
  feedback: string | null;
  problems: AttemptReviewProblemDto[];
}
