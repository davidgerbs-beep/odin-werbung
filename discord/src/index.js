// O.D.I.N.-Bot für Discord als Cloudflare Worker (HTTP-Interaktionen, kein Dauerbetrieb nötig).
// POST /            Discord-Interaktionen (Signatur wird geprüft)
// GET  /wurf.png    Wurfbild, alle Werte stehen in der Adresse (Discord lädt es für die Einbettung)
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import barlow400 from '../schriften/Barlow-400.ttf';
import barlow600 from '../schriften/Barlow-600.ttf';
import barlow700 from '../schriften/Barlow-700.ttf';
import specialElite from '../schriften/SpecialElite-400.ttf';
import { pool, werfen, auswerten, ergebnisArt, SCHWIERIGKEITEN } from './regeln.js';
import { wurfSvg, zeileText, TEXTE } from './bild.js';
import { EMOJIS } from './emojis.js';

const FARBEN = { grandios: 0xd9b36c, erfolg: 0x6fb37a, patzer: 0xd0574a, fehlschlag: 0xaa9e8c, offen: 0xebe2d3 };

let wasmBereit = null;
const schriften = () => [barlow400, barlow600, barlow700, specialElite].map((b) => new Uint8Array(b));

async function png(svg) {
  if (!wasmBereit) wasmBereit = initWasm(resvgWasm);
  await wasmBereit;
  const r = new Resvg(svg, { font: { fontBuffers: schriften(), loadSystemFonts: false, defaultFontFamily: 'Barlow' } });
  return r.render().asPng();
}

function hexZuBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}

async function signaturOk(request, body, publicKey) {
  const sig = request.headers.get('X-Signature-Ed25519');
  const ts = request.headers.get('X-Signature-Timestamp');
  if (!sig || !ts || !publicKey) return false;
  const daten = new TextEncoder().encode(ts + body);
  for (const name of ['Ed25519', 'NODE-ED25519']) {
    try {
      const alg = name === 'Ed25519' ? { name } : { name, namedCurve: name };
      const key = await crypto.subtle.importKey('raw', hexZuBytes(publicKey), alg, false, ['verify']);
      return await crypto.subtle.verify(alg, key, hexZuBytes(sig), daten);
    } catch (e) { /* nächste Variante */ }
  }
  return false;
}

const json = (obj) => new Response(JSON.stringify(obj), { headers: { 'content-type': 'application/json' } });
const sprache = (i) => (String(i.locale || i.guild_locale || 'de').startsWith('de') ? 'de' : 'en');
const zahl = (v, min, max, std = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
const kurz = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Würfel-Emojis der Anwendung (einmal geladen, dann im Speicher)
let emojiCache = null;
async function emojis(env) {
  if (emojiCache) return emojiCache;
  if (!env.DISCORD_BOT_TOKEN) return EMOJIS; // feste IDs aus src/emojis.js
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_APPLICATION_ID) return null;
  const r = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/emojis`, { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } });
  if (!r.ok) return null;
  const j = await r.json();
  const m = {};
  for (const e of j.items || []) m[e.name] = e.id;
  if (Object.keys(m).length >= 24) emojiCache = m;
  return m;
}
const emojiText = (m, farbe, werte, schwelle) => werte.map((v) => {
  const name = `o${farbe}${v}${v >= schwelle ? 'h' : 'm'}`;
  return m[name] ? `<:${name}:${m[name]}>` : `\`${v}\``;
}).join(' ');

// Wurf ausführen und die Antwort für Discord bauen
function wurfAntwort(origin, lang, { weiss, bunt, schw, bonus, malus, probe, wer }, emo = null) {
  const [pw, pb] = pool(weiss, bunt, bonus, malus);
  const r = werfen(pw, pb);
  const e = auswerten(r, schw);
  const T = TEXTE[lang];
  const titel = probe ? `${T.probe}: ${probe}` : T.wurf;
  const poolText = lang === 'de'
    ? `${pw} weiß + ${pb} bunt${bonus ? ` (Bonus ${bonus})` : ''}${malus ? ` (Malus ${malus})` : ''}`
    : `${pw} white + ${pb} coloured${bonus ? ` (bonus ${bonus})` : ''}${malus ? ` (penalty ${malus})` : ''}`;
  const zeile = [wer, zeileText({ attrText: poolText, schw, lang })].filter(Boolean).join(' · ');
  const q = new URLSearchParams({ w: e.w.join(''), b: e.b.join(''), s: String(schw), v: e.verzweiflung ? '1' : '0', t: titel, z: zeile, l: lang });
  const art = ergebnisArt(e);
  const alt = `${TEXTE[lang].art[art]}: ${e.erfolge}${schw ? '/' + schw : ''}`;
  const id = ['n', weiss, bunt, schw, bonus, malus].join('|') + '|' + kurz(probe, 40);
  const idBonus = ['n', weiss, bunt, schw, Math.min(3, bonus + 1), malus].join('|') + '|' + kurz(probe, 40);
  let embed;
  if (emo) {
    const T2 = TEXTE[lang];
    const zeileW = emojiText(emo, 'w', e.w, e.verzweiflung ? 6 : 5);
    const zeileB = emojiText(emo, 'b', e.b, 4);
    const info = e.schw
      ? `${T2.erfolge} **${e.erfolge}** / ${e.schw}  ·  ${T2.ueber} **${e.ueberschuss}**  ·  ${T2.einsen} ${e.einsen}`
      : `${T2.erfolge} **${e.erfolge}**  ·  ${T2.einsen} ${e.einsen}`;
    embed = {
      color: FARBEN[art], title: titel,
      description: `${zeile}\n\n# ${zeileW}${zeileW && zeileB ? '  ┃  ' : ''}${zeileB}\n**${T2.art[art]}**  ·  ${info}`,
      footer: { text: `${e.verzweiflung ? T2.verz : `${T2.weiss} · ${T2.bunt}`} · odin-rpg.pages.dev` },
    };
  } else {
    embed = { color: FARBEN[art], image: { url: `${origin}/wurf.png?${q}` }, footer: { text: alt } };
  }
  return {
    type: 4,
    data: {
      embeds: [embed],
      components: [{ type: 1, components: [
        { type: 2, style: 2, label: lang === 'de' ? 'Nochmal' : 'Reroll', custom_id: id.slice(0, 100) },
        { type: 2, style: 2, label: lang === 'de' ? '+1 Bonuswürfel' : '+1 bonus die', custom_id: idBonus.slice(0, 100), disabled: bonus >= 3 },
      ] }],
    },
  };
}

