/**
 * Mouse Guard sheet for wild animals (actor type "animal").
 *
 * A copy of the character sheet layout for a creature with a single ability (book p. 93, 219-243):
 *  - portrait column: name, species · Natural Order level; edit mode: name and species;
 *  - header: Test (always Nature) / Quick test buttons, the Nature box (rating up to 12) and the Disposition box;
 *  - animal tab: Nature aspects, Animal weapons (gear items of the "natural" category with their conflict effect) and
 *    Natural Order cards, then a band with what the Natural Order means for the guards (book p. 243-244): which goals
 *    Fighter and Hunter allow, the army a war needs, the Scientist's trap, the Fight Animal conflict;
 *  - description and notes tabs.
 * No Will, Health, Resources, Circles, skills, traits, wises or conditions: dropping those is refused.
 */
import { itemDisplayName, loc } from "./character-sheet.js";
import { GEAR_CATEGORY_INFO, MouseGuardNPCBaseSheet, NPC_TEMPLATES, PARTIALS, gearCategory } from "./npc-base-sheet.js";
import { NATURAL_ORDER_MAX, NATURAL_ORDER_MOUSE } from "../data-models.js";

const ANIMAL_TEMPLATES = "systems/mouseguard/templates/actor/animal";

/** Highest Nature of the book's animals (moose, black bear). */
const NATURE_CAP = 12;

/** Armed mice a war against an animal needs, by levels above the mice in the Natural Order (book p. 243-244). */
const ARMY_SIZES = Object.freeze({ 2: 20, 3: 100, 4: 200, 5: 2000, 6: 20000 });

/** i18n key of the species list of a Natural Order level. */
const orderKey = (level) => `MOUSEGUARD.AnimalSheet.Order${level}`;

/** Item types an animal cannot have (it has one ability, Nature). */
const REFUSED_TYPES = new Set(["skill", "trait", "wise", "contact"]);

