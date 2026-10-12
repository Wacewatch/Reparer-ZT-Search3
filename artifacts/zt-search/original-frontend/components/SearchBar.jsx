import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ onSearch, isLoading }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="search-form"
      className="flex gap-2 items-center w-full"
    >
      <div className="relative flex-1">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]"
        />
        <input
          data-testid="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titre, film, série, jeu… ou ID TMDB (ex : 550)"
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#181e2b] border border-[#263042]
                     text-[#f8fafc] placeholder-[#64748b] text-sm
                     focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30
                     transition-all duration-200"
          disabled={isLoading}
        />
        {query && (
          <button
            type="button"
            data-testid="search-clear"
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#f8fafc] transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <button
        data-testid="search-submit"
        type="submit"
        disabled={isLoading || !query.trim()}
        className="px-6 py-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white
                   font-semibold text-sm transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed
                   active:scale-[0.97]"
      >
        {isLoading ? (
          <div className="dot-loader flex items-center gap-0.5">
            <span></span><span></span><span></span>
          </div>
        ) : 'Rechercher'}
      </button>
    </form>
  );
}
