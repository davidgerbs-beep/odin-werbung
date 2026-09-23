# O.D.I.N. Werbung

Postet den Redaktionsplan für O.D.I.N. automatisch auf Bluesky, Mastodon, Instagram und den eigenen Discord, auf Deutsch und Englisch. Läuft kostenlos über GitHub Actions, stündlich, ohne dass ein Rechner an sein muss.

```
posts/plan.yaml        Redaktionsplan: 37 Beiträge, 12 Wochen, je DE und EN
config.yaml            Startdatum, Uhrzeiten, Kanäle, Hashtags
bilder/                fertige Bildkarten (1080 x 1350, JPEG)
werkzeug/karten.py     baut die Bildkarten aus dem Plan
scripts/post.py        die Automatik
state/gepostet.json    was schon draußen ist (schreibt die Automatik selbst)
handarbeit/            Beiträge für Reddit und Foren, Verzeichnisse, Discord-Aufbau
```

## Einrichten (einmalig, etwa eine Stunde)

### 1. Repo anlegen

Auf GitHub unter davidgerbs-beep ein neues **öffentliches** Repository `odin-werbung` anlegen (öffentlich, weil Instagram die Bilder über eine offene Adresse abholt; drin ist nichts Geheimes, die Zugangsdaten liegen getrennt als Secrets).

Dann den Ordner hochladen, am einfachsten im Terminal:

```
cd odin-werbung
git init -b main
git add .
git commit -m "Redaktionsplan und Automatik"
git remote add origin https://github.com/davidgerbs-beep/odin-werbung.git
git push -u origin main
```

Unter Settings > Actions > General > Workflow permissions: „Read and write permissions" einschalten.

### 2. Konten anlegen und Zugangsdaten als Secrets eintragen

Secrets: Settings > Secrets and variables > Actions > New repository secret. Jeder Kanal ist optional: Was kein Secret hat, wird einfach übersprungen.

**Bluesky** (ein Konto für beide Sprachen reicht, die Beiträge tragen eine Sprachkennung)
1. Konto anlegen, z. B. `odin-rpg.bsky.social`, Profilbild und Beschreibung mit Link zur Website.
2. Einstellungen > Privatsphäre und Sicherheit > App-Passwörter > neues App-Passwort.
3. Secrets: `BSKY_HANDLE` (z. B. odin-rpg.bsky.social) und `BSKY_PASSWORD` (das App-Passwort, nicht das Login-Passwort).
4. Wer zwei Konten will: `BSKY_DE_HANDLE`/`BSKY_DE_PASSWORD` und `BSKY_EN_HANDLE`/`BSKY_EN_PASSWORD`.

**Mastodon deutsch: mastodon.pnpde.social**
1. Registrieren (wird von Hand freigeschaltet).
2. Profil bearbeiten: „Dies ist ein Bot-Konto" anhaken, in die Beschreibung schreiben, wer es betreibt (Regel der Instanz für automatische Konten). Die Instanz erlaubt öffentlich höchstens einen Beitrag pro Stunde; die Automatik postet ohnehin nur einen pro Lauf.
3. Einstellungen > Entwicklung > Neue Anwendung, Rechte `write:statuses` und `write:media`, speichern, „Dein Zugangs-Token" kopieren.
4. Secrets: `MASTODON_DE_INSTANCE` = `mastodon.pnpde.social`, `MASTODON_DE_TOKEN` = Token.

Nicht rollenspiel.social nehmen: Dort sind Bot- und reine Werbekonten verboten. Dort lieber ein persönliches Konto, von Hand.

**Mastodon englisch: dice.camp**
Genauso wie oben (bei der Anmeldung kurz begründen, warum man beitreten will). Bot-Haken setzen. Secrets `MASTODON_EN_INSTANCE` = `dice.camp`, `MASTODON_EN_TOKEN`.

