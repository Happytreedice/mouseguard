#!/usr/bin/env node
"use strict";
/**
 * Validate the system's localization files.
 *
 * Usage: node scripts/validate-locales.js [options]
 *   --strict              treat warnings (unused keys, untranslated strings...) as errors
 *   --foundry <path>      Foundry install folder (or its public/lang/en.json) used to resolve core keys
 *                         (defaults to $FOUNDRY_PATH, then a few usual install locations)
 *   --no-core             do not load Foundry's core translations
 *   --fragments <dir>     overlay every <name>.<lang>.json found in <dir> onto lang/<lang>.json before
 *                         validating (dry run of a merge, nothing is written)
 *   --quiet               print errors and the summary only
 *
 * Errors (exit code 1):
 *   - invalid JSON, duplicate keys, non-string values, malformed keys
 *   - a key that is both a string and the prefix of another key (Foundry's expandObject throws
 *     "Cannot create property ... on string ..." and drops the whole file), simulated exactly
 *   - a key that would replace a Foundry core string or a core group when merged
 *   - key sets or {placeholders} that differ between locales
 *   - a TYPES.<Document>.<type> label missing for a type declared in system.json
 *   - a static key used in module/, templates/, tours/, system.json or src/packs/ that is defined
 *     neither by this system nor by Foundry core, or that names a group instead of a string
 * Warnings:
 *   - keys that are never referenced statically (they may still be built dynamically)
 *   - empty strings, strings identical to the base locale, keys used only by unreferenced templates
 *
 * A source line containing "i18n-ignore" is not scanned (use it for legacy strings that look like keys).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE_LOCALE = "en";
const KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SKIPPED_PROPERTIES = new Set(["__proto__", "constructor", "prototype"]);

/* -------------------------------------------- */
/*  Command line                                */
/* -------------------------------------------- */

const argv = process.argv.slice(2);
const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
};
const flags = {
    strict: argv.includes("--strict"),
    quiet: argv.includes("--quiet"),
    noCore: argv.includes("--no-core"),
    foundry: option("--foundry") ?? process.env.FOUNDRY_PATH,
    fragments: option("--fragments")
};

const errors = [];
const warnings = [];
const error = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

/* -------------------------------------------- */
/*  Foundry helpers (mirrors common/utils)      */
/* -------------------------------------------- */

/** Same algorithm as foundry.utils.setProperty; strict mode makes it throw exactly like the client does. */
function setProperty(object, key, value) {
    if (!key) return false;
    let target = object;
    if (key.indexOf(".") !== -1) {
        const parts = key.split(".");
        if (parts.some((p) => SKIPPED_PROPERTIES.has(p))) return false;
        key = parts.pop();
        target = parts.reduce((t, p) => {
            if (t[p] === undefined) t[p] = {};
            return t[p];
        }, object);
    } else if (SKIPPED_PROPERTIES.has(key)) return false;
    if (!(key in target) || target[key] !== value) {
        target[key] = value;
        return true;
    }
    return false;
}

const isPlainObject = (value) =>
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype;

/** Same algorithm as foundry.utils.expandObject. */
function expandObject(obj) {
    const expand = (value, depth) => {
        if (depth > 32)
            throw new Error("Maximum object expansion depth exceeded");
        if (!value) return value;
        if (Array.isArray(value)) return value.map((v) => expand(v, depth + 1));
        if (!isPlainObject(value)) return value;
        const expanded = {};
        for (const [k, v] of Object.entries(value))
            setProperty(expanded, k, expand(v, depth + 1));
        return expanded;
    };
    return expand(obj, 0);
}

function getProperty(object, key) {
    return key
        .split(".")
        .reduce(
            (t, p) => (t !== null && typeof t === "object" ? t[p] : undefined),
            object
        );
}

/** Flatten an expanded translation tree into {"A.B.C": "string"}. */
function flatten(object, prefix = "", out = new Map()) {
    for (const [k, v] of Object.entries(object)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (isPlainObject(v)) flatten(v, key, out);
        else out.set(key, v);
    }
    return out;
}

