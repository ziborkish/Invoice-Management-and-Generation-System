#!/bin/bash
# Pāriet uz mapīti, kurā atrodas šis skripts
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================="
echo "    Rēķinu sistēmas inicializācija...     "
echo "=========================================="

# Pārbauda, vai ir instalēts Node.js
if ! command -v node &> /dev/null
then
    echo "KĻŪDA: Node.js nav atrasts!"
    echo "Lūdzu, lejupielādē un uzinstalē Node.js no https://nodejs.org/"
    exit
fi

echo "Pārbauda nepieciešamās pakotnes..."
npm install express multer pdf-parse

echo "Palaiž serveri un atver pārlūkprogrammu..."
# Pagaida 2 sekundes un atver pārlūku
sleep 2 && open http://localhost:3000 &

# Palaiž pašu serveri
node server.js