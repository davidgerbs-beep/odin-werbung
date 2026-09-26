# O.D.I.N.-Bot für Discord

Slash-Befehle für O.D.I.N.:
- `/wurf weiss bunt [schwierigkeit] [probe] [bonus] [malus]` (englisch `/roll`): weiße Würfel treffen ab 5, bunte ab 4,
  Erfolge, Überschuss, Patzer und grandioser Erfolg wie im Grundregelwerk (Kapitel IV) und im Foundry-System.
  Knöpfe „Nochmal“ und „+1 Bonuswürfel“. Ohne Würfel: Verzweiflungswurf (ein weißer W6, trifft nur auf 6).
- `/tabelle` (englisch `/table`): würfelt auf einer der 281 Würfeltabellen aus den Büchern (Namen, Orte, Hinweise, Artefakte, Klassenfragen …). Suche per Autovervollständigung, Knopf „Nochmal“. Standard: für alle sichtbar.
- `/gegner` (englisch `/threat`): Werte aus dem Bedrohungsatlas und der Registratur (347 Einträge). Standard: nur für den Aufrufer sichtbar (Spoiler), mit `zeigen: True` für alle. Knöpfe würfeln die Angriffe (verdeckt, wenn die Karte verdeckt ist).
- `/regel` (englisch `/rule`): schlägt eine Regelseite nach (79 Seiten). Standard: nur für den Aufrufer.
- `/akte` (englisch `/file`): würfelt eine komplette Akte aus den Zufallsakten (Kapitel I bis IV): Name, Farbe, Meldung, Anlass, Zeitdruck, Region und Schauplatz, Ursprung mit „Was die Zelle zuerst bemerkt“ und „Was dahintersteckt“, dazu Wahrheit, Komplikation, Wendung und mögliches Ende. Sonderfälle des Ursprungs (Mischform, Roter Hering, nichts Übernatürliches) werden aufgelöst. Standard: nur für den Aufrufer. Knopf „Briefing an alle“ zeigt öffentlich nur Name, Farbe, Meldung, Anlass und Zeitdruck (die Zeilen stehen in der custom_id). Das zweite Wort des Aktennamens kommt aus einem Block mit demselben Geschlecht wie das erste (die Listen sind in Sechserblöcken das/der/die geordnet).
- `/agent`: würfelt Name (Region und Geschlecht zufällig), Klasse und Spezialisierung (Option `klasse`, sonst zufällig), Rekrutierungsweg, Antrieb, die „erste …“-Tabelle und den Preis der Spezialisierung, Eigenheit und Geheimnis. Werte gibt es nicht, dafür der Link zum Charaktergenerator. Knopf „Nochmal“.
- `/initiative`: öffentliche Zugreihenfolge. „Eintragen“ öffnet ein Formular (Name, Initiative, WE), „Weiter“ schaltet zum Nächsten und zählt Runden, „Austragen“ entfernt jemanden, „Kampf beenden“ friert die Liste ein. Sortierung wie im Grundregelwerk (Initiative, dann WE, dann W6, der nur bei Gleichstand gezeigt wird). Der Stand steht in der Nachricht selbst, der Worker speichert nichts.
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

## Daten für /tabelle, /gegner, /regel, /akte, /agent
Kommen aus den Kompendien des Foundry-Systems (Repository odin-foundry, Ordner packs). Neu bauen, wenn sich dort etwas ändert:
`npm i --no-save classic-level@1 && node scripts/daten.mjs ../odin-foundry`. Achtung: Die Packs im Repository können hinter dem Release liegen (26.09.: main hatte 242 Gegner, das Release 0.10.2 hat 347). Sicherer ist das entpackte Release-Zip (packs/ und lang/) als Pfad, danach `src/daten/de.json` und `en.json` einchecken. `/akte` und `/agent` suchen ihre Tabellen über den genauen Namen (Liste oben in `src/akte.js`); wird eine Tabelle in Foundry umbenannt, dort nachziehen.
Befehle neu anmelden: Workflow „Discord einrichten“.
