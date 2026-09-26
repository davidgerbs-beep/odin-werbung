// Pflege des eigenen Discord-Servers „O.D.I.N. Funkraum“ über den Bot (kein Nutzerkonto).
// node scripts/funkraum.mjs lesen        -> listet Kanäle, angeheftete Nachrichten und veraltete Stellen
// node scripts/funkraum.mjs ausfuehren   -> arbeitet handarbeit/funkraum_auftrag.json ab
// Braucht DISCORD_BOT_TOKEN. Der Bot braucht im Server: Kanäle ansehen, Nachrichtenverlauf lesen,
// Nachrichten senden, Nachrichten verwalten (für Anheften und Lösen).
import { readFileSync } from "node:fs";

const GUILD = process.env.FUNKRAUM_ID || "1552281593379299408";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) { console.error("DISCORD_BOT_TOKEN fehlt"); process.exit(1); }
const API = "https://discord.com/api/v10";
const ALT = [/drive ?thru/i, /dtrpg/i, /roll20/i, /hCw4C4Kh6/, /\b(20|zwanzig|twenty)\s+(bücher|books|bände)/i, /\b(15|16|17|18|19)\s+(bücher|books)/i];

async function api(method, path, body) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (odin-werbung, 1.0)" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { const j = await r.json(); await new Promise(s => setTimeout(s, (j.retry_after || 1) * 1000 + 200)); continue; }
    const t = await r.text();
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${t.slice(0, 300)}`);
    return t ? JSON.parse(t) : null;
  }
  throw new Error("zu viele 429");
}

const kurz = s => (s || "").replace(/\s+/g, " ").trim();

async function lesen() {
  const kan = (await api("GET", `/guilds/${GUILD}/channels`)).filter(c => [0, 5, 15].includes(c.type)).sort((a, b) => a.position - b.position);
  let funde = 0;
  for (const c of kan) {
    let pins = [];
    try { pins = await api("GET", `/channels/${c.id}/pins`); }
    catch (e) { console.log(`#${c.name} (${c.id}): kein Zugriff (${e.message.slice(0, 80)})`); continue; }
    console.log(`\n#${c.name} (${c.id}): ${pins.length} angeheftet`);
    for (const m of pins) {
      const text = [m.content, ...(m.embeds || []).map(e => [e.title, e.description, ...(e.fields || []).map(f => f.name + " " + f.value)].join(" "))].join(" ");
      const alt = ALT.filter(re => re.test(text)).map(re => re.source);
      if (alt.length) funde++;
      console.log(`  - ${m.id} von ${m.author?.username}${m.author?.bot ? " (Bot)" : ""}, ${m.timestamp.slice(0, 10)}${alt.length ? "  VERALTET: " + alt.join(", ") : ""}`);
      console.log(`    ${kurz(text).slice(0, 700)}`);
    }
    if (["willkommen", "welcome", "regeln", "rules"].some(n => c.name.includes(n))) {
      try {
        const letzte = await api("GET", `/channels/${c.id}/messages?limit=5`);
        for (const m of letzte) {
          const text = [m.content, ...(m.embeds || []).map(e => [e.title, e.description].join(" "))].join(" ");
          const alt = ALT.filter(re => re.test(text)).map(re => re.source);
          if (alt.length) funde++;
          console.log(`  · letzte ${m.id} von ${m.author?.username}${alt.length ? "  VERALTET: " + alt.join(", ") : ""}: ${kurz(text).slice(0, 400)}`);
        }
      } catch (e) { console.log(`  letzte Nachrichten: ${e.message.slice(0, 80)}`); }
    }
  }
  console.log(`\nVeraltete Stellen: ${funde}`);
}

async function ausfuehren() {
  const auftrag = JSON.parse(readFileSync("handarbeit/funkraum_auftrag.json", "utf8"));
  for (const a of auftrag.schritte || []) {
    if (a.tun === "senden") {
      const m = await api("POST", `/channels/${a.kanal}/messages`, { content: a.text, allowed_mentions: { parse: [] }, flags: a.ohne_vorschau ? 4 : 0 });
      console.log(`gesendet ${a.kanal}/${m.id}`);
      if (a.anheften) { await api("PUT", `/channels/${a.kanal}/pins/${m.id}`); console.log(`  angeheftet`); }
    } else if (a.tun === "bearbeiten") {
      await api("PATCH", `/channels/${a.kanal}/messages/${a.nachricht}`, { content: a.text });
      console.log(`bearbeitet ${a.kanal}/${a.nachricht}`);
    } else if (a.tun === "anheften") {
      await api("PUT", `/channels/${a.kanal}/pins/${a.nachricht}`); console.log(`angeheftet ${a.kanal}/${a.nachricht}`);
    } else if (a.tun === "loesen") {
      await api("DELETE", `/channels/${a.kanal}/pins/${a.nachricht}`); console.log(`gelöst ${a.kanal}/${a.nachricht}`);
    } else console.log(`unbekannt: ${a.tun}`);
  }
}

const modus = process.argv[2] || "lesen";
(modus === "ausfuehren" ? ausfuehren() : lesen()).catch(e => { console.error(e.message); process.exit(1); });
