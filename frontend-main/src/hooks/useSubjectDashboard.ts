import { useState, useCallback, useEffect } from 'react';
import { DashboardInfo } from '../types/subject';
import { subjectService } from '../services/subjectService';

export function useSubjectDashboard(subjectId: string) {
  const [dashboardData, setDashboardData] = useState<DashboardInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!subjectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await subjectService.getDashboardInfo(subjectId);
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      setError('대시보드 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    dashboardData,
    isLoading,
    error,
    fetchDashboardData,
  };
}
