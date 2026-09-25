// /akte, /agent und /initiative: fertige Würfe aus mehreren Tabellen der Bücher und eine Zugreihenfolge für Kämpfe.
// Die Tabellen stehen in src/daten/*.json (aus den Foundry-Kompendien), gesucht wird über den genauen Namen.
import de from './daten/de.json';
import en from './daten/en.json';
import { w6 } from './regeln.js';

const DATEN = { de, en };
const FARBE = 0xbe4e3a;
const GENERATOR = 'https://odin-rpg.pages.dev/generator/';

// Tabellennamen je Sprache
const N = {
  de: {
    wort1: 'Aktennamen: Erstes Wort', wort2: 'Aktennamen: Zweites Wort', farbe: 'Die Aktenfarbe', meldung: 'Wie die Meldung kommt',
    anlass: 'Der Anlass', zeit: 'Zeitdruck', ursprung: 'Der Ursprung', wahrheit: 'Was wirklich dahintersteckt',
    kompl: 'Komplikation', wendung: 'Wendung', ende: 'Wie es enden kann', region: 'Die Region',
    stadt: 'Schauplatz in der Stadt', land: 'Schauplatz auf dem Land', bemerkt: ': Was die Zelle zuerst bemerkt', steckt: ': Was dahintersteckt',
    weg: 'Rekrutierungswege', antrieb: 'Schritt 9: Dein Antrieb', eigenheit: 'Eigenheit', geheimnis: 'Geheimnis',
    preis: ': Der Preis', fragen: ': Fragen an', nach: ': Nachname', mann: ': Vorname (männlich)', frau: ': Vorname (weiblich)',
    buch: 'Klassenbuch ',
  },
  en: {
    wort1: 'File Names: First word', wort2: 'File Names: Second word', farbe: 'The File Colour', meldung: 'How the Report Comes In',
    anlass: 'The Incident', zeit: 'Time Pressure', ursprung: 'The Origin', wahrheit: 'What Is Really Behind It',
    kompl: 'Complication', wendung: 'Twist', ende: 'How It Can End', region: 'The Region',
    stadt: 'Location in the City', land: 'Location in the Countryside', bemerkt: ': What the cell notices first', steckt: ': What is behind it',
    weg: 'Paths to O.D.I.N.', antrieb: 'Step 9: Your Drive', eigenheit: 'Quirk', geheimnis: 'Secret',
    preis: ': The Price', fragen: ': Questions for', nach: ': Surname', mann: ': First name (male)', frau: ': First name (female)',
    buch: 'Class Book ',
  },
};

