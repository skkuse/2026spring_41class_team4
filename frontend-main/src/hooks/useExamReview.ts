import { useState, useEffect } from 'react';
import { ReviewResult } from '../types/exam';
import { reviewService } from '../services/reviewService';

export function useExamReview(attemptId: string) {
  const [reviewData, setReviewData] = useState<ReviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchReview() {
      setIsLoading(true);
      try {
        const data = await reviewService.getAttemptResult(attemptId);
        setReviewData(data);
      } catch (error) {
        console.error('Failed to fetch review data', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (attemptId) {
      fetchReview();
    }
  }, [attemptId]);

  return {
    reviewData,
    isLoading
  };
}
