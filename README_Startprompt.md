# FLINQ – Starttext für einen neuen Fortsetzungschat

**Stand des Starttextes:** 28. Oktober 2026  
**Aktuelle ausgelieferte FLINQ-Version:** **v3.0.15**  
**Achtung:** Dieses Dokument ist als **direkt kopierbarer Startprompt** gedacht und muss bei jeder neuen FLINQ-Version auf den tatsächlichen Programmstand aktualisiert werden.

---

## Startprompt (komplett in einen neuen Chat kopieren)

> Wir setzen mein Projekt **FLINQ – Finanzhaus-Lösungen In Neuer Qualität** fort. Bitte knüpfe unmittelbar am aktuellen Projektstand an und arbeite auf Basis der von mir bereitgestellten letzten FLINQ-Dateien/ZIP weiter. Die aktuell ausgelieferte Anwendung ist **v3.0.15 (28.10.2026)**.
>
> **Projektziel:** Eine schnelle, lokale und professionelle Anwendung für die Anlageberatung an einer österreichischen Bank. FLINQ stellt Kundenvermögen als **Finanzhaus mit fünf Säulen** dar: Liquidität, Geldwerte, Substanzwerte, Alternative Anlagen und Sachwerte. Im Anlagevorschlag werden Ist-/Soll-Verteilung, Käufe, Finanzierung und das künftige Finanzhaus betrachtet. Der Name lautet verbindlich **FLINQ = Finanzhaus-Lösungen In Neuer Qualität**.
>
> **Technik und Grenzen:** Windows 11, lokal mit `file://` in Edge/Firefox; kein Server, keine Installation, keine kostenpflichtigen APIs. JavaScript bleibt in den jeweiligen HTML-Dateien (keine separate `.js`-Datei). Gemeinsames CSS in `assets/style.css` ist erwünscht. Kundendaten und Produktdaten bleiben lokal in IndexedDB und `localStorage`. Die historisch gewachsenen Speicherkennungen mit `schnellhelfer_` **nicht umbenennen**. Nie unaufgefordert Daten löschen oder vorhandene Berechnungsregeln ändern.
>
> **Aktuelle Seiten:** `index.html` (Dashboard und Datenumzug), `finanzhaus.html`, `anlagevorschlag.html`, `masterlisten.html`, `admin.html`. Die **Excel-Auswertung** ist seit v3.0.1 entfernt; die beiden Excel-Importe (Finanzhaus und Masterlisten) bleiben. Die kleinen Werkzeuge **IBAN & Bank** und **Kontonummer** gehören in das separate Projekt **Schnellhelfer**, nicht mehr zu FLINQ.
>
> **Aktueller Fachstand:** Im Anlagevorschlag ist nur der Geschäftsfall **„Liquidität veranlagen“** mit sechs Schritten fertig: Ausgangsfinanzhaus, Anlagebetrag und Rahmenbedingungen, Zielallokation, Produktauswahl, Kaufplan, Vorschlagskontrolle und Präsentation. Zwei kleine zeitabhängige Finanzhäuser, lokale Masterlisten/ISIN-Produkte, Sofortkauf, Investitionssparen, Ansparplan, konkrete Kapitalherkunft, Prüfmeldungen mit Sprunglinks, PDF-Bestandteile mit individuellen Seitenumbrüchen sowie Status `Entwurf` / `Zur Präsentation bereit` / `Präsentiert` sind bereits vorhanden. Nur geprüfte Stände können zur Präsentation bereitgestellt werden; nach fachlicher Änderung ist eine erneute Freigabe erforderlich. Es werden **keine Wertpapierorders ausgeführt**.
>
> **Letzte fachliche Korrektur v3.0.3:** Beim Start eines neuen Geschäftsfalls und erneutem Finanzhaus-XLSX-Import wurde eine veraltete Entwurfsübergabe geladen. Das wurde durch eindeutige einmalige Kennzeichnung echter Rückwechsel korrigiert. Eine abschließende Bank-PC-Bestätigung **nach v3.0.3** steht noch aus. Der zuvor durchgeführte Umstieg des Ordners von `Schnellhelfer` auf `FLINQ` und der Datenexport/-import waren erfolgreich.
>
> **Markenstand v3.0.12 (bis einschließlich v3.0.15 unverändert):** Das freigegebene Haus-Signet mit exakt fünf Säulen (vier weiß, mittlere orange) und Fundament darf **nicht mehr verändert werden**. Nur die Wortmarke FLINQ erhielt eine optische Korrektur: Q höher und mit gleichmäßigerem Abstand zu N, oranger Abstrich ragt ausgewogen über den Ring. Favicon verwendet neue Dateinamen (`flinq-v312.*`) gegen alte Browsercaches. Das Banklogo in Kunden-PDFs bleibt davon getrennt.
>
> **FLINQ v3.0.6:** Der Kopfbereich zeigt Haus und FLINQ-Schriftzug horizontal, Untertitel rechts daneben und Version am rechten Rand. In `finanzhaus.html` erscheint die JSON-Gesamtsicherung nur bei geladenen Daten; die Beispieldaten-Schaltfläche verschwindet nach dem Laden. Der alte Umschichtungsplaner wird nicht mehr angezeigt (Bestands-JSON-Daten bleiben lesbar). Vor direktem PDF-Speichern **und** Drucken öffnet derselbe Dialog mit Berichtsauswahl, Sammelschaltern und Anzeigeoptionen. Direkter PDF-Download und Browserdruck verwenden weiterhin die bisherigen zwei Ausgabetechniken.
>
> **FLINQ v3.0.7:** Im Finanzhaus-PDF steht beim Soll-/Ist-Allokationsvergleich in der letzten Spalte „Abweichung (€)“ statt Prozentpunkten nun die absolute Euro-Differenz je Säule mit „Überschuss“, „Abgang“ bzw. „ausgeglichen“. Beide Ausgabewege (direkter PDF-Export und Browserdruck) verwenden dieselbe Berechnung aus ungerundeten Vermögenswerten mit dem gesamten KAV als Basis. Ist-/Soll-Prozentwerte und Balken bleiben gleich.
>
> **FLINQ v3.0.8:** Im `finanzhaus.html` gibt es bei geladenen Daten den Reset mit Sicherheitsbestätigung. Es wird ausschließlich das **aktuelle Finanzhaus** angezeigt, direkt darunter der **Soll-/Ist-Vergleich** mit Balken und den getrennten Eurospalten „Überschuss“/„Abgang“. Der Bereich „Finanzhaus künftig“ ist dort auch aus der PDF-Berichtsauswahl entfernt (im Anlagevorschlag weiter vorhanden). Importierte An-/Absparraten erhalten optionale Monat/Jahr-Felder Beginn und Ende pro Position; diese werden im bestehenden Finanzhaus-JSON gespeichert und in Positions-PDFs ergänzt, ändern jedoch die aktuellen Zahlen nicht. Die Finanzhaus-PDFs (direkt generiert oder Browserdruck) zeigen auf jeder Berichtsseite kompakte Kundeneckdaten; im Footer Beratername, Telefon und E-Mail, das **separate Banklogo**, Seite x von y und Ort/Datum. Im Soll-/Ist-PDF kommt zuerst die Balkengrafik, dann die Tabelle. Rechtliche Hinweise sind etwas kleiner gesetzt. Logo im Browserdruck seit v3.0.10 als wiederkehrendes Druckbild; sonstige Seitenrand-Fußzeilen müssen im Bank-Edge noch geprüft werden.
>
> **PDF-Basis v3.0.13:** Im Finanzhaus-PDF heißt die erste Überschrift „Finanzhaus“ und alle blauen Titelbalken sind gleich hoch. Die Depot-Erläuterung wird als **¹** aus dem Excel-Gruppentext ausgegeben. Jede Depotposition mit Ablaufdatum erhält direkt am Datum **²**, mit Erklärung „Automatische Buchung auf das Verrechnungskonto (keine Kündigung notwendig)“ unter der ¹-Erklärung. Für befristete An-/Absparer gilt unabhängig davon **a, b, c …**. Sowohl direkter PDF-Export als auch Browserdruck wurden angepasst; das FLINQ-Logo ist ausdrücklich **nicht verändert** worden.
>
> **Nächste Aufgabe:** Die in v3.0.15 implementierte Mehrfach-Finanzhaus-Phase 1 im Bank-Edge mit realistischen Dateien prüfen. Danach offene Phase 2 fachlich definieren: echte gemeinschaftliche Vermögenspositionen, gemeinsame Soll-Allokation, Eigentum und Eignungsdaten im Anlagevorschlag. Das gemeinsame Fünf-Säulen-Haus und die Personenfarben sind bereits implementiert; **nicht neu entwickeln**.
>

