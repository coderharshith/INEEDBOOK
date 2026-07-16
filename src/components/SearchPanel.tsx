/**
 * SearchPanel Component
 *
 * The main search interface for the INEEDBOOK application.
 * Provides a primary search bar with optional advanced options (author, ISBN).
 * Displays ranked search results with validation status, match labels,
 * and preview/download actions for each candidate PDF.
 *
 * @module components/SearchPanel
 */

"use client";

import React, { useState } from 'react';

/** Canonical book metadata fetched from Google Books API */
export interface CanonicalMetadata {
  title: string;
  authors: string[];
  pageCount: number;
  publisher: string;
}

/** A single search result with scores, validation state, and display metadata */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  scores: {
    title: number;
    author: number;
    isbn: number;
    trust: number;
    total: number;
  };
  trustLabel: string;
  isValidating?: boolean;
  isValid?: boolean;
  validationError?: string;
  fileSize?: string;
  pdfPages?: number;
  pdfAuthor?: string;
  pdfTitle?: string;
  matchLabel?: string;
  sizeCategory?: string;
  contentMatch?: string;
}

/** Props for the SearchPanel component */
interface SearchPanelProps {
  onSelectResult: (result: SearchResult) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  onSearch: (title: string, author: string, isbn: string) => void;
  canonicalData?: CanonicalMetadata | null;
}

/**
 * SearchPanel — main search interface with results list.
 * Renders the hero search bar, advanced options toggle, canonical match info,
 * and a list of validated search results with preview/download buttons.
 */
export default function SearchPanel({ onSelectResult, isSearching, searchResults, onSearch, canonicalData }: SearchPanelProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSearch(title.trim(), author.trim(), isbn.trim());
    }
  };

  const handleDownload = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: '680px' }}>
        {searchResults.length === 0 && (
          <div style={{ textAlign: 'center', marginBottom: '48px' }} className="animate-fade-in-up">
            <h1 style={{
              fontSize: '36px',
              fontWeight: '700',
              letterSpacing: '-0.03em',
              marginBottom: '12px',
              color: 'var(--text-primary)',
            }}>
              <span style={{ color: 'var(--accent)' }}>iNEED</span>BOOK
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              maxWidth: '400px',
              margin: '0 auto',
            }}>
              Search by title, author, or ISBN to find and preview books instantly.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="animate-fade-in-up" style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '6px',
          display: 'flex',
          gap: '4px',
        }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter book title, author, or ISBN..."
            autoFocus
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '15px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!title.trim() || isSearching}
            style={{
              padding: '14px 24px',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: '600',
              fontSize: '14px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: isSearching || !title.trim() ? 'not-allowed' : 'pointer',
              opacity: isSearching || !title.trim() ? '0.5' : '1',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>
        </div>

        {showAdvanced && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '16px',
          }} className="animate-fade-in-up">
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. J.K. Rowling"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>ISBN</label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="e.g. 978-3-16-148410-0"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div style={{ marginTop: '32px' }} className="animate-fade-in-up">
            {canonicalData && (
              <div style={{
                padding: '16px',
                background: 'var(--accent-muted)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '20px',
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  Target Match
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                  {canonicalData.title}
                  {canonicalData.authors?.length ? ` by ${canonicalData.authors.join(', ')}` : ''}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Pages: {canonicalData.pageCount || 'Unknown'} | Publisher: {canonicalData.publisher}
                </div>
              </div>
            )}

            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-muted)',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {searchResults.length} result{searchResults.length === 1 ? '' : 's'} found
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    opacity: result.isValid === false ? '0.5' : '1',
                    transition: 'border-color 0.15s',
                    cursor: 'pointer',
                  }}
                  onClick={() => onSelectResult(result)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {result.title}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-elevated)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          {result.displayLink}
                        </span>
                        {result.matchLabel && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: result.matchLabel.includes('Verified') ? 'var(--accent)' :
                                   result.matchLabel.includes('Summary') ? 'var(--warning)' :
                                   result.matchLabel.includes('Too Small') ? 'var(--danger)' : 'var(--text-secondary)',
                            background: result.matchLabel.includes('Verified') ? 'var(--accent-muted)' :
                                        result.matchLabel.includes('Summary') ? 'var(--warning-muted)' :
                                        result.matchLabel.includes('Too Small') ? 'var(--danger-muted)' : 'var(--bg-elevated)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}>
                            {result.matchLabel}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {result.snippet}
                      </p>

                      {(result.pdfPages || result.pdfAuthor) && (
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {result.pdfPages && <span>Pages: {result.pdfPages}</span>}
                          {result.pdfAuthor && <span>Author: {result.pdfAuthor}</span>}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
                        {result.isValidating && (
                          <span style={{ color: 'var(--accent)' }}>
                            <span className="animate-pulse">Validating...</span>
                          </span>
                        )}
                        {result.isValid === false && (
                          <span style={{ color: 'var(--danger)' }}>{result.validationError || 'Invalid'}</span>
                        )}
                        {result.fileSize && (
                          <span style={{ color: 'var(--text-muted)' }}>{result.fileSize}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectResult(result); }}
                        disabled={result.isValidating}
                        style={{
                          padding: '8px 16px',
                          background: 'var(--accent)',
                          color: '#000',
                          fontWeight: '600',
                          fontSize: '13px',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          cursor: result.isValidating ? 'not-allowed' : 'pointer',
                          opacity: result.isValidating ? '0.5' : '1',
                          transition: 'all 0.15s',
                        }}
                      >
                        Preview
                      </button>
                      {result.isValid && !result.isValidating && (
                        <button
                          onClick={(e) => handleDownload(e, result.link)}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            fontWeight: '600',
                            fontSize: '13px',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
