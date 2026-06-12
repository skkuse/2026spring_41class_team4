import { useState, useEffect } from 'react';
import { CreateMockExamRequest } from '../types/exam';
import { examService } from '../services/examService';
import { subjectService } from '../services/subjectService';
import { SubjectLearningStatusResponse } from '../types/learningStatus';

export function useMockExam(subjectId: string) {
  const [masteryData, setMasteryData] = useState<SubjectLearningStatusResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    async function fetchMastery() {
      try {
        const data = await subjectService.getSubjectLearningStatus(subjectId);
        setMasteryData(data);
      } catch (error) {
        console.error('Failed to fetch mastery data', error);
      }
    }
    fetchMastery();
  }, [subjectId]);

  const generatePersonalizedExam = async (payload: CreateMockExamRequest): Promise<string | null> => {
    setIsGenerating(true);
    try {
      const response = await examService.postGenerateMockExam(subjectId, payload);
      return response.quizId;
    } catch (error) {
      console.error('Failed to generate mock exam', error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    masteryData,
    isGenerating,
    generatePersonalizedExam
  };
}