**Discord**
Server nach `handarbeit/verzeichnisse_und_discord.md` anlegen, Webhooks in #neuigkeiten und #news-en erstellen. Secrets `DISCORD_DE_WEBHOOK`, `DISCORD_EN_WEBHOOK`. Einladungslink in `config.yaml` bei `discord_einladung` eintragen.

**Instagram** (der aufwendigste Kanal, kann auch später kommen)
1. Instagram-Konto anlegen und unter Einstellungen > Kontotyp auf **Creator** umstellen. Eine Facebook-Seite ist nicht nötig.
2. Auf developers.facebook.com eine App anlegen, Anwendungsfall „Instagram API mit Instagram-Login", das eigene Instagram-Konto als Tester hinzufügen und die Einladung in der Instagram-App annehmen.
3. In der App unter „API-Einrichtung mit Instagram-Login" das Konto verbinden und ein Zugriffs-Token erzeugen (Rechte `instagram_business_basic`, `instagram_business_content_publish`). Die angezeigte Instagram-User-ID notieren.
4. Secrets `INSTAGRAM_USER_ID` und `INSTAGRAM_TOKEN`.
5. Das Token läuft nach 60 Tagen ab. Der Workflow „Instagram-Token verlängern" frischt es jede Woche auf. Damit er ein neues Token selbst eintragen kann, ein Fine-grained Personal Access Token mit dem Recht „Secrets: Read and write" nur für dieses Repo anlegen und als `GH_PAT` speichern.

X ist nicht dabei: Die X-API kostet seit Februar 2026 pro Beitrag Geld.

### 3. Startdatum setzen

In `config.yaml` bei `start` den ersten Montag eintragen, an dem es losgehen soll. Alle Beiträge rechnen ab diesem Tag. Beiträge, die mehr als 36 Stunden überfällig sind, werden übersprungen und nicht nachgeholt, damit es nach einer Pause keinen Schwall gibt.

### 4. Testen

Actions > „Plan prüfen" > Run workflow. Zeigt den Zeitplan, welche Kanäle bereit sind und ob ein Text zu lang ist.
Actions > „Posten" > Run workflow mit Modus `trocken`: zeigt, was jetzt rausgehen würde.
Wer einen Beitrag sofort sehen will: Modus `sofort`, ID z. B. `w01-willkommen`.

Ab dann läuft „Posten" jede Stunde von allein.

## Im Alltag

**Neuen Beitrag einplanen:** In `posts/plan.yaml` einen Block kopieren, `id`, `tag` (oder `datum`), Texte und Bild anpassen, committen. Der Workflow „Plan prüfen" baut die Bildkarte und meldet Fehler. Bluesky erlaubt 300 Zeichen inklusive Link und Hashtags, darum steht Längeres im Feld `mehr`, das nur Mastodon, Discord und Instagram bekommen.

**Beitrag, der auf etwas wartet:** `wartet_auf:` steht zum Beispiel beim Roll20-Beitrag. Sobald der Bogen freigeschaltet ist, die Zeile löschen und `tag` auf den gewünschten Tag setzen, oder den Beitrag über Modus `sofort` mit ID `roll20` direkt schicken.

**Pausieren:** in `config.yaml` die Kanäle auf `false` setzen, oder in GitHub unter Actions den Workflow „Posten" deaktivieren.

**Nach Woche 12:** Neue Beiträge in den Plan schreiben. Ideen, die noch nicht drin sind: jede Subklasse einzeln (30 Stück), Gegner aus „Die anderen Dienste", Horte aus „Horte der Welt", Szenen-Anfänge aus „Graue Akten", Neuerscheinungen.

## Was Handarbeit bleibt

Reddit, Tanelorn, Blutschwerter, RPGnet und EN World lassen sich nicht automatisch bespielen, ohne dass das Konto gesperrt wird. Reddit vergibt seit Ende 2025 keine freien API-Schlüssel mehr, und die Foren verbieten Bots. Fertige Texte dafür liegen in `handarbeit/`. Faustregel: ein Beitrag pro Forum und Anlass, nie derselbe Text in mehreren Subreddits.
