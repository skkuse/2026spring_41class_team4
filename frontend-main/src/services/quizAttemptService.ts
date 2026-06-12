import { apiClient } from './apiClient';
import {
  QuizAttemptStartResponseDto,
  SubmitAnswerDto,
  SubmitAnswerResponseDto,
  SubmitAttemptResponseDto,
  AttemptReviewResponseDto
} from '../types/quizAttempt';

class QuizAttemptService {
  async startAttempt(quizId: string): Promise<QuizAttemptStartResponseDto> {
    const response = await apiClient.post<QuizAttemptStartResponseDto>(`/quiz/${quizId}/attempts`);
    return response.data;
  }

  async submitAnswer(attemptId: string, answer: SubmitAnswerDto): Promise<SubmitAnswerResponseDto> {
    const response = await apiClient.post<SubmitAnswerResponseDto>(`/attempts/${attemptId}/answers`, answer);
    return response.data;
  }

  async submitAttempt(attemptId: string): Promise<SubmitAttemptResponseDto> {
    const response = await apiClient.post<SubmitAttemptResponseDto>(`/attempts/${attemptId}/submit`);
    return response.data;
  }

  async getReview(attemptId: string): Promise<AttemptReviewResponseDto> {
    const response = await apiClient.get<AttemptReviewResponseDto>(`/attempts/${attemptId}/review`);
    return response.data;
  }
}

export const quizAttemptService = new QuizAttemptService();
