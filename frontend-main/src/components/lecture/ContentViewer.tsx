import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ContentViewerProps {
  viewMode: 'pdf' | 'summary';
  pdfUrl: string;
  summaryText: string;
}

export function ContentViewer({ viewMode, pdfUrl, summaryText }: ContentViewerProps) {
  
  const getFullPdfUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  };

  const renderPDF = () => {
    const fullPdfUrl = getFullPdfUrl(pdfUrl);
    if (!fullPdfUrl) {
      return (
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-6">
          PDF 원본 경로가 없습니다.
        </div>
      );
    }
    return (
      <iframe src={fullPdfUrl} className="w-full h-full border-none" title="PDF Viewer" />
    );
  };

  const renderSummary = () => {
    return (
      <div className="flex-1 w-full h-full p-8 overflow-y-auto bg-white">
        <article className="prose prose-slate max-w-none text-left prose-table:w-full prose-th:bg-gray-50 prose-td:border-b prose-th:border-b prose-th:text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText || '*요약 내용이 없습니다.*'}</ReactMarkdown>
        </article>
      </div>
    );
  };

  return (
    <div className="flex-1 rounded border border-gray-300 bg-white shadow-sm flex flex-col overflow-hidden relative">
      {viewMode === 'pdf' ? renderPDF() : renderSummary()}
    </div>
  );
}
