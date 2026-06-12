import { ReviewResult } from '../types/exam';
import { quizAttemptService } from './quizAttemptService';
import { quizService } from './quizService';

class ReviewService {
  async getAttemptResult(id: string): Promise<ReviewResult> {
    const data = await quizAttemptService.getReview(id);
    let title = '퀴즈 결과';
    try {
      const quizDetails = await quizService.getQuizDetails(data.quizId);
      title = quizDetails.title;
    } catch (e) {
      console.error('Failed to fetch quiz details for title', e);
    }

    return {
      attemptId: data.attemptId,
      subjectId: '',
      title,
      finalScore: data.score,
      results: data.problems.map((p) => ({
        question: {
          id: p.quizProblemId,
          type: p.quizProblemType,
          difficulty: p.difficulty === 'HARD' ? 'HIGH' : p.difficulty === 'EASY' ? 'LOW' : 'MEDIUM',
          text: p.problemText,
          options: p.choices?.map((c) => ({ id: c.id, text: c.choiceText })) || [],
        },
        userAnswer: p.quizProblemType === 'MULTIPLE_CHOICE' ? p.selectedChoiceIds || [] : p.userAnswer,
        isCorrect: p.isCorrect,
        explanation: p.explanation || '',
        keywords: p.keywords?.map((k) => k.name) || [],
        correctAnswer: p.correctAnswer,
        choices: p.choices?.map((c) => ({ id: c.id, choiceText: c.choiceText, isCorrect: c.isCorrect })) || [],
      }))
    };
  }
}

export const reviewService = new ReviewService();
