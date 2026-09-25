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
    name: 'odin', description: 'How the O.D.I.N. bot works', description_localizations: { de: 'So funktioniert der O.D.I.N.-Bot' },
    integration_types: [0, 1], contexts: [0, 1, 2],
  },
];

const r = await fetch(`https://discord.com/api/v10/applications/${id}/commands`, {
  method: 'PUT', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(befehle),
});
console.log('Discord:', r.status, (await r.text()).slice(0, 300));
if (!r.ok) process.exit(1);
