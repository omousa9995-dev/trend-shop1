import { readFileSync, writeFileSync } from 'node:fs';
import { careCatalog } from '../src/care-assistant.js';
import { snapshotRecords,sourceCatalog } from '../src/lama-catalog.js';

const source = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'));
const rows = sourceCatalog(source);
const records = snapshotRecords(careCatalog(rows, {includeUnavailable:true}));
writeFileSync(new URL('../public/lama-products-snapshot.json', import.meta.url), JSON.stringify(records));
console.log('Lama product reference records:', records.length);
