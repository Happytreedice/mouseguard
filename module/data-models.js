/**
 * TypeDataModels for Mouse Guard Actor and Item documents.
 *
 * Legacy data (template.json era, the first data-model era and the old compendium builder) is converted on load by
 * the static `migrateData` methods, so existing worlds keep working without a world migration. Item-level conversions
 * that need the document `name`/`type`/`flags` live in {@link migrateItemSource}, which `MouseGuardItem.migrateData`
 * calls (Foundry passes only the `system` object to the TypeDataModel migration).
 *
 * migrateData also runs on partial update diffs, so every conversion below is guarded by `"key" in source` checks and
 * never invents defaults for fields that are absent.
 */
const { TypeDataModel } = foundry.abstract;
const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Shared constants and helpers                */
/* -------------------------------------------- */

/** Ability keys in display order. */
export const ABILITY_KEYS = Object.freeze(["nature", "will", "health", "resources", "circles"]);

/** Condition keys stored in `system.conditions`. */
export const CONDITION_KEYS = Object.freeze(["hungryThirsty", "angry", "tired", "injured", "sick"]);

/**
 * Version of the item data layout. Stored in `flags.mouseguard.schemaVersion` once an item has been written with the
 * current layout; after that the legacy fields still lying in the database are ignored instead of being converted again.
 */
export const ITEM_SCHEMA_VERSION = 2;

/** Legacy `system` keys per item type that the current schema replaced. */
export const LEGACY_SYSTEM_KEYS = Object.freeze({
    ability: ["tax", "pass", "fail"],
    skill: ["pass", "fail", "groups", "attributes"],
    trait: ["usedfor", "usedagainst", "usesThisSession", "exhausted"],
    wise: ["pass", "fail", "rank"]
});

const ABILITY_NAME_TABLE = {
    will: "will",
    "воля": "will",
    health: "health",
    "здоровье": "health",
    resources: "resources",
    "ресурсы": "resources",
    circles: "circles",
    "связи": "circles"
};

const NATURE_NAME = /^(?:MOUSEGUARD\.)?(?:[MW]?Nature|Природа)(?:\s*\(.*\))?$/i;

/**
 * Infer an ability key from a (legacy) ability name.
 * Accepts the old i18n-key names ("MOUSEGUARD.MNature", "MOUSEGUARD.Will", ...), the animal form
 * "<Nature> (<actor name>)" and plain English or Russian names. Returns "" when nothing matches.
 * @param {string} name
 * @returns {""|"nature"|"will"|"health"|"resources"|"circles"}
 */
export function inferAbilityKey(name) {
    if (typeof name !== "string") return "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    if (NATURE_NAME.test(trimmed)) return "nature";
    const bare = trimmed.replace(/^MOUSEGUARD\./, "").toLowerCase();
    return ABILITY_NAME_TABLE[bare] ?? "";
}

/** Skills tested with Health under Beginner's Luck (physical skills, book p. 260-261); every other skill uses Will. */
const HEALTH_BL_SKILLS = new Set([
    "fighter", "боец", "potter", "гончар", "stonemason", "каменщик", "smith", "кузнец", "boatcrafter", "корабел",
    "miller", "мельник", "armorer", "оружейник", "hunter", "охотник", "brewer", "пивовар", "carpenter", "плотник",
    "laborer", "разнорабочий", "scout", "разведчик", "harvester", "сборщик", "survivalist",
    "специалист по выживанию", "glazier", "стекольщик"
]);

/**
 * Infer the Beginner's Luck ability of a skill from its name (or English original name).
 * @param {...string} names
 * @returns {"will"|"health"}
 */
export function inferBeginnersLuck(...names) {
    for (const name of names) {
        if (typeof name !== "string") continue;
        if (HEALTH_BL_SKILLS.has(name.trim().toLowerCase())) return "health";
    }
    return "will";
}

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Old compendium documents stored `description` as an object `{template, parts}` (cast by HTMLField to
 * "[object Object]") or as a bare i18n key; neither renders anything useful any more.
 * @param {object} source  system source (mutated)
 * @param {string} [key="description"]
 */
