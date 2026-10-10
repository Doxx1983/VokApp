# Wörter-Sammler (VokApp)

Installierbare Android-PWA, Vokabeltrainer für die Tochter (9 Jahre, 4. Klasse) mit Sammelkarten (Pokémon-Stil) als Belohnung.
Repo: Doxx1983/VokApp · Live: https://doxx1983.github.io/VokApp/ · Branch `main` (GitHub Pages).

## Arbeitsweise
- Antworten an Dominic: Deutsch, kurz und präzise.
- Commit-Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` und `Claude-Session: <Session-URL>`. Push: `git push -q origin main`.
- Nach jeder Änderung: `sw.js` Cache-Version `woerter-sammler-vNN` erhöhen (aktuell v37), Tests laufen lassen, committen, pushen. Nutzer muss die App danach einmal neu laden.
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
- Belohnung: Punkte → Päckchen → Karten (Seltenheit Normal 62 %, Selten 26 %, Episch 10 %, Legendär 2 %); eigene Kartenbilder (Galerie/ZIP), Kartenrücken-Karussell (pro Sprache `L.back`, Standard `S.cardBack`; eigene Rücken als `S.customBacks` + IndexedDB-Bild `back:<id>`, 360×504 zugeschnitten, im Backup enthalten), spezielle Text-Belohnungen.
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

## Vokabel-Tags (statt fester Kategorien)
- Datenmodell: jedes Wort hat `tags: string[]` (früher `unit`; `migrate()` wandelt alte Daten um, ohne Tag → „Allgemein“). Helfer in der LOGIC: `normTag`, `splitTags`, `tagsOf`; Filter (Lernen, Vokabelliste) = Wort hat mindestens einen gewählten Tag.
- Import: `Fremdwort = Deutsch #Tag1 #Tag2`; Zeile `# Tagname` setzt Tags für folgende Zeilen ohne eigene Tags; Feld „Tags für die neuen Wörter“ als Standard. Gleiches Paar (Fremdwort+Deutsch) wird nicht doppelt angelegt, sondern bekommt die Tags ergänzt.
- Tag umbenennen (gleiche Namen werden zusammengelegt); Tag löschen entfernt den Tag und löscht Wörter, die nur diesen Tag hatten.
- Bestehende Kategorien des Nutzers (jetzt Tags): Möbel, Früchte, Kleidung, Haustiere, Tiere, Schule, Verben, Familie; zusätzlich Schulfächer.
- `docs/englisch-vokabeln.txt`: 1039 Wörter, britisches Englisch, mit Mehrfach-Tags (alle Verben zusätzlich #Verben), jeder Tag mindestens 30 Wörter. Mehrdeutige Wörter stehen mit jeder Bedeutung (date = Dattel / Datum).
- Tags (Anzahl Wörter): Adjektive & Gegensätze (49), Begrüßung & Höflichkeit (40), Essen & Trinken (46), Familie (45), Farben (42), Fragewörter & kleine Wörter (45), Früchte (43), Gefühle (42), Gemüse (37), Haustiere (39), Kleidung (45), Körper (45), Möbel (38), Natur (47), Schule (45), Schulfächer (43), Spiel & Sport (47), Stadt & Verkehr (45), Tage & Monate (46), Tiere (45), Verben (137), Wetter & Jahreszeiten (46), Zahlen (45), Zuhause (43).
- Import: Elternbereich → Einzelne Sprache → Englisch → Vokabeln → gesamten Dateiinhalt einfügen → „Hinzufügen“.
