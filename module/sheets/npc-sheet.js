/**
 * Mouse Guard NPC sheet for NPC mice and weasels (actor types "mouse" and "weasel").
 *
 * A copy of the character sheet in the same layout, cut down to an NPC profile as the book prints it (p. 209-220):
 *  - portrait column: name, occupation · age · home, a "key character" mark;
 *  - header: Test / Quick test / New session buttons, Conditions box, Disposition box with the key character switch;
 *  - profile tab (Mouse / Weasel): Abilities (Nature with its nature aspects), Skills, Traits, Wises cards, without the
 *    advancement and learning marks (NPCs do not advance); Belief / Goal / Instinct only for key characters
 *    (the book has none for ordinary NPCs, the GM writes them for important ones);
 *  - description tab: details and biography; gear tab: weapons and armor, then other gear; notes tab.
 * No Fate, Persona or checks. Ratings are not capped at the player limits: the book's NPC ratings are deliberately a
 * little high (p. 211) and weasel lords reach Will 8, Resources 10.
 */
import {
    ABILITY_LABELS, ABILITY_ORDER, CONDITIONS, PACKS, ROMAN, abilityDisplayName, abilityKeyOf, clamp, cloakSwatch, formatAge,
    itemDisplayName, loc, track
} from "./character-sheet.js";
import { MouseGuardNPCBaseSheet, NPC_TEMPLATES, PARTIALS } from "./npc-base-sheet.js";

const { DialogV2 } = foundry.applications.api;

/** Details shown on the description tab (system.details.*). */
const DETAILS = Object.freeze([
    { key: "role", label: "MOUSEGUARD.NPCSheet.Role" },
    { key: "home", label: "MOUSEGUARD.Sheet.Home" },
    { key: "age", label: "MOUSEGUARD.Sheet.Age", type: "number" },
    { key: "fur_color", label: "MOUSEGUARD.Sheet.FurColor" },
    { key: "cloak_color", label: "MOUSEGUARD.Sheet.CloakColor" }
]);

/** Main tab label per actor type. */
const MAIN_TAB_LABELS = Object.freeze({ mouse: "MOUSEGUARD.Sheet.TabMouse", weasel: "MOUSEGUARD.NPCSheet.TabWeasel" });

/** Weapons and armor are listed on their own card; every other gear item on the gear card. */
const WEAPON_CATEGORIES = new Set(["weapon", "armor"]);

export class MouseGuardNPCSheet extends MouseGuardNPCBaseSheet {
    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["npc", "mgs-npc"],
        position: { width: 1100, height: 800 },
        actions: {
            newSession: MouseGuardNPCSheet.#onNewSession,
            traitUse: { handler: MouseGuardNPCSheet.#onTraitUse, buttons: [0, 2] },
            toggleKey: MouseGuardNPCSheet.#onToggleKey,
            openDetails: MouseGuardNPCSheet.#onOpenDetails
        }
    };

    /** @override */
    static PARTS = {
        portrait: { template: `${NPC_TEMPLATES}/portrait.hbs` },
        header: { template: `${NPC_TEMPLATES}/header.hbs`, templates: [PARTIALS.disposition] },
        tabs: { template: "templates/generic/tab-navigation.hbs", classes: ["mgs-tabs"] },
        main: {
            template: `${NPC_TEMPLATES}/tab-main.hbs`,
            templates: [PARTIALS.track, PARTIALS.tools, PARTIALS.ribbon, PARTIALS.aspects],
            scrollable: [""]
        },
        biography: { template: `${NPC_TEMPLATES}/tab-biography.hbs`, scrollable: [""] },
        gear: {
            template: `${NPC_TEMPLATES}/tab-gear.hbs`,
            templates: [PARTIALS.tools, PARTIALS.ribbon, PARTIALS.weapons],
            scrollable: [""]
        },
        notes: { template: `${NPC_TEMPLATES}/tab-notes.hbs`, scrollable: [""] }
    };

    /** @override */
    static TABS = {
        primary: {
            tabs: [
                { id: "main", label: "MOUSEGUARD.Sheet.TabMouse" },
                { id: "biography", label: "MOUSEGUARD.NPCSheet.TabDescription" },
                { id: "gear", label: "MOUSEGUARD.Sheet.TabGear" },
                { id: "notes", label: "MOUSEGUARD.Sheet.TabNotes" }
            ],
            initial: "main"
        }
    };