const T = {
  de: {
    akte: 'Akte', farbe: 'Aktenfarbe', meldung: 'Wie die Meldung kommt', anlass: 'Der Anlass', zeit: 'Zeitdruck', ort: 'Wo',
    ursprung: 'Ursprung', bemerkt: 'Was die Zelle zuerst bemerkt', steckt: 'Was dahintersteckt', wahrheit: 'Was wirklich dahintersteckt',
    kompl: 'Komplikation', wendung: 'Wendung', ende: 'Wie es enden kann', falsch: 'vorgetäuscht', echt: 'in Wahrheit', und: 'verbunden mit',
    nurDu: 'Nur du siehst diese Akte. Mit „Briefing“ gehen Name, Farbe, Meldung, Anlass und Zeitdruck an alle.',
    briefing: 'Briefing an alle', neu: 'Neue Akte', quelle: 'Zufallsakten, Kapitel I bis IV',
    agent: 'Agent', klasse: 'Klasse', weg: 'Wie O.D.I.N. dich fand', antrieb: 'Antrieb', eigenheit: 'Eigenheit', geheimnis: 'Geheimnis',
    preis: 'Der Preis', nochmal: 'Nochmal', werte: `Werte im Charaktergenerator: ${GENERATOR}`,
    ini: 'Initiative', runde: 'Runde', leer: 'Noch niemand eingetragen. „Eintragen“ drücken, Name und Initiative angeben.',
    eintragen: 'Eintragen', weiter: 'Weiter', raus: 'Austragen', ende2: 'Kampf beenden', beendet: 'Kampf beendet.',
    name: 'Name', iniWert: 'Initiative (GE plus Boni)', we: 'Weisheit (WE), entscheidet bei Gleichstand', anzahl: 'Wer soll raus? (Name)',
    regel: 'Absteigend nach Initiative, bei Gleichstand zuerst die höhere WE, danach entscheidet ein Würfelwurf (W6).',
    unbekannt: 'Nicht in der Liste:', ungueltig: 'Bitte eine Zahl für die Initiative eingeben.', voll: 'Die Liste ist voll (höchstens 25).',
  },
  en: {
    akte: 'File', farbe: 'File colour', meldung: 'How the report comes in', anlass: 'The incident', zeit: 'Time pressure', ort: 'Where',
    ursprung: 'Origin', bemerkt: 'What the cell notices first', steckt: 'What is behind it', wahrheit: 'What is really behind it',
    kompl: 'Complication', wendung: 'Twist', ende: 'How it can end', falsch: 'faked', echt: 'actually', und: 'combined with',
    nurDu: 'Only you can see this file. “Briefing” sends name, colour, report, incident and time pressure to everyone.',
    briefing: 'Briefing for everyone', neu: 'New file', quelle: 'Random Files, chapters I to IV',
    agent: 'Agent', klasse: 'Class', weg: 'How O.D.I.N. found you', antrieb: 'Drive', eigenheit: 'Quirk', geheimnis: 'Secret',
    preis: 'The Price', nochmal: 'Reroll', werte: `Stats in the character generator: ${GENERATOR}`,
    ini: 'Initiative', runde: 'Round', leer: 'Nobody here yet. Press “Join”, enter name and initiative.',
    eintragen: 'Join', weiter: 'Next', raus: 'Remove', ende2: 'End combat', beendet: 'Combat over.',
    name: 'Name', iniWert: 'Initiative (DEX plus bonuses)', we: 'Wisdom (WIS), breaks ties', anzahl: 'Who should leave? (name)',
    regel: 'Highest initiative first; on a tie the higher WIS goes first, then a die roll (d6) decides.',
    unbekannt: 'Not in the list:', ungueltig: 'Please enter a number for initiative.', voll: 'The list is full (25 at most).',
  },
};

const KLASSEN = { de: ['Agent', 'Investigator', 'Psion', 'Scientist', 'Soldier', 'Thaumaturg'], en: ['Agent', 'Investigator', 'Psion', 'Scientist', 'Soldier', 'Thaumaturge'] };

const tab = (lang, name) => DATEN[lang].tabellen.find((t) => t.n === name);
const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

// Wirft auf einer Tabelle und gibt den Zeilenindex zurück (für Knöpfe, die dieselbe Zeile wieder zeigen)
function zeile(t) {
  let wert;
  if (t.a === 'w66') wert = w6() * 10 + w6();
  else if (t.a === 'w12') wert = w6() + (w6() >= 4 ? 6 : 0);
  else wert = w6();
  const i = t.z.findIndex(([lo, hi]) => wert >= lo && wert <= hi);
  return i < 0 ? 0 : i;
}
const text = (t, i) => (t && t.z[i] ? t.z[i][2] : '?');
const wurf = (lang, key) => { const t = tab(lang, N[lang][key]); const i = zeile(t); return { t, i, s: text(t, i) }; };
const kopf = (s) => { const m = /^\*\*(.+?)\*\*/.exec(s); return m ? m[1] : null; };
const titel = (lang, n) => (lang === 'de' ? `Akte „${n}“` : `File “${n.replace(/\b[a-z]/g, (c) => c.toUpperCase())}”`);
const feld = (name, value) => ({ name: String(name).slice(0, 256), value: String(value || '?').slice(0, 1024) });