function migrateLegacyHTML(source, key = "description") {
    if (!(key in source)) return;
    const value = source[key];
    if (value === null || value === undefined) return;
    if (typeof value === "object") source[key] = "";
    else if (typeof value === "string") {
        const v = value.trim();
        if (v === "[object Object]" || /^MOUSEGUARD\.[\w.-]+$/.test(v)) source[key] = "";
    }
}

/**
 * Convert legacy `pass`/`fail` counters into `advancement.passed/failed` (keeping the larger value).
 * @param {object} source  system source (mutated)
 * @param {number} cap     maximum stored value
 */
function migrateLegacyAdvancement(source, cap) {
    const hasPass = "pass" in source;
    const hasFail = "fail" in source;
    if (!hasPass && !hasFail) return;
    const advancement = isObject(source.advancement) ? source.advancement : {};
    if (hasPass) {
        const legacy = toNumber(source.pass);
        const current = "passed" in advancement ? toNumber(advancement.passed) : 0;
        advancement.passed = Math.clamp(Math.max(legacy, current), 0, cap);
    }
    if (hasFail) {
        const legacy = toNumber(source.fail);
        const current = "failed" in advancement ? toNumber(advancement.failed) : 0;
        advancement.failed = Math.clamp(Math.max(legacy, current), 0, cap);
    }
    source.advancement = advancement;
    delete source.pass;
    delete source.fail;
}

/**
 * Document-level migration for Item sources (needs `name`, `type` and `flags`, which the TypeDataModel migration
 * does not receive). Mutates `source` in place and returns it.
 * @param {object} source            Item source data (full document or partial update diff)
 * @returns {object}
 */
export function migrateItemSource(source) {
    if (!isObject(source)) return source;
    const system = source.system;
    if (!isObject(system)) return source;

    // Items already written with the current layout: legacy keys that remain in the database are stale, drop them
    // before the system-level migration could convert them again (e.g. an old `pass` re-inflating reset marks).
    const version = toNumber(source.flags?.mouseguard?.schemaVersion, 0);
    const legacyKeys = LEGACY_SYSTEM_KEYS[source.type];
    if (version >= ITEM_SCHEMA_VERSION && legacyKeys) {
        for (const key of legacyKeys) delete system[key];
    }

    // Ability key from the legacy name ("MOUSEGUARD.MNature", "Воля", "Nature (Owl)", ...)
    if (source.type === "ability" && !system.key) {
        const key = inferAbilityKey(source.name);
        if (key) system.key = key;
    }

    // Beginner's Luck ability for skills that predate the field
    if (source.type === "skill" && !("beginnersLuck" in system) && typeof source.name === "string") {
        system.beginnersLuck = inferBeginnersLuck(source.name, source.flags?.mouseguard?.originalName);
    }
    return source;
}

/* -------------------------------------------- */
/*  Actor Data Models                           */
/* -------------------------------------------- */

const conditionsSchema = () => new fields.SchemaField({
    hungryThirsty: new fields.BooleanField({ initial: false }),
    angry: new fields.BooleanField({ initial: false }),
    tired: new fields.BooleanField({ initial: false }),
    injured: new fields.BooleanField({ initial: false }),
    sick: new fields.BooleanField({ initial: false })
});

const dispositionSchema = () => new fields.SchemaField({
    starting: new fields.NumberField({ initial: 4, integer: true, min: 0 }),
    current: new fields.NumberField({ initial: 4, integer: true, min: 0 })
});

