import { QuizDetails, QuizSolvingViewResponseDto, Question, Difficulty, DocumentQuizResponseDto } from '../types/quiz';
import { apiClient } from './apiClient';

class QuizService {
  async getQuizDetails(quizId: string): Promise<QuizDetails> {
    const response = await apiClient.get<QuizSolvingViewResponseDto>(`/quiz/${quizId}`);
    const data = response.data;
    
    const questions: Question[] = data.quizProblems.map(p => {
      // 난이도 글자 변환
      let diff: Difficulty = 'MEDIUM';
      if (p.difficulty === 'HARD') diff = 'HIGH';
      else if (p.difficulty === 'EASY') diff = 'LOW';
      
      return {
        id: p.id,
        type: p.quizProblemType,
        difficulty: diff,
        text: p.problemText,
        options: p.choices.map(c => ({
          id: c.id,
          text: c.choiceText
        }))
      };
    });

    return {
      quizId: data.id,
      title: data.title,
      questions: questions,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async postSubmitAnswers(_data: Record<string, unknown>): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
  }

  async getDocumentQuizzes(documentId: string): Promise<DocumentQuizResponseDto[]> {
    const response = await apiClient.get<DocumentQuizResponseDto[]>(`/documents/${documentId}/quiz`);
    return response.data;
  }
}

export const quizService = new QuizService();
