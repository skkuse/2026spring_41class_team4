import { apiClient } from './apiClient';
import { CreateMockExamRequest, CreateMockExamResponse, MockExamListItem } from '../types/exam';

class ExamService {
  async getSubjectMockExams(subjectId: string): Promise<MockExamListItem[]> {
    const response = await apiClient.get<MockExamListItem[]>(`/subjects/${subjectId}/mock-exams`);
    return response.data;
  }

  async postGenerateMockExam(subjectId: string, payload: CreateMockExamRequest): Promise<CreateMockExamResponse> {
    const response = await apiClient.post<CreateMockExamResponse>(`/subjects/${subjectId}/mock-exams`, payload);
    return response.data;
  }
}

export const examService = new ExamService();
