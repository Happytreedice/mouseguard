const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { ClassicLevel } = require('classic-level');
const LOCALE_FILE = path.join(__dirname, '../lang/en.json');
const locale = JSON.parse(fs.readFileSync(LOCALE_FILE, 'utf8'));

const PACKS = [
    {
        name: 'skills',
        srcDir: path.join(__dirname, '../src/packs/skills'),
        outDir: path.join(__dirname, '../packs/skills'),
        type: 'skill'
    },
    {
        name: 'traits',
        srcDir: path.join(__dirname, '../src/packs/traits'),
        outDir: path.join(__dirname, '../packs/traits'),
        type: 'trait'
    }
];

function validateDocument(doc, file, pack) {
    const missing = [];
    if (typeof doc._id !== 'string' || !doc._id.trim()) missing.push('_id');
    if (typeof doc.name !== 'string' || !doc.name.trim()) missing.push('name');
    if (doc.type !== pack.type) missing.push(`type=${pack.type}`);
    if (!doc.system || typeof doc.system.description !== 'string') missing.push('system.description');
    if (pack.type === 'skill') {
        for (const key of ['rank', 'pass', 'fail']) {
            if (!Number.isFinite(doc.system[key])) missing.push(`system.${key}`);
        }
        for (const key of ['description', 'supplies', 'factors', 'help']) {
            const value = doc.flags?.mouseguard?.description?.[key];
            const localized = typeof value === 'string' && Object.prototype.hasOwnProperty.call(locale, value);
            if (typeof value !== 'string' || (!value.trim() && !localized)) {
                missing.push(`flags.mouseguard.description.${key}`);
            }
        }
    }
    if (pack.type === 'trait') {
        for (const key of ['level', 'usedfor', 'usedagainst']) {
            if (!Number.isFinite(doc.system[key])) missing.push(`system.${key}`);
        }
        for (const key of ['description', 'level1', 'level2', 'level3', 'against']) {
            const value = doc.flags?.mouseguard?.description?.[key];
            const localized = typeof value === 'string' && Object.prototype.hasOwnProperty.call(locale, value);
            if (typeof value !== 'string' || (!value.trim() && !localized)) {
                missing.push(`flags.mouseguard.description.${key}`);
            }
        }
    }
    if (missing.length) throw new Error(`${file}: missing or invalid ${missing.join(', ')}`);
}

async function compilePack(pack) {
    if (!fs.existsSync(pack.srcDir)) {
        console.warn(`Source directory does not exist: ${pack.srcDir}`);
        return;
    }

    if (!fs.existsSync(pack.outDir)) {
        fs.mkdirSync(pack.outDir, { recursive: true });
    }

    const db = new ClassicLevel(pack.outDir, { valueEncoding: 'json' });
    await db.open();

    const files = fs.readdirSync(pack.srcDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    console.log(`Compiling ${files.length} items for pack: ${pack.name}...`);

    const items = [];

    for (const file of files) {
        const filePath = path.join(pack.srcDir, file);
        const raw = fs.readFileSync(filePath, 'utf8');
        const doc = yaml.load(raw);

        if (!doc || typeof doc !== 'object') throw new Error(`${file}: expected a YAML mapping`);
        validateDocument(doc, file, pack);
        const descriptionParts = doc.flags.mouseguard.description;
        const localizedDescription = {
            template: pack.type === 'skill' ? 'MOUSEGUARD.SkillDescription' : 'MOUSEGUARD.TraitDescription',
            parts: Object.fromEntries(Object.keys(descriptionParts).map((key) => [key, `MOUSEGUARD.${pack.type === 'skill' ? 'Skill' : 'Trait'}.${path.basename(file, path.extname(file)).split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('')}.${key[0].toUpperCase()}${key.slice(1)}`]))
        };

        // Format system data cleanly
        const system = {
            description: localizedDescription
        };

        if (pack.type === 'skill') {
            system.rank = doc.system?.rank ?? 0;
            system.pass = doc.system?.pass ?? 0;
            system.fail = doc.system?.fail ?? 0;
        } else if (pack.type === 'trait') {
            system.level = doc.system?.level ?? 1;
            system.usedfor = doc.system?.usedfor ?? 0;
            system.usedagainst = doc.system?.usedagainst ?? 0;
        }

        const item = {
            _id: doc._id,
            name: doc.name || path.basename(file, path.extname(file)),
            type: pack.type,
            img: doc.img || 'icons/svg/item-bag.svg',
            system: system,
            effects: doc.effects || [],
            folder: doc.folder ?? null,
            sort: doc.sort ?? 0,
            ownership: doc.ownership || { default: 0 },
            flags: doc.flags || {}
        };

        // If there are raw details in YAML, store in flags for reference
        if (doc.details) {
            item.flags.mouseguard = item.flags.mouseguard || {};
            item.flags.mouseguard.details = doc.details;
        }

        items.push(item);
    }

    const batch = db.batch();
    for (const item of items) batch.put(`!items!${item._id}`, item);
    await batch.write();
    await db.close();
    console.log(`Successfully compiled pack: ${pack.name} (${files.length} items)`);
}

async function buildAll() {
    for (const pack of PACKS) {
        await compilePack(pack);
    }
}

if (require.main === module) {
    buildAll().catch(err => {
        console.error('Error compiling compendiums:', err);
        process.exit(1);
    });
}

module.exports = { compilePack, buildAll, validateDocument };
