export interface UpdatedMasteryItemDto {
  keywordId: string;
  masteryScore: number;
}

export interface SubmitAnswerResponseDto {
  quizProblemId: string;
  isCorrect: boolean;
  explanation?: string;
  feedback?: string;
  updatedMastery: UpdatedMasteryItemDto[];
  selectedChoiceIds?: string[];
}
