import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Search, Film, Zap, Settings2, Clock } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import SourcesDialog from '@/components/SourcesDialog';
import BlockedBanner from '@/components/BlockedBanner';
import CategoryTabs from '@/components/CategoryTabs';
import SearchBar from '@/components/SearchBar';
import ResultsGrid from '@/components/ResultsGrid';
import DetailView from '@/components/DetailView';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import LinksPage from '@/components/LinksPage';
import { searchContent, getDetail, getLatest } from '@/api/zt';
import { CATEGORY_TABS } from '@/constants/categories';

// ── Main application view ──────────────────────────────────────────────────────
function MainView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('movie');
  const [results, setResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [error, setError] = useState(null);
  const [view, setView] = useState('home'); // home | results | detail
  const [blocked, setBlocked] = useState(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // Latest additions
  const [latest, setLatest] = useState(null);
  const [latestLoading, setLatestLoading] = useState(false);

  useEffect(() => {
    setLatestLoading(true);
    setLatest(null);
    getLatest(activeTab, 24)
      .then(data => setLatest(data.results || []))
      .catch(() => setLatest([]))
      .finally(() => setLatestLoading(false));
  }, [activeTab]);

  const handleSearch = useCallback(async (query) => {
    // Pure integer → TMDB ID → navigate to liens page
    if (/^\d{1,8}$/.test(query.trim())) {
      navigate(`/liens/film/${query.trim()}`);
      return;
    }
    setError(null);
    setBlocked(null);
    setSearchLoading(true);
    setView('results');
    setDetail(null);
    setLastQuery(query);

    try {
      const data = await searchContent(query, activeTab);
      setResults(data.results || []);
      if (data.blocked) setBlocked(data.errors || []);
    } catch (err) {
      setError(err.message || 'Erreur lors de la recherche');
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [activeTab, navigate]);

  const handleCardClick = useCallback(async (result) => {
    setSelectedResult(result);
    setView('detail');
    setDetailLoading(true);
    setError(null);

    try {
      const data = await getDetail(result.pageUrls);
      setDetail(data.result);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des détails');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleBackToResults = useCallback(() => {
    setView('results');
    setDetail(null);
    setSelectedResult(null);
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    if (view === 'results' && lastQuery) {
      setView('results');
      setDetail(null);
    } else {
      setView('home');
    }
  }, [lastQuery, view]);

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      {/* Header */}
      <header
        data-testid="app-header"
        className="sticky top-0 z-50 bg-[#0b0e14]/80 backdrop-blur-xl border-b border-[#263042]"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center gap-4 py-3">
            <button
              onClick={() => setView('home')}
              className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <h1 className="text-lg font-bold text-[#f8fafc] tracking-tight">
                ZT Search
              </h1>
              <span className="text-[10px] font-mono text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/20">
                .org
              </span>
            </button>

            <div className="flex-1 max-w-2xl">
              <SearchBar onSearch={handleSearch} isLoading={searchLoading} />
            </div>
            <button
              data-testid="open-sources-btn"
              onClick={() => setSourcesOpen(true)}
              className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#263042] text-[#94a3b8] text-xs hover:text-[#f8fafc] hover:border-[#3b82f6] transition-colors"
            >
              <Settings2 size={14} /> <span className="hidden sm:inline">Sources</span>
            </button>
          </div>

          {/* Category tabs */}
          <CategoryTabs
            tabs={CATEGORY_TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Error */}
        {error && (
          <div
            data-testid="error-message"
            className="mb-6 p-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-sm"
          >
            {error}
          </div>
        )}

        {blocked && view === 'results' && !searchLoading && (
          <BlockedBanner errors={blocked} onConfigure={() => setSourcesOpen(true)} />
        )}

        {/* Home — dernières additions */}
        {view === 'home' && (
          <div data-testid="home-latest" className="animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#3b82f6]" />
                <h2 className="text-base font-bold text-[#f8fafc]">Dernières additions</h2>
              </div>
              <span className="text-xs text-[#64748b] bg-[#181e2b] px-2 py-1 rounded border border-[#263042]">
                {CATEGORY_TABS.find(t => t.id === activeTab)?.label}
              </span>
              <p className="hidden sm:block text-xs text-[#475569] ml-auto">
                Entrez un titre ou un ID TMDB (ex&nbsp;: <span className="text-[#3b82f6]">550</span>)
              </p>
            </div>
            {latestLoading ? (
              <LoadingSkeleton />
            ) : latest && latest.length > 0 ? (
              <ResultsGrid results={latest} onCardClick={handleCardClick} />
            ) : (
              <div data-testid="empty-state" className="text-center py-20">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20
                                  flex items-center justify-center border border-[#263042]">
                    <Search size={32} className="text-[#3b82f6]" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-[#f8fafc] mb-2">
                  Recherchez sur zone-telechargement.org
                </h2>
                <p className="text-[#64748b] text-sm max-w-md mx-auto">
                  Sélectionnez une catégorie et lancez une recherche.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search results */}
        {view === 'results' && (
          <div>
            {searchLoading ? (
              <LoadingSkeleton />
            ) : results && results.length === 0 && !blocked ? (
              <div data-testid="no-results" className="text-center py-16 animate-fade-in">
                <Film size={48} className="mx-auto mb-4 text-[#64748b] opacity-40" />
                <h2 className="text-lg font-bold text-[#f8fafc] mb-1">Aucun résultat</h2>
                <p className="text-[#64748b] text-sm">
                  Aucun contenu trouvé pour « {lastQuery} » dans {CATEGORY_TABS.find(t => t.id === activeTab)?.label || activeTab}
                </p>
              </div>
            ) : (
              <ResultsGrid results={results} onCardClick={handleCardClick} />
            )}
          </div>
        )}

        {/* Detail view */}
        {view === 'detail' && (
          <DetailView
            detail={detail}
            refResult={selectedResult}
            onBack={handleBackToResults}
            isLoading={detailLoading}
          />
        )}
      </main>
      <SourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} />
      <Toaster theme="dark" />
    </div>
  );
}

// ── Router root ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/liens/film/:tmdbId" element={<LinksPage mediaType="film" />} />
      <Route path="/liens/serie/:tmdbId" element={<LinksPage mediaType="serie" />} />
      <Route path="/*" element={<MainView />} />
    </Routes>
  );
}