// ---------- /akte ----------
function ursprungFelder(lang) {
  const L = T[lang];
  const tu = tab(lang, N[lang].ursprung);
  const normal = (i) => i <= 8; // Zeilen 1 bis 9: ein bestimmter Ursprung, 10 bis 12: Sonderfälle
  let i = zeile(tu);
  const felder = [];
  const echte = (j) => {
    const name = kopf(text(tu, j));
    const tb = tab(lang, name + N[lang].bemerkt);
    const ts = tab(lang, name + N[lang].steckt);
    const f = [];
    if (tb) f.push(feld(`${L.bemerkt} (${name})`, text(tb, zeile(tb))));
    if (ts) f.push(feld(`${L.steckt} (${name})`, text(ts, zeile(ts))));
    return f;
  };
  const nochEiner = () => { let j; do { j = zeile(tu); } while (!normal(j)); return j; };
  if (normal(i)) {
    felder.push(feld(L.ursprung, text(tu, i)), ...echte(i));
  } else if (i === 9) { // Mischform
    const a = nochEiner(); let b = nochEiner(); while (b === a) b = nochEiner();
    felder.push(feld(L.ursprung, text(tu, i)), feld(`${kopf(text(tu, a))} ${L.und} ${kopf(text(tu, b))}`, `${text(tu, a)}\n${text(tu, b)}`), ...echte(a), ...echte(b));
  } else if (i === 10) { // Roter Hering
    const falsch = nochEiner(); let echt = nochEiner(); while (echt === falsch) echt = nochEiner();
    felder.push(feld(L.ursprung, text(tu, i)), feld(`${L.falsch}: ${kopf(text(tu, falsch))}`, text(tu, falsch)), feld(`${L.echt}: ${kopf(text(tu, echt))}`, text(tu, echt)), ...echte(echt));
  } else {
    felder.push(feld(L.ursprung, text(tu, i)), ...echte(6)); // Nichts Übernatürliches: die Menschen
  }
  return felder;
}

export function akte(lang, zeigen) {
  const L = T[lang];
  const w1 = wurf(lang, 'wort1');
  // Die Wortlisten sind nach Geschlecht in Sechserblöcken geordnet (das, der, die, das, der, die):
  // das zweite Wort kommt aus einem Block mit demselben Geschlecht, damit „Die offene Haus“ nicht vorkommt.
  const g = Math.floor(w1.i / 6) % 3;
  const t2 = tab(lang, N[lang].wort2);
  const i2 = ((Math.random() < 0.5 ? g : g + 3) * 6) + (w6() - 1);
  const w2 = { t: t2, i: i2, s: text(t2, i2) };
  const fa = wurf(lang, 'farbe'), me = wurf(lang, 'meldung'), an = wurf(lang, 'anlass'), ze = wurf(lang, 'zeit');
  const re = wurf(lang, 'region'), sc = wurf(lang, Math.random() < 0.5 ? 'stadt' : 'land');
  const felder = [
    feld(L.farbe, fa.s), feld(L.meldung, me.s), feld(L.anlass, an.s), feld(L.zeit, ze.s),
    feld(L.ort, `${re.s}\n${sc.s}`),
    ...ursprungFelder(lang),
    feld(L.wahrheit, wurf(lang, 'wahrheit').s), feld(L.kompl, wurf(lang, 'kompl').s),
    feld(L.wendung, wurf(lang, 'wendung').s), feld(L.ende, wurf(lang, 'ende').s),
  ].slice(0, 25);
  const code = [w1.i, w2.i, fa.i, me.i, an.i, ze.i].join('.');
  return {
    type: 4,
    data: {
      flags: zeigen ? 0 : 64,
      embeds: [{ color: FARBE, title: titel(lang, `${w1.s} ${w2.s}`), fields: felder, footer: { text: `${L.quelle}${zeigen ? '' : '  ·  ' + L.nurDu}`.slice(0, 2048) } }],
      components: [{ type: 1, components: [
        { type: 2, style: 1, label: L.briefing, custom_id: `ab|${lang}|${code}` },
        { type: 2, style: 2, label: L.neu, custom_id: `an|${lang}|${zeigen ? 1 : 0}` },
      ] }],
    },
  };
}

// Knopf „Briefing an alle“: dieselben Zeilen öffentlich, ohne die Geheimnisse der Spielleitung
export function briefing(lang, code) {
  const L = T[lang];
  const [a, b, c, d, e, f] = String(code).split('.').map((x) => parseInt(x, 10) || 0);
  const t = (k) => tab(lang, N[lang][k]);
  return {
    type: 4,
    data: {
      embeds: [{
        color: FARBE, title: titel(lang, `${text(t('wort1'), a)} ${text(t('wort2'), b)}`),
        fields: [feld(L.farbe, text(t('farbe'), c)), feld(L.meldung, text(t('meldung'), d)), feld(L.anlass, text(t('anlass'), e)), feld(L.zeit, text(t('zeit'), f))],
        footer: { text: L.quelle },
      }],
    },
  };
}

