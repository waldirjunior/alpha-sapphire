import type { GateVerdict } from './gates';
import type { ProbeMetrics } from './probeReport';

export interface GalleryEntry {
  scenario: string;
  image: string;
  referenceImage?: string;
  metrics: ProbeMetrics;
  verdicts: readonly GateVerdict[];
}

const OUTCOME_LABEL: Record<GateVerdict['outcome'], string> = {
  pass: 'ok',
  'known-defect': 'defeito conhecido',
  regression: 'REGRESSÃO',
  fixed: 'CORRIGIDO — atualizar registro',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
}

function verdictItem(verdict: GateVerdict): string {
  const pendencia = verdict.pendencia ? ` (${escapeHtml(verdict.pendencia)})` : '';
  return `<li class="${verdict.outcome}">${verdict.gate}: ${OUTCOME_LABEL[verdict.outcome]}${pendencia}</li>`;
}

function entryMedia(entry: GalleryEntry): string {
  const scenario = escapeHtml(entry.scenario);
  if (!entry.referenceImage) {
    return `<img src="${escapeHtml(entry.image)}" alt="${scenario}" loading="lazy">`;
  }
  return `<div class="compare"><img src="${escapeHtml(entry.image)}" alt="${scenario} (port)" loading="lazy"><img src="${escapeHtml(entry.referenceImage)}" alt="${scenario} (original)" loading="lazy"></div>`;
}

export type GalleryPhase = 'avatars' | 'inicio' | 'oeste' | 'centro' | 'leste';

const PHASES: readonly { id: GalleryPhase | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'avatars', label: 'Avatares' },
  { id: 'inicio', label: 'Início (Littleroot / Birch)' },
  { id: 'oeste', label: 'Oeste (Petalburg → Verdanturf)' },
  { id: 'centro', label: 'Centro & Norte (Mauville → Lavaridge)' },
  { id: 'leste', label: 'Leste & Multicamada (Route 119 / Pisos)' },
];

export function scenarioPhase(scenario: string): GalleryPhase {
  if (scenario.startsWith('avatar-')) return 'avatars';
  if (scenario.endsWith('-upper-floor') || scenario.endsWith('-entry') || /^z00(18|46|47)-/.test(scenario)) {
    return 'leste';
  }
  if (/^z0(006|007|227)-/.test(scenario)) return 'inicio';
  if (/^z00(11|13|16|75|82)-/.test(scenario)) return 'oeste';
  return 'centro';
}

function entryCard(entry: GalleryEntry): string {
  const { voidRatio, avatarVisibility, groundGap } = entry.metrics;
  const phase = scenarioPhase(entry.scenario);
  return `<figure data-phase="${phase}">${entryMedia(entry)}
<figcaption><strong>${escapeHtml(entry.scenario)}</strong>
<span>avatar visível ${(avatarVisibility * 100).toFixed(0)}% · vazio ${(voidRatio * 100).toFixed(0)}% · folga pé-chão ${groundGap.toFixed(3)}</span>
<ul>${entry.verdicts.map(verdictItem).join('')}</ul></figcaption></figure>`;
}

export interface GalleryScore { accepted: number; total: number }

/** Cenário aceito = todos os portões passam sem defeito conhecido registrado. */
export function galleryScore(entries: readonly GalleryEntry[]): GalleryScore {
  const accepted = entries.filter((entry) => entry.verdicts.every((verdict) => verdict.outcome === 'pass')).length;
  return { accepted, total: entries.length };
}

function tabBar(entries: readonly GalleryEntry[]): string {
  const counts = new Map<string, number>([['all', entries.length]]);
  for (const entry of entries) {
    const phase = scenarioPhase(entry.scenario);
    counts.set(phase, (counts.get(phase) ?? 0) + 1);
  }
  const buttons = PHASES.map(({ id, label }) => {
    const active = id === 'all' ? ' aria-selected="true"' : ' aria-selected="false"';
    return `<button type="button" role="tab" data-phase="${id}"${active}>${label} (${counts.get(id) ?? 0})</button>`;
  }).join('');
  return `<nav class="tabs" role="tablist">${buttons}</nav>`;
}

export function renderGallery(entries: readonly GalleryEntry[]): string {
  const score = galleryScore(entries);
  const cards = [...entries].sort((a, b) => a.scenario.localeCompare(b.scenario)).map(entryCard).join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Galeria visual — alpha-sapphire</title>
<style>body{font:14px system-ui;margin:16px;background:#0f172a;color:#e2e8f0}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 16px}.tabs button{background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:999px;padding:6px 14px;cursor:pointer;font:inherit}
.tabs button[aria-selected="true"]{background:#38bdf8;color:#0f172a;border-color:#38bdf8;font-weight:700}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:16px}
figure{margin:0;background:#1e293b;border-radius:8px;overflow:hidden}figure[hidden]{display:none}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#0f172a}
img{display:block;width:100%}figcaption{padding:10px;display:grid;gap:4px}
ul{margin:0;padding-left:18px}.pass{color:#86efac}.known-defect{color:#fcd34d}.regression,.fixed{color:#fca5a5;font-weight:700}</style></head>
<body><h1>Cenários aceitos: ${score.accepted}/${score.total}</h1>${tabBar(entries)}<main>
${cards}
</main><script>
document.querySelectorAll('.tabs button').forEach((btn)=>btn.addEventListener('click',()=>{
  const phase=btn.dataset.phase;
  document.querySelectorAll('.tabs button').forEach((b)=>b.setAttribute('aria-selected',String(b===btn)));
  document.querySelectorAll('main figure').forEach((f)=>{f.hidden=phase!=='all'&&f.dataset.phase!==phase;});
}));
</script></body></html>`;
}
