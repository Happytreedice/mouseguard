/**
 * Compile the YAML compendium sources (src/packs/<pack>/*.yml) into Foundry LevelDB packs (packs/<pack>).
 *
 * Every source file must be a complete Item document matching the system data models
 * (module/data-models.js: SkillData / TraitData). The build validates each document strictly
 * and refuses to write anything if a single file is invalid. Each pack database is cleared before
 * it is rewritten, so documents whose source file was deleted disappear from the compendium.
 *
 * Usage: node scripts/build_packs.js            (build all packs)
 *        node scripts/build_packs.js --check    (validate only, write nothing)
 */
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

const ID_PATTERN = /^[A-Za-z0-9]{16}$/;
const TOP_LEVEL_KEYS = new Set(['_id', 'name', 'type', 'img', 'system', 'effects', 'folder', 'sort', 'ownership', 'flags', '_stats']);
const MOUSEGUARD_FLAG_KEYS = new Set(['originalName']);

/** Allowed system fields per item type: kind + constraints (mirrors module/data-models.js). */
const SYSTEM_SCHEMA = {
    skill: {
        rank: { kind: 'int', min: 0, max: 6 },
        learning: { kind: 'int', min: 0, max: 10 },
        beginnersLuck: { kind: 'choice', choices: ['will', 'health'] },
        specialty: { kind: 'boolean' },
        advancement: {
            kind: 'object',
            fields: {
                passed: { kind: 'int', min: 0, max: 6 },
                failed: { kind: 'int', min: 0, max: 6 }
            }
        },
        description: { kind: 'html', required: true },
        supplies: { kind: 'html' },
        factors: { kind: 'html', required: true },
        help: { kind: 'stringArray' }
    },
    trait: {
        level: { kind: 'int', min: 1, max: 3 },
        usedFor: { kind: 'int', min: 0, max: 2 },
        usedAgainst: { kind: 'int', min: 0, max: 99 },
        checksEarned: { kind: 'int', min: 0, max: 99 },
        description: { kind: 'html', required: true },
        levels: {
            kind: 'object',
            fields: {
                level1: { kind: 'html', required: true },
                level2: { kind: 'html', required: true },
                level3: { kind: 'html', required: true }
            }
        },
        against: { kind: 'html', required: true },
        origin: { kind: 'string' }
    }
};

/** Validate `value` against a field spec; push problems (with dotted path) into `errors`. */
function validateField(spec, value, fieldPath, errors) {
    switch (spec.kind) {
        case 'int':
            if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
                errors.push(`${fieldPath} must be an integer ${spec.min}..${spec.max} (got ${JSON.stringify(value)})`);
            }
            break;
        case 'boolean':
            if (typeof value !== 'boolean') errors.push(`${fieldPath} must be a boolean`);
            break;
        case 'choice':
            if (!spec.choices.includes(value)) errors.push(`${fieldPath} must be one of ${spec.choices.join('|')}`);
            break;
        case 'string':
            if (typeof value !== 'string') errors.push(`${fieldPath} must be a string`);
            break;
        case 'html':
            if (typeof value !== 'string') {
                errors.push(`${fieldPath} must be an HTML string (no i18n key objects)`);
            } else if (spec.required && !value.trim()) {
                errors.push(`${fieldPath} must not be empty`);
            } else if (/\bMOUSEGUARD\.[A-Za-z]/.test(value)) {
                errors.push(`${fieldPath} contains an i18n key; compendium text must be real content`);
            } else if (value.trim() && !/^\s*</.test(value)) {
                errors.push(`${fieldPath} must be HTML (start with a tag such as <p> or <ul>)`);
            }
            break;
        case 'stringArray':
            if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) {
                errors.push(`${fieldPath} must be an array of non-empty strings`);
            } else if (new Set(value).size !== value.length) {
                errors.push(`${fieldPath} contains duplicates`);
            }
            break;
        case 'object': {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                errors.push(`${fieldPath} must be an object`);
                break;
            }
            validateObject(spec.fields, value, fieldPath, errors);
            break;
        }
        default:
            errors.push(`${fieldPath}: unknown spec kind ${spec.kind}`);
    }
}

/** Every schema field must be present and valid; no extra (legacy) keys allowed. */
function validateObject(fields, obj, objPath, errors) {
    for (const [key, spec] of Object.entries(fields)) {
        if (!(key in obj)) errors.push(`${objPath}.${key} is missing`);
        else validateField(spec, obj[key], `${objPath}.${key}`, errors);
    }
    for (const key of Object.keys(obj)) {
        if (!(key in fields)) errors.push(`${objPath}.${key} is not part of the schema (legacy field?)`);
    }
}

/**
 * Validate one source document. Throws with every problem found.
 * @param {object} doc   Parsed YAML document
 * @param {string} file  Source file name (for messages)
 * @param {object} pack  Pack definition (type)
 */