> **FLINQ v3.0.15 – neuer aktueller Entwicklungsstand:** Phase 1 für mehrere Finanzhäuser ist implementiert: Nach dem ersten Import können weitere XLSX oder vollständige Finanzhaus-JSON eines einzelnen Eigentümers eingelesen werden (bis zu sechs Personen). Jede Position besitzt `ownerId`; die fünf Säulen **eines gemeinsamen Finanzhauses** enthalten unterschiedliche Personenfarben, die Hausbank/extern über einen helleren Farbton unterscheidbar lassen. Unter dem Haus stehen Eigentümersummen. „Derzeitiges Vermögen“ kann in der Tabelle und im PDF gemeinsam oder nach Person getrennt erscheinen. Gleiche Kundennummern werden verhindert, identische Positionen und unterschiedliche Stichtage bestätigt. Das bisherige vollständige JSON bleibt kompatibel und wird mit `owners`, `positionMode`, `primaryAllocation` ergänzt. Die frühere Einzelkunden-Sollallokation wird bei mehreren Personen vorübergehend deaktiviert, beim Zurückkehren zu einer Person wiederhergestellt. **Die gemeinsame Übergabe an den Anlagevorschlag ist noch nicht freigegeben** (keine ungewollte Vermischung der Kundeneignung/Kapitalherkunft). Multi-JSONs nur vollständig wiederherstellen, nicht als zusätzliche Einzelperson importieren.
>
> **PDF v3.0.15:** Vergleich Soll/Ist: alle Balken beginnen einheitlich links hinter „Alternative Anlagen“, Sollwerte grünlich und Legende rechts, auch „Sachwerte“ bleibt auf der Vergleichsseite. Depot-Hinweise ¹/² liegen enger. Sparrate 0 wird als Leerfeld angezeigt; Befristungsspalten zentriert; Unterbrechung „MM.JJJJ – MM.JJJJ“. **FLINQ-Logo, Favicon und Banklogo unverändert lassen.** Beide PDF-Ausgabewege beachten.
>
> **Weitere Prüfungen:** Mehrfach-Finanzhaus v3.0.15 sowie bereits bestehende Finanzhausfunktionen auf dem Bank-PC testen (Reset, Zielvergleich, Befristung und neue Unterbrechung samt JSON-Wiederherstellung; Banklogo aus Admin oder lokalem Druckdialog auf jeder Seite, einschließlich deaktivierter Hintergrundgrafiken; beide PDF-Wege; separate alphabetische Sparraten-Fußnoten). Danach optionales **Deckblatt im Anlagevorschlag** und **zusätzlicher moderner Finanzhaus-Stil**; anschließend die Geschäftsfälle **„Umschichtung vornehmen“** und **„Liquiditätsbedarf“** fachlich definieren. Die Finanzhaus-/Anlagevorschlag-Übergabe v3.0.3 ist im Bank-PC noch nicht ausdrücklich abschließend bestätigt.
>
> **Vier verbindliche Dokumentationsdateien:**
> `README_Aktueller_Stand.md` – vollständig gültige Funktionen/Technik;
> `README_Historie.md` – abgeschlossene Änderungen und Versionen;
> `README_Planung.md` – **ausschließlich offene** Aufgaben;
> `README_Startprompt.md` – immer aktueller, kopierbarer Fortsetzungstext.
> **Bei jeder Programmversion alle vier neu prüfen, aktualisieren und mitliefern!** Keine neue `FLINQ_Planungsstand_v...md` erzeugen. Alte versionierte Planungsstände werden nicht weiter gepflegt.
>
> **Auslieferung:** Wie gewohnt ausschließlich vollständige tatsächlich geänderte Dateien plus die vier README-Dateien in einer **geprüften ZIP**. Version im gemeinsamen Header aller fünf Seiten aktualisieren und README-Historie ergänzen; fertige Punkte aus der Planung entfernen. ZIP und den aktualisierten Startprompt als Download anbieten. Kein pauschaler Komplettumbau, keine separate JS-Datei.
>
> **Wichtig für die Fortsetzung:** Lies zuerst die vier README-Dateien aus meinem aktuellen FLINQ-Projekt und prüfe sie gegen die letzte von mir bereitgestellte Programmversion. Wenn Dateien fehlen, bitte die letzte ZIP/Dateien anfordern bzw. vorhandene Konversations-/Bibliotheksdateien verwenden, statt Funktionen zu erfinden. Der Abschlussstand ist nicht allein aus diesem Prompt rekonstruierbar.

