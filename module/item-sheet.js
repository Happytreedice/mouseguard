/**
 * Mouse Guard item sheet (Foundry VTT v13/v14, ApplicationV2 + Handlebars).
 *
 * One sheet class serves every item type. The window is made of two parts: a shared header (image, name, type, badge,
 * test button) and one body part per item type (skill, trait, wise, ability, item, contact, condition).
 * Look and feel follow the character sheet (Legend in the Mist layout): paper window background, parchment cards with
 * coloured ribbons, pip trackers, headings with an underline ornament. All art is placeholder art from assets/sheet/.
 *
 * Two modes, switched with the padlock in the window header (only for users who may edit the item):
 *  - view mode: rich-text fields are shown enriched; pips (advancement, learning, trait uses) and wise marks stay
 *    clickable for quick bookkeeping (left click +1, right click -1);
 *  - edit mode: inputs for every field, ProseMirror editors for the HTML fields, tag editor for the "help" list.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const TEMPLATES = "systems/mouseguard/templates/item";

/** Partials used by the body parts (loaded by HandlebarsApplicationMixin#_preRender through `templates`). */
const PARTIALS = [
    `${TEMPLATES}/parts/rich-section.hbs`,
    `${TEMPLATES}/parts/pips.hbs`
];

/** Localization keys of the five abilities, by AbilityData.key. */
export const ABILITY_LABELS = Object.freeze({
    nature: "MOUSEGUARD.Nature",
    will: "MOUSEGUARD.Will",
    health: "MOUSEGUARD.Health",
    resources: "MOUSEGUARD.Resources",
    circles: "MOUSEGUARD.Circles"
});

/** Highest rating an ability can reach (rulebook pp. 30-31, 254, 259-263). */
const ABILITY_CAPS = Object.freeze({ nature: 7, will: 6, health: 6, resources: 10, circles: 10 });

/** Highest skill rank (rulebook p. 247). */
const SKILL_CAP = 6;

/** Window height per item type (the width is shared). */
const TYPE_HEIGHTS = Object.freeze({
    skill: 720, trait: 720, wise: 560, ability: 560, item: 520, contact: 500, condition: 500
});

/** Window icon per item type. */
const TYPE_ICONS = Object.freeze({
    skill: "fa-solid fa-feather",
    trait: "fa-solid fa-paw",
    wise: "fa-solid fa-book-open",
    ability: "fa-solid fa-shield-halved",
    item: "fa-solid fa-box-open",
    contact: "fa-solid fa-address-book",
    condition: "fa-solid fa-heart-crack"
});

const ROMAN = ["", "I", "II", "III"];

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

const loc = (key) => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/** True when an HTML field holds real content (legacy object descriptions are cast to "[object Object]"). */
function hasHTML(html) {
    if (typeof html !== "string") return false;
    if (html === "[object Object]") return false;
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0 || /<img|<table/i.test(html);
}

/** Raw HTML value of a field, never a legacy object. */
function rawHTML(html) {
    return (typeof html === "string" && html !== "[object Object]") ? html : "";
}

/**
 * Pip tracker view-model.
 * @param {number} value   Marks currently set.
 * @param {number} target  Marks needed (pips drawn even when empty).
 * @param {number} cap     Never draw more pips than this.
 */
function makePips(value, target, cap) {
    const v = Math.max(0, num(value));
    const count = Math.min(cap, Math.max(target, v));
    return Array.from({ length: count }, (_, i) => ({ on: i < v, over: i >= target }));
}

/**
 * Rating scale view-model: `cap` pips, filled up to `value`; for Nature the pips between the current (taxed) rating
 * and the maximum are marked as taxed.
 */
function makeScale(value, cap, max = value) {
    return Array.from({ length: cap }, (_, i) => ({ on: i < value, taxed: (i >= value) && (i < max) }));
}

/**
 * Display name of an item. Uses the document's own `displayName` (MouseGuardItem, shared with the character sheet and
 * the Test dialog) when present; otherwise the localized ability label when an ability carries a key, the localized
 * name when the name is an i18n key (legacy "MOUSEGUARD.Will" ability items), or the name itself.
 * @param {Item} item
 * @returns {string}
 */
