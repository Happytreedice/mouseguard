const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const locales = ['en', 'ru'].map((locale) => ({
    locale,
    data: JSON.parse(fs.readFileSync(path.join(root, 'lang', `${locale}.json`), 'utf8'))
}));
const [base, ...translations] = locales;
const failures = [];

for (const { locale, data } of translations) {
    const missing = Object.keys(base.data).filter((key) => !(key in data));
    const extra = Object.keys(data).filter((key) => !(key in base.data));
    if (missing.length) failures.push(`${locale}: missing keys: ${missing.join(', ')}`);
    if (extra.length) failures.push(`${locale}: keys absent from ${base.locale}: ${extra.join(', ')}`);
}

for (const key of Object.keys(base.data)) {
    const placeholders = (text) => [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
    const expected = placeholders(base.data[key]);
    for (const { locale, data } of translations) {
        if (JSON.stringify(expected) !== JSON.stringify(placeholders(data[key] || ''))) {
            failures.push(`${locale}: placeholder mismatch in ${key}`);
        }
    }
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Validated ${Object.keys(base.data).length} locale keys in ${locales.length} locales.`);
}
