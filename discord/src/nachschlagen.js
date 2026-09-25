// /tabelle, /gegner und /regel: Daten aus den Kompendien des Foundry-Systems (scripts/daten.mjs baut src/daten/*.json)
import de from './daten/de.json';
import en from './daten/en.json';
import { w6 } from './regeln.js';

const DATEN = { de, en };
const FARBE = 0xbe4e3a;
const LINK = { de: 'https://odin-rpg.pages.dev/regeln', en: 'https://odin-rpg.pages.dev/en/rules' };

export const T = {
  de: {
    nochmal: 'Nochmal', wurf: 'Wurf', zeile: 'Zeile', nichts: 'Nichts gefunden. Tipp einen Teil des Namens ein und wähle aus der Liste.',
    stufe: 'Stufe', ursprung: 'Ursprung', grauen: 'Grauen', aktionen: 'Aktionen', ini: 'Initiative',
    vrl: 'Verteidigung / Rüstung / LP', angriffe: 'Angriffe', schaden: 'Schaden', durchschlag: 'Durchschlag',
    verdeckt: 'Nur du siehst diese Karte. Mit „zeigen: True“ sehen sie alle.', mehr: 'Weiterlesen', gekuerzt: '… (gekürzt)',
  },
  en: {
    nochmal: 'Roll again', wurf: 'Roll', zeile: 'Row', nichts: 'Nothing found. Type part of the name and pick from the list.',
    stufe: 'Tier', ursprung: 'Origin', grauen: 'Horror', aktionen: 'Actions', ini: 'Initiative',
    vrl: 'Defence / Armour / HP', angriffe: 'Attacks', schaden: 'damage', durchschlag: 'penetration',
    verdeckt: 'Only you can see this card. Use “show: True” to share it.', mehr: 'Read more', gekuerzt: '… (shortened)',
  },
};

const kurz = (s, n, lang = 'de') => (s.length <= n ? s : s.slice(0, n - 20).replace(/\s+\S*$/, '') + T[lang].gekuerzt);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

// Autovervollständigung: bis zu 25 Treffer, Anfang des Namens zuerst
function suche(liste, text, beschriftung) {
  const q = norm(text || '').trim();
  const treffer = [];
  liste.forEach((e, i) => {
    const name = norm(e.n), ort = norm(e.o || e.k || '');
    let rang = -1;
    if (!q) rang = 2;
    else if (name.startsWith(q)) rang = 0;
    else if (name.includes(q)) rang = 1;
    else if (ort.includes(q)) rang = 2;
    if (rang >= 0) treffer.push([rang, i]);
  });
  treffer.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return treffer.slice(0, 25).map(([, i]) => ({ name: beschriftung(liste[i]).slice(0, 100), value: String(i) }));
}

function doppelt(liste) {
  const zahl = {};
  for (const e of liste) zahl[e.n] = (zahl[e.n] || 0) + 1;
  return (e) => (zahl[e.n] > 1 ? `${e.n} · ${e.o || e.k}` : e.n);
}

export function vorschlaege(was, text, lang) {
  const d = DATEN[lang];
  if (was === 'tabelle') return suche(d.tabellen, text, doppelt(d.tabellen));
  if (was === 'gegner') return suche(d.gegner, text, doppelt(d.gegner));
  if (was === 'regel') return suche(d.regeln, text, (e) => (e.n === e.k ? e.n : `${e.n} · ${e.k}`));
  return [];
}

// Eintrag über Index (aus der Liste) oder über den eingetippten Namen finden
function finde(liste, wert) {
  const n = Number(wert);
  if (/^\d+$/.test(String(wert)) && liste[n]) return [n, liste[n]];
  const q = norm(wert);
  let i = liste.findIndex((e) => norm(e.n) === q);
  if (i < 0) i = liste.findIndex((e) => norm(e.n).includes(q));
  return i < 0 ? [-1, null] : [i, liste[i]];
}

const nichts = (lang) => ({ type: 4, data: { content: T[lang].nichts, flags: 64 } });