export class MouseGuardAnimalSheet extends MouseGuardNPCBaseSheet {
    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["animal", "mgs-animal"],
        position: { width: 1100, height: 800 },
        actions: {
            setOrder: MouseGuardAnimalSheet.#onSetOrder,
            createNature: MouseGuardAnimalSheet.#onCreateNature
        }
    };

    /** @override */
    static PARTS = {
        portrait: { template: `${ANIMAL_TEMPLATES}/portrait.hbs` },
        header: { template: `${ANIMAL_TEMPLATES}/header.hbs`, templates: [PARTIALS.disposition] },
        tabs: { template: "templates/generic/tab-navigation.hbs", classes: ["mgs-tabs"] },
        animal: {
            template: `${ANIMAL_TEMPLATES}/tab-animal.hbs`,
            templates: [PARTIALS.tools, PARTIALS.aspects, PARTIALS.weapons],
            scrollable: [""]
        },
        description: {
            template: `${ANIMAL_TEMPLATES}/tab-description.hbs`,
            templates: [PARTIALS.tools],
            scrollable: [""]
        },
        notes: { template: `${NPC_TEMPLATES}/tab-notes.hbs`, scrollable: [""] }
    };

    /** @override */
    static TABS = {
        primary: {
            tabs: [
                { id: "animal", label: "MOUSEGUARD.AnimalSheet.TabAnimal" },
                { id: "description", label: "MOUSEGUARD.NPCSheet.TabDescription" },
                { id: "notes", label: "MOUSEGUARD.Sheet.TabNotes" }
            ],
            initial: "animal"
        }
    };

    /* -------------------------------------------- */

    /** @override */
    get _portraitPlaceholder() {
        return "icons/svg/pawprint.svg";
    }

    /** A new animal (no species, aspects or animal weapons yet) opens in edit mode. @override */
    _isBlank() {
        const system = this.actor.system;
        return !String(system.species ?? "").trim() && !(system.natureAspects ?? []).length && !this.actor.itemTypes.item?.length;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;
        const system = actor.system;
        const level = Math.clamp(Number(system.naturalOrder) || 0, 0, NATURAL_ORDER_MAX);
        const natureItem = actor.getAbility?.("nature") ?? actor.items.find((i) => (i.type === "ability") && (i.system?.key === "nature"));
        const rating = Number(natureItem?.system?.rating) || 0;
        const items = actor.items.filter((i) => i.type === "item").sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
        const species = String(system.species ?? "").trim();

        Object.assign(context, {
            portrait: this._preparePortrait([species, level ? game.i18n.format("MOUSEGUARD.AnimalSheet.OrderShort", { level }) : ""]),
            species,
            speciesOptions: this.#speciesOptions(),
            nature: natureItem
                ? { id: natureItem.id, label: natureItem.displayName ?? loc("MOUSEGUARD.Nature"), rating, cap: NATURE_CAP }
                : null,
            weapons: items.filter((i) => gearCategory(i) === "natural").map((i) => this._prepareGear(i)),
            weaponsEmpty: "MOUSEGUARD.AnimalSheet.EmptyWeapons",
            showWeaponCategory: false,
            // everything but the Nature shown in the header and the animal weapons, so that legacy items stay reachable
            others: actor.items.filter((i) => (i.id !== natureItem?.id) && !((i.type === "item") && (gearCategory(i) === "natural")))
                .sort((a, b) => a.sort - b.sort)
                .map((i) => ({
                    id: i.id,
                    name: itemDisplayName(i),
                    img: i.img,
                    typeLabel: loc(i.type === "item" ? GEAR_CATEGORY_INFO[gearCategory(i)].label : (CONFIG.Item.typeLabels?.[i.type] ?? i.type))
                })),
            order: this.#prepareOrder(level, rating)
        });
        return context;
    }

    /** Natural Order table (9 = bear, moose ... 1 = insects; mice are 3) and what it means for the guards. */
    #prepareOrder(level, nature) {
        const relative = level ? level - NATURAL_ORDER_MOUSE : null;
        const rows = [];
        for (let n = NATURAL_ORDER_MAX; n >= 1; n--) {
            rows.push({ level: n, label: loc(orderKey(n)), current: n === level, isMouse: n === NATURAL_ORDER_MOUSE, above: n - NATURAL_ORDER_MOUSE });
        }
        const order = { level, known: level > 0, relative, rows, mighty: (relative ?? 0) >= 2 };
        if (!level) return order;

        if (relative === 0) order.relation = loc("MOUSEGUARD.AnimalSheet.RelationLevel");
        else {
            const n = Math.abs(relative);
            let one = n === 1;
            try {
                one = new Intl.PluralRules(game.i18n.lang).select(n) === "one";
            } catch (err) { /* unknown locale: keep the English rule */ }
            const key = `MOUSEGUARD.AnimalSheet.Relation${relative > 0 ? "Above" : "Below"}${one ? "One" : "Other"}`;
            order.relation = game.i18n.format(key, { n });
        }

        // Fighter / Hunter (book p. 243): kill only up to one level above; wound, capture or drive off up to two levels
        // above; anything higher can only be driven off.
        if (relative <= 1) order.fight = loc("MOUSEGUARD.AnimalSheet.FightAny");
        else if (relative === 2) order.fight = loc("MOUSEGUARD.AnimalSheet.FightNoKill");
        else order.fight = loc("MOUSEGUARD.AnimalSheet.FightDriveOff");

        // War (Militarist) and science (Scientist) for animals two levels or more above the mice (book p. 243-244)
        const army = ARMY_SIZES[Math.min(relative, 6)];
        order.war = army
            ? game.i18n.format("MOUSEGUARD.AnimalSheet.WarArmy", { n: army.toLocaleString(game.i18n.lang) })
            : loc("MOUSEGUARD.AnimalSheet.WarNotNeeded");
        order.science = relative >= 2
            ? game.i18n.format("MOUSEGUARD.AnimalSheet.ScienceTrap", { ob: nature })
            : loc("MOUSEGUARD.AnimalSheet.ScienceNotNeeded");
        return order;
    }

    /** Species named in the Natural Order table, for the species input's suggestions. */
    #speciesOptions() {
        const names = new Set();
        for (let n = 1; n <= NATURAL_ORDER_MAX; n++) {
            for (const name of loc(orderKey(n)).split(/[,;]/)) if (name.trim()) names.add(name.trim());
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b, game.i18n.lang));
    }

    /** Natural Order level of a species named in the table (exact name, ignoring case), or 0. */
    #orderOfSpecies(species) {
        const wanted = String(species ?? "").trim().toLocaleLowerCase();
        if (!wanted) return 0;
        for (let n = NATURAL_ORDER_MAX; n >= 1; n--) {
            const names = loc(orderKey(n)).split(/[,;]/).map((s) => s.trim().toLocaleLowerCase());
            if (names.includes(wanted)) return n;
        }
        return 0;
    }

    /* -------------------------------------------- */
    /*  Form handling                               */
    /* -------------------------------------------- */

    /**
     * Typing a new species from the Natural Order table fills in its level while the level is still unknown (a level
     * cleared on purpose stays cleared while the species stays the same).
     * @inheritDoc
     */
    _processFormData(event, form, formData) {
        const data = super._processFormData(event, form, formData);
        const species = data.system?.species;
        const changed = (typeof species === "string") && (species.trim() !== String(this.actor.system.species ?? "").trim());
        if (changed && !(Number(this.actor.system.naturalOrder) > 0) && (data.system.naturalOrder === undefined)) {
            const level = this.#orderOfSpecies(species);
            if (level) data.system.naturalOrder = level;
        }
        return data;
    }

    /* -------------------------------------------- */
    /*  Hooks of the base sheet                     */
    /* -------------------------------------------- */

    /** Animals have one ability, Nature: no skills, traits, wises, contacts or other abilities. @override */
    _dropRefusal(item) {
        if (REFUSED_TYPES.has(item.type)) return loc("MOUSEGUARD.AnimalSheet.DropRefused");
        if ((item.type === "ability") && (item.system?.key !== "nature")) return loc("MOUSEGUARD.AnimalSheet.DropRefused");
        return null;
    }

    /** @override */
    _tabForItem(item) {
        if ((item.type === "item") && (gearCategory(item) === "natural")) return "animal";
        return item.type === "ability" ? "animal" : "description";
    }

    /* -------------------------------------------- */
    /*  Actions                                     */
    /* -------------------------------------------- */

    /** Natural Order row click (edit mode): set the level; a click on the current level clears it. */
    static async #onSetOrder(event, target) {
        event.preventDefault();
        if (!this.isEditable || !this.isEditMode) return;
        const level = Math.clamp(Number(target.dataset.level) || 0, 0, NATURAL_ORDER_MAX);
        const next = level === Number(this.actor.system.naturalOrder) ? 0 : level;
        return this.actor.update({ "system.naturalOrder": next });
    }

    /**
     * Create the missing Nature ability of an animal. A lone ability without a key (a legacy or renamed Nature item) is
     * made the Nature instead of adding a second one.
     */
    static async #onCreateNature(event) {
        event.preventDefault();
        if (!this.isEditable || this.actor.getAbility?.("nature")) return;
        const keyless = (this.actor.itemTypes.ability ?? []).filter((i) => !i.system?.key);
        if (keyless.length === 1) return keyless[0].update({ "system.key": "nature" });
        await this.actor.createEmbeddedDocuments("Item", [{
            name: loc("MOUSEGUARD.Nature"), type: "ability", system: { key: "nature", rating: 1, max: 1 }
        }]);
    }
}