export function itemDisplayName(item) {
    const shared = item?.displayName;
    if ((typeof shared === "string") && shared) return shared;
    const key = item?.type === "ability" ? item.system?.key : "";
    if (key && ABILITY_LABELS[key]) return loc(ABILITY_LABELS[key]);
    const name = item?.name ?? "";
    return name.startsWith("MOUSEGUARD.") ? loc(name) : name;
}

/* -------------------------------------------- */
/*  Sheet                                       */
/* -------------------------------------------- */

export class MouseGuardItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    /** Edit mode of this sheet instance; null = decide on first use. */
    #editMode = null;

    /** Help entries being added right now (guards against Enter + change firing twice). */
    #helpPending = new Set();

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "sheet", "item", "themed", "theme-light"],
        position: { width: 580, height: 640 },
        window: { resizable: true, icon: "fa-solid fa-scroll" },
        form: { submitOnChange: true, closeOnSubmit: false },
        actions: {
            toggleMode: MouseGuardItemSheet.#onToggleMode,
            adjust: { handler: MouseGuardItemSheet.#onAdjust, buttons: [0, 2] },
            toggleFlag: MouseGuardItemSheet.#onToggleFlag,
            helpAdd: MouseGuardItemSheet.#onHelpAdd,
            helpRemove: MouseGuardItemSheet.#onHelpRemove,
            roll: MouseGuardItemSheet.#onRoll
        }
    };

    /**
     * The header part is shared; exactly one of the other parts (the one named after the item type) is rendered.
     * @override
     */
    static PARTS = {
        header: { template: `${TEMPLATES}/header.hbs` },
        skill: { template: `${TEMPLATES}/skill.hbs`, templates: PARTIALS, scrollable: [""] },
        trait: { template: `${TEMPLATES}/trait.hbs`, templates: PARTIALS, scrollable: [""] },
        wise: { template: `${TEMPLATES}/wise.hbs`, templates: PARTIALS, scrollable: [""] },
        ability: { template: `${TEMPLATES}/ability.hbs`, templates: PARTIALS, scrollable: [""] },
        item: { template: `${TEMPLATES}/gear.hbs`, templates: PARTIALS, scrollable: [""] },
        contact: { template: `${TEMPLATES}/simple.hbs`, templates: PARTIALS, scrollable: [""] },
        condition: { template: `${TEMPLATES}/simple.hbs`, templates: PARTIALS, scrollable: [""] }
    };

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    /**
     * Is the sheet in edit mode? Never for users who cannot edit the item (locked compendium, observers).
     * New, empty items open in edit mode; items with a description (e.g. from the compendium) open in view mode.
     * @type {boolean}
     */
    get editMode() {
        if (!this.isEditable) return false;
        if (this.#editMode === null) {
            this.#editMode = (this.item.type !== "ability") && !hasHTML(this.item.system?.description);
        }
        return this.#editMode;
    }

    /** @override */
    get title() {
        const label = CONFIG.Item.typeLabels?.[this.item.type];
        const name = itemDisplayName(this.item) || this.item.id;
        return label ? `${loc(label)}: ${name}` : name;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
        const explicitHeight = options?.position?.height;
        const opts = super._initializeApplicationOptions(options);
        const type = opts.document?.type;
        if (type) {
            opts.classes.push(`mgi-type-${type}`);
            if (TYPE_ICONS[type]) opts.window.icon = TYPE_ICONS[type];
            if ((explicitHeight === undefined) && TYPE_HEIGHTS[type]) opts.position.height = TYPE_HEIGHTS[type];
        }
        return opts;
    }

    /** @inheritDoc */
    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        const body = (this.item.type in parts) && (this.item.type !== "header") ? this.item.type : "contact";
        for (const id of Object.keys(parts)) {
            if ((id !== "header") && (id !== body)) delete parts[id];
        }
        return parts;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const item = this.item;
        const system = item.system ?? {};
        const editMode = this.editMode;

        Object.assign(context, {
            item,
            system,
            editMode,
            interactive: this.isEditable,
            typeLabel: loc(CONFIG.Item.typeLabels?.[item.type] ?? "TYPES.Item.item"),
            displayName: itemDisplayName(item),
            // Legacy ability items are named with an i18n key: edit the readable name instead of the raw key.
            nameValue: item.name?.startsWith("MOUSEGUARD.") ? loc(item.name) : item.name,
            enriched: {},
            raw: {},
            badge: null,
            subtitle: [],
            canRoll: false
        });
        await this.#prepareRichText(context, "description", system.description);

        switch (item.type) {
            case "skill": await this.#prepareSkill(context); break;
            case "trait": await this.#prepareTrait(context); break;
            case "wise": this.#prepareWise(context); break;
            case "ability": this.#prepareAbility(context); break;
            case "item": this.#prepareGear(context); break;
            default: break;
        }
        return context;
    }

    /**
     * Enrich one HTML field for display and keep its raw value for the editor.
     * @param {object} context
     * @param {string} key      Key under context.enriched / context.raw
     * @param {string} html     The stored HTML
     */
    async #prepareRichText(context, key, html) {
        const raw = rawHTML(html);
        context.raw[key] = raw;
        context.enriched[key] = hasHTML(raw)
            ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, {
                secrets: this.item.isOwner,
                rollData: this.item.getRollData?.() ?? {},
                relativeTo: this.item
            })
            : "";
    }

    /** The owning actor's Nature item, if any. */
    #natureItem() {
        const actor = this.item.actor;
        if (!actor) return undefined;
        const viaApi = (typeof actor.getAbility === "function") ? actor.getAbility("nature") : undefined;
        return viaApi ?? actor.items.find(i => (i.type === "ability") && (i.system?.key === "nature"));
    }

    /** May the test button be shown? */
    #canRoll() {
        const actor = this.item.actor;
        return !!actor && this.item.isEmbedded && actor.isOwner && (typeof actor.rollTest === "function");
    }

    /**
     * Advancement trackers (rulebook p. 247: to go from rating N to N+1 you need N passed and N-1 failed tests;
     * from 0 or 1 a single passed test is enough).
     */
    #advancementView(system, rating, cap, pipCap) {
        const passedNeed = Math.max(1, rating);
        const failedNeed = Math.max(0, rating - 1);
        const passed = num(system.advancement?.passed);
        const failed = num(system.advancement?.failed);
        return {
            passed: { value: passed, need: passedNeed, pips: makePips(passed, passedNeed, pipCap) },
            failed: { value: failed, need: failedNeed, pips: makePips(failed, failedNeed, pipCap) },
            hint: rating >= cap
                ? loc("MOUSEGUARD.ItemSheet.AdvanceMax")
                : fmt("MOUSEGUARD.ItemSheet.AdvanceNeed", { rating, passed: passedNeed, failed: failedNeed })
        };
    }

    async #prepareSkill(context) {
        const system = context.system;
        await this.#prepareRichText(context, "supplies", system.supplies);
        await this.#prepareRichText(context, "factors", system.factors);

        const rank = Math.clamp(num(system.rank), 0, SKILL_CAP);
        const learned = rank > 0;
        const bl = (system.beginnersLuck === "health") ? "health" : "will";
        const blLabel = loc(ABILITY_LABELS[bl]);
        const learning = num(system.learning);
        const nature = this.#natureItem();
        const natureTarget = nature ? Math.max(1, num(nature.system?.max, num(nature.system?.rating))) : null;

        context.skill = {
            rank,
            learned,
            scale: makeScale(rank, SKILL_CAP),
            specialty: !!system.specialty,
            advancement: this.#advancementView(system, rank, SKILL_CAP, SKILL_CAP),
            beginnersLuck: bl,
            beginnersLuckLabel: blLabel,
            beginnersLuckOptions: ["will", "health"].map(k => ({ value: k, label: loc(ABILITY_LABELS[k]), selected: k === bl })),
            learning: {
                value: learning,
                need: natureTarget,
                pips: natureTarget ? makePips(learning, natureTarget, 10) : makePips(learning, 0, 10),
                hint: natureTarget
                    ? fmt("MOUSEGUARD.ItemSheet.LearningNeed", { count: natureTarget })
                    : loc("MOUSEGUARD.ItemSheet.LearningHint")
            },
            help: this.#helpList(),
            helpOptions: context.editMode ? this.#helpOptions() : []
        };

        context.badge = {
            value: learned ? String(rank) : "×",
            label: loc(learned ? "MOUSEGUARD.ItemSheet.Rank" : "MOUSEGUARD.ItemSheet.Unlearned"),
            tooltip: learned ? "" : loc("MOUSEGUARD.ItemSheet.UnlearnedHint"),
            cssClass: [learned ? "" : "is-unlearned", system.specialty ? "is-specialty" : ""].filter(Boolean).join(" ")
        };
        context.subtitle.push(fmt("MOUSEGUARD.ItemSheet.BeginnersLuckWith", { ability: blLabel }));
        context.canRoll = this.#canRoll();
    }

    async #prepareTrait(context) {
        const system = context.system;
        await this.#prepareRichText(context, "against", system.against);
        const level = Math.clamp(num(system.level, 1) || 1, 1, 3);
        const levels = [];
        for (const n of [1, 2, 3]) {
            const key = `level${n}`;
            await this.#prepareRichText(context, key, system.levels?.[key]);
            levels.push({
                n,
                roman: ROMAN[n],
                current: n === level,
                rule: loc(`MOUSEGUARD.ItemSheet.Level${n}Rule`),
                field: `system.levels.${key}`,
                raw: context.raw[key],
                html: context.enriched[key]
            });
        }
        const usedFor = num(system.usedFor);
        const forMax = level >= 3 ? 0 : level;
        context.trait = {
            level,
            roman: ROMAN[level],
            levelOptions: [1, 2, 3].map(n => ({ value: n, label: fmt("MOUSEGUARD.ItemSheet.LevelN", { level: ROMAN[n] }), selected: n === level })),
            scale: makeScale(level, 3),
            usedFor: {
                value: usedFor,
                max: forMax,
                unlimited: level >= 3,
                pips: makePips(usedFor, forMax, 2),
                hint: (level >= 3)
                    ? loc("MOUSEGUARD.ItemSheet.UsedForUnlimited")
                    : fmt("MOUSEGUARD.ItemSheet.UsedForCount", { used: usedFor, max: forMax })
            },
            usedAgainst: num(system.usedAgainst),
            checksEarned: num(system.checksEarned),
            origin: typeof system.origin === "string" ? system.origin : "",
            levels
        };
        context.badge = { value: ROMAN[level], label: loc("MOUSEGUARD.ItemSheet.Level"), tooltip: "", cssClass: "is-roman" };
        if (context.trait.origin) context.subtitle.push(context.trait.origin);
    }

    #prepareWise(context) {
        const checks = context.system.checks ?? {};
        const marks = [
            { key: "pass", short: "MOUSEGUARD.ItemSheet.WisePassShort", label: "MOUSEGUARD.ItemSheet.WisePass" },
            { key: "fail", short: "MOUSEGUARD.ItemSheet.WiseFailShort", label: "MOUSEGUARD.ItemSheet.WiseFail" },
            { key: "figuredOut", short: "MOUSEGUARD.ItemSheet.WiseFiguredOutShort", label: "MOUSEGUARD.ItemSheet.WiseFiguredOut" },
            { key: "realized", short: "MOUSEGUARD.ItemSheet.WiseRealizedShort", label: "MOUSEGUARD.ItemSheet.WiseRealized" }
        ].map(m => ({ ...m, short: loc(m.short), label: loc(m.label), on: !!checks[m.key], path: `system.checks.${m.key}` }));
        const count = marks.filter(m => m.on).length;
        context.wise = { marks, count, enlightened: count === 4 };
        context.badge = { value: `${count}/4`, label: loc("MOUSEGUARD.ItemSheet.WiseMarks"), tooltip: "", cssClass: count === 4 ? "is-full" : "" };
    }

    #prepareAbility(context) {
        const system = context.system;
        const key = Object.hasOwn(ABILITY_LABELS, system.key) ? system.key : "";
        const isNature = key === "nature";
        const rating = num(system.rating);
        const max = isNature ? Math.max(rating, num(system.max, rating)) : rating;
        const cap = ABILITY_CAPS[key] ?? 10;
        // Nature advancement is counted against its untaxed maximum (rulebook p. 248).
        const measured = isNature ? max : rating;
        context.ability = {
            key,
            isNature,
            rating,
            max,
            cap,
            taxed: isNature && (rating < max),
            scale: makeScale(Math.min(rating, cap), Math.max(cap, max), max),
            keyOptions: [
                ...Object.entries(ABILITY_LABELS).map(([k, label]) => ({ value: k, label: loc(label), selected: k === key })),
                { value: "", label: loc("MOUSEGUARD.ItemSheet.AbilityCustom"), selected: key === "" }
            ],
            advancement: this.#advancementView(system, measured, cap, 10)
        };
        context.badge = {
            value: isNature ? `${rating}/${max}` : String(rating),
            label: loc("MOUSEGUARD.ItemSheet.Rating"),
            tooltip: isNature ? loc("MOUSEGUARD.ItemSheet.NatureHint") : "",
            cssClass: isNature ? "is-wide" : ""
        };
        if (key && (context.displayName !== context.item.name) && !context.item.name.startsWith("MOUSEGUARD.")) {
            context.subtitle.push(context.item.name);
        }
        context.canRoll = this.#canRoll();
    }

    #prepareGear(context) {
        const system = context.system;
        context.gear = { quantity: num(system.quantity, 1), weight: num(system.weight) };
    }

    /** Current "help" list of a skill, sanitized. */
    #helpList() {
        const help = this.item.system?.help;
        if (!Array.isArray(help)) return [];
        return help.filter(h => (typeof h === "string") && h.trim()).map(h => h.trim());
    }

    /** Skill names offered as suggestions in the help editor (world items, owner's skills, item compendiums). */
    #helpOptions() {
        const names = new Set();
        const add = (entry) => { if ((entry?.type === "skill") && entry.name) names.add(entry.name); };
        for (const i of game.items ?? []) add(i);
        for (const i of this.item.actor?.items ?? []) add(i);
        for (const pack of game.packs ?? []) {
            if (pack.documentName !== "Item") continue;
            for (const entry of pack.index ?? []) add(entry);
        }
        names.delete(this.item.name);
        for (const h of this.#helpList()) names.delete(h);
        return Array.from(names).sort((a, b) => a.localeCompare(b, game.i18n.lang));
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this.#renderModeToggle();
        const input = this.element.querySelector("[data-help-input]");
        input?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            this.#addHelp(input.value);
        });
    }

    /** Insert (once) and refresh the edit/view padlock in the window header, left of the title. */
    #renderModeToggle() {
        if (!this.hasFrame) return;
        const header = this.element.querySelector(":scope > .window-header");
        if (!header) return;
        let button = header.querySelector(".mgi-mode-toggle");
        if (!this.isEditable) {
            button?.remove();
            return;
        }
        if (!button) {
            button = document.createElement("button");
            button.type = "button";
            button.className = "header-control icon fa-solid mgi-mode-toggle";
            button.dataset.action = "toggleMode";
            header.insertBefore(button, header.querySelector(".window-title"));
        }
        const edit = this.editMode;
        button.classList.toggle("fa-lock-open", edit);
        button.classList.toggle("fa-lock", !edit);
        button.classList.toggle("active", edit);
        const label = loc(edit ? "MOUSEGUARD.ItemSheet.ToViewMode" : "MOUSEGUARD.ItemSheet.ToEditMode");
        button.dataset.tooltip = label;
        button.setAttribute("aria-label", label);
    }

    /* -------------------------------------------- */
    /*  Form handling                               */
    /* -------------------------------------------- */

    /** @inheritDoc */
    _onChangeForm(formConfig, event) {
        // The help tag input is not a document field: add the tag instead of submitting the form.
        if (event.target?.matches?.("[data-help-input]")) {
            this.#addHelp(event.target.value);
            return;
        }
        return super._onChangeForm(formConfig, event);
    }

    /** @inheritDoc */
    _processFormData(event, form, formData) {
        // A cleared number input submits null, which the schema would reject: keep the stored value instead.
        for (const [name, value] of Object.entries(formData.object)) {
            if ((value === null) && (form.elements.namedItem(name)?.type === "number")) delete formData.object[name];
        }
        return super._processFormData(event, form, formData);
    }

    /* -------------------------------------------- */
    /*  Drag and drop                               */
    /* -------------------------------------------- */

    /**
     * Dropping a skill onto a skill sheet adds that skill to the "help" list; everything else keeps the core behaviour
     * (Active Effects are copied onto the item).
     * @inheritDoc
     */
    async _onDropDocument(event, document) {
        if ((this.item.type === "skill") && (document?.documentName === "Item") && (document.type === "skill")
            && (document.uuid !== this.item.uuid)) {
            await this.#addHelp(itemDisplayName(document));
            return document;
        }
        return (await super._onDropDocument?.(event, document)) ?? null;
    }

    /** Append a skill name to system.help (no duplicates, case-insensitive). */
    async #addHelp(rawValue) {
        if (!this.isEditable) return;
        const value = String(rawValue ?? "").trim();
        if (!value) return;
        const key = value.toLocaleLowerCase();
        const help = this.#helpList();
        if (this.#helpPending.has(key) || help.some(h => h.toLocaleLowerCase() === key)) return;
        this.#helpPending.add(key);
        try {
            await this.item.update({ "system.help": [...help, value] });
        } finally {
            this.#helpPending.delete(key);
        }
    }

    /* -------------------------------------------- */
    /*  Actions                                     */
    /* -------------------------------------------- */

    /** Switch between view and edit mode. */
    static #onToggleMode(event) {
        event.preventDefault();
        if (!this.isEditable) return;
        this.#editMode = !this.editMode;
        this.render();
    }

    /**
     * Step a number field: left click +1, right click -1, clamped to [data-min, data-max].
     * Advancement trackers of owned items go through actor.markAdvancement so the actor applies the advancement rules.
     */
    static async #onAdjust(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const item = this.item;
        const { path, advance } = target.dataset;
        if (!path) return;
        const delta = (event.button === 2) ? -1 : 1;
        if (advance && item.isEmbedded && (typeof item.actor?.markAdvancement === "function")) {
            return item.actor.markAdvancement(item.id, advance, delta);
        }
        // Beginner's Luck learning marks: the actor learns the skill (rank 2) once the marks reach its Nature.
        if (target.dataset.learn && item.isEmbedded && (typeof item.actor?.markLearning === "function")) {
            if ((delta < 0) && (num(item.system?.learning) <= 0)) return;
            return item.actor.markLearning(item.id, delta);
        }
        const min = target.dataset.min ? Number(target.dataset.min) : 0;
        const max = target.dataset.max ? Number(target.dataset.max) : 99;
        const current = num(foundry.utils.getProperty(item, path));
        const next = Math.clamp(current + delta, min, max);
        if (next !== current) await item.update({ [path]: next });
    }

    /** Toggle a boolean field (wise marks). */
    static async #onToggleFlag(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const path = target.dataset.path;
        if (!path) return;
        await this.item.update({ [path]: !foundry.utils.getProperty(this.item, path) });
    }

    /** Add the content of the help input as a tag. */
    static async #onHelpAdd(event) {
        event.preventDefault();
        const input = this.element.querySelector("[data-help-input]");
        await this.#addHelp(input?.value);
    }

    /** Remove one tag from the help list. */
    static async #onHelpRemove(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const index = Number(target.dataset.index);
        const help = this.#helpList();
        if (!Number.isInteger(index) || (index < 0) || (index >= help.length)) return;
        help.splice(index, 1);
        await this.item.update({ "system.help": help });
    }

    /** Open the Test dialog of the owning actor for this skill/ability (shift-click: roll at once). */
    static async #onRoll(event) {
        event.preventDefault();
        const item = this.item;
        const actor = item.actor;
        if (!actor || (typeof actor.rollTest !== "function")) return;
        const abilityKey = (item.type === "ability") ? (item.system?.key || undefined) : undefined;
        return actor.rollTest({ itemId: item.id, abilityKey, quick: !!event.shiftKey, event });
    }
}
