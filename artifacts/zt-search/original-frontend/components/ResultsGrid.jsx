import React from 'react';
import ResultCard from './ResultCard';

export default function ResultsGrid({ results, onCardClick }) {
  if (!results || results.length === 0) return null;

  return (
    <div
      data-testid="results-grid"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
    >
      {results.map((r, i) => (
        <ResultCard key={r.id || i} result={r} index={i} onClick={onCardClick} />
      ))}
    </div>
  );
}
