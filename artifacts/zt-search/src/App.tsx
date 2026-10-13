import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity, ArrowLeft, BookOpen, Check, ChevronRight,
  Clapperboard, Clock3, Copy, ExternalLink, Film, Gamepad2, Headphones,
  KeyRound, Link2, LoaderCircle, MapPin, MonitorDown, Music2, Radio,
  Search, Settings2, ShieldAlert, Sparkles, Star, Tag, Tv, UserRound, Users,
  Video, X, Zap,
} from 'lucide-react';
import {
  getGetContentCategoriesQueryKey, getGetContentDetailQueryKey, getGetContentLinksQueryKey,
  getGetLatestContentQueryKey, getGetSourceSettingsQueryKey, getSearchContentQueryKey,
  setBaseUrl, useGetContentCategories, useGetContentDetail, useGetContentLinks,
  useGetLatestContent, useGetSourceSettings, useGetSourceStatus, useSaveSourceSettings,
  useSearchContent, useTestContentSources,
} from '@workspace/api-client-react';
import type {
  Category, ContentResult, Link as ApiLink, Quality, Relay, SourceSettings,
  SourceTestResponseResultsItem,
} from '@workspace/api-client-react';
import { Route, Switch, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';

setBaseUrl('/zt-api');

const queryClient = new QueryClient();
const posterSrc = (url?: string | null) => {
  if (!url) return '';
  const lower = url.toLowerCase();
  return lower.includes('zone-telechargement') || lower.includes('zone-images')
    ? `/zt-api/api/img?u=${encodeURIComponent(url)}` : url;
};

const iconFor = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized.includes('movie') || normalized.includes('film')) return Film;
  if (normalized.includes('tv') || normalized.includes('serie')) return Tv;
  if (normalized.includes('anime')) return Sparkles;
  if (normalized.includes('jeu')) return Gamepad2;
  if (normalized.includes('musique')) return Music2;
  if (normalized.includes('ebook')) return BookOpen;
  if (normalized.includes('logiciel')) return MonitorDown;
  if (normalized.includes('documentaire')) return Clapperboard;
  if (normalized.includes('emission')) return Radio;
  if (normalized.includes('concert')) return Headphones;
  return Video;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
      <Zap size={17} fill="currentColor" />
      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-[#11171d]" />
    </div>
    {!compact && <div className="leading-tight">
      <div className="font-display text-[16px] font-bold tracking-[-.04em] text-[#f2f4ed]">ZT Search</div>
      <div className="font-mono-ui mt-0.5 text-[9px] uppercase tracking-[.2em] text-slate-500">index cinéma .org</div>
    </div>}
  </div>;
}

function Header({ onOpenSources, onHome, category, isLookup = false }: {
  onOpenSources?: () => void; onHome?: () => void; category?: string; isLookup?: boolean;
}) {
  return <header data-testid="app-header" className="sticky top-0 z-40 border-b border-white/[.07] bg-[#0d1218]/90 backdrop-blur-2xl">
    <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-7">
      <button data-testid="link-home" onClick={onHome} className="shrink-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
        <Brand />
      </button>
      {isLookup && <div className="hidden h-7 w-px bg-white/10 sm:block" />}
      {isLookup && <span className="hidden text-xs text-slate-400 sm:block">Résolution TMDB</span>}
      {!isLookup && <div className="ml-4 hidden h-7 w-px bg-white/10 sm:block" />}
      {!isLookup && <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Catalogue connecté
      </div>}
      <div className="ml-auto flex items-center gap-2">
        {category && <span className="hidden rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-widest text-slate-400 sm:block">{category}</span>}
        {!isLookup && <button data-testid="open-sources-btn" onClick={onOpenSources} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-300/30 hover:text-emerald-200">
          <Settings2 size={14} /><span className="hidden sm:inline">Sources</span>
        </button>}
      </div>
    </div>
  </header>;
}