export class CharacterData extends TypeDataModel {
    static defineSchema() {
        return {
            biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            notes: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            player: new fields.StringField({ blank: true, initial: "" }),
            details: new fields.SchemaField({
                age: new fields.NumberField({ initial: 0, integer: true }),
                birth_year: new fields.NumberField({ initial: 0, integer: true }),
                home: new fields.StringField({ blank: true, initial: "" }),
                fur_color: new fields.StringField({ blank: true, initial: "" }),
                guard_rank: new fields.StringField({ blank: true, initial: "" }),
                cloak_color: new fields.StringField({ blank: true, initial: "" }),
                parents: new fields.StringField({ blank: true, initial: "" }),
                senior_artisan: new fields.StringField({ blank: true, initial: "" }),
                mentor: new fields.StringField({ blank: true, initial: "" }),
                friend: new fields.StringField({ blank: true, initial: "" }),
                enemy: new fields.StringField({ blank: true, initial: "" })
            }),
            rewards: new fields.SchemaField({
                fate: new fields.NumberField({ initial: 1, integer: true, min: 0 }),
                persona: new fields.NumberField({ initial: 1, integer: true, min: 0 }),
                belief: new fields.StringField({ blank: true, initial: "" }),
                goal: new fields.StringField({ blank: true, initial: "" }),
                instinct: new fields.StringField({ blank: true, initial: "" }),
                check: new fields.NumberField({ initial: 1, integer: true, min: 0 })
            }),
            conditions: conditionsSchema(),
            disposition: dispositionSchema()
        };
    }

    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) {
            migrateLegacyHTML(source, "biography");
            migrateLegacyHTML(source, "notes");
        }
        return super.migrateData(source, options);
    }

    get itemTypes() {
        return this.parent?.itemTypes ?? {};
    }

    set itemTypes(_) {}
}

export class NPCActorData extends TypeDataModel {
    static defineSchema() {
        return {
            biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            player: new fields.StringField({ blank: true, initial: "" }),
            conditions: conditionsSchema(),
            disposition: dispositionSchema()
        };
    }

    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) migrateLegacyHTML(source, "biography");
        return super.migrateData(source, options);
    }

    get itemTypes() {
        return this.parent?.itemTypes ?? {};
    }

    set itemTypes(_) {}
}

/* -------------------------------------------- */
/*  Item Data Models                            */
/* -------------------------------------------- */

/** Base class for item models: shared clean-up of legacy description shapes. */
class MouseGuardItemDataBase extends TypeDataModel {
    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) migrateLegacyHTML(source, "description");
        return super.migrateData(source, options);
    }
}

export class ItemData extends MouseGuardItemDataBase {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            quantity: new fields.NumberField({ initial: 1, integer: true }),
            weight: new fields.NumberField({ initial: 0 }),
            attributes: new fields.ObjectField(),
            groups: new fields.ObjectField()
        };
    }
}

export class SkillData extends MouseGuardItemDataBase {
    static defineSchema() {
        return {
            rank: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 6 }),
            learning: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 10 }),
            beginnersLuck: new fields.StringField({ required: true, blank: false, initial: "will", choices: ["will", "health"] }),
            specialty: new fields.BooleanField({ initial: false }),
            advancement: new fields.SchemaField({
                passed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 6 }),
                failed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 6 })
            }),
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            supplies: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            factors: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            help: new fields.ArrayField(new fields.StringField({ blank: true }))
        };
    }

    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) {
            migrateLegacyHTML(source, "supplies");
            migrateLegacyHTML(source, "factors");
            migrateLegacyAdvancement(source, 6);
            if ("rank" in source && typeof source.rank === "string") source.rank = toNumber(source.rank);
            if ("beginnersLuck" in source && !["will", "health"].includes(source.beginnersLuck)) {
                source.beginnersLuck = String(source.beginnersLuck).toLowerCase() === "health" ? "health" : "will";
            }
            if ("help" in source && typeof source.help === "string") {
                source.help = source.help.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
            } else if (Array.isArray(source.help)) {
                source.help = source.help.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
            }
            delete source.groups;
            delete source.attributes;
        }
        return super.migrateData(source, options);
    }
}

