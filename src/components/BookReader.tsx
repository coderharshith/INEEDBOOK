/**
 * BookReader Component
 *
 * Full-screen PDF reader with:
 *   - Left sidebar: book info, TOC outline, and download button
 *   - Main area: rendered PDF page on a canvas with navigation controls
 *   - Keyboard navigation: Arrow keys for prev/next, Escape to close
 *
 * Uses PDF.js to render pages at 1.5x scale for crisp display.
 *
 * @module components/BookReader
 */

"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TOCItem, BookMetadata } from '@/lib/pdf-processor';

/** Props for the BookReader component */
interface BookReaderProps {
  metadata: BookMetadata;
  toc: TOCItem[];
  pdfDoc: PDFDocumentProxy | null;
  defaultPage: number;
  onClose: () => void;
}

/**
 * Full-screen PDF reader with sidebar navigation and canvas-based rendering.
 * Manages page state, render lifecycle, and keyboard event handlers.
 */
export default function BookReader({ metadata, toc, pdfDoc, defaultPage, onClose }: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(defaultPage);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const renderTask = page.render({ canvasContext: context, canvas, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') console.error('Rendering error:', err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPage(p => Math.max(1, p - 1));
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage(p => Math.min(metadata.totalPages, p + 1));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [metadata.totalPages, onClose]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      background: 'var(--bg-base)',
    }} className="animate-fade-in">
      {/* Sidebar */}
      <div style={{
        width: '300px',
        height: '100%',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '4px 0',
              marginBottom: '16px',
              display: 'block',
            }}
          >
            Back
          </button>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.3 }}>
            {metadata.title}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>{metadata.author}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{metadata.fileSize} | {metadata.totalPages} pages</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '8px 12px',
          }}>
            Outline
          </div>
          {toc.length > 0 ? (
            toc.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(item.pageNumber)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: currentPage === item.pageNumber ? 'var(--accent-muted)' : 'transparent',
                  color: currentPage === item.pageNumber ? 'var(--accent)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingLeft: `${Math.max(12, item.depth * 16)}px`,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>{item.pageNumber}</span>
              </button>
            ))
          ) : (
            <p style={{ padding: '16px 12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No outline available
            </p>
          )}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <a
            href={metadata.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '10px',
              background: 'var(--accent)',
              color: '#000',
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Download Full PDF
          </a>
        </div>
      </div>

      {/* Main Reader */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          height: '52px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Page {currentPage} of {metadata.totalPages}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{
                padding: '6px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.4 : 1,
                fontSize: '13px',
              }}
            >
              Prev
            </button>
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= metadata.totalPages) setCurrentPage(val);
              }}
              style={{
                width: '56px',
                padding: '6px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                textAlign: 'center',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
              }}
              min={1}
              max={metadata.totalPages}
            />
            <button
              onClick={() => setCurrentPage(p => Math.min(metadata.totalPages, p + 1))}
              disabled={currentPage >= metadata.totalPages}
              style={{
                padding: '6px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                cursor: currentPage >= metadata.totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= metadata.totalPages ? 0.4 : 1,
                fontSize: '13px',
              }}
            >
              Next
            </button>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '32px',
          background: 'var(--bg-base)',
        }}>
          <div style={{
            position: 'relative',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            borderRadius: 'var(--radius-md)',
            background: '#fff',
            overflow: 'hidden',
          }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {rendering && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.3)',
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                }} className="animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