function SearchBox({ onSubmit, busy }: { onSubmit: (query: string) => void; busy: boolean }) {
  const [value, setValue] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (value.trim()) onSubmit(value.trim()); };
  return <form data-testid="search-form" onSubmit={submit} className="flex w-full gap-2.5">
    <div className="relative min-w-0 flex-1">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
      <input data-testid="search-input" value={value} onChange={(event) => setValue(event.target.value)} disabled={busy}
        className="h-[54px] w-full rounded-2xl border border-white/10 bg-[#151c23] pl-12 pr-11 text-sm text-slate-100 shadow-[0_12px_38px_rgba(0,0,0,.18)] outline-none placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/[.06] disabled:opacity-60"
        placeholder="Un titre, une série, un anime ou un ID TMDB…" />
      {value && <button type="button" data-testid="search-clear" aria-label="Effacer la recherche" onClick={() => setValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-white"><X size={15} /></button>}
    </div>
    <button data-testid="search-submit" disabled={busy || !value.trim()} className="flex h-[54px] shrink-0 items-center gap-2 rounded-2xl bg-emerald-300 px-5 text-sm font-extrabold text-[#0b1714] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 sm:px-6">
      {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}<span className="hidden sm:inline">{busy ? 'Recherche…' : 'Rechercher'}</span>
    </button>
  </form>;
}

function CategoryRail({ categories, active, onChange }: { categories: Category[]; active: string; onChange: (id: string) => void }) {
  return <nav data-testid="category-tabs" aria-label="Catégories" className="scrollbar-none flex gap-1.5 overflow-x-auto border-t border-white/[.06] py-3">
    {categories.map((category) => {
      const Icon = iconFor(category.type);
      return <button key={category.type} data-testid={`tab-${category.type}`} onClick={() => onChange(category.type)}
        className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${active === category.type ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[.035] hover:text-slate-200'}`}>
        <Icon size={14} />{category.label}
      </button>;
    })}
  </nav>;
}

function LoadingCards() {
  return <div data-testid="loading-results" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
    {Array.from({ length: 12 }, (_, i) => <div key={i} className="overflow-hidden rounded-2xl border border-white/[.06] bg-[#141b22]">
      <div className="skeleton aspect-[2/3]" /><div className="space-y-2 p-3"><div className="skeleton h-3 w-4/5 rounded" /><div className="skeleton h-2.5 w-2/5 rounded" /></div>
    </div>)}
  </div>;
}

function ResultCard({ result, index, onClick }: { result: ContentResult; index: number; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button data-testid={`result-card-${index}`} onClick={onClick}
    className="group min-w-0 overflow-hidden rounded-2xl border border-white/[.07] bg-[#141b22] text-left transition duration-300 hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-[#192229] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
    <div className="poster-field relative aspect-[2/3] overflow-hidden">
      {result.poster && !failed ? <img data-testid={`img-poster-${index}`} src={posterSrc(result.poster)} alt={result.title} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" /> :
        <div data-testid={`poster-fallback-${index}`} className="absolute inset-0 grid place-items-center text-slate-700"><Film size={38} strokeWidth={1.1} /></div>}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-[#070a0d]/95 via-[#070a0d]/55 to-transparent p-3 pt-12">
        {result.quality ? <span data-testid={`card-quality-${index}`} className="max-w-[75%] truncate rounded-md border border-emerald-100/20 bg-emerald-200/10 px-2 py-1 font-mono-ui text-[9px] text-emerald-100">{result.quality}</span> : <span />}
        {result.lang && <span data-testid={`card-lang-${index}`} className="rounded-md border border-amber-200/20 bg-amber-100/10 px-2 py-1 font-mono-ui text-[9px] text-amber-100">{result.lang}</span>}
      </div>
    </div>
    <div className="p-3.5">
      <div data-testid={`text-title-${index}`} className="line-clamp-2 min-h-[36px] text-[13px] font-bold leading-[1.4] text-slate-100">{result.title}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span data-testid={`text-year-${index}`}>{result.year || (result.seasons?.join(' · ') ?? '')}</span>
        <span className="flex items-center gap-1 text-slate-500 transition group-hover:text-emerald-200">Détails <ChevronRight size={12} /></span>
      </div>
    </div>
  </button>;
}

function ResultGrid({ results, onSelect }: { results: ContentResult[]; onSelect: (result: ContentResult) => void }) {
  return <div data-testid="results-grid" className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
    {results.map((result, index) => <ResultCard key={`${result.title}-${index}`} result={result} index={index} onClick={() => onSelect(result)} />)}
  </div>;
}

type LinkWithRelease = ApiLink & {
  hoster?: string | null;
  release?: string | null;
  releaseName?: string | null;
  releaseSize?: string | null;
};

function LinkRow({ link, index }: { link: LinkWithRelease; index: number }) {
  const releaseLabel = link.release?.trim() ||
    [link.releaseName?.trim(), link.releaseSize?.trim() ? `(${link.releaseSize.trim()})` : '']
      .filter(Boolean).join(' ');
  return <div data-testid={`link-row-${index}`} className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-xl border border-white/[.055] bg-[#0e141a] px-3 py-2.5">
    {releaseLabel && <div data-testid={`link-release-${index}`} className="w-full basis-full break-words font-mono-ui text-[10px] leading-5 text-rose-300 [overflow-wrap:anywhere]">
      <span className="mr-2 text-[9px] uppercase tracking-widest text-rose-400/70">Release</span>{releaseLabel}
    </div>}
    <div className="flex w-full min-w-0 items-center gap-2.5 sm:flex-1">
      <span className={`shrink-0 rounded-md border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wide ${link.type === 'stream' ? 'border-sky-300/20 bg-sky-200/[.07] text-sky-200' : 'border-emerald-300/20 bg-emerald-200/[.07] text-emerald-200'}`}>{link.type === 'stream' ? 'Streaming' : 'DDL'}</span>
      {link.quality && <span data-testid={`link-quality-${index}`} className="shrink-0 rounded-md bg-white/[.06] px-2 py-1 font-mono-ui text-[9px] text-slate-300">{link.quality}</span>}
      {link.lang && <span className="shrink-0 rounded-md bg-white/[.06] px-2 py-1 font-mono-ui text-[9px] text-slate-400">{link.lang}</span>}
      <span data-testid={`link-host-${index}`} className="shrink-0 rounded-md bg-[#202a31] px-2 py-1 text-[10px] text-slate-300">{link.hoster || link.host || 'Source'}</span>
      <span className="min-w-0 flex-1 truncate font-mono-ui text-[10px] text-slate-600" title={link.url}>{link.size || link.url}</span>
      <a data-testid={`link-open-${index}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-300 px-3 py-2 text-[10px] font-bold text-[#091411] hover:bg-emerald-200">Ouvrir <ExternalLink size={11} /></a>
    </div>
  </div>;
}

function QualitySection({ quality, offset }: { quality: Quality; offset: number }) {
  const links = [...(quality.downloadLinks || []).map((item) => ({ ...item, type: item.type || 'download' })), ...(quality.streamLinks || []).map((item) => ({ ...item, type: 'stream' }))];
  if (!links.length) return null;
  return <section data-testid={`quality-section-${offset}`} className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#141b22]">
    <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[.06] bg-white/[.02] px-4 py-3.5">
      <span className="font-display text-sm font-bold text-slate-100">{quality.quality || 'Qualité non précisée'}</span>
      {quality.lang && <span className="rounded-md border border-amber-200/15 bg-amber-200/[.06] px-2 py-1 font-mono-ui text-[9px] text-amber-100">{quality.lang}</span>}
      {quality.size && <span className="ml-auto font-mono-ui text-[10px] text-slate-500">{quality.size}</span>}
    </div>
    <div className="space-y-2 p-3">{links.map((link, i) => <LinkRow key={`${link.url}-${i}`} link={link} index={offset * 20 + i} />)}</div>
  </section>;
}

function DetailPanel({ result, onBack }: { result: ContentResult; onBack: () => void }) {
  const urls = result.pageUrls.join(',');
  const detail = useGetContentDetail({ urls }, { query: { enabled: !!urls, queryKey: getGetContentDetailQueryKey({ urls }) } });
  const value = detail.data?.result;
  const poster = value?.poster || result.poster;
  const [posterError, setPosterError] = useState(false);
  const metadata = [
    { label: 'Origine', value: value?.origin, Icon: MapPin },
    { label: 'Réalisation', value: value?.director, Icon: UserRound },
    { label: 'Acteurs', value: value?.actors, Icon: Users },
    { label: 'Genres', value: value?.genres, Icon: Tag },
    { label: 'Durée', value: value?.duration, Icon: Clock3 },
    { label: 'Année', value: value?.year || result.year, Icon: Clock3 },
    { label: 'Note', value: value?.rating, Icon: Star },
  ].filter((field) => field.value);
  return <section data-testid="detail-view" className="animate-in">
    <button data-testid="detail-back" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-emerald-200"><ArrowLeft size={15} /> Retour aux résultats</button>
    {detail.isLoading ? <div data-testid="detail-loading" className="grid gap-6 md:grid-cols-[210px_1fr]">
      <div className="skeleton aspect-[2/3] rounded-2xl" /><div className="space-y-4"><div className="skeleton h-8 w-3/5 rounded" /><div className="skeleton h-4 w-2/5 rounded" /><div className="skeleton h-24 rounded-xl" /></div>
    </div> : detail.isError ? <div data-testid="detail-error" className="rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-5 text-sm text-rose-200">Impossible de charger les détails. <button data-testid="detail-retry" onClick={() => detail.refetch()} className="ml-2 underline">Réessayer</button></div> :
      <><div className="grid gap-6 md:grid-cols-[210px_1fr]">
        <div className="mx-auto aspect-[2/3] w-full max-w-[210px] overflow-hidden rounded-2xl border border-white/10 bg-[#141b22] md:mx-0">
          {poster && !posterError ? <img data-testid="detail-poster" src={posterSrc(poster)} onError={() => setPosterError(true)} alt={value?.title || result.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-600"><Film size={48} /></div>}
        </div>
        <div className="pt-1">
          <div className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.25em] text-emerald-300">Fiche catalogue</div>
          <h1 data-testid="detail-title" className="font-display text-3xl font-bold tracking-[-.04em] text-slate-100 sm:text-4xl">{value?.title || result.title}</h1>
          {value?.originalTitle && value.originalTitle !== value.title && <p data-testid="detail-original-title" className="mt-1 text-sm italic text-slate-500">{value.originalTitle}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {(value?.year || result.year) && <span className="rounded-lg border border-amber-200/15 bg-amber-200/[.06] px-2.5 py-1.5 font-mono-ui text-[10px] text-amber-100">{value?.year || result.year}</span>}
            {value?.rating && <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/15 bg-emerald-200/[.06] px-2.5 py-1.5 font-mono-ui text-[10px] text-emerald-100"><Star size={11} />{value.rating}</span>}
          </div>
          {metadata.length > 0 && <dl data-testid="detail-metadata" className="mt-5 grid gap-x-6 gap-y-3 border-y border-white/[.07] py-4 sm:grid-cols-2">
            {metadata.map(({ label, value: field, Icon }) => <div key={label} className="grid grid-cols-[108px_1fr] items-start gap-2 text-xs"><dt className="flex items-center gap-1.5 text-slate-600"><Icon size={12} />{label}</dt><dd className="text-slate-300">{field}</dd></div>)}
          </dl>}
          {value?.synopsis && <p data-testid="detail-synopsis" className="mt-5 max-w-3xl text-sm leading-7 text-slate-400">{value.synopsis}</p>}
        </div>
      </div>
      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between"><div><div className="font-mono-ui text-[9px] uppercase tracking-[.22em] text-emerald-300">Sources disponibles</div><h2 className="mt-1 font-display text-xl font-bold text-slate-100">Liens disponibles</h2></div></div>
        {value?.qualities?.length ? <div className="space-y-3">{value.qualities.map((quality, i) => <QualitySection key={`${quality.quality}-${i}`} quality={quality} offset={i} />)}</div> :
          <div data-testid="detail-empty-links" className="rounded-2xl border border-dashed border-white/10 py-12 text-center"><Film size={30} className="mx-auto mb-3 text-slate-700" /><p className="text-sm text-slate-500">Aucun lien trouvé pour ce contenu.</p></div>}
      </div></>}
  </section>;
}

function SourceModal({ open, close }: { open: boolean; close: () => void }) {
  const [adminKey, setAdminKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<SourceSettings | null>(null);
  const [testResults, setTestResults] = useState<SourceTestResponseResultsItem[] | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const request = useMemo(() => ({ headers: { 'X-Admin-Key': adminKey } }), [adminKey]);
  const settingsQuery = useGetSourceSettings({
    request,
    query: { enabled: open && unlocked, queryKey: getGetSourceSettingsQueryKey() },
  });
  const saveSettings = useSaveSourceSettings({ request });
  const testSources = useTestContentSources({ request });
  useEffect(() => { if (settingsQuery.data) setSettings(settingsQuery.data); }, [settingsQuery.data]);
  useEffect(() => {
    if (!open) {
      setAdminKey('');
      setUnlocked(false);
      setSettings(null);
      setTestResults(null);
      setNotice('');
    }
  }, [open]);

  if (!open) return null;
  const unlock = () => { if (!adminKey.trim()) return; setNotice(''); setUnlocked(true); };
  const save = async () => {
    if (!settings) return;
    setBusy('save'); setNotice('');
    try { await saveSettings.mutateAsync({ data: settings }); setNotice('Sources enregistrées.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(''); }
  };
  const test = async () => {
    if (!settings) return;
    setBusy('test'); setNotice('');
    try {
      await saveSettings.mutateAsync({ data: settings });
      const response = await testSources.mutateAsync();
      setTestResults(response.results);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Le test des sources a échoué.'); }
    finally { setBusy(''); }
  };
  const updateRelay = (index: number, field: keyof Relay, value: string) => setSettings((current) => current && ({ ...current, relays: current.relays.map((relay, i) => i === index ? { ...relay, [field]: value } : relay) }));
  return <div data-testid="sources-dialog" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="source-dialog-title" className="max-h-[92dvh] w-full max-w-[620px] overflow-y-auto rounded-3xl border border-white/10 bg-[#111920] p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><div className="font-mono-ui text-[9px] uppercase tracking-[.22em] text-emerald-300">Configuration</div><h2 id="source-dialog-title" className="mt-1 font-display text-2xl font-bold text-slate-100">Sources de récupération</h2><p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">Gérez les relais et la connexion directe utilisés pour interroger le catalogue.</p></div>
        <button data-testid="sources-close" onClick={close} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-white/[.06] hover:text-white"><X size={17} /></button>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {['zt_org.php', 'relay.php', 'relay.py', 'README.md'].map((file) => <a key={file} data-testid={`download-${file.replace('.', '-')}`} href={`/zt-api/api/relay/${file}`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.08] px-3 py-2 font-mono-ui text-[9px] text-slate-400 hover:border-emerald-200/20 hover:text-emerald-100"><ExternalLink size={11} />{file}</a>)}
      </div>
      {!unlocked ? <div className="mt-6 rounded-2xl border border-white/[.07] bg-[#0d141a] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300"><KeyRound size={14} className="text-amber-200" /> Accès administrateur requis</div>
        <div className="flex gap-2"><input data-testid="admin-key-input" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') unlock(); }} placeholder="Clé administrateur" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111920] px-3 font-mono-ui text-xs text-slate-100 outline-none focus:border-emerald-300/40" />
          <button data-testid="admin-unlock-btn" onClick={unlock} disabled={!adminKey.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#091411] disabled:opacity-40"><KeyRound size={13} />Déverrouiller</button></div>
      </div> : settingsQuery.isLoading ? <div data-testid="settings-loading" className="mt-6 space-y-3"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div> : settingsQuery.isError ? <div data-testid="settings-error" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-4 text-xs text-rose-200">{settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Chargement des paramètres impossible.'}<button data-testid="settings-retry" onClick={() => settingsQuery.refetch()} className="ml-2 underline">Réessayer</button></div> : settings && <div className="mt-6 space-y-5">
        <section><div className="mb-2 flex items-center justify-between"><h3 className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-slate-400">Relais prioritaires</h3><span className="text-[10px] text-slate-600">{settings.relays.length} configuré(s)</span></div>
          <div data-testid="relay-list" className="space-y-2">{settings.relays.map((relay, index) => <div key={index} className="flex gap-2">
            <input data-testid={`relay-url-input-${index}`} value={relay.url} onChange={(event) => updateRelay(index, 'url', event.target.value)} placeholder="https://adresse-du-relais" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0d141a] px-3 font-mono-ui text-[10px] text-slate-200 outline-none focus:border-emerald-300/40" />
            <input data-testid={`relay-key-input-${index}`} value={relay.key || ''} onChange={(event) => updateRelay(index, 'key', event.target.value)} placeholder="Clé relais" className="h-10 w-[120px] rounded-xl border border-white/10 bg-[#0d141a] px-3 font-mono-ui text-[10px] text-slate-200 outline-none focus:border-emerald-300/40" />
            <button data-testid={`relay-remove-btn-${index}`} aria-label={`Supprimer le relais ${index + 1}`} onClick={() => setSettings({ ...settings, relays: settings.relays.filter((_, i) => i !== index) })} className="rounded-xl border border-white/[.08] px-3 text-slate-500 hover:border-rose-300/20 hover:text-rose-200"><X size={14} /></button>
          </div>)}</div>
          <button data-testid="relay-add-btn" onClick={() => setSettings({ ...settings, relays: [...settings.relays, { url: '', key: '' }] })} className="mt-3 text-xs font-semibold text-emerald-200 hover:text-emerald-100">+ Ajouter un relais</button>
        </section>
        <section><label htmlFor="scraper-key" className="mb-2 block font-mono-ui text-[10px] uppercase tracking-[.16em] text-slate-400">Clé ScraperAPI</label>
          <input id="scraper-key" data-testid="scraperapi-key-input" value={settings.scraperapi_key} onChange={(event) => setSettings({ ...settings, scraperapi_key: event.target.value })} placeholder="Clé API facultative" className="h-10 w-full rounded-xl border border-white/10 bg-[#0d141a] px-3 font-mono-ui text-xs text-slate-200 outline-none focus:border-emerald-300/40" /></section>
        <label className="flex items-center justify-between rounded-xl border border-white/[.07] bg-[#0d141a] p-3 text-xs text-slate-300">Tenter aussi la connexion directe
          <button data-testid="direct-switch" role="switch" aria-checked={settings.direct} onClick={() => setSettings({ ...settings, direct: !settings.direct })} className={`relative h-6 w-11 rounded-full transition ${settings.direct ? 'bg-emerald-300' : 'bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[#111920] transition ${settings.direct ? 'left-6' : 'left-1'}`} /></button>
        </label>
        <div className="flex flex-wrap gap-2"><button data-testid="sources-save-btn" onClick={save} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-bold text-[#0b1714] disabled:opacity-50">{busy === 'save' ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}Enregistrer</button>
          <button data-testid="sources-test-btn" onClick={test} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-white/20 disabled:opacity-50">{busy === 'test' ? <LoaderCircle size={13} className="animate-spin" /> : <Activity size={13} />}Tester les sources</button>
        </div>
        {notice && <p data-testid="source-notice" className="text-xs text-amber-200">{notice}</p>}
        {testResults && <div data-testid="source-test-results" className="space-y-2">{testResults.map((result, index) => <div key={index} data-testid={`source-test-row-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-[#0d141a] px-3 py-2 text-[10px] text-slate-300"><span>{String(result.source || `Source ${index + 1}`)}</span><span className={result.ok ? 'text-emerald-200' : 'text-rose-200'}>{result.error ? String(result.error) : `HTTP ${String(result.http_code ?? '—')}`} · {String(result.ms ?? '—')} ms</span></div>)}</div>}
      </div>}
    </section>
  </div>;
}

function MainPage() {
  const [, navigate] = useLocation();
  const [activeType, setActiveType] = useState('movie');
  const [view, setView] = useState<'home' | 'results' | 'detail'>('home');
  const [searchText, setSearchText] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  const [selected, setSelected] = useState<ContentResult | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const categories = useGetContentCategories();
  const availableCategories = categories.data?.categories || [];
  const normalizedType = availableCategories.some((item) => item.type === activeType) ? activeType : (availableCategories[0]?.type || activeType);
  const activeCategory = availableCategories.find((item) => item.type === normalizedType);
  const latest = useGetLatestContent({ type: normalizedType, limit: 24 }, { query: { queryKey: getGetLatestContentQueryKey({ type: normalizedType, limit: 24 }), enabled: view === 'home' } });
  const search = useSearchContent({ q: searchText || ' ', type: normalizedType }, { query: { queryKey: [...getSearchContentQueryKey({ q: searchText || ' ', type: normalizedType }), searchCount], enabled: view === 'results' && !!searchText } });
  const status = useGetSourceStatus();

  const runSearch = (query: string) => {
    if (/^\d{1,8}$/.test(query.trim())) {
      if (normalizedType === 'movie') { navigate(`/liens/film/${query.trim()}`); return; }
      if (normalizedType === 'tv') { navigate(`/liens/serie/${query.trim()}`); return; }
    }
    setSearchText(query);
    setSearchCount((count) => count + 1);
    setSelected(null);
    setView('results');
  };
  const changeCategory = (type: string) => { setActiveType(type); setSelected(null); setView((current) => current === 'results' && searchText ? 'results' : 'home'); };
  const selectResult = (result: ContentResult) => { setSelected(result); setView('detail'); };
  const visibleResults = view === 'home' ? latest.data?.results : search.data?.results;
  const loading = view === 'home' ? latest.isLoading : search.isLoading;
  const queryError = view === 'home' ? latest.isError : search.isError;

  return <div className="min-h-[100dvh]">
    <Header category={activeCategory?.label} onOpenSources={() => setSourcesOpen(true)} onHome={() => { setView('home'); setSelected(null); }} />
    <div className="mx-auto max-w-[1440px] px-4 sm:px-7">
      <section className="relative overflow-hidden pb-1 pt-8 sm:pt-12">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full border border-emerald-200/[.06] sm:right-10 sm:top-1"><div className="m-7 h-56 w-56 rounded-full border border-emerald-200/[.05]"><div className="m-7 h-42 w-42 rounded-full border border-emerald-200/[.04]" /></div></div>
        <div className="relative grid items-end gap-7 lg:grid-cols-[1fr_minmax(400px,550px)]">
          <div className="max-w-2xl">
            <div data-testid="text-index-label" className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[.055] px-3 py-1.5 font-mono-ui text-[9px] uppercase tracking-[.2em] text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Votre index francophone</div>
            <h1 className="font-display text-[clamp(2.4rem,6vw,4.7rem)] font-bold leading-[.98] tracking-[-.065em] text-[#f1f3ee]">Le bon titre.<br /><span className="text-emerald-300">Toutes les sources.</span></h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">Explorez les dernières additions ou retrouvez un film, une série et bien plus depuis un seul endroit.</p>
          </div>
          <div className="relative z-10 mb-1"><SearchBox onSubmit={runSearch} busy={view === 'results' && search.isFetching} />
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-600"><span className="font-mono-ui uppercase tracking-widest">Astuce</span><span className="h-px w-5 bg-slate-700" />Entrez un ID TMDB pour ouvrir ses liens</div>
          </div>
        </div>
        <div className="mt-8">
          {categories.isLoading ? <div data-testid="categories-loading" className="flex gap-2 border-t border-white/[.06] py-3">{Array.from({ length: 7 }, (_, i) => <div key={i} className="skeleton h-9 w-24 rounded-xl" />)}</div> : availableCategories.length ? <CategoryRail categories={availableCategories} active={normalizedType} onChange={changeCategory} /> :
            <div data-testid="categories-error" className="border-t border-white/[.06] py-3 text-xs text-slate-500">Catégories indisponibles. <button data-testid="categories-retry" onClick={() => categories.refetch()} className="text-emerald-200 underline">Réessayer</button></div>}
        </div>
      </section>
      <main className="pb-16 pt-5">
        {view === 'detail' && selected ? <DetailPanel result={selected} onBack={() => setView('results')} /> :
          <section data-testid={view === 'home' ? 'home-latest' : 'search-results'} className="animate-in">
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="mr-auto">
                <div className="mb-1 flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.2em] text-slate-600">{view === 'home' ? <Clock3 size={12} className="text-emerald-300" /> : <Search size={12} className="text-emerald-300" />}{view === 'home' ? 'À découvrir maintenant' : 'Recherche catalogue'}</div>
                <h2 data-testid="section-title" className="font-display text-xl font-bold tracking-[-.03em] text-slate-100">{view === 'home' ? 'Dernières additions' : <>Résultats pour « {searchText} »</>}</h2>
              </div>
              <span data-testid="active-category-label" className="rounded-lg border border-white/[.08] bg-white/[.03] px-2.5 py-1.5 text-[10px] text-slate-400">{activeCategory?.label || normalizedType}</span>
              {view === 'results' && search.data?.total !== undefined && <span data-testid="result-count" className="font-mono-ui text-[10px] text-slate-600">{search.data.total} résultat(s)</span>}
            </div>
            {status.data && <div data-testid="source-status" className="mb-4 flex flex-wrap items-center gap-2 text-[9px] text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${status.data.direct || status.data.scraperapi || status.data.relays?.length ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              <span>{status.data.direct || status.data.scraperapi || status.data.relays?.length ? 'Sources en ligne' : 'Sources à configurer'}</span>
              {status.data.relays?.map((relay, i) => <span key={`${relay.url}-${i}`} data-testid={`status-relay-${i}`} className="rounded border border-white/[.06] px-2 py-0.5">{relay.url}</span>)}
              {status.data.scraperapi && <span data-testid="status-scraperapi" className="rounded border border-white/[.06] px-2 py-0.5">ScraperAPI</span>}
            </div>}
            {queryError ? <div data-testid="results-error" className="rounded-2xl border border-rose-200/15 bg-rose-200/[.04] p-5 text-sm text-rose-200">La connexion au catalogue a échoué. <button data-testid="results-retry" onClick={() => view === 'home' ? latest.refetch() : search.refetch()} className="ml-2 underline">Réessayer</button></div> :
              loading ? <LoadingCards /> :
                visibleResults?.length ? <ResultGrid results={visibleResults} onSelect={selectResult} /> :
                  view === 'results' && search.data?.blocked ? <div data-testid="blocked-banner" className="rounded-2xl border border-amber-200/15 bg-amber-200/[.05] p-5"><div className="flex gap-3"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-200" /><div><h3 className="text-sm font-bold text-amber-100">La source a bloqué cette recherche</h3><p className="mt-1 text-xs text-slate-400">Configurez un relais dans les paramètres pour rétablir l’accès.</p>{search.data.errors?.map((error, i) => <p data-testid={`blocked-error-${i}`} key={i} className="mt-2 font-mono-ui text-[10px] text-slate-500">{error}</p>)}<button data-testid="blocked-configure-btn" onClick={() => setSourcesOpen(true)} className="mt-4 rounded-lg bg-amber-200 px-3 py-2 text-xs font-bold text-[#18140a]">Configurer les sources</button></div></div></div> :
                    <div data-testid={view === 'results' ? 'no-results' : 'empty-state'} className="soft-grid flex min-h-[270px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/[.09] px-5 text-center">
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-emerald-200/10 bg-emerald-200/[.05] text-emerald-200"><Film size={20} /></div>
                      <h3 className="font-display text-lg font-bold text-slate-200">{view === 'results' ? 'Aucun résultat trouvé' : 'Le catalogue est calme pour le moment'}</h3>
                      <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{view === 'results' ? `Aucun contenu correspondant à « ${searchText} » dans ${activeCategory?.label || normalizedType}.` : 'Lancez une recherche ou essayez une autre catégorie pour parcourir le catalogue.'}</p>
                    </div>}
          </section>}
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.06] py-5 text-[9px] text-slate-700"><span>ZT Search <span className="mx-1.5 text-slate-800">/</span> Index de recherche francophone</span><span className="font-mono-ui">CATALOGUE · {activeCategory?.label || normalizedType}</span></footer>
    </div>
    <SourceModal open={sourcesOpen} close={() => setSourcesOpen(false)} />
  </div>;
}

function LookupPage({ mediaType }: { mediaType: 'film' | 'serie' }) {
  const params = useParams<{ tmdbId: string }>();
  const [, navigate] = useLocation();
  const [titleInput, setTitleInput] = useState('');
  const [copied, setCopied] = useState(false);
  const tmdbId = Number(params.tmdbId || 0);
  const lookup = useGetContentLinks({ media_type: mediaType, tmdb_id: tmdbId, ...(titleInput.trim() && { title: titleInput.trim() }) }, { query: { enabled: tmdbId > 0, queryKey: getGetContentLinksQueryKey({ media_type: mediaType, tmdb_id: tmdbId, ...(titleInput.trim() && { title: titleInput.trim() }) }) } });
  const data = lookup.data;
  const [posterError, setPosterError] = useState(false);
  const rawJson = data ? JSON.stringify(data, null, 2) : '';
  const needsTitle = data?.error?.includes('TMDB_API_KEY');
  const submitTitle = (event: FormEvent) => { event.preventDefault(); if (titleInput.trim()) lookup.refetch(); };
  const copyJson = async () => {
    try { await navigator.clipboard.writeText(rawJson); setCopied(true); window.setTimeout(() => setCopied(false), 1700); }
    catch { setCopied(false); }
  };
  return <div className="min-h-[100dvh]">
    <Header isLookup onHome={() => navigate('/')} />
    <main className="mx-auto max-w-[1150px] px-4 py-7 sm:px-7 sm:py-10">
      <button data-testid="lookup-back" onClick={() => navigate('/')} className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-emerald-200"><ArrowLeft size={14} /> Retour au catalogue</button>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-white/[.07] pb-5">
        <div><div className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-emerald-300">Résolution de liens</div><h1 data-testid="lookup-heading" className="mt-1 font-display text-3xl font-bold tracking-[-.05em] text-slate-100">{mediaType === 'film' ? 'Film' : 'Série'} <span className="text-emerald-300">TMDB</span></h1></div>
        <span data-testid="lookup-id" className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 font-mono-ui text-[10px] text-slate-400">ID · {params.tmdbId}</span>
      </div>
      {lookup.isLoading ? <div data-testid="links-loading" className="space-y-4"><div className="skeleton h-28 rounded-2xl" /><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div> :
        lookup.isError ? <div data-testid="links-error" className="rounded-2xl border border-rose-200/15 bg-rose-200/[.04] p-5 text-sm text-rose-200">{lookup.error instanceof Error ? lookup.error.message : 'Recherche impossible.'}<button data-testid="links-retry" onClick={() => lookup.refetch()} className="ml-2 underline">Réessayer</button></div> :
          needsTitle ? <div className="max-w-2xl rounded-2xl border border-amber-200/15 bg-[#141b22] p-5 sm:p-7">
            <div className="mb-3 flex items-center gap-2 text-amber-100"><KeyRound size={16} /><h2 className="font-display text-lg font-bold">Résolution automatique indisponible</h2></div>
            <p data-testid="lookup-key-message" className="max-w-xl text-xs leading-6 text-slate-400">{data?.error}. Vous pouvez tout de même lancer une recherche manuelle avec le titre.</p>
            <form data-testid="lookup-title-form" onSubmit={submitTitle} className="mt-5 flex gap-2"><input data-testid="lookup-title-input" value={titleInput} onChange={(event) => setTitleInput(event.target.value)} placeholder="Titre du film ou de la série" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0d141a] px-3 text-xs text-slate-100 outline-none focus:border-emerald-300/40" /><button data-testid="lookup-title-submit" type="submit" disabled={!titleInput.trim() || lookup.isFetching} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#091411] disabled:opacity-40">{lookup.isFetching ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}Chercher</button></form>
          </div> : data?.error ? <div data-testid="links-api-error" className="rounded-2xl border border-rose-200/15 bg-rose-200/[.04] p-5 text-sm text-rose-200">{data.error}</div> :
            <><section data-testid="lookup-content" className="mb-7 flex flex-col gap-5 rounded-2xl border border-white/[.07] bg-[#141b22] p-4 sm:flex-row sm:items-center sm:p-5">
              {data?.poster && !posterError && <img data-testid="lookup-poster" src={posterSrc(data.poster)} alt={data.title || 'Affiche'} onError={() => setPosterError(true)} className="h-36 w-24 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1"><div className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-slate-600">Contenu identifié</div><h2 data-testid="lookup-title" className="mt-1 font-display text-2xl font-bold text-slate-100">{data?.title || `ID TMDB ${params.tmdbId}`}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2"><span data-testid="lookup-count" className="rounded-lg border border-emerald-200/15 bg-emerald-200/[.06] px-2.5 py-1.5 text-[10px] text-emerald-100">{data?.total ?? data?.links?.length ?? 0} lien(s) trouvé(s)</span>{data?.result_url && <a data-testid="lookup-source-link" href={data.result_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-400 hover:text-emerald-200">Page source <ExternalLink size={11} /></a>}</div>
              </div></section>
              <section className="mb-8"><div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-slate-100">Liens</h3><span className="font-mono-ui text-[9px] uppercase tracking-widest text-slate-600">{data?.links?.length || 0} résultat(s)</span></div>
                {data?.links?.length ? <div className="space-y-2">{data.links.map((link, i) => <LinkRow key={`${link.url}-${i}`} link={link} index={i} />)}</div> : <div data-testid="lookup-empty" className="rounded-2xl border border-dashed border-white/10 py-12 text-center"><Link2 size={24} className="mx-auto mb-2 text-slate-700" /><p className="text-xs text-slate-500">Aucun lien trouvé pour ce contenu.</p></div>}
              </section>
              <section><div className="mb-3 flex items-center justify-between"><h3 className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-slate-400">Réponse JSON</h3><button data-testid="copy-json-btn" onClick={copyJson} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-400 transition hover:border-emerald-200/20 hover:text-emerald-100">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copié' : 'Copier'}</button></div><pre data-testid="links-json" className="max-h-[440px] overflow-auto rounded-2xl border border-white/[.07] bg-[#0b1015] p-4 font-mono-ui text-[10px] leading-5 text-slate-400">{rawJson}</pre></section>
            </>}
    </main>
  </div>;
}

function Router() {
  return <Switch>
    <Route path="/" component={MainPage} />
    <Route path="/liens/film/:tmdbId"><LookupPage mediaType="film" /></Route>
    <Route path="/liens/serie/:tmdbId"><LookupPage mediaType="serie" /></Route>
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><Router /></QueryClientProvider>;
}

export default App;
