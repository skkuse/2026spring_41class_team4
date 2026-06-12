import { useState, useCallback, useEffect } from 'react';
import { LectureDetail } from '../types/subject';
import { lectureService } from '../services/lectureService';
import { DocumentQuizResponseDto } from '../types/quiz';
import { quizService } from '../services/quizService';

export function useLectureDetail(lectureId: string) {
  const [lectureData, setLectureData] = useState<LectureDetail | null>(null);
  const [previousQuizzes, setPreviousQuizzes] = useState<DocumentQuizResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLectureContent = useCallback(async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await lectureService.getLectureDetail(id);
      setLectureData(data);
      
      try {
        const quizzes = await quizService.getDocumentQuizzes(id);
        setPreviousQuizzes(quizzes);
      } catch (err) {
        console.error('Failed to fetch previous quizzes', err);
      }
    } catch (err) {
      console.error(err);
      setError('강의 상세 자료를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const postRequestQuiz = async (id: string): Promise<string | null> => {
    try {
      const quizId = await lectureService.postRequestQuiz(id);
      return quizId;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  useEffect(() => {
    if (lectureId) {
      getLectureContent(lectureId);
    }
  }, [lectureId, getLectureContent]);

  return {
    lectureData,
    previousQuizzes,
    isLoading,
    error,
    getLectureContent,
    postRequestQuiz,
  };
}
