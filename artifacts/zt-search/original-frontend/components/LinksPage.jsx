import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Play, ExternalLink, Film, Zap, Copy } from 'lucide-react';
import { getLinksByTmdbId, posterUrl } from '@/api/zt';

function LinkRow({ link }) {
  const isStream = link.type === 'stream';
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0b0e14]/60 rounded-lg hover:bg-[#181e2b] transition-colors">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
        isStream
          ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
          : 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30'
      }`}>
        {isStream ? 'STREAM' : 'DDL'}
      </span>
      {link.quality && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 shrink-0">
          {link.quality}
        </span>
      )}
      {link.lang && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#8b5cf6]/15 text-[#a78bfa] border border-[#8b5cf6]/30 shrink-0">
          {link.lang}
        </span>
      )}
      <span className="text-[12px] text-[#94a3b8] bg-[#202838] px-2 py-0.5 rounded shrink-0">
        {link.host || '?'}
      </span>
      <span className="flex-1 text-[11px] text-[#475569] truncate min-w-0">{link.filename || link.url}</span>
      {link.size && <span className="text-[10px] text-[#475569] shrink-0">{link.size}</span>}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                   bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
      >
        <ExternalLink size={11} /> Ouvrir
      </a>
    </div>
  );
}

export default function LinksPage({ mediaType }) {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [searchingTitle, setSearchingTitle] = useState(false);

  const doFetch = useCallback((title = null) => {
    setLoading(true);
    setData(null);
    getLinksByTmdbId(tmdbId, mediaType, title)
      .then(setData)
      .catch(err => setData({ error: err.message, links: [] }))
      .finally(() => setLoading(false));
  }, [tmdbId, mediaType]);

  useEffect(() => { doFetch(); }, [doFetch]);

  const handleTitleSearch = (e) => {
    e.preventDefault();
    if (!titleInput.trim()) return;
    setSearchingTitle(true);
    doFetch(titleInput.trim());
    setSearchingTitle(false);
  };

  const needsTitleInput = data?.error && data.error.includes('TMDB_API_KEY');
  const jsonStr = data ? JSON.stringify(data, null, 2) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0b0e14]/80 backdrop-blur-xl border-b border-[#263042]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-[#f8fafc]">ZT Search</span>
            <span className="text-[10px] font-mono text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/20">.org</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#94a3b8] hover:text-[#3b82f6] text-sm transition-colors ml-4"
          >
            <ArrowLeft size={16} /> Retour
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[#475569]">
              {mediaType === 'film' ? 'Film' : 'Série'} TMDB #{tmdbId}
            </span>
            <span className="text-[10px] px-2 py-1 rounded bg-[#181e2b] border border-[#263042] text-[#64748b] font-mono">
              /api/liens/{mediaType}/{tmdbId}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-[#64748b]">
            <div className="inline-block w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm">Recherche en cours sur zone-telechargement.org…</p>
          </div>
        ) : needsTitleInput ? (
          <div className="max-w-lg mx-auto py-12">
            <div className="p-6 rounded-xl bg-[#181e2b] border border-[#263042]">
              <h2 className="text-base font-bold text-[#f8fafc] mb-1">Clé TMDB non configurée</h2>
              <p className="text-sm text-[#64748b] mb-4">
                Ajoutez <code className="text-[#f59e0b] bg-[#0b0e14] px-1 rounded">TMDB_API_KEY</code> dans{' '}
                <code className="text-[#94a3b8] bg-[#0b0e14] px-1 rounded">backend/.env</code>{' '}
                pour activer la résolution automatique.
              </p>
              <p className="text-sm text-[#64748b] mb-4">
                Ou entrez le titre manuellement pour chercher sur zone-telechargement.org :
              </p>
              <form onSubmit={handleTitleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  placeholder="Titre du film (ex : Fight Club)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0b0e14] border border-[#263042] text-[#f8fafc] text-sm focus:border-[#3b82f6] outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!titleInput.trim() || searchingTitle}
                  className="px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Chercher
                </button>
              </form>
            </div>
          </div>
        ) : data?.error ? (
          <div className="p-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-sm">
            {data.error}
          </div>
        ) : (
          <>
            {/* Film info */}
            <div className="flex items-start gap-5 mb-8">
              {data?.poster && (
                <img
                  src={posterUrl(data.poster)}
                  alt={data?.title}
                  className="w-24 rounded-xl border border-[#263042] shrink-0 hidden sm:block"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-[#f8fafc] mb-1">{data?.title || '—'}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs px-2.5 py-1 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 font-semibold">
                    {data?.total || 0} lien{data?.total !== 1 ? 's' : ''} disponible{data?.total !== 1 ? 's' : ''}
                  </span>
                  {data?.result_url && (
                    <a href={data.result_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs px-2.5 py-1 rounded bg-[#181e2b] text-[#64748b] border border-[#263042] hover:text-[#3b82f6] transition-colors">
                      Page source ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Links UI view */}
            {data?.links?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-[#f8fafc] uppercase tracking-wider mb-3">
                  Liens
                </h2>
                <div className="space-y-1.5">
                  {data.links.map((lk, i) => <LinkRow key={i} link={lk} />)}
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-[#94a3b8] uppercase tracking-wider">JSON brut</h2>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#181e2b] border border-[#263042] text-[#64748b] hover:text-[#f8fafc] hover:border-[#3b82f6] transition-colors"
                >
                  <Copy size={12} /> {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <pre
                data-testid="links-json"
                className="text-[#94a3b8] text-xs bg-[#0d1117] p-4 rounded-xl overflow-auto border border-[#263042] max-h-[500px] font-mono"
              >
                {jsonStr}
              </pre>
            </div>

            {data?.links?.length === 0 && (
              <div className="text-center py-12 text-[#64748b]">
                <Film size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucun lien trouvé pour ce contenu sur zone-telechargement.org</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
