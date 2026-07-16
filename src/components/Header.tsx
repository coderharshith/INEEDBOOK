/**
 * Header Component
 *
 * Sticky top navigation bar with the INEEDBOOK logo, search input,
 * and two dropdown menus: "Explore" (popular books) and "Collections" (categories).
 * Clicking outside a dropdown closes it automatically.
 *
 * @module components/Header
 */

"use client";

import React, { useState, useRef, useEffect } from 'react';

/** Props for the Header component */
interface HeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

/** Pre-defined popular book queries for the Explore dropdown */
const exploreItems = [
  { label: '1984', query: '1984 George Orwell' },
  { label: 'To Kill a Mockingbird', query: 'To Kill a Mockingbird Harper Lee' },
  { label: 'The Great Gatsby', query: 'The Great Gatsby F. Scott Fitzgerald' },
  { label: 'Pride and Prejudice', query: 'Pride and Prejudice Jane Austen' },
  { label: 'The Alchemist', query: 'The Alchemist Paulo Coelho' },
  { label: 'Atomic Habits', query: 'Atomic Habits James Clear' },
];

/** Pre-defined genre/category queries for the Collections dropdown */
const collectionItems = [
  { label: 'Science Fiction', query: 'science fiction bestseller' },
  { label: 'Self Help', query: 'self help popular books' },
  { label: 'Business & Finance', query: 'business finance books' },
  { label: 'Classic Literature', query: 'classic literature must read' },
  { label: 'Psychology', query: 'psychology books best' },
  { label: 'Programming', query: 'programming books bestseller' },
];

/**
 * Renders the sticky header bar with logo, search form, and dropdown menus.
 * Manages open/close state for the Explore and Collections dropdowns,
 * and closes dropdowns when clicking outside the menu container.
 */
export default function Header({ onSearch, searchQuery, onSearchQueryChange }: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<'explore' | 'collections' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) onSearch(searchQuery.trim());
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (query: string) => {
    onSearch(query);
    setOpenMenu(null);
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '32px',
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          flexShrink: 0,
        }}>
          <span style={{ color: 'var(--accent)' }}>iNEED</span>BOOK
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: '520px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search books, authors, ISBN..."
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </form>

        <div ref={menuRef} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexShrink: 0,
          fontSize: '14px',
          fontWeight: '500',
          position: 'relative',
        }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === 'explore' ? null : 'explore')}
              style={{
                background: 'none',
                border: 'none',
                color: openMenu === 'explore' ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                padding: '4px 0',
                transition: 'color 0.15s',
              }}
            >
              Explore
            </button>
            {openMenu === 'explore' && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '220px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                zIndex: 100,
              }} className="animate-fade-in">
                <div style={{
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Popular Books
                </div>
                {exploreItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item.query)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === 'collections' ? null : 'collections')}
              style={{
                background: 'none',
                border: 'none',
                color: openMenu === 'collections' ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                padding: '4px 0',
                transition: 'color 0.15s',
              }}
            >
              Collections
            </button>
            {openMenu === 'collections' && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '220px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                zIndex: 100,
              }} className="animate-fade-in">
                <div style={{
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Categories
                </div>
                {collectionItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item.query)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