/* -------------------------------------------- */
/*  Loading                                     */
/* -------------------------------------------- */

/** Report keys repeated inside one JSON object (JSON.parse silently keeps the last one). */
function findDuplicateKeys(text) {
    const duplicates = [];
    const stack = [];
    let expectKey = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            let j = i + 1;
            let raw = "";
            while (j < text.length && text[j] !== '"') {
                if (text[j] === "\\") {
                    raw += text[j];
                    j++;
                }
                raw += text[j];
                j++;
            }
            const top = stack[stack.length - 1];
            if (top && top.type === "object" && expectKey) {
                let key;
                try {
                    key = JSON.parse(`"${raw}"`);
                } catch {
                    key = raw;
                }
                if (top.keys.has(key)) duplicates.push(key);
                top.keys.add(key);
                expectKey = false;
            }
            i = j;
        } else if (ch === "{") {
            stack.push({ type: "object", keys: new Set() });
            expectKey = true;
        } else if (ch === "[") {
            stack.push({ type: "array" });
        } else if (ch === "}" || ch === "]") {
            stack.pop();
        } else if (ch === ",") {
            const top = stack[stack.length - 1];
            expectKey = Boolean(top && top.type === "object");
        }
    }
    return duplicates;
}

function readJson(file, label) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (err) {
        error(`${label}: cannot read ${rel(file)} (${err.message})`);
        return undefined;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        error(`${label}: invalid JSON in ${rel(file)} (${err.message})`);
        return undefined;
    }
    for (const key of findDuplicateKeys(text))
        error(`${label}: duplicate key "${key}" in ${rel(file)}`);
    return data;
}

const systemJson =
    readJson(path.join(ROOT, "system.json"), "system.json") ?? {};
const languages = (systemJson.languages ?? [])
    .filter((l) => !l.system || l.system === systemJson.id)
    .map((l) => ({ locale: l.lang, file: path.join(ROOT, l.path) }));
if (!languages.length) {
    for (const locale of ["en", "ru"])
        languages.push({
            locale,
            file: path.join(ROOT, "lang", `${locale}.json`)
        });
}
if (!languages.some((l) => l.locale === BASE_LOCALE))
    error(`system.json declares no "${BASE_LOCALE}" language`);

const locales = [];
for (const { locale, file } of languages) {
    const data = readJson(file, locale);
    if (!data) continue;
    if (!isPlainObject(data)) {
        error(`${locale}: ${rel(file)} must contain a JSON object`);
        continue;
    }
    locales.push({ locale, file, data: { ...data } });
}

// Optional dry-run merge of agent fragments: <dir>/<name>.<locale>.json
if (flags.fragments) {
    const dir = path.resolve(flags.fragments);
    const files = fs.existsSync(dir)
        ? fs
              .readdirSync(dir)
              .filter((f) => /\.[A-Za-z-]+\.json$/.test(f))
              .sort()
        : [];
    if (!files.length)
        warn(`--fragments: no <name>.<lang>.json files in ${dir}`);
    for (const name of files) {
        const locale = name.split(".").slice(-2, -1)[0];
        const target = locales.find((l) => l.locale === locale);
        const data = readJson(path.join(dir, name), `fragment ${name}`);
        if (!target || !isPlainObject(data)) continue;
        for (const [k, v] of Object.entries(data)) {
            if (k in target.data && target.data[k] !== v)
                warn(`fragment ${name}: overrides "${k}"`);
            target.data[k] = v;
        }
    }
}

const base = locales.find((l) => l.locale === BASE_LOCALE) ?? locales[0];
if (!base) {
    console.error(errors.join("\n") || "No locale files found.");
    process.exit(1);
}