// ---------- /agent ----------
function name(lang) {
  const alle = DATEN[lang].tabellen.filter((t) => t.n.endsWith(N[lang].nach));
  const nach = zufall(alle);
  const region = nach.n.slice(0, -N[lang].nach.length);
  const vor = tab(lang, region + (Math.random() < 0.5 ? N[lang].mann : N[lang].frau));
  return { name: `${text(vor, zeile(vor))} ${text(nach, zeile(nach))}`, region };
}

export function agent(lang, klasseWunsch, zeigen = true) {
  const L = T[lang];
  const klassen = KLASSEN[lang];
  const wahl = parseInt(klasseWunsch, 10);
  const klasse = Number.isInteger(wahl) && klassen[wahl] ? klassen[wahl] : zufall(klassen);
  const buch = DATEN[lang].tabellen.filter((t) => t.q.startsWith(N[lang].buch) && t.o === klasse);
  const preise = buch.filter((t) => t.n.endsWith(N[lang].preis));
  const preis = zufall(preise);
  const spez = preis.n.slice(0, -N[lang].preis.length);
  const eigene = buch.filter((t) => t.n.startsWith(spez + ':') && t !== preis && !t.n.includes(N[lang].fragen));
  const erste = eigene.find((t) => /erste|first/i.test(t.n)) || zufall(eigene);
  const nm = name(lang);
  const felder = [
    feld(L.klasse, `${klasse} · ${spez}`),
    feld(L.weg, wurf(lang, 'weg').s), feld(L.antrieb, lang === 'de' ? wurf(lang, 'antrieb').s.replace(/^(\*\*.+?\*\*: )er /, '$1weil er ') : wurf(lang, 'antrieb').s),
  ];
  if (erste) felder.push(feld(erste.n.slice(spez.length + 1).trim(), text(erste, zeile(erste))));
  felder.push(feld(L.preis, text(preis, zeile(preis))), feld(L.eigenheit, wurf(lang, 'eigenheit').s), feld(L.geheimnis, wurf(lang, 'geheimnis').s));
  return {
    type: 4,
    data: {
      flags: zeigen ? 0 : 64,
      embeds: [{ color: FARBE, title: nm.name, description: `*${nm.region}*`, fields: felder, footer: { text: L.werte } }],
      components: [{ type: 1, components: [{ type: 2, style: 2, label: L.nochmal, custom_id: `ag|${lang}|${Number.isInteger(wahl) && klassen[wahl] ? wahl : ''}|${zeigen ? 1 : 0}` }] }],
    },
  };
}

// ---------- /initiative ----------
// Der Stand steht in der Nachricht selbst (Titel und Zeilen), deshalb braucht der Bot keinen Speicher.
// Zeile: "→ **4** · Raven · WE 5 · W6 3" (Pfeil nur bei der Person am Zug)
function lesen(msg) {
  const e = msg?.embeds?.[0] || {};
  const runde = parseInt((/(\d+)\s*$/.exec(e.title || '') || [])[1], 10) || 1;
  const leute = [];
  let dran = 0;
  for (const l of String(e.description || '').split('\n')) {
    const m = /^(→ )?\*\*(-?\d+)\*\* · (.+?) · (?:WE|WIS) (-?\d+)(?: · (?:W6|d6) (\d))?$/.exec(l.trim());
    if (!m) continue;
    if (m[1]) dran = leute.length;
    leute.push({ ini: +m[2], name: m[3], we: +m[4], w: m[5] ? +m[5] : 0 });
  }
  return { runde, leute, dran };
}

function sortieren(leute) {
  return leute.sort((a, b) => b.ini - a.ini || b.we - a.we || b.w - a.w);
}

