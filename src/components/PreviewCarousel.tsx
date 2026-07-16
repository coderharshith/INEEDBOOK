/**
 * PreviewCarousel Component
 *
 * A dual-tab preview widget for exploring PDF content:
 *   - Preview tab: renders selected pages on a canvas with a mini TOC sidebar
 *   - Index tab: displays the full table of contents as clickable entries
 *
 * Includes left/right navigation arrows for quick page carousel browsing.
 *
 * @module components/PreviewCarousel
 */

"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TOCItem } from '@/lib/pdf-processor';

/** Props for the PreviewCarousel component */
interface PreviewCarouselProps {
  pdfDoc: PDFDocumentProxy | null;
  toc: TOCItem[];
  indexPage: number;
  totalPages: number;
  onPageSelect: (page: number) => void;
}

/**
 * Renders a tabbed PDF preview carousel.
 * The Preview tab renders a page on a canvas with a scrollable TOC sidebar.
 * The Index tab shows the full outline as clickable navigation entries.
 */
export default function PreviewCarousel({ pdfDoc, toc, indexPage, totalPages, onPageSelect }: PreviewCarouselProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'index'>('preview');
  const [previewPage, setPreviewPage] = useState(1);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || activeTab !== 'preview') return;
    let cancelled = false;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(previewPage);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const viewport = page.getViewport({ scale: 0.8 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') console.error(err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, previewPage, activeTab]);

  const carouselPages = [1, indexPage, Math.min(3, totalPages), Math.min(5, totalPages), Math.min(10, totalPages)]
    .filter((v, i, a) => a.indexOf(v) === i && v > 0)
    .slice(0, 5);

  const goNext = () => {
    const newIdx = Math.min(carouselIndex + 1, carouselPages.length - 1);
    setCarouselIndex(newIdx);
    setPreviewPage(carouselPages[newIdx]);
  };

  const goPrev = () => {
    const newIdx = Math.max(carouselIndex - 1, 0);
    setCarouselIndex(newIdx);
    setPreviewPage(carouselPages[newIdx]);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 0',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('preview')} style={tabStyle(activeTab === 'preview')}>Preview</button>
        <button onClick={() => setActiveTab('index')} style={tabStyle(activeTab === 'index')}>Index</button>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={goPrev}
          disabled={carouselIndex === 0}
          style={{
            position: 'absolute',
            left: '-16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: carouselIndex === 0 ? 'default' : 'pointer',
            opacity: carouselIndex === 0 ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
          }}
        >
          &lsaquo;
        </button>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          minHeight: '380px',
        }}>
          {activeTab === 'preview' ? (
            <div style={{ display: 'flex' }}>
              <div style={{
                flex: 1,
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)',
              }}>
                <div style={{
                  background: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  position: 'relative',
                  maxWidth: '260px',
                  width: '100%',
                }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  {rendering && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.8)',
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid var(--accent)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                      }} className="animate-spin" />
                    </div>
                  )}
                  <div style={{
                    textAlign: 'center',
                    padding: '8px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    {previewPage}
                  </div>
                </div>
              </div>

              {toc.length > 0 && (
                <div style={{
                  width: '240px',
                  borderLeft: '1px solid var(--border)',
                  padding: '20px',
                  overflowY: 'auto',
                  maxHeight: '380px',
                }}>
                  <h4 style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '12px',
                  }}>
                    Contents
                  </h4>
                  {toc.slice(0, 12).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setPreviewPage(item.pageNumber); onPageSelect(item.pageNumber); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'none',
                        border: 'none',
                        padding: '6px 0',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        paddingLeft: `${item.depth * 12}px`,
                        transition: 'color 0.15s',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{item.title}</span>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '11px' }}>{item.pageNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '380px' }}>
              <h4 style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '16px',
              }}>
                Full Contents
              </h4>
              {toc.length > 0 ? (
                <div>
                  {toc.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => onPageSelect(item.pageNumber)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'none',
                        border: 'none',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        paddingLeft: `${12 + item.depth * 16}px`,
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '12px' }}>
                        {item.depth === 0 ? `${idx + 1}. ` : ''}{item.title}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }}>{item.pageNumber}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0' }}>
                  No table of contents found.
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={carouselIndex >= carouselPages.length - 1}
          style={{
            position: 'absolute',
            right: '-16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: carouselIndex >= carouselPages.length - 1 ? 'default' : 'pointer',
            opacity: carouselIndex >= carouselPages.length - 1 ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
          }}
        >
          &rsaquo;
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
        {carouselPages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => { setCarouselIndex(idx); setPreviewPage(carouselPages[idx]); }}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: idx === carouselIndex ? 'var(--accent)' : 'var(--border)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
