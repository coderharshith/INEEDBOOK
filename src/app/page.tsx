/**
 * Home Page — INEEDBOOK Application Entry Point
 *
 * Manages the entire application state machine with four views:
 *   - search:  SearchPanel with results and validation
 *   - loading: BookDetailSkeleton during PDF processing
 *   - detail:  BookDetail with cover, metadata, and preview
 *   - reader:  Full-screen BookReader for reading the PDF
 *
 * Coordinates search execution, deep PDF validation, metadata extraction,
 * and recommendation generation across all views.
 *
 * @module app/page
 */

"use client";

import React, { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import SearchPanel from '@/components/SearchPanel';
import type { SearchResult, CanonicalMetadata } from '@/components/SearchPanel';
import { BookDetailSkeleton } from '@/components/LoadingStates';
import type { PipelineStage } from '@/components/LoadingStates';
import RecommendationRow from '@/components/RecommendationRow';
import { scoreCandidate, rankCandidates, getDomainTrust } from '@/lib/search-engine';
import type { ScoredResult } from '@/lib/search-engine';
import type { TOCItem, BookMetadata, ProcessingResult } from '@/lib/pdf-processor';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Lazy-load BookDetail and BookReader to avoid SSR issues with PDF.js */
const BookDetail = dynamic(() => import('@/components/BookDetail'), { ssr: false });
const BookReader = dynamic(() => import('@/components/BookReader'), { ssr: false });

/** Available application views */
type AppView = 'search' | 'loading' | 'detail' | 'reader';

/** Complete application state shape */
interface AppState {
  view: AppView;
  pipelineStage: PipelineStage;
  pipelineMessage: string;
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  selectedMetadata: BookMetadata | null;
  selectedTOC: TOCItem[];
  selectedCover: string;
  selectedIndexPage: number;
  selectedPdfDoc: PDFDocumentProxy | null;
  selectedScore: number;
  selectedTrustLabel: string;
  recommendations: { title: string; author: string; coverUrl: string; rating: number }[];
  canonicalData: CanonicalMetadata | null;
}

/**
 * HomePage — root component managing the search → process → view flow.
 * Handles search execution, result ranking, deep PDF validation,
 * metadata extraction, and view transitions.
 */
export default function HomePage() {
  const [state, setState] = useState<AppState>({
    view: 'search',
    pipelineStage: 'idle',
    pipelineMessage: '',
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    selectedMetadata: null,
    selectedTOC: [],
    selectedCover: '',
    selectedIndexPage: 1,
    selectedPdfDoc: null,
    selectedScore: 0,
    selectedTrustLabel: '',
    recommendations: [],
    canonicalData: null,
  });

  const searchParamsRef = useRef<{ title: string; author: string; isbn: string }>({
    title: '', author: '', isbn: '',
  });

  const handleSearch = useCallback(async (title: string, author: string = '', isbn: string = '') => {
    searchParamsRef.current = { title, author, isbn };

    setState(prev => ({
      ...prev,
      isSearching: true,
      searchResults: [],
      view: 'search',
      pipelineStage: 'searching',
      pipelineMessage: `Searching for "${title}"...`,
      searchQuery: title,
    }));

    try {
      const params = new URLSearchParams({ title });
      if (author) params.set('author', author);
      if (isbn) params.set('isbn', isbn);

      const searchResponse = await fetch(`/api/search?${params.toString()}`);
      const searchData = await searchResponse.json();

      if (searchData.error) {
        setState(prev => ({
          ...prev,
          isSearching: false,
          pipelineStage: 'error',
          pipelineMessage: searchData.error,
        }));
        return;
      }

      if (!searchData.results || searchData.results.length === 0) {
        setState(prev => ({
          ...prev,
          isSearching: false,
          pipelineStage: 'idle',
          pipelineMessage: '',
          searchResults: [],
        }));
        return;
      }

      const scored = rankCandidates(
        searchData.results.map((r: any) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet || '',
          displayLink: r.displayLink || new URL(r.link).hostname,
        })),
        title,
        author,
        isbn
      );

      const results: SearchResult[] = scored.map(s => ({
        title: s.candidate.title,
        link: s.candidate.link,
        snippet: s.candidate.snippet,
        displayLink: s.candidate.displayLink,
        scores: s.scores,
        trustLabel: s.trustLabel,
      }));

      let canonical = null;
      try {
        const canRes = await fetch(`/api/books?q=${encodeURIComponent(title + ' ' + author)}`);
        if (canRes.ok) canonical = await canRes.json();
      } catch (e) {
        console.error('Canonical fetch failed', e);
      }

      setState(prev => ({
        ...prev,
        isSearching: false,
        searchResults: results,
        pipelineStage: 'idle',
        pipelineMessage: '',
        canonicalData: canonical,
      }));

      results.forEach(result => deepValidatePDF(result, title, canonical));

    } catch (err) {
      console.error('Search failed:', err);
      setState(prev => ({
        ...prev,
        isSearching: false,
        pipelineStage: 'error',
        pipelineMessage: 'Search failed. Please try again.',
      }));
    }
  }, []);

  const deepValidatePDF = useCallback(async (
    result: SearchResult,
    bookTitle: string,
    canonical: CanonicalMetadata | null
  ) => {
    setState(prev => ({
      ...prev,
      searchResults: prev.searchResults.map(r =>
        r.link === result.link ? { ...r, isValidating: true } : r
      ),
    }));

    try {
      const valRes = await fetch(
        `/api/validate?url=${encodeURIComponent(result.link)}&title=${encodeURIComponent(bookTitle)}`
      );
      const valData = await valRes.json();

      if (!valData.valid) {
        setState(prev => ({
          ...prev,
          searchResults: prev.searchResults.map(r =>
            r.link === result.link
              ? { ...r, isValidating: false, isValid: false, validationError: valData.error }
              : r
          ),
        }));
        return;
      }

      let matchLabel = 'Valid PDF';
      const sizeCategory = valData.sizeCategory || 'unknown';
      const contentMatch = valData.contentMatch || 'unknown';

      if (contentMatch === 'strong') matchLabel = 'Content Verified';
      else if (contentMatch === 'weak') matchLabel = 'Likely Match';

      if (sizeCategory === 'full-book' || sizeCategory === 'large-book') {
        matchLabel = contentMatch === 'strong' ? 'Verified Full Book' : 'Full Book PDF';
      } else if (sizeCategory === 'short-book') {
        matchLabel = contentMatch === 'strong' ? 'Verified Book' : 'Book PDF';
      } else if (sizeCategory === 'summary') {
        matchLabel = 'Summary / Excerpt';
      } else if (sizeCategory === 'too-small') {
        matchLabel = 'Too Small';
      }

      let extractedPages = 0;
      let extractedAuthor = '';

      try {
        const { loadPdfDocument, extractMetadata, configurePdfWorker } = await import('@/lib/pdf-processor');
        configurePdfWorker();
        const pdfDoc = await loadPdfDocument(result.link, typeof window !== 'undefined' ? window.location.origin : '');
        const meta = await extractMetadata(pdfDoc, result.link, valData.fileSizeFormatted);
        extractedPages = meta.totalPages;
        extractedAuthor = meta.author || '';

        if (canonical && canonical.pageCount && extractedPages > 0) {
          const pageRatio = Math.min(canonical.pageCount, extractedPages) / Math.max(canonical.pageCount, extractedPages);
          if (pageRatio > 0.85) matchLabel = 'Verified Full Book';
          else if (pageRatio > 0.5 && (sizeCategory === 'full-book' || sizeCategory === 'large-book')) matchLabel = 'Verified Book (Abridged)';
          else if (extractedPages < 30) matchLabel = 'Summary / Excerpt';
        }
      } catch (pdfErr) {
        console.warn('Deep PDF inspection failed:', pdfErr);
      }

      setState(prev => ({
        ...prev,
        searchResults: prev.searchResults.map(r =>
          r.link === result.link
            ? { ...r, isValidating: false, isValid: true, fileSize: valData.fileSizeFormatted, pdfPages: extractedPages || undefined, pdfAuthor: extractedAuthor || undefined, matchLabel, sizeCategory, contentMatch }
            : r
        ),
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        searchResults: prev.searchResults.map(r =>
          r.link === result.link ? { ...r, isValidating: false, isValid: false, validationError: 'Validation failed' } : r
        ),
      }));
    }
  }, []);

  const handleSelectResult = useCallback(async (result: SearchResult) => {
    setState(prev => ({ ...prev, view: 'loading', pipelineStage: 'processing', pipelineMessage: 'Loading PDF document...' }));

    try {
      const { configurePdfWorker, loadPdfDocument, extractMetadata, extractTableOfContents, findTOCPageIndex, generateCoverImage } = await import('@/lib/pdf-processor');
      configurePdfWorker();
      setState(prev => ({ ...prev, pipelineMessage: 'Connecting to PDF source...' }));
      const pdfDoc = await loadPdfDocument(result.link, typeof window !== 'undefined' ? window.location.origin : '');
      setState(prev => ({ ...prev, pipelineMessage: 'Extracting metadata and TOC...' }));
      const metadata = await extractMetadata(pdfDoc, result.link, result.fileSize || 'Unknown');
      const [toc, tocPageIdx] = await Promise.all([extractTableOfContents(pdfDoc), findTOCPageIndex(pdfDoc)]);
      setState(prev => ({ ...prev, pipelineStage: 'rendering', pipelineMessage: 'Generating cover preview...' }));
      const coverImage = await generateCoverImage(pdfDoc);

      const recommendations = state.searchResults
        .filter(r => r.link !== result.link && r.isValid !== false)
        .slice(0, 5)
        .map(r => ({
          title: r.title.replace(/ - PDF.*$/i, '').replace(/\.pdf$/i, '').slice(0, 50),
          author: r.displayLink,
          coverUrl: '',
          rating: r.scores.total * 5,
        }));

      setState(prev => ({
        ...prev,
        view: 'detail',
        pipelineStage: 'complete',
        pipelineMessage: '',
        selectedMetadata: metadata,
        selectedTOC: toc,
        selectedCover: coverImage,
        selectedIndexPage: tocPageIdx,
        selectedPdfDoc: pdfDoc,
        selectedScore: result.scores.total,
        selectedTrustLabel: result.trustLabel,
        recommendations,
      }));
    } catch (err) {
      console.error('PDF processing failed:', err);
      setState(prev => ({
        ...prev,
        view: 'search',
        pipelineStage: 'error',
        pipelineMessage: `Failed to process PDF: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }, [state.searchResults]);

  const handleHeaderSearch = useCallback((query: string) => handleSearch(query), [handleSearch]);
  const handleReadPreview = useCallback(() => setState(prev => ({ ...prev, view: 'reader' })), []);
  const handleCloseReader = useCallback(() => setState(prev => ({ ...prev, view: 'detail' })), []);
  const handleSearchRelated = useCallback((title: string) => handleSearch(title), [handleSearch]);
  const handleBackToSearch = useCallback(() => setState(prev => ({ ...prev, view: 'search', pipelineStage: 'idle', pipelineMessage: '' })), []);

  return (
    <div style={{ minHeight: '100vh' }}>
      {state.view !== 'reader' && (
        <Header
          onSearch={handleHeaderSearch}
          searchQuery={state.searchQuery}
          onSearchQueryChange={(q) => setState(prev => ({ ...prev, searchQuery: q }))}
        />
      )}

      {state.view === 'loading' && (
        <div style={{ padding: '32px 24px' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '100%', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
              <div className="animate-pulse" style={{ width: '60%', height: '100%', background: 'var(--accent)', borderRadius: '2px' }} />
            </div>
            <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {state.pipelineMessage || 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {state.view === 'search' && (
        <SearchPanel
          onSelectResult={handleSelectResult}
          isSearching={state.isSearching}
          searchResults={state.searchResults}
          onSearch={handleSearch}
        />
      )}

      {state.view === 'loading' && <BookDetailSkeleton />}

      {state.view === 'detail' && state.selectedMetadata && (
        <>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 24px 0' }}>
            <button
              onClick={handleBackToSearch}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              Back to search
            </button>
          </div>

          <BookDetail
            metadata={state.selectedMetadata}
            toc={state.selectedTOC}
            coverImageBase64={state.selectedCover}
            indexPageNumber={state.selectedIndexPage}
            pdfDoc={state.selectedPdfDoc}
            onReadPreview={handleReadPreview}
            onSearchRelated={handleSearchRelated}
            score={state.selectedScore}
            trustLabel={state.selectedTrustLabel}
          />

          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 64px' }}>
            <RecommendationRow
              books={state.recommendations}
              onBookClick={handleSearchRelated}
            />
          </div>
        </>
      )}

      {state.view === 'reader' && state.selectedMetadata && state.selectedPdfDoc && (
        <BookReader
          metadata={state.selectedMetadata}
          toc={state.selectedTOC}
          pdfDoc={state.selectedPdfDoc}
          defaultPage={state.selectedIndexPage}
          onClose={handleCloseReader}
        />
      )}
    </div>
  );
}
