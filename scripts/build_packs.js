const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { ClassicLevel } = require('classic-level');

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

    const batch = db.batch();

    for (const file of files) {
        const filePath = path.join(pack.srcDir, file);
        const raw = fs.readFileSync(filePath, 'utf8');
        const doc = yaml.load(raw);

        if (!doc || !doc._id) {
            console.warn(`Skipping invalid doc in ${file}: missing _id`);
            continue;
        }

        // Format system data cleanly
        const system = {
            description: doc.system?.description || ''
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

        batch.put(`!items!${item._id}`, item);
    }

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

module.exports = { compilePack, buildAll };
