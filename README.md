# Rēķinu pārvaldības un ģenerēšanas sistēma

Vienkārša un ātra rēķinu izrakstīšanas aplikācija, kas pilnībā darbojas pārlūkprogrammā. Ar to var izveidot un pārvaldīt rēķinus, sekot līdzi to apmaksas statusam un eksportēt tos PDF formātā.

Visi dati tiek glabāti lokāli pārlūkā, izmantojot `localStorage`, tāpēc backend serveris vai datubāze nav nepieciešami. Datus var arī eksportēt JSON failā — tajā tiek saglabāti rēķini, tavi iestatījumi, uzņēmuma rekvizīti un klientu informācija. Šo failu pēc tam var importēt atpakaļ, piemēram, lai izveidotu rezerves kopiju vai pārvietotu visus datus uz citu ierīci.
## ✨ Galvenās funkcijas

* **Rēķinu pārvaldība:** Var izveidot, rediģēt un dzēst rēķinus, kā arī atzīmēt tos kā apmaksātus vai neapmaksātus.
* **Automātiski aprēķini:** Aplikācija automātiski aprēķina starpsummas, PVN un gala summu. Tiek atbalstīti dažādi PVN režīmi, kā arī automātiska summas izrakstīšana vārdiem.
* **PDF eksports:** Rēķinus var eksportēt PDF formātā, saglabājot precīzu rēķina izkārtojumu, stilus un izmantotos fontus. PDF ģenerēšana notiek izolētā, slēptā *iframe*, lai rēķina CSS neietekmētu pārējo aplikāciju.
* **Dashboard:** Vienuviet var redzēt kopējos ieņēmumus, neapmaksātos rēķinus un aptuvenos nodokļus, piemēram, IIN un VSAOI.
* **Lokāla datu glabāšana:** Rēķini, uzņēmuma rekvizīti un nodokļu iestatījumi tiek glabāti tieši pārlūkā, izmantojot `localStorage`. Tas nozīmē, ka aplikācija var darboties bez backend servera un dati paliek lokāli.
* **JSON eksports/imports:** Visus datus var eksportēt JSON failā rezerves kopijai vai importēt tos citā ierīcē.

## 🛠 Izmantotās tehnoloģijas