/** Foundry core translations, used to resolve COMBAT.*, DOCUMENT.*... keys referenced by the system. */
function loadCore() {
    if (flags.noCore) return undefined;
    const candidates = [];
    if (flags.foundry) {
        const p = path.resolve(flags.foundry);
        if (p.endsWith(".json")) candidates.push(p);
        candidates.push(path.join(p, "public", "lang", "en.json"));
        candidates.push(
            path.join(p, "resources", "app", "public", "lang", "en.json")
        );
    }
    for (const dir of [
        "foundryvtt",
        "FoundryVTT",
        path.join("foundryvtt", "foundryvtt")
    ]) {
        candidates.push(
            path.join(os.homedir(), dir, "public", "lang", "en.json")
        );
        candidates.push(
            path.join(
                os.homedir(),
                dir,
                "resources",
                "app",
                "public",
                "lang",
                "en.json"
            )
        );
    }
    candidates.push(
        "/opt/foundryvtt/resources/app/public/lang/en.json",
        "/opt/foundryvtt/public/lang/en.json"
    );
    for (const file of candidates) {
        if (!fs.existsSync(file)) continue;
        try {
            const keys = flatten(
                expandObject(JSON.parse(fs.readFileSync(file, "utf8")))
            );
            return { file, keys };
        } catch (err) {
            warn(
                `could not read Foundry core translations ${file}: ${err.message}`
            );
        }
    }
    warn(
        "Foundry core translations not found (use --foundry <path>): core keys cannot be checked"
    );
    return undefined;
}
const core = loadCore();

/* -------------------------------------------- */
/*  Structure of each locale file               */
/* -------------------------------------------- */

const placeholders = (text) =>
    [...String(text).matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]).sort();

for (const { locale, data } of locales) {
    const keys = Object.keys(data);
    const keySet = new Set(keys);

    for (const key of keys) {
        const value = data[key];
        if (typeof value !== "string") {
            error(
                `${locale}: "${key}" must be a string (lang files are flat), got ${Array.isArray(value) ? "array" : typeof value}`
            );
            continue;
        }
        const parts = key.split(".");
        if (parts.some((p) => !KEY_SEGMENT.test(p)))
            error(
                `${locale}: malformed key "${key}" (allowed: A-Z a-z 0-9 _ - separated by dots)`
            );
        if (parts.some((p) => SKIPPED_PROPERTIES.has(p)))
            error(
                `${locale}: key "${key}" uses a reserved segment and is ignored by Foundry`
            );
        if (!value.trim()) warn(`${locale}: "${key}" is empty`);

        // Leaf/prefix collision inside the file: "A.B" is a string and "A.B.C" exists.
        for (let i = 1; i < parts.length; i++) {
            const prefix = parts.slice(0, i).join(".");
            if (keySet.has(prefix))
                error(
                    `${locale}: "${prefix}" is a string but also the prefix of "${key}"`
                );
        }

        // Collision with Foundry core once both trees are merged.
        if (core) {
            for (let i = 1; i < parts.length; i++) {
                const prefix = parts.slice(0, i).join(".");
                if (core.keys.has(prefix))
                    error(
                        `${locale}: "${key}" would replace the Foundry core string "${prefix}"`
                    );
            }
            if (!core.keys.has(key)) {
                for (const coreKey of core.keys.keys()) {
                    if (coreKey.startsWith(`${key}.`)) {
                        error(
                            `${locale}: "${key}" would replace the Foundry core group "${key}.*" (e.g. "${coreKey}")`
                        );
                        break;
                    }
                }
            }
        }
    }

    // Exact simulation of Foundry's Localization#loadTranslationFile.
    try {
        const expanded = expandObject(data);
        for (const key of keys) {
            if (
                typeof data[key] === "string" &&
                getProperty(expanded, key) !== data[key]
            ) {
                error(
                    `${locale}: "${key}" is lost when Foundry expands the file (overwritten by another key)`
                );
            }
        }
    } catch (err) {
        error(`${locale}: Foundry cannot parse this file: ${err.message}`);
    }
}

/* -------------------------------------------- */
/*  Consistency between locales                 */
/* -------------------------------------------- */

