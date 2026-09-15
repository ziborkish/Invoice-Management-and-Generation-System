# Rēķinu sistēma saimnieciskās darbības veicējiem

Viegls (lightweight), pārlūkprogrammā balstīts rēķinu ģenerēšanas un izdevumu pārvaldības rīks pašnodarbinātajiem un mazajiem uzņēmumiem. Sistēma ir veidota, fokusējoties uz pilnīgu datu privātumu (100% lokāla darbība).

## Galvenās funkcijas

* **Daudzpusīgi PVN režīmi:** Sistēmā ir iebūvēts atbalsts dažādiem rēķinu veidiem – Standarta 21%, Apgrieztā PVN maksāšana (ES B2B), 0% likme un Atbrīvojums no PVN. Rēķinos automātiski tiek iekļautas nepieciešamās atsauces uz ES direktīvām.
* **Personīgo nodokļu prognozēšana:** Sistēma ļauj tev pašam iestatīt savus IIN (Iedzīvotāju ienākuma nodoklis) un VSAOI (Valsts sociālās apdrošināšanas obligātās iemaksas) procentus atkarībā no tava konkrētā nodokļu maksātāja režīma. Tā reāllaikā aprēķina, cik liela summa jāatstāj rezerves kontā nodokļiem.
* **Fiksētie izdevumi un automātiskā atskaitīšana:** Pievieno regulāros abonementus (piemēram, Adobe, hostinga izmaksas utt.). Sistēma automātiski atskaita šos izdevumus no tavas mēneša nodokļu "rezerves", palīdzot precīzi prognozēt patieso neto peļņu.
* **Gudrā PDF augšupielāde un validācija:** Augšupielādējot izdevumu rēķinus, sistēmas Node.js serveris pārbauda ne tikai faila nosaukumu, bet ar `pdf-parse` (OCR) ielūkojas pašā PDF saturā, lai pārliecinātos, ka dokuments tiešām atbilst norādītajam gadam un mēnesim.
* **Klientu un pārdevēja datu bāze:** Iestatījumos vari vienreiz saglabāt savus rekvizītus (Pārdevēja datus), kā arī izveidot un saglabāt klientu sarakstu. Izrakstot jaunu rēķinu, klienta datus var ievietot ar vienu klikšķi.

## Datu un failu glabāšana (100% Lokāli)
Sistēma nesūta tavus datus uz ārējiem serveriem.
* **Datu bāze:** Visi tavi rēķini, klienti un iestatījumi tiek fiziski un automātiski saglabāti vienā `data.json` failā tavā darba mapītē. 
* **Failu organizācija:** Visi PDF faili (gan tavi ģenerētie, gan augšupielādētie izdevumi) tiek automātiski strukturēti un fiziski saglabāti `invoices/` mapē.
* **Rezerves kopijas:** Sistēmā ir iebūvēta "Importēt/Eksportēt" poga papildu drošībai un datu pārnešanai uz citu datoru.

## Priekšnosacījumi
Lai darbinātu šo sistēmu, tavā datorā jābūt instalētam **Node.js**.  
[Lejupielādēt Node.js šeit](https://nodejs.org/).

## Kā palaist sistēmu

Sistēma ir veidota tā, lai to varētu palaist ar vienu klikšķi.

### Mac un Linux lietotājiem:
1. Pārliecinies, ka pirms pirmās palaišanas skriptam ir iedotas izpildes (executable) tiesības. Atver termināli un ieraksti (neaizmirsti atstarpi pirms faila ceļa):
   ```bash
   chmod +x start.command