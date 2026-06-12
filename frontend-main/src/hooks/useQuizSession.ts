import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '../contexts/ToastContext';
import { Question, QuizDetails } from '../types/quiz';
import { quizService } from '../services/quizService';
import { quizAttemptService } from '../services/quizAttemptService';
import { SubmitAnswerDto } from '../types/quizAttempt';

export function useQuizSession(quizId: string | null, customReturnUrl?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadQuizAndStart() {
      if (!quizId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await quizService.getQuizDetails(quizId);
        setQuizDetails(data);
        
        // 백엔드 API: 응시 시작
        const attemptRes = await quizAttemptService.startAttempt(quizId);
        setAttemptId(attemptRes.attemptId);
      } catch (error) {
        console.error('Failed to load quiz or start attempt:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuizAndStart();
  }, [quizId]);

  const saveAnswer = (questionId: string, value: string | string[]) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const submitCurrentAnswer = async (question: Question, answer: string | string[]) => {
    if (!attemptId) return;
    const dto: SubmitAnswerDto = {
      quizProblemId: question.id,
      usedHint: false,
      elapsedSeconds: 0
    };
    if (question.type === 'MULTIPLE_CHOICE') {
      dto.selectedChoiceIds = (answer as string[]) || [];
    } else {
      dto.userAnswer = (answer as string) || '';
    }
    await quizAttemptService.submitAnswer(attemptId, dto);
  };

  const validateAnswer = (question: Question, answer: string | string[]): boolean => {
    if (question.type === 'MULTIPLE_CHOICE') {
      if (!answer || (Array.isArray(answer) && answer.length === 0)) {
        return false;
      }
    } else {
      if (answer === undefined || answer === null || String(answer).trim() === '') {
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!quizDetails || !attemptId) return;
    const currentQuestion = quizDetails.questions[currentIndex];
    const answer = userAnswers[currentQuestion.id];

    if (!validateAnswer(currentQuestion, answer)) {
      showToast('정답을 입력해주세요.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitCurrentAnswer(currentQuestion, answer);
      if (currentIndex < quizDetails.questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      showToast('답안 제출 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAll = async () => {
    if (!quizDetails || !attemptId) return;
    
    const currentQuestion = quizDetails.questions[currentIndex];
    const answer = userAnswers[currentQuestion.id];

    if (!validateAnswer(currentQuestion, answer)) {
      showToast('정답을 입력해주세요.', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 마지막 문제 답안 제출
      await submitCurrentAnswer(currentQuestion, answer);

      // 백엔드 API: 최종 제출
      await quizAttemptService.submitAttempt(attemptId);
      
      // 발급받은 UUID attemptId를 사용하여 실제 리뷰 페이지로 이동
      const returnUrl = customReturnUrl || pathname.replace('/quiz', ''); // 퀴즈 페이지 경로를 제거하여 상위 문서(lecture) 경로 획득
      router.push(`/exam/${attemptId}/review?returnUrl=${returnUrl}`);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      showToast('최종 제출 중 오류가 발생했습니다.', 'error');
      setIsSubmitting(false);
    }
  };

  const currentQuestion: Question | null = quizDetails ? quizDetails.questions[currentIndex] : null;
  const isLastQuestion = quizDetails ? currentIndex === quizDetails.questions.length - 1 : false;
  const totalQuestions = quizDetails ? quizDetails.questions.length : 0;

  return {
    quizDetails,
    currentQuestion,
    currentIndex,
    totalQuestions,
    userAnswers,
    isLastQuestion,
    isLoading,
    isSubmitting,
    saveAnswer,
    handleNext,
    submitAll
  };
}
