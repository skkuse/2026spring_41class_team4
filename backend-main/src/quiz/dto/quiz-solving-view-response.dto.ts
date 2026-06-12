import { DifficultyLevel } from '../enums/difficulty-level.enum';
import { QuizProblemType } from '../enums/quiz-problem-type.enum';
import { QuizType } from '../enums/quiz-type.enum';

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

