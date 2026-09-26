// Baut die Daten für /tabelle, /gegner und /regel aus den Kompendien des Foundry-Systems.
// Aufruf: npm i --no-save classic-level@1 && node scripts/daten.mjs <Pfad zu odin-foundry>
// Ergebnis: src/daten/de.json und src/daten/en.json (werden mit dem Worker ausgeliefert).
import { ClassicLevel } from 'classic-level';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const quelle = process.argv[2] || '../odin-foundry';
const ziel = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'daten');

async function lies(pack) {
  // LevelDB kann nur geöffnet werden, wenn sie beschreibbar ist: deshalb eine Kopie
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odin-'));
  fs.cpSync(path.join(quelle, 'packs', pack), tmp, { recursive: true });
  const db = new ClassicLevel(tmp, { valueEncoding: 'json' });
  const alle = {};
  for await (const [k, v] of db.iterator()) alle[k] = v;
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const nach = (art) => Object.entries(alle).filter(([k]) => k.startsWith(`!${art}!`)).map(([, v]) => v);
  return nach;
}

// HTML aus Foundry in Discord-Markdown
export function md(html) {
  let s = String(html || '');
  s = s.replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, '$1');
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, z) => {
    const zellen = [...z.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    return '\n' + zellen.filter(Boolean).join(' · ');
  });
  s = s.replace(/<\/?(strong|b)>/gi, '**').replace(/<\/?(em|i)>/gi, '*');
  s = s.replace(/<h[1-6][^>]*>/gi, '\n\n**').replace(/<\/h[1-6]>/gi, '**\n');
  s = s.replace(/<li[^>]*>/gi, '\n• ').replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>|<\/div>|<\/ul>|<\/ol>|<\/table>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/\*\*\s*\*\*/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
const ersteZeile = (html) => md((String(html || '').match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1]);

async function baue(lang) {
  const x = lang === 'en' ? '-en' : '';
  const daten = { tabellen: [], gegner: [], regeln: [] };

  // Würfeltabellen
  const t = await lies('odin-tabellen' + x);
  const ordner = Object.fromEntries(t('folders').map((f) => [f._id, f.name]));
  const ergebnisse = Object.fromEntries(t('tables.results').map((r) => [r._id, r]));
  for (const tab of t('tables')) {
    const f = String(tab.formula || '1d6');
    const art = /Zehner|tens/i.test(f) ? 'w66' : /floor/.test(f) ? 'w12' : /^1d6$/.test(f.trim()) ? 'w6' : null;
    if (!art) { console.warn('unbekannte Formel', tab.name, f); continue; }
    const zeilen = (tab.results || []).map((id) => ergebnisse[id]).filter(Boolean)
      .map((r) => [r.range[0], r.range[1], md(r.description || r.text || r.name)])
      .sort((a, b) => a[0] - b[0]);
    const quelleTxt = (String(tab.description || '').match(/<p><i>([\s\S]*?)<\/i><\/p>\s*$/) || [, ''])[1];
    daten.tabellen.push({ n: tab.name, o: ordner[tab.folder] || '', a: art, k: ersteZeile(tab.description), q: md(quelleTxt), z: zeilen });
  }
  daten.tabellen.sort((a, b) => a.n.localeCompare(b.n, lang) || a.o.localeCompare(b.o, lang));

  // Gegner (Bedrohungsatlas)
  // Stufe und Ursprung stehen in den Packs auf Deutsch; für EN über die Sprachdateien des Systems übersetzen
  const uebersetze = (() => {
    if (lang !== 'en') return (w) => w;
    try {
      const de = JSON.parse(fs.readFileSync(path.join(quelle, 'lang', 'de.json'), 'utf8'));
      const en = JSON.parse(fs.readFileSync(path.join(quelle, 'lang', 'en.json'), 'utf8'));
      const karte = {};
      for (const gruppe of ['Stufen', 'Urspruenge']) {
        const d = de?.ODIN?.Gegner?.[gruppe] || {}, e = en?.ODIN?.Gegner?.[gruppe] || {};
        for (const k of Object.keys(d)) if (e[k]) karte[d[k]] = e[k];
      }
      return (w) => karte[w] || w;
    } catch { return (w) => w; }
  })();
  const g = await lies('odin-gegner' + x);
  const gOrdner = Object.fromEntries(g('folders').map((f) => [f._id, f.name]));
  for (const a of g('actors')) {
    const s = a.system || {};
    daten.gegner.push({
      n: a.name, o: gOrdner[a.folder] || '', st: uebersetze(s.stufe || ''), u: uebersetze(s.ursprung || ''),
      g: s.grauen ?? 0, ak: s.aktionen ?? 1, i: s.initiative ?? 0, v: s.verteidigung ?? 0, r: s.ruestung ?? 0,
      lp: (s.lp && s.lp.max) || 0,
      p: (s.pools || []).map((p) => ({ n: p.name, w: p.weiss || 0, b: p.bunt || 0, s: p.schaden || 0, d: p.durchschlag || 0, x: p.notiz || '' })),
      t: md(s.beschreibung), b: md(s.besonderheit),
    });
  }
  daten.gegner.sort((a, b) => a.n.localeCompare(b.n, lang) || a.o.localeCompare(b.o, lang));

  // Regeln
  const r = await lies('odin-regeln' + x);
  const seiten = Object.fromEntries(r('journal.pages').map((p) => [p._id, p]));
  for (const j of r('journal').sort((a, b) => a.name.localeCompare(b.name))) {
    const kapitel = j.name.replace(/^(Regeln|Rules)\s+\d+:\s*/, '');
    for (const id of j.pages || []) {
      const p = seiten[id];
      if (!p || p.type !== 'text') continue;
      daten.regeln.push({ k: kapitel, n: p.name, t: md(p.text && p.text.content) });
    }
  }
  fs.mkdirSync(ziel, { recursive: true });
  fs.writeFileSync(path.join(ziel, `${lang}.json`), JSON.stringify(daten));
  console.log(lang, 'Tabellen', daten.tabellen.length, 'Gegner', daten.gegner.length, 'Regelseiten', daten.regeln.length,
    Math.round(fs.statSync(path.join(ziel, `${lang}.json`)).size / 1024) + ' KB');
}

if (process.argv[1] && process.argv[1].endsWith('daten.mjs')) {
  await baue('de');
  await baue('en');
}
