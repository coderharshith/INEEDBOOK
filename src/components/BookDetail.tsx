/**
 * BookDetail Component
 *
 * Displays the full detail view for a selected book:
 *   - Left column: cover image or title placeholder
 *   - Middle column: metadata (title, author, page count, score, trust label)
 *   - Right column: PreviewCarousel for page browsing and TOC navigation
 *
 * Includes Download PDF and Read Preview action buttons.
 *
 * @module components/BookDetail
 */

"use client";

import React, { useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TOCItem, BookMetadata } from '@/lib/pdf-processor';
import PreviewCarousel from './PreviewCarousel';

/** Props for the BookDetail component */
interface BookDetailProps {
  metadata: BookMetadata;
  toc: TOCItem[];
  coverImageBase64: string;
  indexPageNumber: number;
  pdfDoc: PDFDocumentProxy | null;
  onReadPreview: () => void;
  onSearchRelated: (title: string) => void;
  score?: number;
  trustLabel?: string;
}

/** Inline style definitions for the BookDetail layout */
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 24px',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 1fr',
    gap: '40px',
    alignItems: 'start',
  } as React.CSSProperties,
  coverSection: {
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  placeholder: {
    width: '240px',
    height: '320px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--accent)',
    background: 'var(--accent-muted)',
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '12px',
  } as React.CSSProperties,
  title: {
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  } as React.CSSProperties,
  author: {
    fontSize: '14px',
    color: 'var(--accent)',
    fontWeight: 500,
    marginBottom: '16px',
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    gap: '24px',
    marginBottom: '24px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: '12px',
  } as React.CSSProperties,
  btnPrimary: {
    padding: '12px 24px',
    background: 'var(--accent)',
    color: '#000',
    fontWeight: 600,
    fontSize: '14px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  } as React.CSSProperties,
  btnSecondary: {
    padding: '12px 24px',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,
};

/**
 * Renders the three-column book detail layout with cover, metadata, and preview.
 */
export default function BookDetail({
  metadata,
  toc,
  coverImageBase64,
  indexPageNumber,
  pdfDoc,
  onReadPreview,
  onSearchRelated,
  score,
  trustLabel,
}: BookDetailProps) {
  const [selectedPage, setSelectedPage] = useState(indexPageNumber);

  return (
    <div style={styles.container} className="animate-fade-in-up">
      <div style={styles.grid}>
        <div style={styles.coverSection}>
          {coverImageBase64 ? (
            <img
              src={coverImageBase64}
              alt={metadata.title}
              style={{
                width: '100%',
                maxWidth: '240px',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            />
          ) : (
            <div style={styles.placeholder}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {metadata.title}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {metadata.author}
              </p>
            </div>
          )}
        </div>

        <div>
          {trustLabel && <span style={styles.badge}>{trustLabel}</span>}
          <h1 style={styles.title}>{metadata.title}</h1>
          <p style={styles.author}>{metadata.author}</p>

          {score !== undefined && score > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {(score * 5).toFixed(1)}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Match Score</span>
            </div>
          )}

          <div style={styles.meta}>
            <span>{metadata.totalPages} pages</span>
            <span>{metadata.fileSize}</span>
          </div>

          <div style={styles.actions}>
            <a
              href={metadata.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.btnPrimary}
            >
              Download PDF
            </a>
            <button onClick={onReadPreview} style={styles.btnSecondary}>
              Read Preview
            </button>
          </div>
        </div>

        <div>
          <PreviewCarousel
            pdfDoc={pdfDoc}
            toc={toc}
            indexPage={indexPageNumber}
            totalPages={metadata.totalPages}
            onPageSelect={setSelectedPage}
          />
        </div>
      </div>
    </div>
  );
}
