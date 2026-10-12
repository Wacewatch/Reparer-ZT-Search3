import React from 'react';
import { Film, Link } from 'lucide-react';
import { posterUrl } from '@/api/zt';

export default function ResultCard({ result, index, onClick }) {
  const hasPoster = !!result.poster;

  return (
    <div
      data-testid={`result-card-${index}`}
      onClick={() => onClick(result)}
      className="group relative bg-[#181e2b] border border-[#263042] rounded-xl overflow-hidden
                 cursor-pointer transition-all duration-300 ease-out
                 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/10
                 hover:border-[#3b82f6]/40 card-shine animate-fade-up"
      style={{ animationDelay: `${index * 40}ms`, opacity: 0 }}
    >
      {/* Poster */}
      <div className="aspect-[2/3] bg-[#121721] relative overflow-hidden">
        {hasPoster ? (
          <img
            src={posterUrl(result.poster)}
            alt={result.title}
            className="w-full h-full object-cover transition-transform duration-500
                       group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`absolute inset-0 flex items-center justify-center text-[#64748b] ${hasPoster ? 'hidden' : ''}`}
        >
          <Film size={42} strokeWidth={1.2} />
        </div>

        {/* Overlay badges */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between gap-1">
            {result.quality ? (
              <span data-testid={`card-quality-${index}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30 line-clamp-1">
                {result.quality}
              </span>
            ) : result.year ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                {result.year}
              </span>
            ) : <span />}
            {result.lang && (
              <span data-testid={`card-lang-${index}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/30">
                {result.lang}
              </span>
            )}
            {result.totalLinks > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
                <Link size={9} /> {result.totalLinks}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-[13px] font-semibold leading-tight text-[#f8fafc] line-clamp-2 min-h-[36px]">
          {result.title}
        </h3>
        {result.genres && (
          <p className="text-[11px] text-[#64748b] mt-1 line-clamp-1">{result.genres}</p>
        )}
      </div>
    </div>
  );
}
