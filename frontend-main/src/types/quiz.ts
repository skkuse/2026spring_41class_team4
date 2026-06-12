export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
export type Difficulty = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  text: string;
  options?: Option[]; // 객관식인 경우 존재
}

export interface QuizDetails {
  quizId: string;
  title: string;
  questions: Question[];
}

// ---------------------------------------------------------
// Backend API DTOs
// ---------------------------------------------------------

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type QuizProblemType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
export type QuizType = 'LECTURE' | 'MOCK_EXAM';

export interface CreateDocumentQuizDto {
  quizProblemCount: number;
  keywordIds?: string[];
}

export interface CreateQuizResponseDto {
  quizId: string;
  quizType: QuizType;
  quizProblemCount: number;
}

export interface QuizSolvingChoiceDto {
  id: string;
  choiceText: string;
  displayOrder: number;
}

export interface QuizSolvingProblemDto {
  id: string;
  problemText: string;
  quizProblemType: QuizProblemType;
  difficulty: DifficultyLevel;
  displayOrder: number;
  hintLevel1: string | null;
  hintLevel2: string | null;
  hintLevel3: string | null;
  choices: QuizSolvingChoiceDto[];
}

export interface QuizSolvingViewResponseDto {
  id: string;
  title: string;
  quizType: QuizType;
  quizProblems: QuizSolvingProblemDto[];
}

export interface DocumentQuizAttempt {
  attemptId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  startedAt: string;
  submittedAt: string | null;
  totalQuizProblems: number;
  correctCount: number | null;
  score: number | null;
}

export interface DocumentQuizResponseDto {
  quizId: string;
  title: string;
  quizType: QuizType;
  quizProblemCount: number;
  createdAt: string;
  latestAttempt: DocumentQuizAttempt | null;
}
