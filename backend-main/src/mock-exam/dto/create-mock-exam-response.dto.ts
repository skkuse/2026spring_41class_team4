import { QuizType } from '../../quiz/enums/quiz-type.enum';

export interface CreateMockExamResponseDto {
  mockExamId: string;
  quizId: string;
  quizType: QuizType.MOCK_EXAM;
  quizProblemCount: number;
}
