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
1. Pārliecinies, ka pirms pirmās palaišanas skriptam ir iedotas izpildes (executable) tiesības. Atver termināli, dodies uz mapīti un ieraksti: `chmod +x start.command`
2. **Svarīgi Mac lietotājiem (Apple Gatekeeper apvedceļš):** Tā kā fails ir lejupielādēts no interneta, Apple to var bloķēt, ja mēģināsi to atvērt ar dubultklikšķi. Lai to atļautu, dari vienu no šiem:
   * Uzklikšķini uz `start.command` faila ar **labo peles taustiņu** un izvēlies **"Open"** (Atvērt). Pēc tam brīdinājuma logā vēlreiz nospied "Open".
   * **VAI** terminālī noņem failam karantīnas birku ar šo komandu: `xattr -c start.command`
3. Turpmāk vari failu vienkārši atvērt ar dubultklikšķi. 
4. Skripts automātiski uzinstalēs trūkstošās pakotnes (`express`, `multer`, `pdf-parse`), palaidīs serveri un atvērs sistēmu pārlūkprogrammā.

### Windows lietotājiem:
1. Atver **`start.bat`** failu ar dubultklikšķi.
2. Skripts pats uzinstalēs nepieciešamo un atvērs sistēmu tavā noklusējuma pārlūkprogrammā (`http://localhost:3000`).

---

# Invoice & Expense Manager

A lightweight, browser-based invoice generation and expense management tool built for freelancers and small businesses. The system is designed with a strict focus on complete data privacy (100% local execution).

## Key Features

* **Versatile VAT Modes:** Built-in support for multiple invoice types – Standard 21%, Reverse charge (EU B2B), 0% rate, and VAT Exempt. Invoices automatically include the necessary legal references to EU directives.
* **Personal Tax Forecasting:** Set your own income tax and social security tax percentages based on your specific taxpayer regime. The system calculates the exact amount you need to leave in your reserve account for taxes in real-time.
* **Fixed Expenses & Auto-Deduction:** Add regular monthly subscriptions (e.g., Adobe, hosting costs). The system automatically deducts these fixed expenses from your tax "reserve", helping you accurately forecast your true net profit.
* **Smart PDF Upload & Validation:** When uploading expense invoices, the Node.js backend doesn't just check the filename. It uses `pdf-parse` to read the actual content of the PDF, ensuring the document genuinely matches the required year and month.
* **Client & Vendor Database:** Save your company details and build a client roster in the settings. You can populate new invoices with client data in a single click.

## Data & File Storage (100% Local)
This system does not send your data to external servers.
* **Database:** All your invoices, clients, and settings are physically and automatically saved in a single `data.json` file in your working directory.
* **File Organization:** All PDF files (both your generated invoices and uploaded expense receipts) are automatically structured and saved in the local `invoices/` folder.
* **Backups:** A built-in "Import/Export" button allows you to backup or transfer your entire database as a JSON file with one click.

## Prerequisites
To run this system, you must have **Node.js** installed on your computer.  
[Download Node.js here](https://nodejs.org/).

## How to Run the System

The application is designed to run "out-of-the-box" with a single click, requiring no terminal configuration from the user. (Note: The `data.json` file and `invoices/` directory will be automatically generated upon your first interaction).

### For Mac and Linux Users:
1. Ensure the startup script has executable permissions before the first run. Open your terminal, navigate to the folder, and run: `chmod +x start.command`
2. **Important for Mac users (Gatekeeper bypass):** Because the file was downloaded from the internet, macOS will block it if you double-click it. To allow it, do one of the following:
   * **Right-click** (or Control-click) the `start.command` file and select **"Open"**. Click "Open" again in the warning dialog.
   * **OR** remove the quarantine attribute via terminal by running: `xattr -c start.command`
3. From then on, simply double-click the `start.command` file to run the application.
4. The script will automatically install missing dependencies (`express`, `multer`, `pdf-parse`), start the local server, and open the system in your default browser.

### For Windows Users:
1. Simply double-click the **`start.bat`** file.
2. The script will install dependencies, launch the server, and open the system in your default browser (`http://localhost:3000`).
