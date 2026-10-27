/**
 * Mouse Guard character sheet (Foundry VTT v14, also v13): HandlebarsApplicationMixin(ActorSheetV2).
 *
 * Layout and format follow the "Legend in the Mist" character sheet (mist-engine-fvtt):
 *  - left: a 300 px portrait column fading into the dark sheet background, the name overlaid in a large serif font,
 *    a subtitle (guard rank · age · home) and the cloak colour;
 *  - right: a header strip (Test / Quick test / New session buttons and two white "paper" boxes: Conditions and
 *    Rewards), a translucent tab bar (Mouse / Biography / Gear / Notes) and, on the Mouse tab, a row of parchment cards
 *    with coloured ribbon headers (Abilities, Skills, Traits, Wises) followed by the Belief / Goal / Instinct
 *    "quest" boxes.
 *  - a padlock in the window header switches between play mode (clean, click-to-roll) and edit mode (inputs,
 *    add / edit / delete controls).
 * All raster art is placeholder art from assets/sheet/ (see assets/sheet/README.md).
 *
 * Rolls and bookkeeping go through the actor API from the shared contract (rollTest, markAdvancement, useTrait,
 * toggleCondition, startNewSession). The sheet checks that each method exists and falls back to plain document
 * updates where that is safe, so it never throws while the roll system is missing.
 */

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TEMPLATES = "systems/mouseguard/templates/actor/character";
const PARTIALS = {
    track: `${TEMPLATES}/parts/track.hbs`,
    tools: `${TEMPLATES}/parts/line-tools.hbs`,
    ribbon: `${TEMPLATES}/parts/ribbon-tools.hbs`
};

/** Display order and localization keys of the five abilities (by AbilityData.key). */
export const ABILITY_ORDER = ["nature", "will", "health", "resources", "circles"];
export const ABILITY_LABELS = Object.freeze({
    nature: "MOUSEGUARD.Nature",
    will: "MOUSEGUARD.Will",
    health: "MOUSEGUARD.Health",
    resources: "MOUSEGUARD.Resources",
    circles: "MOUSEGUARD.Circles"
});

/** Highest ratings (rulebook pp. 30-31, 247, 254, 259-263): no "ready to advance" glow at the cap. */
export const ABILITY_CAPS = Object.freeze({ nature: 7, will: 6, health: 6, resources: 10, circles: 10 });
export const SKILL_CAP = 6;

/** Legacy ability names (before AbilityData.key existed). Used only when an item has no key yet. */
const NATURE_NAME = /^(?:MOUSEGUARD\.)?(?:[MW]?Nature|Природа)(?:\s*\(.*\))?$/i;
const ABILITY_NAMES = Object.freeze({
    will: ["will", "воля"],
    health: ["health", "здоровье"],
    resources: ["resources", "ресурсы"],
    circles: ["circles", "связи"]
});

/** The five conditions: actor field, label / tooltip keys (shared with the token status effects) and icon. */
export const CONDITIONS = Object.freeze([
    { key: "hungryThirsty", label: "MOUSEGUARD.Sheet.HungryShort", tooltip: "MOUSEGUARD.hungthurstToolTip", icon: "hungthurst" },
    { key: "angry", label: "MOUSEGUARD.angry", tooltip: "MOUSEGUARD.angryToolTip", icon: "angry" },
    { key: "tired", label: "MOUSEGUARD.tired", tooltip: "MOUSEGUARD.tiredToolTip", icon: "tired" },
    { key: "injured", label: "MOUSEGUARD.injured", tooltip: "MOUSEGUARD.injuredToolTip", icon: "injured" },
    { key: "sick", label: "MOUSEGUARD.sick", tooltip: "MOUSEGUARD.sickToolTip", icon: "sick" }
]);

/** "N years" in the plural forms of Intl.PluralRules. */
const AGE_KEYS = Object.freeze({
    one: "MOUSEGUARD.Sheet.AgeYearsOne",
    few: "MOUSEGUARD.Sheet.AgeYearsFew",
    many: "MOUSEGUARD.Sheet.AgeYearsMany",
    other: "MOUSEGUARD.Sheet.AgeYearsOther"
});

/** The four marks of a wise (WiseData.checks). */
export const WISE_MARKS = Object.freeze([
    { key: "pass", short: "MOUSEGUARD.Sheet.WisePassShort", tooltip: "MOUSEGUARD.Sheet.WisePassHint" },
    { key: "fail", short: "MOUSEGUARD.Sheet.WiseFailShort", tooltip: "MOUSEGUARD.Sheet.WiseFailHint" },
    { key: "figuredOut", short: "MOUSEGUARD.Sheet.WiseFiguredOutShort", tooltip: "MOUSEGUARD.Sheet.WiseFiguredOutHint" },
    { key: "realized", short: "MOUSEGUARD.Sheet.WiseRealizedShort", tooltip: "MOUSEGUARD.Sheet.WiseRealizedHint" }
]);

/** Details shown on the Biography tab (system.details.*), in the order of the Mouse Guard character sheet. */
const DETAILS = Object.freeze([
    { key: "age", label: "MOUSEGUARD.Sheet.Age", type: "number" },
    { key: "birth_year", label: "MOUSEGUARD.Sheet.BirthYear", type: "number" },
    { key: "home", label: "MOUSEGUARD.Sheet.Home" },
    { key: "fur_color", label: "MOUSEGUARD.Sheet.FurColor" },
    { key: "guard_rank", label: "MOUSEGUARD.Sheet.GuardRank" },
    { key: "cloak_color", label: "MOUSEGUARD.Sheet.CloakColor" },
    { key: "parents", label: "MOUSEGUARD.Sheet.Parents" },
    { key: "senior_artisan", label: "MOUSEGUARD.Sheet.SeniorArtisan" },
    { key: "mentor", label: "MOUSEGUARD.Sheet.Mentor" },
    { key: "friend", label: "MOUSEGUARD.Sheet.Friend" },
    { key: "enemy", label: "MOUSEGUARD.Sheet.Enemy" }
]);