export class WiseData extends MouseGuardItemDataBase {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            checks: new fields.SchemaField({
                pass: new fields.BooleanField({ initial: false }),
                fail: new fields.BooleanField({ initial: false }),
                figuredOut: new fields.BooleanField({ initial: false }),
                realized: new fields.BooleanField({ initial: false })
            })
        };
    }

    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) {
            // template.json era: numeric pass/fail counters and a meaningless rank
            for (const key of ["pass", "fail"]) {
                if (!(key in source)) continue;
                const checks = isObject(source.checks) ? source.checks : {};
                if (!(key in checks)) checks[key] = toNumber(source[key]) > 0;
                source.checks = checks;
                delete source[key];
            }
            delete source.rank;
        }
        return super.migrateData(source, options);
    }
}

export class AbilityData extends MouseGuardItemDataBase {
    static defineSchema() {
        return {
            key: new fields.StringField({ required: true, blank: true, initial: "", choices: [...ABILITY_KEYS, ""] }),
            rating: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0, max: 20 }),
            max: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0, max: 20 }),
            advancement: new fields.SchemaField({
                passed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 10 }),
                failed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 10 })
            }),
            description: new fields.HTMLField({ required: false, blank: true, initial: "" })
        };
    }

    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) {
            if ("rating" in source && typeof source.rating === "string") source.rating = toNumber(source.rating);
            if ("key" in source && !ABILITY_KEYS.includes(source.key)) {
                source.key = inferAbilityKey(source.key) || "";
            }
            // Legacy `tax` (default 1, old UI range 0..7) held the untaxed Nature maximum.
            if ("tax" in source) {
                if (!("max" in source)) {
                    const values = [source.rating, source.tax].map((v) => Number(v)).filter(Number.isFinite);
                    if (values.length) source.max = Math.clamp(Math.max(...values), 0, 20);
                }
                delete source.tax;
            }
            migrateLegacyAdvancement(source, 10);
        }
        return super.migrateData(source, options);
    }

    /**
     * Nature's maximum can never be below its current rating (a rating raised by hand, without touching the maximum,
     * raises the maximum too). Derived only: every reader (sheets, dice pool, Nature tax, learning) sees one value.
     * @inheritdoc
     */
    prepareBaseData() {
        super.prepareBaseData();
        if (this.max < this.rating) this.max = this.rating;
    }
}

export class TraitData extends MouseGuardItemDataBase {
    static defineSchema() {
        return {
            level: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 1, max: 3 }),
            usedFor: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 2 }),
            usedAgainst: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 99 }),
            checksEarned: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 99 }),
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            levels: new fields.SchemaField({
                level1: new fields.HTMLField({ required: false, blank: true, initial: "" }),
                level2: new fields.HTMLField({ required: false, blank: true, initial: "" }),
                level3: new fields.HTMLField({ required: false, blank: true, initial: "" })
            }),
            against: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            origin: new fields.StringField({ blank: true, initial: "" })
        };
    }

    /** @inheritdoc */
    static migrateData(source, options) {
        if (isObject(source)) {
            migrateLegacyHTML(source, "against");
            if (isObject(source.levels)) {
                for (const key of ["level1", "level2", "level3"]) migrateLegacyHTML(source.levels, key);
            }
            if ("level" in source && typeof source.level === "string") source.level = toNumber(source.level, 1);

            // usesThisSession / usedfor -> usedFor (beneficial uses this session, 0..2)
            if ("usesThisSession" in source || "usedfor" in source) {
                const values = [source.usedFor, source.usesThisSession, source.usedfor]
                    .map((v) => Number(v)).filter(Number.isFinite);
                if (values.length) source.usedFor = Math.clamp(Math.max(...values), 0, 2);
                delete source.usesThisSession;
                delete source.usedfor;
            }
            // usedagainst -> usedAgainst
            if ("usedagainst" in source) {
                const values = [source.usedAgainst, source.usedagainst].map((v) => Number(v)).filter(Number.isFinite);
                if (values.length) source.usedAgainst = Math.clamp(Math.max(...values), 0, 99);
                delete source.usedagainst;
            }
            delete source.exhausted;
        }
        return super.migrateData(source, options);
    }
}

export class SimpleItemData extends MouseGuardItemDataBase {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" })
        };
    }
}