for (const { locale, data } of locales) {
    if (locale === base.locale) continue;
    const missing = Object.keys(base.data).filter((key) => !(key in data));
    const extra = Object.keys(data).filter((key) => !(key in base.data));
    for (const key of missing)
        error(`${locale}: missing key "${key}" (present in ${base.locale})`);
    for (const key of extra)
        error(`${locale}: key "${key}" is absent from ${base.locale}`);

    for (const key of Object.keys(base.data)) {
        if (
            !(key in data) ||
            typeof data[key] !== "string" ||
            typeof base.data[key] !== "string"
        )
            continue;
        const expected = placeholders(base.data[key]);
        const actual = placeholders(data[key]);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            error(
                `${locale}: placeholder mismatch in "${key}": {${expected.join("}, {")}} vs {${actual.join("}, {")}}`
            );
        }
        const value = data[key].replace(/<[^>]+>|\{[^}]+\}|&[a-z]+;/g, "");
        if (
            data[key] === base.data[key] &&
            /[A-Za-z]{3,}.*\s.*[A-Za-z]{3,}/.test(value)
        ) {
            warn(
                `${locale}: "${key}" is identical to ${base.locale} (untranslated?)`
            );
        }
    }
}

/* -------------------------------------------- */
/*  Document type labels                        */
/* -------------------------------------------- */

const documentTypes = systemJson.documentTypes ?? {};
const typeLabelKeys = [];
for (const [documentName, types] of Object.entries(documentTypes)) {
    for (const type of Object.keys(types ?? {}))
        typeLabelKeys.push(`TYPES.${documentName}.${type}`);
}
for (const key of typeLabelKeys) {
    for (const { locale, data } of locales) {
        if (typeof data[key] !== "string")
            error(`${locale}: missing document type label "${key}"`);
    }
}

/* -------------------------------------------- */
/*  Source scan                                 */
/* -------------------------------------------- */

const SOURCE_RULES = [
    { dir: "module", ext: [".js", ".mjs", ".hbs", ".html"] },
    { dir: "templates", ext: [".hbs", ".html"] },
    { dir: "tours", ext: [".json"] },
    { dir: "src/packs", ext: [".yml", ".yaml", ".json"], bare: true }
];

function walk(dir, ext, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith("."))
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, ext, out);
        else if (ext.includes(path.extname(entry.name))) out.push(full);
    }
    return out;
}

const sourceFiles = [{ file: path.join(ROOT, "system.json"), bare: false }];
for (const rule of SOURCE_RULES) {
    for (const file of walk(path.join(ROOT, rule.dir), rule.ext))
        sourceFiles.push({ file, bare: Boolean(rule.bare) });
}

// Namespaces worth scanning: our own top-level segments plus Foundry core's upper-case ones.
const namespaces = new Set();
for (const key of Object.keys(base.data)) namespaces.add(key.split(".")[0]);
if (core) for (const key of core.keys.keys()) namespaces.add(key.split(".")[0]);
for (const ns of [...namespaces])
    if (!/^[A-Z][A-Z0-9_]*$/.test(ns)) namespaces.delete(ns);
namespaces.add("MOUSEGUARD");
namespaces.add("TYPES");
const nsPattern = [...namespaces].sort((a, b) => b.length - a.length).join("|");
const KEY_RE = new RegExp(
    `(?<![A-Za-z0-9_$.])(${nsPattern})\\.([A-Za-z0-9_.-]*)`,
    "g"
);
const QUOTES = new Set(['"', "'", "`"]);

