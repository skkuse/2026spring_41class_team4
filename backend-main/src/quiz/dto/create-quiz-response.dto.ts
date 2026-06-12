import { QuizType } from '../enums/quiz-type.enum';

export interface CreateQuizResponseDto {
  quizId: string;
  quizType: QuizType;
  quizProblemCount: number;
}

