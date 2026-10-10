# Wörter-Sammler (VokApp)

Installierbare Android-PWA, Vokabeltrainer für die Tochter (9 Jahre, 4. Klasse) mit Sammelkarten (Pokémon-Stil) als Belohnung.
Repo: Doxx1983/VokApp · Live: https://doxx1983.github.io/VokApp/ · Branch `main` (GitHub Pages).

## Arbeitsweise
- Antworten an Dominic: Deutsch, kurz und präzise.
- Commit-Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` und `Claude-Session: <Session-URL>`. Push: `git push -q origin main`.
- Nach jeder Änderung: `sw.js` Cache-Version `woerter-sammler-vNN` erhöhen (aktuell v35), Tests laufen lassen, committen, pushen. Nutzer muss die App danach einmal neu laden.
- Tests (Node, ohne Abhängigkeiten): `node tests/logic.test.js`, `tests/stats.test.js`, `tests/pomo.test.js`, `tests/smoke.js` (VM mit DOM-Stubs). `node --check` auf das extrahierte Script. Neue Features immer im Smoke-Test abdecken.
- `pkill -f` nicht verwenden (beendet die eigene Shell).

## Architektur
- Eine Datei `index.html` (CSS + JS inline), `sw.js` (network-first Cache), `manifest.webmanifest`, Icons, `backs/1..10.svg` (Kartenrücken).
- Zustand: `localStorage` (Objekt `S`, `load()`/`migrate()`); Bilder als Blobs in IndexedDB (`IMG`, `BLOBS`); Sicherung als JSON inkl. Bilder (Data-URLs).
- Testbare Logik zwischen `//LOGIC-START` und `//LOGIC-END`: Antwortprüfung (norm/lev/checkAnswer), Leitner (Box 1–5), `pickSession`, `drawCards`, `packDraw`, `SPECIAL_PACKS`, `parseVocab`, `parseSections`, `sortWords`/`wLevel`, Streak-Funktionen, Themes, ZIP-Import, Statistik-Log, Pomodoro (`pomoStep` …).
- Ansichten via `render()`: home, quiz, summary, pack, album, list, stats, options, parent. Navigation unten: Lernen, Vokabeln, Album, Statistik, Optionen, Eltern. Klicks per Delegation auf `[data-a]` (`switch(d.a)`), Eingaben über `data-change`. Modals über `ui.modal`.
- Hilfe: `HELP`-Objekt (Texte je Bereich/Abschnitt), `helpBtn`, `helpModal`; „? Hilfe“ neben dem Sprach-Dropdown, im Elternbereich „?“ im Abschnittskopf.
- Browser-Zurück: History API (`pushHist`, popstate) springt in der App einen Bildschirm zurück.

## Funktionen (Stand)
- Mehrere Sprachen, je eigene Vokabeln, Punkte, Päckchen, Album, Statistik. Sprachauswahl als Dropdown; im Elternbereich Umschalter „Alle Sprachen / Einzelne Sprache“ (Alle: Punkte & Abfrage gelten für alle).
- Lernen: Schreiben/Sprechen (Web Speech), 10/20/30 Wörter, Kategorie-Mehrfachauswahl, falsche Wörter kommen öfter (Leitner), Tippfehler-Toleranz.
- Belohnung: Punkte → Päckchen → Karten (Seltenheit Normal 62 %, Selten 26 %, Episch 10 %, Legendär 2 %); eigene Kartenbilder (Galerie/ZIP), Kartenrücken-Karussell, spezielle Text-Belohnungen.
- Serie: Länge in Tagen; Standard-Belohnung (Päckchen ×n, Big-Pack 5 Karten, Mega-Pack 7, Epic-Pack 3 epische, Legend-Pack 1 legendäre, oder Spezielle Belohnung) und einmalige Belohnung für die nächste Serie (gleiche Auswahl). Serien-Highlight in Gelb/Orange je nach Theme.
- Optionen: 18 Farbschemata (alphabetisch, dunkel + „hell“-Varianten), Kartenrücken.
- Statistik: Kennzahlen, Woche (Mo–So)/Monat, Verlauf Punkte/Lernzeit (Tage/Wochen), Wissensstand, knifflige Wörter.
- Vokabelliste mit Kategorie-Filter, Sortierung und Spalte „Stand“ (5 Balken, grün ab Box 4).
- Pomodoro-Lernpause: Lernzeit/Pause/Leerlauf einstellbar, Sperre „Mach mal Pause!“ mit Serverzeit (läuft bei geschlossener App weiter), Entsperren nur mit Eltern-PIN; PIN beim ersten Start verpflichtend.
- Eltern: Sprachen, Vokabeln (Import `Fremdwort = Deutsch`, Überschriften `# Kategorie` für mehrere Kategorien), Karten (Import, Markieren/gesammelt löschen, Doppelte zusammenführen, fehlende Bilder wiederherstellen), Spezielle Belohnungen, Serien-Belohnung, Lernpause, Punkte & Abfrage, Sicherung & PIN (Erinnerung nach 14 Tagen ohne Sicherung).

## Offen / Entscheidungen
- E-Mail/Push bei abgeschlossener Serie: nicht gebaut (bräuchte externen Dienst, z. B. ntfy.sh).
- Sync zwischen zwei Handys: nicht gebaut (bräuchte Cloud-Backend), „aktuell nicht“.
- Karten-Pack-Bild (urheberrechtlich) ist nicht im Repo; wird vom Nutzer hochgeladen.

## Vokabel-Kategorien
Bestehende Kategorien des Nutzers in der App (exakt so benannt, inkl. „ 1“): Möbel 1, Früchte 1, Kleidung 1, Haustiere 1, Tiere 1, Schule 1, Verben 1, Familie 1. Gewünscht zusätzlich: Schulfächer.
`docs/englisch-320-vokabeln.txt` (320 Wörter, britisches Englisch) nutzt diese Namen, damit die Wörter zusammengeführt werden. Weitere Kategorien: Begrüßung & Höflichkeit (14), Fragewörter & kleine Wörter (12), Körper (14), Gefühle (10), Farben (11), Zahlen (14), Essen & Trinken (20), Gemüse (6), Zuhause (9), Wetter & Jahreszeiten (11), Tage & Monate (19), Stadt & Verkehr (14), Spiel & Sport (10), Natur (10), Adjektive & Gegensätze (19).
Zugeordnet: Familie 1 (16), Haustiere 1 (8), Tiere 1 (18, Bauernhof + wilde Tiere), Früchte 1 (13), Kleidung 1 (14), Möbel 1 (9), Schule 1 (14), Schulfächer (11), Verben 1 (24).
Import: Elternbereich → Einzelne Sprache → Englisch → Vokabeln → gesamten Dateiinhalt einfügen → „Hinzufügen“. Identische Paare in derselben Kategorie werden übersprungen.