/** Return the closing index of a quoted literal opened at `start`, skipping ${...} and {{...}} blocks. */
function literalEnd(text, start, quote) {
    let depth = 0;
    for (let i = start + 1; i < text.length; i++) {
        const ch = text[i];
        if (ch === "\\") {
            i++;
            continue;
        }
        if (ch === "\n" && quote !== "`" && depth === 0) return -1;
        if ((ch === "$" || ch === "{") && text[i + 1] === "{") {
            depth++;
            i++;
            continue;
        }
        if (ch === "}" && depth > 0) {
            depth--;
            if (text[i + 1] === "}") i++;
            continue;
        }
        if (ch === quote && depth === 0) return i;
    }
    return -1;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keys referenced statically: key -> [{file, line, dead}] ; dynamic patterns: [{re, source, file, line}] */
const references = new Map();
const dynamicPatterns = [];
const tourDefinitions = new Map();

// Templates reachable from no code (directly or through live templates) are dead: their missing keys are warnings.
const allText = new Map();
for (const { file } of sourceFiles)
    allText.set(file, fs.readFileSync(file, "utf8"));
const templateFiles = walk(path.join(ROOT, "templates"), [".hbs", ".html"]).map(
    rel
);
const liveTemplates = new Set();
{
    const queue = [...allText.entries()]
        .filter(
            ([file]) =>
                !rel(file).startsWith("templates/") &&
                !rel(file).startsWith("src/")
        )
        .map(([, text]) => text);
    while (queue.length) {
        const text = queue.pop();
        for (const t of templateFiles) {
            if (liveTemplates.has(t) || !text.includes(t)) continue;
            liveTemplates.add(t);
            queue.push(allText.get(path.join(ROOT, t)) ?? "");
        }
    }
}
const isDeadTemplate = (file) =>
    rel(file).startsWith("templates/") && !liveTemplates.has(rel(file));

for (const { file, bare } of sourceFiles) {
    const text = allText.get(file);
    const r = rel(file);
    const dead = isDeadTemplate(file);
    const lines = text.split("\n");
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++)
        if (text[i] === "\n") lineStarts.push(i + 1);
    const lineOf = (index) => {
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (lineStarts[mid] <= index) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };

    // Tours may carry their own fallback strings.
    if (r.startsWith("tours/")) {
        try {
            for (const key of Object.keys(JSON.parse(text).localization ?? {}))
                tourDefinitions.set(key, r);
        } catch {
            error(`${r}: invalid JSON`);
        }
    }

    for (const match of text.matchAll(KEY_RE)) {
        const start = match.index;
        const line = lineOf(start);
        if (lines[line - 1].includes("i18n-ignore")) continue;
        let key = `${match[1]}.${match[2]}`;
        const before = text[start - 1];
        const after = text[start + match[0].length];

        if (QUOTES.has(before)) {
            if (after === before) {
                if (key.endsWith(".")) {
                    // "NS.Prefix." + something or (concat 'NS.Prefix.' something); a bare "NS." is usually a prefix test.
                    const broad = key === `${match[1]}.`;
                    const re = broad
                        ? /^$/
                        : new RegExp(`^${escapeRe(key)}.+$`);
                    dynamicPatterns.push({
                        re,
                        source: `${key}*${broad ? " (too broad, ignored)" : ""}`,
                        file: r,
                        line
                    });
                    continue;
                }
            } else if (after === "$" || after === "{") {
                const end = literalEnd(text, start - 1, before);
                const literal = end === -1 ? key : text.slice(start, end);
                const source = literal.replace(
                    /\$\{[^}]*\}|\{\{[^}]*\}\}/g,
                    "*"
                );
                const re = new RegExp(
                    `^${source.split("*").map(escapeRe).join("[A-Za-z0-9_.-]+")}$`
                );
                dynamicPatterns.push({ re, source, file: r, line });
                continue;
            } else {
                continue; // prose or a pattern such as "MOUSEGUARD.Nature*"
            }
        } else if (!(
            bare &&
            (before === undefined || /[\s:\-[,]/.test(before)) &&
            (after === undefined || /[\s,\]}#'"]/.test(after))
        )) {
            continue;
        }
        key = key.replace(/\.+$/, "");
        if (!references.has(key)) references.set(key, []);
        references.get(key).push({ file: r, line, dead });
    }
}

/* -------------------------------------------- */
/*  Resolve referenced keys                     */
/* -------------------------------------------- */

const baseKeys = new Set(Object.keys(base.data));
const isGroup = (keys, key) => {
    for (const k of keys) if (k.startsWith(`${key}.`)) return true;
    return false;
};
const where = (refs) =>
    refs
        .slice(0, 3)
        .map((ref) => `${ref.file}:${ref.line}`)
        .join(", ") + (refs.length > 3 ? ` (+${refs.length - 3})` : "");

