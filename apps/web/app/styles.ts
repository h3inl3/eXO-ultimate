import type { CSSProperties } from 'react';

// Plain module: values exported from a 'use client' file are references in server components.
export const btn: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: '1.5px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--text)',
  font: '600 15px var(--font-ui), sans-serif',
  cursor: 'pointer',
};
export const field: CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--text)',
  font: 'inherit',
  boxSizing: 'border-box',
};