function initNachricht(lang, { runde, leute, dran }, typ = 4, ende = false) {
  const L = T[lang];
  const WE = lang === 'de' ? 'WE' : 'WIS';
  const W6 = lang === 'de' ? 'W6' : 'd6';
  // Würfel nur zeigen, wo Initiative und WE gleich sind
  const zeilen = leute.map((p, k) => {
    const gleich = leute.some((q, j) => j !== k && q.ini === p.ini && q.we === p.we);
    return `${!ende && k === dran ? '→ ' : ''}**${p.ini}** · ${p.name} · ${WE} ${p.we}${gleich ? ` · ${W6} ${p.w}` : ''}`;
  });
  const knoepfe = ende ? [] : [{ type: 1, components: [
    { type: 2, style: 1, label: L.eintragen, custom_id: `ie|${lang}` },
    { type: 2, style: 2, label: L.weiter, custom_id: `iw|${lang}`, disabled: !leute.length },
    { type: 2, style: 2, label: L.raus, custom_id: `ir|${lang}`, disabled: !leute.length },
    { type: 2, style: 4, label: L.ende2, custom_id: `ix|${lang}` },
  ] }];
  return {
    type: typ,
    data: {
      embeds: [{
        color: FARBE, title: `${L.ini} · ${L.runde} ${runde}`,
        description: (zeilen.join('\n') || L.leer) + (ende ? `\n\n${L.beendet}` : ''),
        footer: { text: L.regel },
      }],
      components: knoepfe,
    },
  };
}

export const initiativeStart = (lang) => initNachricht(lang, { runde: 1, leute: [], dran: 0 });

// Knöpfe der Initiative-Liste
export function initiativeKnopf(lang, art, msg) {
  const L = T[lang];
  const s = lesen(msg);
  if (art === 'ie' || art === 'ir') { // Formular öffnen
    const felder = art === 'ie'
      ? [
        { type: 4, custom_id: 'name', label: L.name, style: 1, required: true, max_length: 40 },
        { type: 4, custom_id: 'ini', label: L.iniWert, style: 1, required: true, max_length: 3 },
        { type: 4, custom_id: 'we', label: L.we, style: 1, required: false, max_length: 2 },
      ]
      : [{ type: 4, custom_id: 'name', label: L.anzahl, style: 1, required: true, max_length: 40 }];
    return { type: 9, data: { custom_id: `${art}m|${lang}`, title: L.ini, components: felder.map((f) => ({ type: 1, components: [f] })) } };
  }
  if (art === 'iw') {
    if (!s.leute.length) return initNachricht(lang, s, 7);
    s.dran += 1;
    if (s.dran >= s.leute.length) { s.dran = 0; s.runde += 1; }
    return initNachricht(lang, s, 7);
  }
  if (art === 'ix') return initNachricht(lang, s, 7, true);
  return null;
}

// Formulare der Initiative-Liste (Eintragen, Austragen)
export function initiativeFormular(lang, art, msg, werte) {
  const L = T[lang];
  const s = lesen(msg);
  const amZug = s.leute[s.dran];
  const name = String(werte.name || '').replace(/[*_`~|\n→·]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (art === 'iem') {
    const ini = parseInt(werte.ini, 10);
    if (!name || !Number.isFinite(ini)) return { type: 4, data: { content: L.ungueltig, flags: 64 } };
    if (s.leute.length >= 25) return { type: 4, data: { content: L.voll, flags: 64 } };
    const we = parseInt(werte.we, 10);
    s.leute = s.leute.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
    s.leute.push({ ini: Math.max(-9, Math.min(99, ini)), name, we: Number.isFinite(we) ? Math.max(0, Math.min(9, we)) : 0, w: 0 });
  } else {
    const vorher = s.leute.length;
    s.leute = s.leute.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
    if (s.leute.length === vorher) return { type: 4, data: { content: `${L.unbekannt} ${name}`, flags: 64 } };
  }
  // Gleichstand bei Initiative und WE: jeder bekommt einen eigenen W6 (neu, falls er noch keinen hat oder zwei gleich sind)
  for (const p of s.leute) {
    const gruppe = s.leute.filter((q) => q.ini === p.ini && q.we === p.we);
    if (gruppe.length > 1) while (!p.w || gruppe.some((q) => q !== p && q.w === p.w)) p.w = w6();
  }
  sortieren(s.leute);
  const k = amZug ? s.leute.findIndex((p) => p.name === amZug.name) : -1;
  s.dran = k >= 0 ? k : Math.min(s.dran, Math.max(0, s.leute.length - 1));
  return initNachricht(lang, s, 7);
}