    /** @override */
    async _renderFrame(options) {
        const frame = await super._renderFrame(options);
        const title = frame.querySelector(".window-header .window-title");
        if (title && this.isEditable && this.actor.type === "mouse") {
            const detailsBtn = document.createElement("button");
            detailsBtn.type = "button";
            detailsBtn.className = "header-control icon fa-solid fa-feather-pointed mgs-details-toggle";
            detailsBtn.dataset.action = "openDetails";
            detailsBtn.dataset.tooltip = "MOUSEGUARD.DetailsDialog.ButtonHint";
            title.before(detailsBtn);
        }
        return frame;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
        const opts = super._initializeApplicationOptions(options);
        const type = opts.document?.type;
        if (type) opts.classes.push(`mgs-npc--${type}`);
        return opts;
    }

    /** Weasels get the paw print instead of the seated mouse while they have no picture. @override */
    get _portraitPlaceholder() {
        return this.actor.type === "weasel" ? "icons/svg/pawprint.svg" : super._portraitPlaceholder;
    }

    /** The profile tab is named after the species (Mouse / Weasel). @inheritDoc */
    _getTabsConfig(group) {
        const config = super._getTabsConfig(group);
        if ((group !== "primary") || !config) return config;
        const label = MAIN_TAB_LABELS[this.actor.type] ?? "MOUSEGUARD.Sheet.TabMouse";
        return { ...config, tabs: config.tabs.map((t) => (t.id === "main" ? { ...t, label } : t)) };
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;
        const system = actor.system;
        const byType = (type) => actor.items.filter((i) => i.type === type).sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
        const keyCharacter = !!system.keyCharacter;
        const details = system.details ?? {};

        const gearItems = byType("item").map((i) => this._prepareGear(i));
        const gear = gearItems.filter((g) => !WEAPON_CATEGORIES.has(g.category));
        const totalWeight = gearItems.reduce((sum, g) => sum + (Number(g.quantity) || 0) * (Number(g.weight) || 0), 0);
        const shownTypes = new Set(["ability", "skill", "trait", "wise", "item"]);

        const portrait = this._preparePortrait([details.role, formatAge(details.age), details.home]);
        portrait.cloak = String(details.cloak_color ?? "").trim();
        portrait.cloakSwatch = cloakSwatch(details.cloak_color);

        Object.assign(context, {
            isWeasel: actor.type === "weasel",
            keyCharacter,
            portrait,
            conditions: this._prepareConditions(),
            healthy: !CONDITIONS.some((c) => system.conditions?.[c.key]),
            showQuests: keyCharacter,
            quests: [
                { key: "belief", path: "system.motivation.belief", value: system.motivation?.belief ?? "", label: "MOUSEGUARD.Sheet.Belief", hint: "MOUSEGUARD.NPCSheet.BeliefHint" },
                { key: "goal", path: "system.motivation.goal", value: system.motivation?.goal ?? "", label: "MOUSEGUARD.Sheet.Goal", hint: "MOUSEGUARD.NPCSheet.GoalHint" },
                { key: "instinct", path: "system.motivation.instinct", value: system.motivation?.instinct ?? "", label: "MOUSEGUARD.Sheet.Instinct", hint: "MOUSEGUARD.NPCSheet.InstinctHint" }
            ],
            abilities: this.#prepareAbilities(),
            skills: byType("skill").map((i) => this.#prepareSkill(i)),
            traits: byType("trait").map((i) => this.#prepareTrait(i)),
            wises: byType("wise").map((i) => ({ id: i.id, name: itemDisplayName(i) })),
            weapons: gearItems.filter((g) => WEAPON_CATEGORIES.has(g.category)),
            weaponsEmpty: "MOUSEGUARD.NPCSheet.EmptyWeapons",
            showWeaponCategory: true,
            gear,
            totalWeight: Math.round(totalWeight * 100) / 100,
            others: actor.items.filter((i) => !shownTypes.has(i.type)).sort((a, b) => a.sort - b.sort)
                .map((i) => ({ id: i.id, name: itemDisplayName(i), img: i.img, typeLabel: loc(CONFIG.Item.typeLabels?.[i.type] ?? i.type) })),
            details: DETAILS.map((d) => ({ ...d, name: `system.details.${d.key}`, value: details[d.key] ?? (d.type === "number" ? 0 : "") })),
            packs: { skill: !!game.packs.get(PACKS.skill), trait: !!game.packs.get(PACKS.trait) }
        });
        return context;
    }

    /** Ability rows, in rulebook order (nature, will, health, resources, circles), then any other ability. */
    #prepareAbilities() {
        const rows = this.actor.items.filter((i) => i.type === "ability").map((item) => {
            const key = abilityKeyOf(item);
            return {
                id: item.id,
                key,
                label: abilityDisplayName(item),
                rating: Number(item.system?.rating) || 0,
                isNature: key === "nature",
                order: ABILITY_ORDER.includes(key) ? ABILITY_ORDER.indexOf(key) : 10 + (item.sort || 0) / 1e6
            };
        });
        return rows.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }

    /** Skill row: rank, or "–" for an unlearned skill (Beginner's Luck). */
    #prepareSkill(item) {
        const sys = item.system ?? {};
        const rank = Number(sys.rank) || 0;
        const blKey = sys.beginnersLuck === "health" ? "health" : "will";
        return {
            id: item.id,
            name: itemDisplayName(item),
            rank,
            learned: rank > 0,
            blTooltip: rank > 0 ? "" : game.i18n.format("MOUSEGUARD.Sheet.BeginnersLuckHint", { ability: loc(ABILITY_LABELS[blKey]) })
        };
    }