// ---------- Tabellen ----------
function wirf(art) {
  if (art === 'w66') { const a = w6(), b = w6(); return { wert: a * 10 + b, wuerfel: [a, b] }; }
  if (art === 'w12') { const a = w6(), b = w6(); return { wert: a + (b >= 4 ? 6 : 0), wuerfel: [a, b] }; }
  const a = w6(); return { wert: a, wuerfel: [a] };
}

const fett = (t) => (t.includes('**') ? t : `**${t}**`);

export function tabelle(wert, lang, emo, verdeckt = false) {
  const liste = DATEN[lang].tabellen;
  const [i, t] = finde(liste, wert);
  if (!t) return nichts(lang);
  const { wert: z, wuerfel } = wirf(t.a);
  const zeile = t.z.find(([lo, hi]) => z >= lo && z <= hi);
  const w = wuerfel.map((v) => (emo && emo[`ow${v}h`] ? `<:ow${v}h:${emo[`ow${v}h`]}>` : `\`${v}\``)).join(' ');
  const wieviel = t.a === 'w6' ? '' : t.a === 'w66' ? ` → ${z}` : ` → ${T[lang].zeile} ${z}`;
  return {
    type: 4,
    data: {
      flags: verdeckt ? 64 : 0,
      embeds: [{
        color: FARBE, title: t.n,
        description: `${w}${wieviel}\n\n${fett(zeile ? zeile[2] : '?')}`.slice(0, 4000),
        footer: { text: [t.k, t.q].filter(Boolean).join(' · ').slice(0, 200) },
      }],
      components: [{ type: 1, components: [{ type: 2, style: 2, label: T[lang].nochmal, custom_id: `t|${lang}|${i}|${verdeckt ? 1 : 0}` }] }],
    },
  };
}

// ---------- Gegner ----------
export function gegner(wert, lang, zeigen) {
  const liste = DATEN[lang].gegner;
  const [i, g] = finde(liste, wert);
  if (!g) return nichts(lang);
  const L = T[lang];
  const kopf = [g.st && `**${L.stufe}:** ${g.st}`, g.u && `**${L.ursprung}:** ${g.u}`].filter(Boolean).join('  ·  ');
  // Die Beschreibung beginnt oft mit einer kursiven Zeile „Stufe · Ursprung“: die steht schon im Kopf
  const text = String(g.t || '').replace(/^\*[^*\n]{1,80}\*\s*\n+/, '').trim();
  const vrlDoppelt = /\*\*(Verteidigung|Defen[cs]e)/.test(g.b || '');
  const werte = [!vrlDoppelt && `**${L.vrl}:** ${g.v} / ${g.r} / ${g.lp}`, `**${L.ini}:** ${g.i}`, `**${L.aktionen}:** ${g.ak}`, `**${L.grauen}:** ${g.g}`]
    .filter(Boolean).join('  ·  ');
  const beschreibung = [kopf, text, werte, g.b].filter(Boolean).join('\n\n');
  const knoepfe = g.p.slice(0, 5).map((p, k) => ({
    type: 2, style: 1, label: `${p.n} ${p.w}+${p.b}`.slice(0, 80),
    custom_id: `${zeigen ? 'n' : 'v'}|${p.w}|${p.b}|0|0|0|${p.n}${p.s ? ` (${L.schaden} ${p.s})` : ''}`.slice(0, 100),
  }));
  return {
    type: 4,
    data: {
      flags: zeigen ? 0 : 64,
      embeds: [{
        color: FARBE, title: g.n, description: kurz(beschreibung, 4000, lang),
        footer: { text: `${g.o}${zeigen ? '' : '  ·  ' + L.verdeckt}`.slice(0, 200) },
      }],
      components: knoepfe.length ? [{ type: 1, components: knoepfe }] : [],
    },
  };
}

// ---------- Regeln ----------
export function regel(wert, lang, zeigen) {
  const liste = DATEN[lang].regeln;
  const [, r] = finde(liste, wert);
  if (!r) return nichts(lang);
  return {
    type: 4,
    data: {
      flags: zeigen ? 0 : 64,
      embeds: [{
        color: FARBE, title: r.n, url: LINK[lang],
        description: kurz(r.t, 4000, lang),
        footer: { text: `${r.k} · odin-rpg.pages.dev` },
      }],
    },
  };
}