const missing = [];
const missingByFile = new Map(); // file -> {live, items: [{key, line}]}
for (const [key, refs] of [...references.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
)) {
    if (baseKeys.has(key)) continue;
    if (core?.keys.has(key)) continue;
    if (tourDefinitions.has(key)) continue;
    const live = refs.filter((ref) => !ref.dead);
    const report = live.length ? error : warn;
    const shown = live.length ? live : refs;
    if (isGroup(baseKeys, key) || (core && isGroup(core.keys.keys(), key))) {
        report(`"${key}" names a group of keys, not a string: ${where(shown)}`);
        continue;
    }
    const owned =
        key.startsWith("MOUSEGUARD.") ||
        typeLabelKeys.includes(key) ||
        key.startsWith("SETTINGS.MouseGuard");
    if (!core && !owned) {
        warn(
            `"${key}" is not defined by this system (core translations unavailable to check it): ${where(shown)}`
        );
        continue;
    }
    missing.push(key);
    for (const ref of shown) {
        if (!missingByFile.has(ref.file))
            missingByFile.set(ref.file, { live: !ref.dead, items: [] });
        missingByFile.get(ref.file).items.push({ key, line: ref.line });
    }
}
for (const [file, { live, items }] of [...missingByFile.entries()].sort(
    ([a], [b]) => a.localeCompare(b)
)) {
    const report = live ? error : warn;
    const suffix = live ? "" : " (unreferenced template)";
    if (items.length <= 3) {
        for (const { key, line } of items)
            report(`missing key "${key}": ${file}:${line}${suffix}`);
    } else {
        report(
            `${file}${suffix}: ${items.length} missing keys: ${items.map((i) => i.key).join(", ")}`
        );
    }
}

for (const [key, file] of tourDefinitions) {
    if (!baseKeys.has(key))
        warn(
            `"${key}" is only defined inside ${file} (English fallback, not translatable)`
        );
}

/* -------------------------------------------- */
/*  Unused keys                                 */
/* -------------------------------------------- */

const unused = [];
for (const key of baseKeys) {
    if (references.has(key)) continue;
    if (typeLabelKeys.includes(key)) continue; // read by Foundry itself
    if (tourDefinitions.has(key)) continue;
    if (dynamicPatterns.some((p) => p.re.test(key))) continue;
    unused.push(key);
}
for (const key of unused) warn(`unused key "${key}"`);

/* -------------------------------------------- */
/*  Report                                      */
/* -------------------------------------------- */

const header = (title) => console.log(`\n== ${title}`);
if (!flags.quiet) {
    console.log(
        `Locales: ${locales.map((l) => `${l.locale} (${Object.keys(l.data).length} keys)`).join(", ")}`
    );
    console.log(
        `Foundry core: ${core ? `${core.file} (${core.keys.size} keys)` : "not loaded"}`
    );
    console.log(
        `Scanned ${sourceFiles.length} source files: ${references.size} static keys, ${dynamicPatterns.length} dynamic patterns`
    );
    if (dynamicPatterns.length) {
        header("Dynamic key patterns (not checked, used to mark keys as used)");
        for (const p of dynamicPatterns)
            console.log(`  ${p.source}  ${p.file}:${p.line}`);
    }
    if (warnings.length) {
        header(`Warnings (${warnings.length})`);
        for (const w of warnings) console.log(`  ${w}`);
    }
}
if (errors.length) {
    header(`Errors (${errors.length})`);
    for (const e of errors) console.log(`  ${e}`);
}
const failed = errors.length > 0 || (flags.strict && warnings.length > 0);
console.log(
    `\n${failed ? "FAILED" : "OK"}: ${errors.length} error(s), ${warnings.length} warning(s)` +
        (missing.length ? `, ${missing.length} missing key(s)` : "") +
        (unused.length ? `, ${unused.length} unused key(s)` : "")
);
process.exitCode = failed ? 1 : 0;