/** Default names of new items, per type. */
export const NEW_ITEM_NAMES = Object.freeze({
    skill: "MOUSEGUARD.Sheet.NewSkill",
    trait: "MOUSEGUARD.Sheet.NewTrait",
    wise: "MOUSEGUARD.Sheet.NewWise",
    ability: "MOUSEGUARD.Sheet.NewAbility",
    item: "MOUSEGUARD.Sheet.NewGear",
    contact: "MOUSEGUARD.Sheet.NewContact",
    condition: "MOUSEGUARD.Sheet.NewCondition"
});

/** Compendium packs that can be browsed from a card ribbon. */
export const PACKS = Object.freeze({ skill: "mouseguard.skills", trait: "mouseguard.traits" });

/** Shown in the portrait column while the actor still has the core default image; never saved to the actor. */
export const PORTRAIT_PLACEHOLDER = "systems/mouseguard/assets/seated-mouse.svg";

/** Item types that may exist only once per character (matched by name). */
export const UNIQUE_TYPES = new Set(["skill", "trait", "wise"]);

/** Cloak colour words the sheet can paint, in addition to any valid CSS colour. */
const CLOAK_COLOURS = Object.freeze({
    красный: "#9b2d20", алый: "#c0392b", бордовый: "#6d1f1f", багровый: "#7a1e1e", вишнёвый: "#7b1e2f",
    вишневый: "#7b1e2f", малиновый: "#a3264d", розовый: "#c8798c", оранжевый: "#c46a24", рыжий: "#b5652b",
    жёлтый: "#c9a227", желтый: "#c9a227", золотой: "#b8912f", горчичный: "#a8862a", охристый: "#b07a2a",
    зелёный: "#3f6b3a", зеленый: "#3f6b3a", изумрудный: "#2e7d5b", оливковый: "#6b6b2a", травяной: "#5a8a3a",
    голубой: "#5b8fb9", синий: "#2c4f86", лазурный: "#3a7ca5", бирюзовый: "#2f8f88",
    фиолетовый: "#5d3a7a", пурпурный: "#7a2f6b", сиреневый: "#8e7cb0", лиловый: "#86608e",
    коричневый: "#6b4428", бурый: "#5e3d26", серый: "#6e6a64", чёрный: "#1d1b19", черный: "#1d1b19",
    белый: "#e8e2d6", бежевый: "#cdb994", песочный: "#c7a875"
});

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

export const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
export const loc = (key) => game.i18n.localize(key);

/** AbilityData.key of an ability item, inferring it from a legacy name when the item has none yet. */
export function abilityKeyOf(item) {
    const key = item.system?.key;
    if (key) return key;
    const name = String(item.name ?? "").trim();
    if (NATURE_NAME.test(name)) return "nature";
    const bare = name.replace(/^MOUSEGUARD\./i, "").toLowerCase();
    for (const [k, names] of Object.entries(ABILITY_NAMES)) if (names.includes(bare)) return k;
    return "";
}

/** The item's own display name (MouseGuardItem#displayName), when the item class provides one. */
function ownDisplayName(item) {
    try {
        const name = item.displayName;
        return (typeof name === "string") && name ? name : "";
    } catch (err) {
        return "";
    }
}

/** Display name rule from the contract: label of the key, else a localized "MOUSEGUARD.*" name, else the name. */
export function abilityDisplayName(item) {
    const own = ownDisplayName(item);
    if (own && !own.startsWith("MOUSEGUARD.")) return own;
    const key = abilityKeyOf(item);
    if (ABILITY_LABELS[key]) return loc(ABILITY_LABELS[key]);
    const name = String(item.name ?? "");
    return name.startsWith("MOUSEGUARD.") ? loc(name) : name;
}

/** Name of any item as shown on the sheet (never a raw localization key). */
export function itemDisplayName(item) {
    if (item.type === "ability") return abilityDisplayName(item);
    const own = ownDisplayName(item);
    if (own && !own.startsWith("MOUSEGUARD.")) return own;
    const name = String(item.name ?? "");
    return name.startsWith("MOUSEGUARD.") && game.i18n.has(name) ? loc(name) : name;
}

/** An array of `count` pips, the first `value` of them filled. */
export function pips(count, value) {
    const n = clamp(count, 0, 10);
    const v = clamp(value, 0, n);
    return Array.from({ length: n }, (_, index) => ({ index, on: index < v }));
}

/** A pip track for the track.hbs partial. */
export function track({ kind, label, tooltip, count, value, action = "advance", mode }) {
    const list = pips(count, value);
    return { kind, label, tooltip, action, mode, pips: list, full: list.length > 0 && list.every((p) => p.on) };
}

/** Roman numeral for a trait level. */
export const ROMAN = ["", "I", "II", "III"];