---

## Hinweise zur Nutzung und Pflege

- Für einen neuen Chat den Inhalt des Abschnitts **„Startprompt“** einschließlich aller Absätze übertragen. Ideal zusätzlich die letzte FLINQ-Programm-ZIP und die vier aktuellen README-Dateien anhängen.
- In jedem Release die Version, letzte Änderungen, offene Punkte und die Lieferregeln kontrollieren. Dieser Starttext ist ein **Momentaufnahme-Dokument**, keine automatisch aktualisierte Referenz.
- Eingebettete Hinweise auf Kunden- und Produktdaten sind generisch; **keine echten Kundendaten in den Startprompt übernehmen**.


**Übergabe nach v3.0.10 (bis v3.0.15 weitergeführt):** Phase 1 mit fünf Säulen (vier weiß, mittlere orange) und Footer-/Depotkorrekturen abgeschlossen (im Bank-Edge noch zu prüfen). **Phase 1 seit v3.0.15** ist Mehrfachimport von Finanzhäusern: EIN gemeinsames grafisches Fünf-Säulen-Finanzhaus mit je Kunde farblich getrennten Anteilen und farblich zugeordneten Tabellenzeilen. „Derzeitiges Vermögen“ wahlweise gemeinsam aggregiert oder getrennt je Kunde. Keinesfalls pro Kunde ein separates grafisches Finanzhaus erzeugen. Alle vier README-Dateien bei jeder Version aktualisieren.