function validateDocument(doc, file, pack) {
    const errors = [];
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(`${file}: expected a YAML mapping`);

    if (typeof doc._id !== 'string' || !ID_PATTERN.test(doc._id)) errors.push('_id must be a 16-character alphanumeric string');
    if (typeof doc.name !== 'string' || !doc.name.trim()) errors.push('name is missing');
    else if (doc.name.startsWith('MOUSEGUARD.')) errors.push('name must be real text, not an i18n key');
    if (doc.type !== pack.type) errors.push(`type must be "${pack.type}"`);
    if (typeof doc.img !== 'string' || !doc.img.trim()) errors.push('img is missing');
    for (const key of Object.keys(doc)) {
        if (!TOP_LEVEL_KEYS.has(key)) errors.push(`top-level key "${key}" is not allowed (move free-form data into system fields)`);
    }
    if (doc.effects !== undefined && !Array.isArray(doc.effects)) errors.push('effects must be an array');

    const schema = SYSTEM_SCHEMA[pack.type];
    if (!doc.system || typeof doc.system !== 'object') errors.push('system is missing');
    else validateObject(schema, doc.system, 'system', errors);

    const flags = doc.flags?.mouseguard;
    if (!flags || typeof flags.originalName !== 'string' || !flags.originalName.trim()) {
        errors.push('flags.mouseguard.originalName (English name) is missing');
    }
    if (flags) {
        for (const key of Object.keys(flags)) {
            if (!MOUSEGUARD_FLAG_KEYS.has(key)) errors.push(`flags.mouseguard.${key} is not allowed (legacy description/details flag?)`);
        }
    }

    if (errors.length) throw new Error(`${file}:\n  - ${errors.join('\n  - ')}`);
}

/** Cross-document checks for one pack: unique _id and name, help lists reference skills of the pack. */
function validatePack(entries, pack) {
    const errors = [];
    const byId = new Map();
    const byName = new Map();
    for (const { file, doc } of entries) {
        if (byId.has(doc._id)) errors.push(`duplicate _id ${doc._id}: ${byId.get(doc._id)} and ${file}`);
        else byId.set(doc._id, file);
        const nameKey = doc.name.trim().toLocaleLowerCase('ru');
        if (byName.has(nameKey)) errors.push(`duplicate name "${doc.name}": ${byName.get(nameKey)} and ${file}`);
        else byName.set(nameKey, file);
    }
    if (pack.type === 'skill') {
        for (const { file, doc } of entries) {
            for (const helper of doc.system.help) {
                if (!byName.has(helper.trim().toLocaleLowerCase('ru'))) errors.push(`${file}: system.help names unknown skill "${helper}"`);
                if (helper === doc.name) errors.push(`${file}: a skill cannot help itself`);
            }
        }
    }
    if (errors.length) throw new Error(`pack ${pack.name}:\n  - ${errors.join('\n  - ')}`);
}

/** Read, validate and normalise all documents of a pack (no writing). */
function loadPack(pack) {
    if (!fs.existsSync(pack.srcDir)) throw new Error(`Source directory does not exist: ${pack.srcDir}`);
    const files = fs.readdirSync(pack.srcDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
    const entries = [];
    const failures = [];
    for (const file of files) {
        try {
            const doc = yaml.load(fs.readFileSync(path.join(pack.srcDir, file), 'utf8'));
            validateDocument(doc, file, pack);
            entries.push({ file, doc });
        } catch (err) {
            failures.push(err.message);
        }
    }
    if (failures.length) throw new Error(`Invalid documents in pack ${pack.name}:\n${failures.join('\n')}`);
    validatePack(entries, pack);

    return entries.map(({ doc }) => ({
        _id: doc._id,
        name: doc.name.trim(),
        type: pack.type,
        img: doc.img,
        system: doc.system,
        effects: doc.effects ?? [],
        folder: doc.folder ?? null,
        sort: doc.sort ?? 0,
        ownership: doc.ownership ?? { default: 0 },
        flags: doc.flags,
        ...(doc._stats ? { _stats: doc._stats } : {})
    }));
}

async function compilePack(pack, { check = false } = {}) {
    const items = loadPack(pack);
    if (check) {
        console.log(`Validated pack: ${pack.name} (${items.length} items)`);
        return items.length;
    }

    fs.mkdirSync(pack.outDir, { recursive: true });
    const db = new ClassicLevel(pack.outDir, { valueEncoding: 'json' });
    await db.open();
    try {
        // Start from an empty database so deleted/renamed sources do not linger in the compendium.
        await db.clear();
        const batch = db.batch();
        for (const item of items) batch.put(`!items!${item._id}`, item);
        await batch.write();
        await db.compactRange('\x00', '\xff');
    } finally {
        await db.close();
    }
    console.log(`Compiled pack: ${pack.name} (${items.length} items)`);
    return items.length;
}

async function buildAll(options = {}) {
    // Validate everything first so an invalid source never leaves packs half-written.
    for (const pack of PACKS) loadPack(pack);
    for (const pack of PACKS) await compilePack(pack, options);
}

if (require.main === module) {
    buildAll({ check: process.argv.includes('--check') }).catch((err) => {
        console.error('Error compiling compendiums:', err.message ?? err);
        process.exit(1);
    });
}

module.exports = { compilePack, buildAll, validateDocument, validatePack, loadPack, PACKS };