    /** Trait row: level I-III and the beneficial uses this session. */
    #prepareTrait(item) {
        const sys = item.system ?? {};
        const level = clamp(sys.level ?? 1, 1, 3);
        const usedFor = Number(sys.usedFor) || 0;
        return {
            id: item.id,
            name: itemDisplayName(item),
            level,
            roman: ROMAN[level],
            unlimited: level >= 3,
            spent: level < 3 && usedFor >= level,
            forTrack: level < 3
                ? track({ kind: "usedFor", label: "MOUSEGUARD.Sheet.TraitForShort", tooltip: "MOUSEGUARD.NPCSheet.TraitForHint", count: level, value: usedFor, action: "traitUse", mode: "for" })
                : null
        };
    }

    /* -------------------------------------------- */
    /*  Hooks of the base sheet                     */
    /* -------------------------------------------- */

    /** @override */
    _tabForItem(item) {
        if (["ability", "skill", "trait", "wise"].includes(item.type)) return "main";
        return "gear";
    }

    /** Adds "use the trait" to the item context menu. @override */
    _getItemContextOptions() {
        const entries = super._getItemContextOptions();
        const use = this._contextEntry("MOUSEGUARD.Sheet.MenuTraitFor", "fa-solid fa-angles-up",
            (i) => (i.type === "trait") && this.isEditable, (i) => this.#useTrait(i));
        entries.splice(2, 0, use);
        return entries;
    }

    /** Use a trait to help (once per session at level 1, twice at level 2, at will at level 3). */
    async #useTrait(item) {
        if (typeof this.actor.useTrait === "function") return this.actor.useTrait(item.id, "for");
        const level = clamp(item.system?.level ?? 1, 1, 3);
        const used = Number(item.system?.usedFor) || 0;
        if ((level < 3) && (used >= level)) return;
        return item.update({ "system.usedFor": clamp(used + 1, 0, 2) });
    }

    /* -------------------------------------------- */
    /*  Actions                                     */
    /* -------------------------------------------- */

    /** "New session" header button: trait uses of this session are reset. */
    static async #onNewSession(event) {
        event.preventDefault();
        if (!this.isEditable) return;
        const name = foundry.utils.escapeHTML?.(this.actor.name) ?? this.actor.name;
        const confirmed = await DialogV2.confirm({
            window: { title: loc("MOUSEGUARD.Sheet.NewSession"), icon: "fa-solid fa-hourglass-start" },
            content: `<p>${game.i18n.format("MOUSEGUARD.NPCSheet.NewSessionConfirm", { name })}</p>`,
            rejectClose: false,
            modal: true
        });
        if (!confirmed) return;
        if (typeof this.actor.startNewSession === "function") return this.actor.startNewSession();
        const updates = this.actor.items.filter((i) => i.type === "trait").map((i) => ({ _id: i.id, "system.usedFor": 0 }));
        if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
    }

    /** Trait use pips: left click = use the trait (or take back a filled pip), right click = take one use back. */
    static async #onTraitUse(event, target) {
        event.preventDefault();
        const item = this._itemFrom(target);
        if (!item || !this.isEditable) return;
        const used = Number(item.system?.usedFor) || 0;
        const pip = event.target.closest?.(".mgs-pip");
        if ((event.button === 2) || pip?.classList.contains("on")) {
            if (used > 0) await item.update({ "system.usedFor": used - 1 });
            return;
        }
        return this.#useTrait(item);
    }

    /** Key character switch: shows Belief, Goal and Instinct. */
    static async #onToggleKey(event) {
        event.preventDefault();
        if (!this.isEditable) return;
        return this.actor.update({ "system.keyCharacter": !this.actor.system.keyCharacter });
    }

    /** Open details fill and generator dialog. */
    static #onOpenDetails(event) {
        event.preventDefault();
        const dlg = game.mouseguard?.MouseGuardDetailsDialog;
        if (dlg) dlg.open(this.actor);
    }
}
