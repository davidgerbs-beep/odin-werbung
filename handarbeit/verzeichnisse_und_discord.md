# Einmalige Einträge und der eigene Discord

Diese Einträge macht man einmal, danach wirken sie dauerhaft.

## Verzeichnisse

| Wo | Was | Aufwand |
|---|---|---|
| **RPGGeek** (rpggeek.com) | Reihenfolge laut Wiki: erst Person „David Ger" und Verlag (self-published) anlegen, dann das RPG „O.D.I.N.", dann je Buch ein Item. Deutsche Ausgaben sind „Versions" der englischen Items. Admins schalten erst frei, wenn ein Item verknüpft ist. | 1 bis 2 Stunden |
| **itch.io** | Seite als „Physical game" mit Preis 0 oder „Name your own price", Tags: Tabletop role-playing game, printable, horror, investigation. PDFs hochladen oder auf die Website verlinken. In die Sammlung „Rollenspiele auf Deutsch" aufnehmen lassen. Die One-Page RPG Jam im Sommer eignet sich für ein Ein-Seiten-Szenario. | 1 Stunde |
| **DriveThruRPG** | Englische Ausgabe als eigene Produkte einstellen: Follower bekommen bei jedem neuen Titel automatisch eine Mail. Überlegen, ob „Pay what you want" statt „free" passt (bleibt kostenlos möglich, Spenden direkt im Shop). Neue Regel beachten: erst Sichtprüfung, dann Upload. | je Titel 20 Minuten |
| **we20.de** | „Discord-Server vorschlagen", sobald der eigene Server steht | 5 Minuten |
| **rollenspiel-kompass.de** | Discord-Server über „Mitmachen" eintragen | 5 Minuten |
| **DISBOARD** | Server mit Tags pnp, rollenspiel, ttrpg eintragen, „Bump" gelegentlich von Hand | 5 Minuten |
| **rsp-blogs.de** | Nimmt deutsche Rollenspiel-Blogs mit RSS-Feed auf. Dafür bräuchte die Website einen kleinen News-Bereich mit Feed. Dann erscheint jede Meldung automatisch dort. | Website-Erweiterung |
| **Gratisrollenspieltage 2027** (März) | Schnellstart als Material anbieten: info@gratisrollenspieltag.de | 1 Mail |
| **Teilzeithelden** | Rezensionsanfrage an kontakt@teilzeithelden.de | 1 Mail |
| **Orkenspalter TV** | Indie-Talk rund um die GRT, Kontakt über orkenspalter-tv.de/kontakt | 1 Mail |

**KI-Regeln vorher prüfen:** Foundry verlangt für gelistete Pakete, dass nutzerseitige Inhalte nicht KI-generiert sind. Die ENnies verlangen „AI-free". EN World hat eigene Präfixe. pnpde.social verlangt die Kennzeichnung (#KIgeneriert, macht die Automatik). Wer das offen sagt, bekommt weniger Ärger als jemand, bei dem es später rauskommt.

## Eigener Discord-Server

**Name:** O.D.I.N. Funkraum
**Sprache:** zweisprachig, Kanäle getrennt

```
EINGANG
  #willkommen            (nur lesen: was ist O.D.I.N., Links, Regeln)
  #regeln
  #vorstellung

NEUIGKEITEN
  #neuigkeiten           (Ankündigungskanal, hier postet die Automatik auf Deutsch)
  #news-en               (Ankündigungskanal, hier postet die Automatik auf Englisch)

DEUTSCH
  #allgemein
  #regelfragen
  #spielberichte
  #mitspieler-gesucht
  #eigene-inhalte        (Fan-Material, eigene Akten)

ENGLISH
  #general
  #rules-questions
  #actual-play

ONLINE SPIELEN
  #foundry-vtt
  #roll20
  #charaktergenerator

SPRACHE
  Funkraum 1
  Funkraum 2
```

**Rollen:** Spielleitung, Spieler, Übersetzung, Tester (selbst zuweisbar), dazu Moderation.

**Webhooks für die Automatik:** In #neuigkeiten und #news-en jeweils: Kanal bearbeiten > Integrationen > Webhooks > Neuer Webhook > URL kopieren. Die beiden URLs kommen als Secrets DISCORD_DE_WEBHOOK und DISCORD_EN_WEBHOOK ins Repo.

**Einladungslink:** Server > Leute einladen > Link bearbeiten > „Läuft nie ab". Den Link in config.yaml bei discord_einladung eintragen, dann gibt die Automatik den Discord-Beitrag frei. Den Link auch auf die Website setzen.

**Willkommenstext für #willkommen:**

Willkommen im Funkraum von O.D.I.N.

O.D.I.N. ist ein kostenloses Pen-&-Paper-Rollenspiel über eine Organisation ohne Namen, die seit 1977 die Risse schließt. Alle Bücher, der Charaktergenerator und das Foundry-System: https://odin-rpg.pages.dev

Neu hier? Holt euch den Schnellstart, sucht euch in #mitspieler-gesucht eine Runde, und wenn eine Regel hakt, fragt in #regelfragen.

Welcome! English speakers: head to #general, books in English are at https://odin-rpg.pages.dev/en/