> **Bestand aus FLINQ v3.0.12:** Der Benutzer kann bei vorhandenen An-/Absparraten über einen Sprunglink vor dem PDF-Button direkt zum weiter nach oben verlegten Bereich „Monatliche An-/Absparraten – optionale Befristung“ wechseln. Pro Rate sind Beginn, Ende und optional eine Unterbrechung (von/bis einschließlich) dokumentierbar; diese Angaben werden im vollständigen Finanzhaus-JSON gespeichert und beeinflussen KAV und Monatsrate nicht. Sparraten-Fußnoten werden mit **a, b, c …** gekennzeichnet. **Seit v3.0.13** verwenden Depot-Hinweise ausschließlich **¹** und Depot-Ablaufdaten **²**. Die Sparraten beginnen immer bei **a**, unabhängig davon, ob Depot-Hinweise vorhanden sind. Im Finanzhaus-Druckdialog kann das Banklogo lokal ausgewählt werden, wenn das Admin-Logo unter file:// nicht erreichbar ist. Für den Browserdruck wird ein kleines vorgerendertes PNG in der echten Seitenrand-Fußzeile über `content:url()` ausgegeben (keine Abhängigkeit von „Hintergrundgrafiken“); der direkte PDF-Download bettet ein Banklogo ebenfalls ein. Das Haus-Signet blieb unverändert, die Q-Wortmarke wurde optisch gekernt, und die Favicons erhielten cache-neue Namen. Prüfungen, offene Aufgaben und verbindliche Dokumentationsregeln siehe die anderen drei README-Dateien.


**Hinweis zum Versionssprung:** v3.0.15 enthält Phase 1 des Mehrfach-Finanzhauses. Phase 2 (gemeinschaftlich gehaltene Positionen, gemeinsame Sollallokation, Anlagevorschlag-Integration) bleibt in `README_Planung.md` offen.


> **Neu in v3.0.14:** Im Finanzhaus-PDF wurde der Abschnitt „Vergleich Soll-/Ist-Allokation“ verdichtet: Balken weiter links, Legende rechts, Soll-Farbe grünlicher. Gleichzeitig startet der nächste Entwicklungsblock „mehrere Finanzhäuser“ als Vorbereitung für ein gemeinsames Finanzhaus mit farblich getrennten Personenanteilen.
