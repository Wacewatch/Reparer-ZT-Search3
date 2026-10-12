import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div data-testid="loading-skeleton" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden">
          <div className="aspect-[2/3] shimmer rounded-xl" />
          <div className="pt-3 space-y-2">
            <div className="h-3.5 shimmer rounded w-4/5" />
            <div className="h-3 shimmer rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
