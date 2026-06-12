export interface PreprocessedPageDto {
  pageNumber: number;
  title: string;
  rawText: string;
  cleanedText: string;
  markdown: string;
  imageRefs: string[];
  importantVisualNote?: string;
}

