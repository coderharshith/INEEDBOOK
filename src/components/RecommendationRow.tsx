/**
 * RecommendationRow Component
 *
 * Displays a horizontal scrollable row of recommended books
 * based on the current search context. Each card shows the title,
 * author, and rating, and triggers a new search when clicked.
 *
 * @module components/RecommendationRow
 */

"use client";

import React from 'react';

/** A single recommended book entry */
interface RecommendedBook {
  title: string;
  author: string;
  coverUrl: string;
  rating: number;
}

/** Props for the RecommendationRow component */
interface RecommendationRowProps {
  books: RecommendedBook[];
  onBookClick: (title: string) => void;
}

/**
 * Renders a "You may also like" section with horizontally scrollable book cards.
 * Returns null if no recommendations are provided.
 */
export default function RecommendationRow({ books, onBookClick }: RecommendationRowProps) {
  if (!books.length) return null;

  return (
    <section style={{ marginTop: '48px' }} className="animate-fade-in-up">
      <h2 style={{
        fontSize: '14px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '16px',
      }}>
        You may also like
      </h2>

      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
        {books.map((book, idx) => (
          <button
            key={idx}
            onClick={() => onBookClick(book.title)}
            style={{
              flexShrink: 0,
              width: '220px',
              padding: '14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <p style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {book.title}
            </p>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginBottom: book.rating > 0 ? '6px' : '0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {book.author}
            </p>
            {book.rating > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                {book.rating.toFixed(1)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
