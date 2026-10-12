import React, { useState } from 'react';
import { toast } from 'sonner';
import { Download, KeyRound, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import RelayList from '@/components/RelayList';
import SourceTestResults from '@/components/SourceTestResults';
import { getSettings, saveSettings, testSources, relayFileUrl } from '@/api/zt';

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-[#263042] text-[#f8fafc] text-xs font-mono placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]';
const btnCls = 'px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5';
const errMsg = (e) => e?.response?.data?.detail || e.message;

export default function SourcesDialog({ open, onOpenChange }) {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('zt_admin_key') || '');
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState('');
  const [testResults, setTestResults] = useState(null);

  const run = async (name, fn) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  const unlock = () => run('load', async () => {
    const s = await getSettings(adminKey);
    localStorage.setItem('zt_admin_key', adminKey);
    setSettings(s);
  });

  const save = () => run('save', async () => {
    await saveSettings(adminKey, settings);
    toast.success('Sources enregistrées');
  });

  const test = () => run('test', async () => {
    await saveSettings(adminKey, settings);
    setTestResults((await testSources(adminKey)).results);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sources-dialog" className="bg-[#11151f] border-[#263042] text-[#f8fafc] max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sources de récupération</DialogTitle>
          <DialogDescription className="text-[#64748b] text-xs">
            Le .org bloque les IP de datacenter. Ajoute un relais tournant sur une IP résidentielle (ton PC + tunnel gratuit) ou une clé ScraperAPI.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {['zt_org.php', 'relay.php', 'relay.py', 'README.md'].map((f) => (
            <a key={f} href={relayFileUrl(f)} data-testid={`download-${f.replace('.', '-')}`}
               className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#263042] text-[#cbd5e1] hover:border-[#3b82f6] transition-colors">
              <Download size={12} /> {f}
            </a>
          ))}
        </div>

        {!settings ? (
          <div className="flex gap-2">
            <input data-testid="admin-key-input" type="password" className={inputCls} placeholder="Clé admin"
                   value={adminKey} onChange={(e) => setAdminKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} />
            <button data-testid="admin-unlock-btn" onClick={unlock} disabled={!adminKey || busy}
                    className={`${btnCls} bg-[#3b82f6] text-white hover:bg-[#2563eb]`}>
              {busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Déverrouiller
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">Relais (prioritaires)</h3>
              <RelayList relays={settings.relays} onChange={(relays) => setSettings({ ...settings, relays })} />
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">Clé ScraperAPI (optionnel, 1000 req/mois gratuites)</h3>
              <input data-testid="scraperapi-key-input" className={inputCls} placeholder="clé API scraperapi.com"
                     value={settings.scraperapi_key} onChange={(e) => setSettings({ ...settings, scraperapi_key: e.target.value })} />
            </section>
            <label className="flex items-center justify-between text-xs text-[#cbd5e1]">
              Tenter aussi la connexion directe
              <Switch data-testid="direct-switch" checked={settings.direct} onCheckedChange={(direct) => setSettings({ ...settings, direct })} />
            </label>
            <div className="flex gap-2">
              <button data-testid="sources-save-btn" onClick={save} disabled={!!busy} className={`${btnCls} bg-[#3b82f6] text-white hover:bg-[#2563eb]`}>
                {busy === 'save' && <Loader2 size={14} className="animate-spin" />} Enregistrer
              </button>
              <button data-testid="sources-test-btn" onClick={test} disabled={!!busy} className={`${btnCls} border border-[#263042] text-[#cbd5e1] hover:border-[#3b82f6]`}>
                {busy === 'test' && <Loader2 size={14} className="animate-spin" />} Tester sur le .org
              </button>
            </div>
            <SourceTestResults results={testResults} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