* **HTML5 / CSS3** – pielāgots responsīvs dizains ar CSS mainīgajiem
* **Vanilla JavaScript** – ES6+
* **[jsPDF](https://github.com/parallax/jsPDF)** – V2.5.1, izmantots PDF failu ģenerēšanai
* **[html2canvas](https://html2canvas.hertzen.com/)** – V1.4.1, izmantots rēķina HTML pārveidošanai attēlā PDF failam

## 📂 Projekta struktūra

Projekts ir veidots diezgan vienkārši un sastāv no trim galvenajiem failiem:

* `index.html` – galvenā lietotāja saskarne, rēķinu saraksti un skati. Šeit tiek pievienotas arī nepieciešamās ārējās CDN bibliotēkas.
* `style.css` – aplikācijas stili, tostarp ekrānu pārslēgšana, Dashboard izkārtojums un animētā peldošā izvēlne datu importam un eksportam.
* `script.js` – galvenā aplikācijas loģika: datu pārvaldība, aprēķini, PDF ģenerēšana caur *iframe* un JSON imports/eksports.

## 🚀 Kā uzstādīt un lietot

1. Noklonē vai lejupielādē repozitoriju.
2. Pārliecinies, ka visi trīs faili (`index.html`, `style.css`, `script.js`) atrodas vienā direktorijā.
3. Atver `index.html` jebkurā modernā pārlūkprogrammā, piemēram, Chrome, Safari, Edge vai Firefox. Nav nepieciešams serveris, *build* process vai datubāze.
4. Sāc ar **Iestatījumu** sadaļu un ievadi sava uzņēmuma rekvizītus un nodokļu likmes.
5. Dodies uz **Rēķini** sadaļu un spied **+ Izrakstīt rēķinu**.

## 💡 Kā darbojas PDF ģenerēšana

PDF ģenerēšanai tiek izmantota atsevišķa renderēšanas vide, lai rēķina veidnei varētu būt savs dizains un CSS, kas neietekmē pārējo aplikāciju.

Kad tiek izsaukta `downloadInvoicePDF()` funkcija, `script.js` izveido slēptu `iframe` un tajā ievieto sagatavoto rēķina HTML un CSS. Pēc tam skripts pagaida, līdz ielādējas ārējie fonti, un tikai tad turpina ar rēķina renderēšanu.

Iegūtais rēķins tiek pārveidots attēlā ar `html2canvas`, un pēc tam tas tiek ievietots gala PDF failā, izmantojot `jsPDF`.

Šāda pieeja ļauj pilnībā nodalīt rēķina veidni no pārējās aplikācijas un izmantot pielāgotus fontus un precīzāku izkārtojumu, neradot konfliktus ar aplikācijas UI.




# Invoice Management & Generation System

A simple, fast, fully browser-based app for creating and managing invoices. It lets you create invoices, keep track of their payment status, and export them as properly formatted PDF files.

Everything is stored locally in the browser using `localStorage`, so there’s no backend or database involved. You can also export all your data as a JSON file and import it later if you need to move it to another device or keep a backup.

## ✨ Main Features

* **Invoice management:** Create, edit, delete, and mark invoices as paid or unpaid.
* **Automatic calculations:** The app automatically calculates subtotals, VAT, and the final total. It supports different VAT modes and can also generate the total amount in words.
* **PDF export:** Invoices are exported as PDF files while keeping the exact layout, styling, and fonts used in the invoice template. The PDF generation runs inside an isolated hidden *iframe*, so the invoice-specific CSS doesn’t interfere with the main app.
* **Dashboard:** A simple overview of total revenue, unpaid invoices, and estimated taxes such as income tax (IIN) and social contributions (VSAOI).
* **Local data storage:** All invoices, company details, and tax settings are stored directly in the browser using `localStorage`. This means the app works without a backend and keeps everything local.
* **JSON export/import:** Export your data as a JSON file for backups or import it on another device.

## 🛠 Tech Stack

* **HTML5 / CSS3** – Custom responsive layout using CSS variables
* **Vanilla JavaScript** – ES6+
* **[jsPDF](https://github.com/parallax/jsPDF)** – V2.5.1, used for generating PDF files
* **[html2canvas](https://html2canvas.hertzen.com/)** – V1.4.1, used to render the invoice HTML as an image for the PDF

## 📂 Project Structure

The project is intentionally kept pretty simple and consists of three main files:

* `index.html` – Main UI, invoice lists, and views. Also includes the required external CDN libraries.
* `style.css` – All app styling, including screen switching, the dashboard layout, and the animated floating menu for importing and exporting data.
* `script.js` – Main application logic, including data management, calculations, PDF generation through the *iframe*, and JSON import/export.

## 🚀 How to Set It Up

1. Clone or download the repository.
2. Make sure all three files (`index.html`, `style.css`, `script.js`) are in the same directory.
3. Open `index.html` in any modern browser such as Chrome, Safari, Edge, or Firefox. No server, build process, or database is needed.
4. Start by opening **Settings** and entering your company details and tax rates.
5. Go to the **Invoices** section and click **+ Create Invoice**.

## 💡 How the PDF Generation Works

The app uses a separate rendering environment for generating invoices so that the invoice template can have its own styling without affecting the rest of the app.

When `downloadInvoicePDF()` is called, `script.js` creates a hidden `iframe` and injects the prepared invoice HTML and CSS into it. The script then waits for external fonts to load before rendering the invoice.

The rendered result is converted into an image using `html2canvas` and then placed into the final PDF using `jsPDF`.

This approach keeps the invoice template isolated from the main application and makes it possible to use custom fonts and more precise layouts without messing with the app's UI.
