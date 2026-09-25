// Wurfbild als SVG, danach mit resvg zu PNG. Farben und Schriften wie Website und Foundry-System.
import { SCHWIERIGKEITEN, ergebnisArt } from './regeln.js';

const BG = '#1a1714', PAPER = '#231f1b', INK = '#ebe2d3', MUT = '#aa9e8c', LINE = '#3e372f';
const ACC = '#be4e3a', GOLD = '#d9b36c', GRUEN = '#6fb37a', ROT = '#d0574a';

const TEXTE = {
  de: { probe: 'Probe', wurf: 'Wurf', weiss: 'weiß trifft ab 5', bunt: 'bunt trifft ab 4', verz: 'Verzweiflungswurf: trifft nur auf 6',
    erfolge: 'Erfolge', ueber: 'Überschuss', einsen: 'Einsen', schw: 'Schwierigkeit',
    art: { patzer: 'PATZER', offen: 'ERFOLGE', grandios: 'GRANDIOSER ERFOLG', erfolg: 'ERFOLG', fehlschlag: 'FEHLSCHLAG' } },
  en: { probe: 'Check', wurf: 'Roll', weiss: 'white hits on 5+', bunt: 'coloured hits on 4+', verz: 'Desperation roll: hits only on 6',
    erfolge: 'Successes', ueber: 'Excess', einsen: 'Ones', schw: 'Difficulty',
    art: { patzer: 'FUMBLE', offen: 'SUCCESSES', grandios: 'CRITICAL SUCCESS', erfolg: 'SUCCESS', fehlschlag: 'FAILURE' } },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

const PIPS = {
  1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]],
  4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
  6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]],
};

function wuerfel(x, y, g, wert, weiss, treffer) {
  const eins = wert === 1;
  let fill, rand, pip, bw;
  if (weiss) { fill = '#f4f0e8'; rand = treffer ? '#141414' : '#96918a'; pip = treffer ? '#191614' : '#96918a'; }
  else { fill = treffer ? '#7a2a20' : '#785852'; rand = treffer ? GOLD : '#4d1812'; pip = treffer ? '#faf0e4' : '#d7c4be'; }
  bw = treffer ? 5 : 2;
  const r = g * 0.18;
  let s = `<rect x="${x + 4}" y="${y + 6}" width="${g}" height="${g}" rx="${r}" fill="#000" fill-opacity=".35"/>`;
  s += `<rect x="${x}" y="${y}" width="${g}" height="${g}" rx="${r}" fill="${fill}" stroke="${rand}" stroke-width="${bw}"/>`;
  for (const [px, py] of PIPS[wert]) s += `<circle cx="${x + px * g}" cy="${y + py * g}" r="${g * 0.085}" fill="${eins ? ROT : pip}"/>`;
  if (eins) s += `<rect x="${x + g * 0.12}" y="${y + g + 10}" width="${g * 0.76}" height="4" fill="${ROT}"/>`;
  return s;
}

export function wurfSvg({ e, titel, zeile, lang }) {
  const T = TEXTE[lang] || TEXTE.de;
  const W = 1000, H = 420;
  const anzahl = e.w.length + e.b.length;
  const platz = W - 80 - (e.b.length && e.w.length ? 54 : 0);
  const g = Math.min(78, Math.floor((platz + 18) / Math.max(1, anzahl) - 18));
  const abst = Math.max(8, Math.min(18, Math.floor(g * 0.23)));
  const art = ergebnisArt(e);
  const farbe = { grandios: GOLD, erfolg: GRUEN, patzer: ROT, fehlschlag: MUT, offen: INK }[art];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" fill="${BG}"/>`;
  s += `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="${PAPER}" stroke="${LINE}" stroke-width="2"/>`;
  s += `<rect x="12" y="12" width="${W - 24}" height="6" fill="${ACC}"/>`;
  s += `<text x="40" y="68" font-family="Special Elite" font-size="34" fill="${INK}">${esc(titel)}</text>`;
  if (zeile) s += `<text x="40" y="104" font-family="Barlow" font-size="21" fill="${MUT}">${esc(zeile)}</text>`;
  let x = 40; const y = 128 + (78 - g) / 2;
  for (const v of e.w) { s += wuerfel(x, y, g, v, true, v >= (e.verzweiflung ? 6 : 5)); x += g + abst; }
  if (e.b.length && e.w.length) { x += 18; s += `<rect x="${x}" y="${y + 6}" width="3" height="${g - 12}" fill="${LINE}"/>`; x += 18 + abst; }
  for (const v of e.b) { s += wuerfel(x, y, g, v, false, v >= 4); x += g + abst; }
  s += `<text x="40" y="244" font-family="Barlow" font-size="17" fill="${MUT}">${esc(e.verzweiflung ? T.verz : `${T.weiss}  ·  ${T.bunt}`)}</text>`;
  const yb = 292;
  s += `<rect x="40" y="${yb}" width="${W - 80}" height="64" rx="10" fill="${farbe}" fill-opacity=".15" stroke="${farbe}" stroke-width="2"/>`;
  s += `<text x="62" y="${yb + 43}" font-family="Barlow" font-weight="700" font-size="32" fill="${farbe}">${esc(T.art[art])}</text>`;
  const info = e.schw
    ? `${T.erfolge} ${e.erfolge} / ${e.schw}   ·   ${T.ueber} ${e.ueberschuss}   ·   ${T.einsen} ${e.einsen}`
    : `${T.erfolge} ${e.erfolge}   ·   ${T.einsen} ${e.einsen}`;
  s += `<text x="${W - 62}" y="${yb + 40}" text-anchor="end" font-family="Barlow" font-weight="600" font-size="22" fill="${INK}">${esc(info)}</text>`;
  s += `<text x="${W - 40}" y="${H - 28}" text-anchor="end" font-family="Barlow" font-size="15" fill="${MUT}">O.D.I.N. · odin-rpg.pages.dev</text>`;
  return s + '</svg>';
}

export function zeileText({ attrText, schw, lang }) {
  const T = TEXTE[lang] || TEXTE.de;
  const teile = [];
  if (attrText) teile.push(attrText);
  if (schw) teile.push(`${T.schw} ${SCHWIERIGKEITEN[lang][schw]} (${schw})`);
  return teile.join(' · ');
}

export { TEXTE };
