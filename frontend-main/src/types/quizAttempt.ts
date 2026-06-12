export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
export type QuizProblemType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface SubmitAnswerDto {
  quizProblemId: string;
  userAnswer?: string;
  selectedChoiceIds?: string[];
  usedHint: boolean;
  hintLevelUsed?: number | null;
  elapsedSeconds?: number | null;
}

export interface QuizAttemptStartResponseDto {
  attemptId: string;
  quizId: string;
  status: AttemptStatus;
}

export interface UpdatedMasteryItemDto {
  keywordId: string;
  masteryScore: number;
}

export interface SubmitAnswerResponseDto {
  quizProblemId: string;
  isCorrect: boolean;
  explanation?: string;
  feedback?: string;
  updatedMastery: UpdatedMasteryItemDto[];
  selectedChoiceIds?: string[];
}

export interface SubmitAttemptResponseDto {
  attemptId: string;
  status: AttemptStatus;
  totalQuizProblems: number;
  correctCount: number;
  score: number;
}

export interface AttemptReviewChoiceDto {
  id: string;
  choiceText: string;
  displayOrder: number;
  isCorrect: boolean;
}

export interface AttemptReviewKeywordDto {
  keywordId: string;
  name: string;
  weight: number | null;
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