function optionen(data) {
  const o = {};
  for (const x of data.options || []) o[x.name] = x.value;
  return o;
}

// BILDMODUS = "bild" rendert eine Wurfkarte als PNG (braucht Workers Paid wegen der Rechenzeit),
// sonst Würfel als Emojis (kostenloser Plan reicht).
const modus = async (env) => (env.BILDMODUS === 'bild' ? null : (await emojis(env)) || {});

async function interaktion(request, env, origin) {
  const body = await request.text();
  if (!(await signaturOk(request, body, env.DISCORD_PUBLIC_KEY))) return new Response('ungültige Signatur', { status: 401 });
  const i = JSON.parse(body);
  if (i.type === 1) return json({ type: 1 }); // PING
  const lang = sprache(i);
  const nutzer = i.member?.nick || i.member?.user?.global_name || i.user?.global_name || i.member?.user?.username || i.user?.username || '';

  if (i.type === 2) { // Befehl
    const name = i.data.name;
    if (name === 'roll' || name === 'wurf') {
      const o = optionen(i.data);
      return json(wurfAntwort(origin, lang, {
        weiss: zahl(o.white ?? o.weiss, 0, 15), bunt: zahl(o.coloured ?? o.bunt, 0, 15), schw: zahl(o.difficulty ?? o.schwierigkeit, 0, 5),
        bonus: zahl(o.bonus, 0, 3), malus: zahl(o.penalty ?? o.malus, 0, 20), probe: kurz(o.check ?? o.probe, 40), wer: nutzer,
      }, await modus(env)));
    }
    if (name === 'odin') {
      const text = lang === 'de'
        ? '**O.D.I.N.-Bot**\n`/wurf weiß bunt` würfelt eine Probe: weiße Würfel (Attribut) treffen ab 5, bunte (Fertigkeit) ab 4. Optional Schwierigkeit, Bonus (bis 3, zusätzliche weiße Würfel) und Malus (nimmt erst weiße, dann bunte weg) sowie der Name der Probe.\nOhne Würfel gibt es einen Verzweiflungswurf: ein weißer W6, trifft nur auf 6.\nRegeln und alle Bücher kostenlos: https://odin-rpg.pages.dev'
        : '**O.D.I.N. bot**\n`/roll white coloured` rolls a check: white dice (attribute) hit on 5+, coloured dice (skill) on 4+. Optional difficulty, bonus (up to 3 extra white dice), penalty (removes white dice first, then coloured) and the name of the check.\nWith no dice you make a desperation roll: one white d6, hits only on 6.\nRules and all books for free: https://odin-rpg.pages.dev/en/';
      return json({ type: 4, data: { content: text, flags: 64 } });
    }
  }
  if (i.type === 3) { // Knopf
    const [art, weiss, bunt, schw, bonus, malus, ...rest] = String(i.data.custom_id).split('|');
    if (art === 'n') {
      return json(wurfAntwort(origin, lang, {
        weiss: zahl(weiss, 0, 15), bunt: zahl(bunt, 0, 15), schw: zahl(schw, 0, 5), bonus: zahl(bonus, 0, 3), malus: zahl(malus, 0, 20),
        probe: kurz(rest.join('|'), 40), wer: nutzer,
      }, await modus(env)));
    }
  }
  return json({ type: 4, data: { content: '?', flags: 64 } });
}

async function wurfBild(url) {
  const p = url.searchParams;
  const ziffern = (s) => String(s || '').split('').map(Number).filter((n) => n >= 1 && n <= 6).slice(0, 18);
  const lang = p.get('l') === 'en' ? 'en' : 'de';
  const e = auswerten({ w: ziffern(p.get('w')), b: ziffern(p.get('b')), verzweiflung: p.get('v') === '1' }, zahl(p.get('s'), 0, 5));
  if (!e.w.length && !e.b.length) return new Response('keine Würfel', { status: 400 });
  const svg = wurfSvg({ e, titel: kurz(p.get('t'), 60), zeile: kurz(p.get('z'), 110), lang });
  return new Response(await png(svg), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/') return interaktion(request, env, url.origin);
    if (request.method === 'GET' && url.pathname === '/wurf.png') return wurfBild(url);
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('O.D.I.N.-Bot für Discord. Regeln und Bücher: https://odin-rpg.pages.dev', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return new Response('nicht gefunden', { status: 404 });
  },
};
