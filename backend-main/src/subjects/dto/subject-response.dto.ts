export interface SubjectResponseDto {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  masteryScore?: number | null;
}
