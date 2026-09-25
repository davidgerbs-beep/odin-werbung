// Lädt die 24 Würfel-Emojis (emojis/*.png) als Anwendungs-Emojis hoch, fehlende nur.
// Aufruf: DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... node scripts/emojis.mjs
import fs from 'node:fs';
import path from 'node:path';
const id = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!id || !token) { console.error('DISCORD_APPLICATION_ID und DISCORD_BOT_TOKEN fehlen'); process.exit(1); }
const api = `https://discord.com/api/v10/applications/${id}/emojis`;
const h = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const vorhanden = new Set(((await (await fetch(api, { headers: h })).json()).items || []).map((e) => e.name));
const ordner = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'emojis');
for (const f of fs.readdirSync(ordner).filter((x) => x.endsWith('.png')).sort()) {
  const name = f.slice(0, -4);
  if (vorhanden.has(name)) { console.log('schon da:', name); continue; }
  const image = 'data:image/png;base64,' + fs.readFileSync(path.join(ordner, f)).toString('base64');
  const r = await fetch(api, { method: 'POST', headers: h, body: JSON.stringify({ name, image }) });
  console.log(name, r.status);
  if (!r.ok) { console.log(await r.text()); process.exit(1); }
  await new Promise((ok) => setTimeout(ok, 600));
}
