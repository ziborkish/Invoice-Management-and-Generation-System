const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const invoicesDir = path.join(__dirname, 'invoices');
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const dataFile = path.join(__dirname, 'data.json');
const jsonDir = path.join(__dirname, 'json');

function getLatestDataFile() {
    let fileToRead = dataFile;
    if (fs.existsSync(jsonDir)) {
        const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
        if (files.length > 0) {
            let newestFile = files[0];
            let newestTime = fs.statSync(path.join(jsonDir, newestFile)).mtime.getTime();
            for (let i = 1; i < files.length; i++) {
                const time = fs.statSync(path.join(jsonDir, files[i])).mtime.getTime();
                if (time > newestTime) { newestTime = time; newestFile = files[i]; }
            }
            let dataJsonTime = fs.existsSync(dataFile) ? fs.statSync(dataFile).mtime.getTime() : 0;
            if (newestTime > dataJsonTime) fileToRead = path.join(jsonDir, newestFile);
        }
    }
    return fileToRead;
}

app.get('/api/data', (req, res) => {
    const fileToRead = getLatestDataFile();
    if (fs.existsSync(fileToRead)) {
        let data = JSON.parse(fs.readFileSync(fileToRead, 'utf8'));
        let changed = false;

        // Pārbauda, vai fiziskais fails vēl eksistē
        if (data.expense_records) {
            data.expense_records.forEach(rec => {
                if (rec.verified) {
                    const safeExpName = rec.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const expDir = path.join(invoicesDir, safeExpName);
                    if (rec.fileName && !fs.existsSync(path.join(expDir, rec.fileName))) {
                        rec.verified = false; rec.fileName = null; rec.validationMethod = null; changed = true;
                    } else if (!rec.fileName) {
                        rec.verified = false; changed = true;
                    }
                }
            });
        }
        if (changed) fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        res.json(data);
    } else {
        res.json({}); 
    }
});

app.post('/api/data', (req, res) => {
    fs.writeFileSync(dataFile, JSON.stringify(req.body, null, 2));
    res.send('Dati saglabāti automātiski!');
});

app.post('/api/upload-expense', upload.single('invoice'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nav pievienots fails.');

    const expenseName = req.body.expenseName;
    const targetDate = req.body.targetDate; // formāts "2026-09"
    const [y, m] = targetDate.split('-');

    const mNum = parseInt(m, 10);
    const monthVariants = [
        m, mNum.toString(),
        new Date(y, mNum-1, 1).toLocaleString('lv-LV', {month: 'long'}).toLowerCase(),
        new Date(y, mNum-1, 1).toLocaleString('lv-LV', {month: 'short'}).toLowerCase(),
        new Date(y, mNum-1, 1).toLocaleString('en-US', {month: 'long'}).toLowerCase(),
        new Date(y, mNum-1, 1).toLocaleString('en-US', {month: 'short'}).toLowerCase(),
        "sept"
    ];

    const fileNameLower = req.file.originalname.toLowerCase();
    let isValid = false;
    let validationMethod = '';

    // 1. Pārbaudām faila nosaukumu
    if (fileNameLower.includes(y) && monthVariants.some(v => fileNameLower.includes(v))) {
        isValid = true;
        validationMethod = 'nosaukuma';
    }

    // 2. Ja nosaukums neder, lasām PDF saturu
    if (!isValid) {
        try {
            const data = await pdfParse(req.file.buffer);
            const text = data.text.toLowerCase();
            if (text.includes(y) && monthVariants.some(v => text.includes(v))) {
                isValid = true;
                validationMethod = 'satura';
            }
        } catch(e) {
            console.log("Neizdevās nolasīt PDF saturu:", e);
        }
    }

    if (!isValid) {
        return res.status(400).send(`Neizdevās apstiprināt rēķinu! Faila nosaukumā vai saturā netika atrasts gads (${y}) un mēnesis.`);
    }

    const safeExpName = expenseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const expDir = path.join(invoicesDir, safeExpName);
    if (!fs.existsSync(expDir)) fs.mkdirSync(expDir, { recursive: true });

    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(expDir, safeName);
    fs.writeFileSync(filePath, req.file.buffer);

    // Atgriežam informāciju par to, KĀ fails tika validēts
    res.json({ success: true, fileName: safeName, validationMethod: validationMethod });
});

app.listen(PORT, () => {
    console.log(`\nServeris gatavs! Atver: http://localhost:${PORT}\n`);
});