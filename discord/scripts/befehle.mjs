// Meldet die Slash-Befehle bei Discord an (einmalig und nach Änderungen).
// Aufruf: DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... node scripts/befehle.mjs
const id = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!id || !token) { console.error('DISCORD_APPLICATION_ID und DISCORD_BOT_TOKEN fehlen'); process.exit(1); }

const schw = [
  ['Open (count successes)', 'Offen (Erfolge zählen)', 0], ['Easy', 'Einfach', 1], ['Feasible', 'Machbar', 2],
  ['Hard', 'Schwer', 3], ['Very hard', 'Sehr schwer', 4], ['Impossible', 'Unmöglich', 5],
];
const befehle = [
  {
    name: 'roll', name_localizations: { de: 'wurf' },
    description: 'O.D.I.N. check: white dice hit on 5+, coloured dice on 4+',
    description_localizations: { de: 'O.D.I.N.-Probe: weiße Würfel treffen ab 5, bunte ab 4' },
    integration_types: [0, 1], contexts: [0, 1, 2],
    options: [
      { type: 4, name: 'white', name_localizations: { de: 'weiss' }, description: 'White dice (attribute)', description_localizations: { de: 'Weiße Würfel (Attribut)' }, required: true, min_value: 0, max_value: 15 },
      { type: 4, name: 'coloured', name_localizations: { de: 'bunt' }, description: 'Coloured dice (skill)', description_localizations: { de: 'Bunte Würfel (Fertigkeit)' }, required: true, min_value: 0, max_value: 15 },
      { type: 4, name: 'difficulty', name_localizations: { de: 'schwierigkeit' }, description: 'Difficulty (successes needed)', description_localizations: { de: 'Schwierigkeit (nötige Erfolge)' },
        choices: schw.map(([en, de, v]) => ({ name: en, name_localizations: { de }, value: v })) },
      { type: 3, name: 'check', name_localizations: { de: 'probe' }, description: 'Name of the check, e.g. Stealth', description_localizations: { de: 'Name der Probe, z. B. Heimlichkeit' }, max_length: 40 },
      { type: 4, name: 'bonus', description: 'Bonus dice (extra white, max 3)', description_localizations: { de: 'Bonuswürfel (zusätzliche weiße, höchstens 3)' }, min_value: 0, max_value: 3 },
      { type: 4, name: 'penalty', name_localizations: { de: 'malus' }, description: 'Penalty dice (remove white first, then coloured)', description_localizations: { de: 'Maluswürfel (erst weiße, dann bunte weg)' }, min_value: 0, max_value: 20 },
    ],
  },
  {
    name: 'table', name_localizations: { de: 'tabelle' },
    description: 'Roll on an O.D.I.N. random table', description_localizations: { de: 'Auf einer O.D.I.N.-Würfeltabelle würfeln' },
    integration_types: [0, 1], contexts: [0, 1, 2],
    options: [
      { type: 3, name: 'name', description: 'Table (type to search)', description_localizations: { de: 'Tabelle (tippen zum Suchen)' }, required: true, autocomplete: true, max_length: 100 },
      { type: 5, name: 'show', name_localizations: { de: 'zeigen' }, description: 'Visible to everyone (default: yes)', description_localizations: { de: 'Für alle sichtbar (Standard: ja)' } },
    ],
  },
  {
    name: 'threat', name_localizations: { de: 'gegner' },
    description: 'Stats from the Threat Atlas (only you see them)', description_localizations: { de: 'Werte aus dem Bedrohungsatlas (nur du siehst sie)' },
    integration_types: [0, 1], contexts: [0, 1, 2],
    options: [
      { type: 3, name: 'name', description: 'Threat (type to search)', description_localizations: { de: 'Gegner (tippen zum Suchen)' }, required: true, autocomplete: true, max_length: 100 },
      { type: 5, name: 'show', name_localizations: { de: 'zeigen' }, description: 'Show to everyone (default: no, contains spoilers)', description_localizations: { de: 'Für alle zeigen (Standard: nein, enthält Spoiler)' } },
    ],
  },
  {
    name: 'rule', name_localizations: { de: 'regel' },
    description: 'Look up an O.D.I.N. rule', description_localizations: { de: 'Eine O.D.I.N.-Regel nachschlagen' },
    integration_types: [0, 1], contexts: [0, 1, 2],
    options: [
      { type: 3, name: 'topic', name_localizations: { de: 'thema' }, description: 'Rule (type to search)', description_localizations: { de: 'Regel (tippen zum Suchen)' }, required: true, autocomplete: true, max_length: 100 },
      { type: 5, name: 'show', name_localizations: { de: 'zeigen' }, description: 'Show to everyone (default: no)', description_localizations: { de: 'Für alle zeigen (Standard: nein)' } },
    ],
  },
  {
    name: 'odin', description: 'How the O.D.I.N. bot works', description_localizations: { de: 'So funktioniert der O.D.I.N.-Bot' },
    integration_types: [0, 1], contexts: [0, 1, 2],
  },
];

const r = await fetch(`https://discord.com/api/v10/applications/${id}/commands`, {
  method: 'PUT', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(befehle),
});
console.log('Discord:', r.status, (await r.text()).slice(0, 300));
if (!r.ok) process.exit(1);
