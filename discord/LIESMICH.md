# O.D.I.N.-Bot für Discord

Slash-Befehle für O.D.I.N.:
- `/wurf weiss bunt [schwierigkeit] [probe] [bonus] [malus]` (englisch `/roll`): weiße Würfel treffen ab 5, bunte ab 4,
  Erfolge, Überschuss, Patzer und grandioser Erfolg wie im Grundregelwerk (Kapitel IV) und im Foundry-System.
  Knöpfe „Nochmal“ und „+1 Bonuswürfel“. Ohne Würfel: Verzweiflungswurf (ein weißer W6, trifft nur auf 6).
- `/tabelle` (englisch `/table`): würfelt auf einer der 281 Würfeltabellen aus den Büchern (Namen, Orte, Hinweise, Artefakte, Klassenfragen …). Suche per Autovervollständigung, Knopf „Nochmal“. Standard: für alle sichtbar.
- `/gegner` (englisch `/threat`): Werte aus dem Bedrohungsatlas (242 Einträge). Standard: nur für den Aufrufer sichtbar (Spoiler), mit `zeigen: True` für alle. Knöpfe würfeln die Angriffe (verdeckt, wenn die Karte verdeckt ist).
- `/regel` (englisch `/rule`): schlägt eine Regelseite nach (79 Seiten). Standard: nur für den Aufrufer.
- `/odin`: kurze Hilfe.
Sprache richtet sich nach der Discord-Sprache des Nutzers (Deutsch oder Englisch).

## Aufbau
- Läuft als Cloudflare Worker (kein Server nötig). `src/index.js` beantwortet die Discord-Interaktionen, prüft die Signatur.
- Würfel erscheinen als Emojis (24 Bilder in `emojis/`, als Anwendungs-Emojis hochgeladen). Das passt in den kostenlosen Workers-Plan.
- Alternativ `BILDMODUS=bild`: eine gerenderte Wurfkarte als PNG (`/wurf.png`). Braucht wegen der Rechenzeit Workers Paid (5 $ im Monat).

## Geheimnisse und Einstellungen (Worker)
- `DISCORD_PUBLIC_KEY` (Text), `DISCORD_APPLICATION_ID` (Text), `DISCORD_BOT_TOKEN` (Secret)
- optional `BILDMODUS` = `bild`

## Befehle und Emojis anmelden
GitHub-Workflow „Discord einrichten“ (braucht die Repository-Secrets `DISCORD_APPLICATION_ID` und `DISCORD_BOT_TOKEN`),
oder lokal: `node scripts/befehle.mjs` und `node scripts/emojis.mjs` mit denselben Umgebungsvariablen.

## Lokal testen
`npx wrangler dev`, dann `node test/sig.mjs` und `node test/send.mjs` (signierte Test-Interaktionen).

## Daten für /tabelle, /gegner, /regel
Kommen aus den Kompendien des Foundry-Systems (Repository odin-foundry, Ordner packs). Neu bauen, wenn sich dort etwas ändert:
`npm i --no-save classic-level@1 && node scripts/daten.mjs ../odin-foundry`, danach `src/daten/de.json` und `en.json` einchecken.
Befehle neu anmelden: Workflow „Discord einrichten“.