/** Plain text excerpt of an HTML string. */
export function excerpt(html, length = 90) {
    const text = String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** Russian-aware plural form of "N years". */
export function formatAge(age) {
    const n = Number(age);
    if (!Number.isFinite(n) || n <= 0) return "";
    let rule = "other";
    try {
        rule = new Intl.PluralRules(game.i18n.lang).select(n);
    } catch (err) { /* unknown locale: keep "other" */ }
    return game.i18n.format(AGE_KEYS[rule] ?? AGE_KEYS.other, { age: n });
}

/** A CSS colour for the cloak colour text, or "" when the text names no known colour. */
export function cloakSwatch(text) {
    const value = String(text ?? "").trim();
    if (!value) return "";
    if (globalThis.CSS?.supports?.("color", value)) return value;
    const words = value.toLowerCase().split(/[\s,.;/-]+/);
    for (const word of words) {
        if (CLOAK_COLOURS[word]) return CLOAK_COLOURS[word];
        const stem = Object.keys(CLOAK_COLOURS).find((k) => k.length > 4 && word.startsWith(k.slice(0, -2)));
        if (stem) return CLOAK_COLOURS[stem];
    }
    return "";
}

/* -------------------------------------------- */
/*  Sheet                                       */
/* -------------------------------------------- */

export class MouseGuardCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    /** Play (false) or edit (true) mode; null until first decided. Sheet-instance state, not saved. */
    #editMode = null;

    /** Quick-test mode: a click on a skill or ability rolls at once, like Shift+click. */
    #quickMode = false;

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "sheet", "actor", "character", "mgs-sheet", "themed", "theme-light"],
        position: { width: 1100, height: 800 },
        window: { resizable: true },
        form: { submitOnChange: true },
        actions: {
            toggleMode: MouseGuardCharacterSheet.#onToggleMode,
            roll: MouseGuardCharacterSheet.#onRoll,
            testFree: MouseGuardCharacterSheet.#onTestFree,
            toggleQuick: MouseGuardCharacterSheet.#onToggleQuick,
            newSession: MouseGuardCharacterSheet.#onNewSession,
            advance: { handler: MouseGuardCharacterSheet.#onAdvance, buttons: [0, 2] },
            traitUse: { handler: MouseGuardCharacterSheet.#onTraitUse, buttons: [0, 2] },
            wiseMark: MouseGuardCharacterSheet.#onWiseMark,
            toggleCondition: MouseGuardCharacterSheet.#onToggleCondition,
            adjust: { handler: MouseGuardCharacterSheet.#onAdjust, buttons: [0, 2] },
            toggleSpecialty: MouseGuardCharacterSheet.#onToggleSpecialty,
            itemCreate: MouseGuardCharacterSheet.#onItemCreate,
            itemEdit: MouseGuardCharacterSheet.#onItemEdit,
            itemDelete: MouseGuardCharacterSheet.#onItemDelete,
            openCompendium: MouseGuardCharacterSheet.#onOpenCompendium,
            openDetails: MouseGuardCharacterSheet.#onOpenDetails
        }
    };

    /** @override */
    static PARTS = {
        portrait: { template: `${TEMPLATES}/portrait.hbs` },
        header: { template: `${TEMPLATES}/header.hbs` },
        tabs: { template: "templates/generic/tab-navigation.hbs", classes: ["mgs-tabs"] },
        mouse: {
            template: `${TEMPLATES}/tab-mouse.hbs`,
            templates: [PARTIALS.track, PARTIALS.tools, PARTIALS.ribbon],
            scrollable: [""]
        },
        biography: {
            template: `${TEMPLATES}/tab-biography.hbs`,
            templates: [PARTIALS.tools, PARTIALS.ribbon],
            scrollable: [""]
        },
        gear: {
            template: `${TEMPLATES}/tab-gear.hbs`,
            templates: [PARTIALS.tools, PARTIALS.ribbon],
            scrollable: [""]
        },
        notes: { template: `${TEMPLATES}/tab-notes.hbs`, scrollable: [""] }
    };

    /** @override */
    static TABS = {
        primary: {
            tabs: [
                { id: "mouse", label: "MOUSEGUARD.Sheet.TabMouse" },
                { id: "biography", label: "MOUSEGUARD.Sheet.TabBiography" },
                { id: "gear", label: "MOUSEGUARD.Sheet.TabGear" },
                { id: "notes", label: "MOUSEGUARD.Sheet.TabNotes" }
            ],
            initial: "mouse"
        }
    };

    /* -------------------------------------------- */

    /** Is the sheet in edit mode? A new character (no skills, traits or wises yet) opens in edit mode. */
    get isEditMode() {
        if (!this.isEditable) return false;
        this.#editMode ??= !this.actor.items.some((i) => UNIQUE_TYPES.has(i.type));
        return this.#editMode;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _renderFrame(options) {
        const frame = await super._renderFrame(options);
        // Edit-lock toggle, left of the window title (like the Legend in the Mist sheet).
        const title = frame.querySelector(".window-header .window-title");
        if (title && this.isEditable) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "header-control icon fa-solid fa-lock mgs-mode-toggle";
            button.dataset.action = "toggleMode";
            title.before(button);

            const detailsBtn = document.createElement("button");
            detailsBtn.type = "button";
            detailsBtn.className = "header-control icon fa-solid fa-feather-pointed mgs-details-toggle";
            detailsBtn.dataset.action = "openDetails";
            detailsBtn.dataset.tooltip = "MOUSEGUARD.DetailsDialog.ButtonHint";
            title.before(detailsBtn);
        }
        return frame;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;
        const system = actor.system;
        const editMode = this.isEditMode;

        const byType = (type) => actor.items.filter((i) => i.type === type).sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
        const abilities = this.#prepareAbilities();
        const nature = abilities.find((a) => a.key === "nature");
        const natureMax = Math.max(1, nature?.max ?? 1);

        const shownTypes = new Set(["ability", "skill", "trait", "wise", "item", "contact"]);
        const gear = byType("item").map((i) => this.#prepareGear(i));
        const totalWeight = gear.reduce((sum, g) => sum + (Number(g.quantity) || 0) * (Number(g.weight) || 0), 0);

        Object.assign(context, {
            actor,
            system,
            editMode,
            quickMode: this.#quickMode,
            owner: actor.isOwner,
            portrait: this.#preparePortrait(),
            conditions: this.#prepareConditions(),
            healthy: !CONDITIONS.some((c) => system.conditions?.[c.key]),
            rewards: [
                { path: "system.rewards.fate", value: system.rewards?.fate ?? 0, label: "MOUSEGUARD.Sheet.Fate", tooltip: "MOUSEGUARD.Sheet.FateHint" },
                { path: "system.rewards.persona", value: system.rewards?.persona ?? 0, label: "MOUSEGUARD.Sheet.Persona", tooltip: "MOUSEGUARD.Sheet.PersonaHint" },
                { path: "system.rewards.check", value: system.rewards?.check ?? 0, label: "MOUSEGUARD.Sheet.Checks", tooltip: "MOUSEGUARD.Sheet.ChecksHint" }
            ],
            disposition: { current: system.disposition?.current ?? 0, starting: system.disposition?.starting ?? 0 },
            quests: [
                { key: "belief", path: "system.rewards.belief", value: system.rewards?.belief ?? "", label: "MOUSEGUARD.Sheet.Belief", hint: "MOUSEGUARD.Sheet.BeliefHint" },
                { key: "goal", path: "system.rewards.goal", value: system.rewards?.goal ?? "", label: "MOUSEGUARD.Sheet.Goal", hint: "MOUSEGUARD.Sheet.GoalHint" },
                { key: "instinct", path: "system.rewards.instinct", value: system.rewards?.instinct ?? "", label: "MOUSEGUARD.Sheet.Instinct", hint: "MOUSEGUARD.Sheet.InstinctHint" }
            ],
            abilities,
            skills: byType("skill").map((i) => this.#prepareSkill(i, natureMax)),
            traits: byType("trait").map((i) => this.#prepareTrait(i)),
            wises: byType("wise").map((i) => this.#prepareWise(i)),
            gear,
            totalWeight: Math.round(totalWeight * 100) / 100,
            contacts: byType("contact").map((i) => ({ id: i.id, name: itemDisplayName(i), img: i.img, excerpt: excerpt(i.system?.description) })),
            others: actor.items.filter((i) => !shownTypes.has(i.type)).sort((a, b) => a.sort - b.sort)
                .map((i) => ({ id: i.id, name: itemDisplayName(i), img: i.img, typeLabel: loc(CONFIG.Item.typeLabels?.[i.type] ?? i.type) })),
            details: DETAILS.map((d) => ({ ...d, name: `system.details.${d.key}`, value: system.details?.[d.key] ?? (d.type === "number" ? 0 : "") })),
            packs: { skill: !!game.packs.get(PACKS.skill), trait: !!game.packs.get(PACKS.trait) }
        });
        return context;
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId in context.tabs) context.tab = context.tabs[partId];
        const TextEditor = foundry.applications.ux.TextEditor.implementation;
        const enrich = (html) => TextEditor.enrichHTML(html ?? "", {
            secrets: this.actor.isOwner, rollData: this.actor.getRollData(), relativeTo: this.actor
        });
        if (partId === "biography") context.biographyHTML = await enrich(this.actor.system.biography);
        if (partId === "notes") context.notesHTML = await enrich(this.actor.system.notes);
        return context;
    }

    /* -------------------------------------------- */

    /** Portrait column data. */
    #preparePortrait() {
        const { system } = this.actor;
        const img = this.actor.img;
        const isDefault = !img || img === CONST.DEFAULT_TOKEN;
        const src = isDefault ? PORTRAIT_PLACEHOLDER : img;
        const details = system.details ?? {};
        const subtitle = [details.guard_rank, formatAge(details.age), details.home].map((s) => String(s ?? "").trim()).filter(Boolean);
        return {
            src,
            isIcon: isDefault || /\.svg(\?.*)?$/i.test(src),
            subtitle: subtitle.join(" · "),
            cloak: String(details.cloak_color ?? "").trim(),
            cloakSwatch: cloakSwatch(details.cloak_color),
            player: String(system.player ?? "").trim(),
            age: details.age ?? 0
        };
    }

    /** Condition chips for the header box. */
    #prepareConditions() {
        const conditions = this.actor.system.conditions ?? {};
        return CONDITIONS.map((c) => ({
            key: c.key,
            active: !!conditions[c.key],
            label: c.label,
            tooltip: c.tooltip,
            icon: `systems/mouseguard/assets/icons/${c.icon}.svg`
        }));
    }

    /** Ability rows, in rulebook order (nature, will, health, resources, circles), then any other ability. */
    #prepareAbilities() {
        const rows = this.actor.items.filter((i) => i.type === "ability").map((item) => {
            const sys = item.system ?? {};
            const key = abilityKeyOf(item);
            const rating = Number(sys.rating) || 0;
            const legacyMax = Number(sys.tax) || 0;
            const max = key === "nature" ? Math.max(rating, Number(sys.max) || 0, legacyMax) : rating;
            const r = key === "nature" ? max : rating;
            const passed = Number(sys.advancement?.passed) || 0;
            const failed = Number(sys.advancement?.failed) || 0;
            const passNeed = Math.max(1, r);
            const failNeed = Math.max(0, r - 1);
            return {
                id: item.id,
                key,
                label: abilityDisplayName(item),
                rating,
                max,
                isNature: key === "nature",
                taxed: key === "nature" && rating < max,
                ready: (r < (ABILITY_CAPS[key] ?? 10)) && passed >= passNeed && failed >= failNeed,
                passTrack: track({ kind: "passed", label: "MOUSEGUARD.Sheet.PassShort", tooltip: "MOUSEGUARD.Sheet.PassHint", count: passNeed, value: passed }),
                failTrack: failNeed ? track({ kind: "failed", label: "MOUSEGUARD.Sheet.FailShort", tooltip: "MOUSEGUARD.Sheet.FailHint", count: failNeed, value: failed }) : null,
                order: ABILITY_ORDER.includes(key) ? ABILITY_ORDER.indexOf(key) : 10 + (item.sort || 0) / 1e6
            };
        });
        return rows.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }

    /** Skill row. Rank 0 = not learned yet (Beginner's Luck): shows learning marks toward Nature instead of P/F. */
    #prepareSkill(item, natureMax) {
        const sys = item.system ?? {};
        const rank = Number(sys.rank) || 0;
        const passed = Number(sys.advancement?.passed) || 0;
        const failed = Number(sys.advancement?.failed) || 0;
        const learned = rank > 0;
        const blKey = sys.beginnersLuck === "health" ? "health" : "will";
        const row = {
            id: item.id,
            name: itemDisplayName(item),
            rank,
            learned,
            specialty: !!sys.specialty,
            ready: learned && (rank < SKILL_CAP) && passed >= Math.max(1, rank) && failed >= Math.max(0, rank - 1)
        };
        if (learned) {
            row.passTrack = track({ kind: "passed", label: "MOUSEGUARD.Sheet.PassShort", tooltip: "MOUSEGUARD.Sheet.PassHint", count: Math.max(1, rank), value: passed });
            row.failTrack = rank > 1 ? track({ kind: "failed", label: "MOUSEGUARD.Sheet.FailShort", tooltip: "MOUSEGUARD.Sheet.FailHint", count: rank - 1, value: failed }) : null;
        } else {
            row.learnTrack = track({ kind: "learning", label: "MOUSEGUARD.Sheet.LearningShort", tooltip: "MOUSEGUARD.Sheet.LearningHint", count: natureMax, value: Number(sys.learning) || 0 });
            row.blTooltip = game.i18n.format("MOUSEGUARD.Sheet.BeginnersLuckHint", { ability: loc(ABILITY_LABELS[blKey]) });
        }
        return row;
    }

    /** Trait row: level I-III, beneficial uses this session, uses against yourself. */
    #prepareTrait(item) {
        const sys = item.system ?? {};
        const level = clamp(sys.level ?? 1, 1, 3);
        const usedFor = Number(sys.usedFor ?? sys.usedfor) || 0;
        const usedAgainst = Number(sys.usedAgainst ?? sys.usedagainst) || 0;
        return {
            id: item.id,
            name: itemDisplayName(item),
            level,
            roman: ROMAN[level],
            unlimited: level >= 3,
            usedAgainst,
            checksEarned: Number(sys.checksEarned) || 0,
            spent: level < 3 && usedFor >= level,
            forTrack: level < 3
                ? track({ kind: "usedFor", label: "MOUSEGUARD.Sheet.TraitForShort", tooltip: "MOUSEGUARD.Sheet.TraitForHint", count: level, value: usedFor, action: "traitUse", mode: "for" })
                : null
        };
    }

    /** Wise row with its four marks. */
    #prepareWise(item) {
        const checks = item.system?.checks ?? {};
        const marks = WISE_MARKS.map((m) => ({ ...m, on: !!checks[m.key] }));
        return { id: item.id, name: itemDisplayName(item), marks, ready: marks.every((m) => m.on) };
    }

    /** Gear row. */
    #prepareGear(item) {
        const sys = item.system ?? {};
        return {
            id: item.id,
            name: itemDisplayName(item),
            img: item.img,
            quantity: sys.quantity ?? 1,
            weight: sys.weight ?? 0,
            excerpt: excerpt(sys.description, 120)
        };
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.#createContextMenus();
        // Keyboard access for the clickable names / chips (role="button"): Enter or Space = click (Shift kept).
        this.element.addEventListener("keydown", (event) => {
            if ((event.key !== "Enter") && (event.key !== " ")) return;
            const target = event.target;
            if (!target?.matches?.('[role="button"][data-action]')) return;
            event.preventDefault();
            target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: event.shiftKey, button: 0 }));
        });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        const editMode = this.isEditMode;
        this.element.classList.toggle("mgs-edit-mode", editMode);
        this.element.classList.toggle("mgs-play-mode", !editMode);
        const toggle = this.element.querySelector(".window-header .mgs-mode-toggle");
        if (toggle) {
            toggle.classList.toggle("fa-lock-open", editMode);
            toggle.classList.toggle("fa-lock", !editMode);
            const label = loc(editMode ? "MOUSEGUARD.Sheet.ToPlayMode" : "MOUSEGUARD.Sheet.ToEditMode");
            toggle.dataset.tooltip = label;
            toggle.setAttribute("aria-label", label);
            toggle.setAttribute("aria-pressed", String(editMode));
        }
    }

    /* -------------------------------------------- */
    /*  Form handling                               */
    /* -------------------------------------------- */

    /**
     * The portrait <img data-edit="img"> is submitted with every form change. While the actor has no picture of its own
     * it shows the placeholder, which must not be written into actor.img (and from there into the token).
     * @override
     */
    _processFormData(event, form, formData) {
        const data = super._processFormData(event, form, formData);
        const sourceImg = this.actor._source.img;
        const hasOwnImage = !!sourceImg && sourceImg !== CONST.DEFAULT_TOKEN;
        if (!hasOwnImage && data.img === PORTRAIT_PLACEHOLDER) delete data.img;
        return data;
    }

    /**
     * Inputs that edit an embedded item carry `data-item-field` (and no `name`), so they never reach the actor form
     * submission. Their changes are written to the item here instead.
     * @override
     */
    _onChangeForm(formConfig, event) {
        const input = event.target?.closest?.("[data-item-field]");
        if (input) {
            event.stopPropagation();
            this.#updateItemField(input);
            return;
        }
        return super._onChangeForm(formConfig, event);
    }

    /** Write one embedded-item input to its item. */
    async #updateItemField(input) {
        const item = this.actor.items.get(input.closest("[data-item-id]")?.dataset.itemId);
        if (!item) return;
        let value;
        if (input.type === "checkbox") value = input.checked;
        else if ((input.type === "number") || (input.dataset.dtype === "Number")) {
            if (input.value === "") return;
            value = Number(input.value);
            if (!Number.isFinite(value)) return;
            if (input.min !== "") value = Math.max(value, Number(input.min));
            if (input.max !== "") value = Math.min(value, Number(input.max));
        } else value = input.value;
        await item.update({ [input.dataset.itemField]: value });
    }

    /* -------------------------------------------- */
    /*  Drag and drop                               */
    /* -------------------------------------------- */

    /**
     * Dropping an item from a compendium, the sidebar or another actor creates it on this mouse (core behaviour),
     * except for a skill, trait or wise the mouse already has. Dropping one of this mouse's own items sorts it.
     * @inheritDoc
     */
    async _onDropItem(event, item) {
        if (!this.actor.isOwner || !this.isEditable) return null;
        if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
        const duplicate = this.#findDuplicate(item);
        if (duplicate) {
            ui.notifications.info(game.i18n.format("MOUSEGUARD.Sheet.AlreadyHas", { name: itemDisplayName(duplicate) }));
            return null;
        }
        const created = await super._onDropItem(event, item);
        if (created) {
            const tab = { item: "gear", contact: "biography", condition: "gear" }[created.type]
                ?? (["ability", "skill", "trait", "wise"].includes(created.type) ? "mouse" : null);
            if (tab && (this.tabGroups.primary !== tab)) {
                try { this.changeTab(tab, "primary"); } catch (err) { this.tabGroups.primary = tab; }
            }
        }
        return created;
    }

    /** An existing item that the dropped one would duplicate. */
    #findDuplicate(item) {
        const norm = (s) => String(s ?? "").trim().toLowerCase();
        if (item.type === "ability") {
            const key = abilityKeyOf(item);
            return key ? this.actor.items.find((i) => (i.type === "ability") && (abilityKeyOf(i) === key)) : null;
        }
        if (!UNIQUE_TYPES.has(item.type)) return null;
        const names = new Set([norm(item.name), norm(item.flags?.mouseguard?.originalName)].filter(Boolean));
        const source = item.uuid;
        return this.actor.items.find((i) => {
            if (i.type !== item.type) return false;
            if (source && (i._stats?.compendiumSource === source)) return true;
            return names.has(norm(i.name)) || (i.flags?.mouseguard?.originalName && names.has(norm(i.flags.mouseguard.originalName)));
        }) ?? null;
    }

    /**
     * Sort only among items of the same type (rows of one list); ignore drops on other rows.
     * @inheritDoc
     */
    _onSortItem(event, item) {
        const row = event.target.closest?.("[data-item-id]");
        const target = row && this.actor.items.get(row.dataset.itemId);
        if (!target || (target.id === item.id) || (target.type !== item.type)) return;
        return super._onSortItem(event, item);
    }

    /* -------------------------------------------- */
    /*  Context menu                                */
    /* -------------------------------------------- */

    /** Item row context menu (right click on the name part of a row). Created once: this.element persists. */
    #createContextMenus() {
        const options = { fixed: true, hookName: "get{}ItemContextOptions", parentClassHooks: false };
        const selector = ".mgs-line[data-item-id] .mgs-line-main, .mgs-gear-row[data-item-id], .mgs-contact[data-item-id]";
        const handler = () => this.#getItemContextOptions();
        if (typeof this._createContextMenu === "function") this._createContextMenu(handler, selector, options);
        else new foundry.applications.ux.ContextMenu.implementation(this.element, selector, handler(), { fixed: true, jQuery: false });
    }

    /** Entries usable by v14 (label/visible/onClick) and v13 (name/condition/callback) without deprecation warnings. */
    #getItemContextOptions() {
        const itemOf = (el) => this.actor.items.get((el instanceof HTMLElement ? el : el?.[0])?.closest("[data-item-id]")?.dataset.itemId);
        const entry = (label, icon, visible, run) => ({
            label,
            name: label,
            icon: `<i class="${icon}"></i>`,
            visible: (el) => !!itemOf(el) && visible(itemOf(el)),
            condition: (el) => !!itemOf(el) && visible(itemOf(el)),
            onClick: (event, el) => run(itemOf(el), event),
            callback: (el) => run(itemOf(el))
        });
        const rollable = (i) => (i.type === "skill") || (i.type === "ability");
        const editable = () => this.isEditable;
        return [
            entry("MOUSEGUARD.Sheet.MenuTest", "fa-solid fa-dice-d6", (i) => rollable(i) && editable(),
                (i) => this.#rollTest(this.#rollTarget(i, false))),
            entry("MOUSEGUARD.Sheet.MenuQuickTest", "fa-solid fa-bolt", (i) => rollable(i) && editable(),
                (i) => this.#rollTest(this.#rollTarget(i, true))),
            entry("MOUSEGUARD.Sheet.MenuMarkPass", "fa-solid fa-circle-check", (i) => rollable(i) && editable() && ((i.type !== "skill") || (Number(i.system?.rank) > 0)),
                (i) => this.#markAdvancement(i, "passed", 1)),
            entry("MOUSEGUARD.Sheet.MenuMarkFail", "fa-solid fa-circle-xmark", (i) => rollable(i) && editable() && ((i.type !== "skill") || (Number(i.system?.rank) > 1)) && ((i.type !== "ability") || (Number(i.system?.rating) > 1) || (abilityKeyOf(i) === "nature")),
                (i) => this.#markAdvancement(i, "failed", 1)),
            entry("MOUSEGUARD.Sheet.MenuSpecialty", "fa-solid fa-star", (i) => (i.type === "skill") && editable(),
                (i) => this.#toggleSpecialty(i)),
            entry("MOUSEGUARD.Sheet.MenuTraitFor", "fa-solid fa-angles-up", (i) => (i.type === "trait") && editable(),
                (i) => this.#useTrait(i, "for")),
            entry("MOUSEGUARD.Sheet.MenuTraitAgainst", "fa-solid fa-angles-down", (i) => (i.type === "trait") && editable(),
                (i) => this.#useTrait(i, "against")),
            entry("MOUSEGUARD.Sheet.MenuTraitRecharge", "fa-solid fa-battery-half",
                (i) => (i.type === "trait") && editable() && (typeof this.actor.rechargeTrait === "function")
                    && (Number(i.system?.level) < 3) && (Number(i.system?.usedFor) > 0),
                (i) => this.actor.rechargeTrait(i.id)),
            entry("MOUSEGUARD.Sheet.MenuEdit", "fa-solid fa-pen-to-square", () => true,
                (i) => i.sheet?.render({ force: true })),
            entry("MOUSEGUARD.Sheet.MenuDelete", "fa-solid fa-trash", () => editable(),
                (i) => this.#confirmDelete(i))
        ];
    }

    /* -------------------------------------------- */
    /*  Actor API wrappers (contract), with fallbacks */
    /* -------------------------------------------- */

    /** rollTest options for an item row: rollTest({itemId}) for skills, rollTest({abilityKey}) for keyed abilities. */
    #rollTarget(item, quick, event) {
        const key = item.type === "ability" ? item.system?.key : "";
        if (key && ABILITY_LABELS[key]) return { abilityKey: key, itemId: item.id, quick, event };
        return { itemId: item.id, quick, event };
    }

    /** actor.rollTest, guarded. */
    async #rollTest(options) {
        const actor = this.actor;
        if (typeof actor.rollTest !== "function") {
            ui.notifications.warn(loc("MOUSEGUARD.Sheet.NoRollSystem"));
            return null;
        }
        try {
            return await actor.rollTest(options);
        } catch (err) {
            console.error("Mouse Guard | rollTest failed", err);
            ui.notifications.error(loc("MOUSEGUARD.Sheet.RollFailed"));
            return null;
        }
    }

    /** actor.markAdvancement, or a plain clamped update of the advancement / learning counter. */
    async #markAdvancement(item, kind, delta) {
        if (!delta) return;
        if (kind === "learning") {
            if (typeof this.actor.markLearning === "function") return this.actor.markLearning(item.id, delta);
            return item.update({ "system.learning": clamp((Number(item.system?.learning) || 0) + delta, 0, 10) });
        }
        if (typeof this.actor.markAdvancement === "function") return this.actor.markAdvancement(item.id, kind, delta);
        const path = `system.advancement.${kind}`;
        const current = Number(foundry.utils.getProperty(item, path)) || 0;
        return item.update({ [path]: clamp(current + delta, 0, 10) });
    }

    /** actor.useTrait (for / against), or a plain update of the counters. */
    async #useTrait(item, mode) {
        if (typeof this.actor.useTrait === "function") return this.actor.useTrait(item.id, mode);
        const sys = item.system ?? {};
        if (mode === "for") {
            const level = clamp(sys.level ?? 1, 1, 3);
            if (level < 3 && (Number(sys.usedFor) || 0) >= level) return;
            return item.update({ "system.usedFor": clamp((Number(sys.usedFor) || 0) + 1, 0, 2) });
        }
        await item.update({
            "system.usedAgainst": clamp((Number(sys.usedAgainst) || 0) + 1, 0, 99),
            "system.checksEarned": clamp((Number(sys.checksEarned) || 0) + 1, 0, 99)
        });
        return this.actor.update({ "system.rewards.check": clamp((Number(this.actor.system.rewards?.check) || 0) + 1, 0, 99) });
    }

    /** Make a skill the patrol specialty (only one per mouse), or remove the mark. */
    async #toggleSpecialty(item) {
        const on = !item.system?.specialty;
        const updates = [{ _id: item.id, "system.specialty": on }];
        if (on) {
            for (const other of this.actor.items) {
                if ((other.type === "skill") && (other.id !== item.id) && other.system?.specialty) updates.push({ _id: other.id, "system.specialty": false });
            }
        }
        return this.actor.updateEmbeddedDocuments("Item", updates);
    }

    /** Confirm, then delete an embedded item. */
    async #confirmDelete(item) {
        if (!item) return;
        const name = foundry.utils.escapeHTML?.(itemDisplayName(item)) ?? itemDisplayName(item);
        const confirmed = await DialogV2.confirm({
            window: { title: loc("MOUSEGUARD.Sheet.DeleteTitle"), icon: "fa-solid fa-trash" },
            content: `<p>${game.i18n.format("MOUSEGUARD.Sheet.DeleteConfirm", { name })}</p>`,
            rejectClose: false,
            modal: true
        });
        if (confirmed) await item.delete();
    }

    /** The embedded item of an action target row. */
    #itemFrom(target) {
        return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    }

    /* -------------------------------------------- */
    /*  Actions                                     */
    /* -------------------------------------------- */

    /** Switch between play and edit mode. */
    static #onToggleMode(event) {
        event.preventDefault();
        if (!this.isEditable) return;
        this.#editMode = !this.isEditMode;
        this.render();
    }

    /** Open details fill and generator dialog. */
    static #onOpenDetails(event) {
        event.preventDefault();
        const dlg = game.mouseguard?.MouseGuardDetailsDialog;
        if (dlg) dlg.open(this.actor);
    }

    /** Click on a skill or ability name: Test dialog; Shift+click (or quick mode): roll at once. */
    static async #onRoll(event, target) {
        event.preventDefault();
        const item = this.#itemFrom(target);
        if (!item || !this.isEditable) return;
        const quick = !!event.shiftKey || this.#quickMode;
        return this.#rollTest(this.#rollTarget(item, quick, event));
    }

    /** "Test" header button: free Test dialog (choose the skill or ability inside it). */
    static async #onTestFree(event) {
        event.preventDefault();
        return this.#rollTest({ quick: false, event });
    }

    /** "Quick test" header button: toggles quick mode. */
    static #onToggleQuick(event) {
        event.preventDefault();
        this.#quickMode = !this.#quickMode;
        this.render({ parts: ["header"] });
    }

    /** "New session" header button. */
    static async #onNewSession(event) {
        event.preventDefault();
        if (!this.isEditable) return;
        const confirmed = await DialogV2.confirm({
            window: { title: loc("MOUSEGUARD.Sheet.NewSession"), icon: "fa-solid fa-hourglass-start" },
            content: `<p>${loc("MOUSEGUARD.Sheet.NewSessionConfirm")}</p>`,
            rejectClose: false,
            modal: true
        });
        if (!confirmed) return;
        if (typeof this.actor.startNewSession === "function") return this.actor.startNewSession();
        const updates = this.actor.items.filter((i) => i.type === "trait")
            .map((i) => ({ _id: i.id, "system.usedFor": 0, "system.usedAgainst": 0, "system.checksEarned": 0 }));
        if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
        ui.notifications.info(game.i18n.format("MOUSEGUARD.Sheet.NewSessionDone", { name: this.actor.name }));
    }

    /**
     * Pip track click (advancement P/F of skills and abilities, learning marks of rank-0 skills).
     * Left click on pip n sets the count to n (or n-1 when pip n is the last filled one); right click removes one.
     */
    static async #onAdvance(event, target) {
        event.preventDefault();
        const item = this.#itemFrom(target);
        if (!item || !this.isEditable) return;
        const kind = target.dataset.track;
        const value = kind === "learning"
            ? Number(item.system?.learning) || 0
            : Number(item.system?.advancement?.[kind]) || 0;
        let delta = -1;
        if (event.button !== 2) {
            const pip = event.target.closest?.(".mgs-pip");
            if (pip) {
                const n = Number(pip.dataset.index) + 1;
                delta = (n === value ? n - 1 : n) - value;
            } else delta = 1;
        }
        if ((value + delta) < 0) return;
        return this.#markAdvancement(item, kind, delta);
    }

    /** Trait use: left click = use the trait (for / against); right click = take one mark back. */
    static async #onTraitUse(event, target) {
        event.preventDefault();
        const item = this.#itemFrom(target);
        if (!item || !this.isEditable) return;
        const mode = target.dataset.mode === "against" ? "against" : "for";
        if (event.button === 2) {
            const path = mode === "for" ? "system.usedFor" : "system.usedAgainst";
            const current = Number(foundry.utils.getProperty(item, path)) || 0;
            if (current > 0) await item.update({ [path]: current - 1 });
            return;
        }
        const pip = event.target.closest?.(".mgs-pip");
        if ((mode === "for") && pip?.classList.contains("on")) {
            return item.update({ "system.usedFor": Math.max(0, (Number(item.system?.usedFor) || 0) - 1) });
        }
        return this.#useTrait(item, mode);
    }

    /** Toggle one of the four marks of a wise. */
    static async #onWiseMark(event, target) {
        event.preventDefault();
        const item = this.#itemFrom(target);
        const mark = target.dataset.mark;
        if (!item || !this.isEditable || !WISE_MARKS.some((m) => m.key === mark)) return;
        return item.update({ [`system.checks.${mark}`]: !item.system?.checks?.[mark] });
    }

    /** Toggle a condition. */
    static async #onToggleCondition(event, target) {
        event.preventDefault();
        const key = target.dataset.condition;
        if (!this.isEditable || !CONDITIONS.some((c) => c.key === key)) return;
        if (typeof this.actor.toggleCondition === "function") return this.actor.toggleCondition(key);
        return this.actor.update({ [`system.conditions.${key}`]: !this.actor.system.conditions?.[key] });
    }

    /** Left click +1, right click -1 on an actor number (fate, persona, checks, disposition). */
    static async #onAdjust(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const path = target.dataset.path;
        if (!path?.startsWith("system.")) return;
        const delta = event.button === 2 ? -1 : 1;
        const min = Number(target.dataset.min ?? 0);
        const max = Number(target.dataset.max ?? 99);
        const current = Number(foundry.utils.getProperty(this.actor, path)) || 0;
        const value = clamp(current + delta, min, max);
        if (value !== current) return this.actor.update({ [path]: value });
    }

    /** Star toggle on a skill row (edit mode). */
    static async #onToggleSpecialty(event, target) {
        event.preventDefault();
        const item = this.#itemFrom(target);
        if (item && this.isEditable) return this.#toggleSpecialty(item);
    }

    /** Create a new item of the requested type and open its sheet. */
    static async #onItemCreate(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const type = target.dataset.type;
        if (!(type in (CONFIG.Item.dataModels ?? {})) && !game.documentTypes?.Item?.includes(type)) return;
        const name = loc(NEW_ITEM_NAMES[type] ?? "MOUSEGUARD.Sheet.NewGear");
        const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
        item?.sheet?.render({ force: true });
    }

    /** Open the sheet of an embedded item. */
    static #onItemEdit(event, target) {
        event.preventDefault();
        this.#itemFrom(target)?.sheet?.render({ force: true });
    }

    /** Delete an embedded item (after confirmation). */
    static async #onItemDelete(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        return this.#confirmDelete(this.#itemFrom(target));
    }

    /** Open a compendium pack (skills / traits) to drag entries onto the sheet. */
    static #onOpenCompendium(event, target) {
        event.preventDefault();
        const pack = game.packs.get(target.dataset.pack);
        if (pack) pack.render(true);
        else ui.notifications.warn(game.i18n.format("MOUSEGUARD.Sheet.NoPack", { pack: target.dataset.pack }));
    }
}
