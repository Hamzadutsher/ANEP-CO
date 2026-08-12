/* Génère un certificat auto-signé (HTTPS) pour le serveur ANEP MOD.
   Usage : node scripts/gen-cert.js  (ou npm run gen-cert)
   Le certificat couvre localhost + les adresses IPv4 locales détectées. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

const CERT_DIR = path.join(__dirname, '..', 'data', 'certs');
fs.mkdirSync(CERT_DIR, { recursive: true });

// Adresses IPv4 locales
const ips = ['127.0.0.1'];
Object.values(os.networkInterfaces()).forEach(list => {
    (list || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); });
});

const altNames = [
    { type: 2, value: 'localhost' },
    ...ips.map(ip => ({ type: 7, ip }))
];

const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'ANEP MOD' }, { name: 'organizationName', value: 'ANEP' }],
    { days: 3650, keySize: 2048, algorithm: 'sha256', extensions: [{ name: 'subjectAltName', altNames }] }
);

fs.writeFileSync(path.join(CERT_DIR, 'server.key'), pems.private);
fs.writeFileSync(path.join(CERT_DIR, 'server.crt'), pems.cert);

console.log('✅ Certificat auto-signé généré dans data/certs/ (server.key + server.crt)');
console.log('   Valable 10 ans, pour : ' + ips.join(', ') + ', localhost');
console.log('   Relancez le serveur (npm run serve) pour activer HTTPS.');
console.log('   ⚠ Certificat auto-signé : le navigateur affichera un avertissement à accepter une fois.');
