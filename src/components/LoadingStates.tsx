/**
 * LoadingStates Components
 *
 * Provides skeleton and progress indicator components for various loading states:
 *   - PipelineProgress: stepped progress bar showing search → validate → process → render
 *   - BookDetailSkeleton: placeholder layout for the book detail view
 *   - SearchSkeleton: placeholder cards for search results
 *
 * @module components/LoadingStates
 */

"use client";

import React from 'react';

/** Possible pipeline stages for the loading progress indicator */
export type PipelineStage = 'idle' | 'searching' | 'validating' | 'processing' | 'rendering' | 'complete' | 'error';

/** Props for the PipelineProgress component */
interface LoadingStatesProps {
  stage: PipelineStage;
  message?: string;
}

/** Pipeline step definitions displayed in the progress indicator */
const stages = [
  { key: 'searching', label: 'Searching' },
  { key: 'validating', label: 'Validating' },
  { key: 'processing', label: 'Processing' },
  { key: 'rendering', label: 'Rendering' },
];

/**
 * PipelineProgress — renders a horizontal stepped progress indicator.
 * Each step shows "Done" (completed), "..." (active), or the step label (pending).
 * Connected by lines that turn green as steps complete.
 */
export function PipelineProgress({ stage, message }: LoadingStatesProps) {
  const currentIdx = stages.findIndex(s => s.key === stage);
  if (stage === 'idle') return null;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }} className="animate-fade-in-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
        {stages.map((s, i) => {
          const isActive = s.key === stage;
          const isCompleted = currentIdx > i;
          return (
            <React.Fragment key={s.key}>
              <div style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                background: isCompleted ? 'var(--accent-muted)' : isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isCompleted ? 'var(--accent)' : isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.3s',
              }}>
                {isCompleted ? 'Done' : isActive ? '...' : s.label}
              </div>
              {i < stages.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: isCompleted ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.3s',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }} className="animate-pulse">
        {message || 'Processing...'}
      </p>
    </div>
  );
}

/**
 * BookDetailSkeleton — a three-column placeholder layout matching the BookDetail view.
 * Shows a cover placeholder, metadata lines, and a preview panel skeleton.
 */
export function BookDetailSkeleton() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }} className="animate-fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '240px', height: '320px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ width: '80px', height: '20px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
          <div style={{ width: '70%', height: '28px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
          <div style={{ width: '40%', height: '16px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
          <div style={{ width: '30%', height: '16px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '100%', height: '380px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}

/**
 * SearchSkeleton — renders three placeholder cards that mimic the layout
 * of search result items during loading.
 */
export function SearchSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="animate-fade-in">
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          padding: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ width: '60%', height: '14px', background: 'var(--bg-elevated)', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ width: '100%', height: '12px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  );
}
