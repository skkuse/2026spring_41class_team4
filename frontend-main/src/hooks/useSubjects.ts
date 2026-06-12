import { useState, useCallback, useEffect } from 'react';
import { Subject, CreateSubjectDto } from '../types/subject';
import { subjectService } from '../services/subjectService';

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await subjectService.getSubjects();
      setSubjects(data);
    } catch (err) {
      console.error(err);
      setError('과목 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addSubject = async (formData: CreateSubjectDto): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const newSubject = await subjectService.postSubject(formData);
      setSubjects((prev) => [...prev, newSubject]);
      return true;
    } catch (err) {
      console.error(err);
      setError('과목 추가에 실패했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const removeSubject = async (id: string): Promise<boolean> => {
    try {
      await subjectService.deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      console.error(err);
      setError('과목 삭제에 실패했습니다.');
      return false;
    }
  };

  // Automatically fetch on mount if you wish, or let the component call fetchSubjects
  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  return {
    subjects,
    isLoading,
    error,
    addSubject,
    removeSubject,
    fetchSubjects,
  };
}
