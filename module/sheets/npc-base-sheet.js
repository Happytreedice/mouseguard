/**
 * Shared base of the NPC sheets: NPC mice and weasels (npc-sheet.js) and wild animals (animal-sheet.js).
 *
 * The NPC sheets are copies of the character sheet (character-sheet.js) in the same "Legend in the Mist" layout:
 * portrait column with the name overlaid, header strip with roll buttons and white paper boxes, translucent tab bar,
 * parchment cards with ribbon headers, play / edit mode padlock. This class holds the machinery all of them share:
 *  - play / edit mode and quick-test mode;
 *  - click-to-roll through actor.rollTest, conditions, disposition steppers;
 *  - inputs of embedded items (data-item-field), drag & drop, sorting, the item row context menu;
 *  - the nature aspect tags (system.natureAspects);
 *  - gear rows of the weapon / armor / animal weapon categories (ItemData.category, ItemData.effect).
 * Player-only bookkeeping (advancement marks, Beginner's Luck learning, Fate, Persona, checks, patrol specialty, wise
 * marks) is left out: NPCs do not advance (book p. 247: advancement is a player character rule).
 */
import {
    CONDITIONS, NEW_ITEM_NAMES, PORTRAIT_PLACEHOLDER, UNIQUE_TYPES, abilityKeyOf, clamp, excerpt, itemDisplayName, loc
} from "./character-sheet.js";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export const CHARACTER_TEMPLATES = "systems/mouseguard/templates/actor/character";
export const NPC_TEMPLATES = "systems/mouseguard/templates/actor/npc";

/** Partials shared by the NPC sheet parts (the character sheet partials plus the NPC ones). */
export const PARTIALS = Object.freeze({
    track: `${CHARACTER_TEMPLATES}/parts/track.hbs`,
    tools: `${CHARACTER_TEMPLATES}/parts/line-tools.hbs`,
    ribbon: `${CHARACTER_TEMPLATES}/parts/ribbon-tools.hbs`,
    aspects: `${NPC_TEMPLATES}/parts/aspects.hbs`,
    weapons: `${NPC_TEMPLATES}/parts/weapons.hbs`,
    disposition: `${NPC_TEMPLATES}/parts/disposition.hbs`
});

/** Gear category -> label / default name of a new item / default image (core Foundry icons). */
export const GEAR_CATEGORY_INFO = Object.freeze({
    gear: { label: "MOUSEGUARD.ItemSheet.CategoryGear", create: "MOUSEGUARD.Sheet.NewGear", img: "icons/svg/item-bag.svg" },
    weapon: { label: "MOUSEGUARD.ItemSheet.CategoryWeapon", create: "MOUSEGUARD.NPCSheet.NewWeapon", img: "icons/svg/sword.svg" },
    armor: { label: "MOUSEGUARD.ItemSheet.CategoryArmor", create: "MOUSEGUARD.NPCSheet.NewArmor", img: "icons/svg/shield.svg" },
    natural: { label: "MOUSEGUARD.ItemSheet.CategoryNatural", create: "MOUSEGUARD.AnimalSheet.NewWeapon", img: "icons/svg/pawprint.svg" }
});

/** Gear category of an item ("gear" for anything without a valid one). */
export function gearCategory(item) {
    const category = item?.system?.category;
    return Object.hasOwn(GEAR_CATEGORY_INFO, category) ? category : "gear";
}

/** Default (shown, not saved) nature aspects per actor type when the actor has none yet: book p. 30 (mice), p. 219 (weasels). */
const DEFAULT_ASPECTS = Object.freeze({
    mouse: ["MOUSEGUARD.NPCSheet.AspectEscaping", "MOUSEGUARD.NPCSheet.AspectClimbing",
        "MOUSEGUARD.NPCSheet.AspectForaging", "MOUSEGUARD.NPCSheet.AspectHiding"],
    weasel: ["MOUSEGUARD.NPCSheet.AspectAggressive", "MOUSEGUARD.NPCSheet.AspectBurrowRaiding",
        "MOUSEGUARD.NPCSheet.AspectGloating"]
});

/* -------------------------------------------- */
/*  Sheet                                       */
/* -------------------------------------------- */

export class MouseGuardNPCBaseSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    /** Play (false) or edit (true) mode; null until first decided. Sheet-instance state, not saved. */
    #editMode = null;

    /** Quick-test mode: a click on a skill or ability rolls at once, like Shift+click. */
    #quickMode = false;

    /** Nature aspects being added right now (guards against Enter + change firing twice). */
    #aspectPending = new Set();

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "sheet", "actor", "mgs-sheet", "themed", "theme-light"],
        position: { width: 1000, height: 760 },
        window: { resizable: true },
        form: { submitOnChange: true },
        actions: {
            toggleMode: MouseGuardNPCBaseSheet.#onToggleMode,
            roll: MouseGuardNPCBaseSheet.#onRoll,
            testFree: MouseGuardNPCBaseSheet.#onTestFree,
            toggleQuick: MouseGuardNPCBaseSheet.#onToggleQuick,
            toggleCondition: MouseGuardNPCBaseSheet.#onToggleCondition,
            adjust: { handler: MouseGuardNPCBaseSheet.#onAdjust, buttons: [0, 2] },
            itemCreate: MouseGuardNPCBaseSheet.#onItemCreate,
            itemEdit: MouseGuardNPCBaseSheet.#onItemEdit,
            itemDelete: MouseGuardNPCBaseSheet.#onItemDelete,
            openCompendium: MouseGuardNPCBaseSheet.#onOpenCompendium,
            aspectAdd: MouseGuardNPCBaseSheet.#onAspectAdd,
            aspectRemove: MouseGuardNPCBaseSheet.#onAspectRemove
        }
    };

    /* -------------------------------------------- */

    /** Is the sheet in edit mode? A blank actor (see {@link _isBlank}) opens in edit mode. */
    get isEditMode() {
        if (!this.isEditable) return false;
        this.#editMode ??= this._isBlank();
        return this.#editMode;
    }

    /** Is the quick-test mode on? */
    get isQuickMode() {
        return this.#quickMode;
    }

    /**
     * Has nothing been written on this actor yet? Then the sheet opens in edit mode.
     * @returns {boolean}
     * @protected
     */
    _isBlank() {
        return !this.actor.items.some((i) => UNIQUE_TYPES.has(i.type));
    }

    /**
     * Portrait image shown while the actor still has the core default image (never saved to the actor).
     * @type {string}
     * @protected
     */
    get _portraitPlaceholder() {
        return PORTRAIT_PLACEHOLDER;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _renderFrame(options) {
        const frame = await super._renderFrame(options);
        // Edit-lock toggle, left of the window title (like the character sheet).
        const title = frame.querySelector(".window-header .window-title");
        if (title && this.isEditable) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "header-control icon fa-solid fa-lock mgs-mode-toggle";
            button.dataset.action = "toggleMode";
            title.before(button);
        }
        return frame;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;
        const system = actor.system;
        Object.assign(context, {
            actor,
            system,
            editMode: this.isEditMode,
            quickMode: this.#quickMode,
            owner: actor.isOwner,
            disposition: { current: system.disposition?.current ?? 0, starting: system.disposition?.starting ?? 0 },
            aspects: this._prepareAspects()
        });
        return context;
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId in (context.tabs ?? {})) context.tab = context.tabs[partId];
        const TextEditor = foundry.applications.ux.TextEditor.implementation;
        const enrich = (html) => TextEditor.enrichHTML(html ?? "", {
            secrets: this.actor.isOwner, rollData: this.actor.getRollData(), relativeTo: this.actor
        });
        if ((partId === "biography") || (partId === "description")) context.biographyHTML = await enrich(this.actor.system.biography);
        if (partId === "notes") context.notesHTML = await enrich(this.actor.system.notes);
        return context;
    }

    /* -------------------------------------------- */

    /**
     * Portrait column data: image (placeholder while the actor has the core default image) and a subtitle line.
     * @param {string[]} subtitle  parts of the subtitle, joined with " · "
     * @returns {{src: string, isIcon: boolean, subtitle: string}}
     * @protected
     */
    _preparePortrait(subtitle = []) {
        const img = this.actor.img;
        const isDefault = !img || img === CONST.DEFAULT_TOKEN;
        const src = isDefault ? this._portraitPlaceholder : img;
        return {
            src,
            isIcon: isDefault || /\.svg(\?.*)?$/i.test(src),
            subtitle: subtitle.map((s) => String(s ?? "").trim()).filter(Boolean).join(" · ")
        };
    }

    /**
     * Condition chips for the header box.
     * @protected
     */
    _prepareConditions() {
        const conditions = this.actor.system.conditions ?? {};
        return CONDITIONS.map((c) => ({
            key: c.key,
            active: !!conditions[c.key],
            label: c.label,
            tooltip: c.tooltip,
            icon: `systems/mouseguard/assets/icons/${c.icon}.svg`
        }));
    }

    /**
     * The nature aspects actually shown: the actor's own list, or the rulebook aspects of the species for a mouse or
     * weasel whose list was never written (actors made before the field existed). Editing a shown default list saves it
     * as the actor's own; once written (flags.mouseguard.aspectsSet), an emptied list stays empty.
     * @returns {{names: string[], isDefault: boolean}}
     * @protected
     */
    _aspectList() {
        const own = (this.actor.system.natureAspects ?? []).filter((s) => (typeof s === "string") && s.trim()).map((s) => s.trim());
        if (own.length || this.actor.flags?.mouseguard?.aspectsSet) return { names: own, isDefault: false };
        const defaults = (DEFAULT_ASPECTS[this.actor.type] ?? []).map(loc);
        return { names: defaults, isDefault: defaults.length > 0 };
    }

    /**
     * Save the nature aspect list (and mark it as written, so the rulebook defaults never come back).
     * @param {string[]} names
     * @protected
     */
    _saveAspects(names) {
        return this.actor.update({ "system.natureAspects": names, "flags.mouseguard.aspectsSet": true });
    }

    /**
     * Nature aspect chips.
     * @protected
     */
    _prepareAspects() {
        const { names, isDefault } = this._aspectList();
        return { list: names.map((name, index) => ({ name, index })), isDefault, empty: !names.length };
    }

    /**
     * Gear row (any category), with the conflict effect line of weapons, armor and animal weapons.
     * @param {Item} item
     * @protected
     */
    _prepareGear(item) {
        const sys = item.system ?? {};
        const category = gearCategory(item);
        return {
            id: item.id,
            name: itemDisplayName(item),
            img: item.img,
            category,
            categoryLabel: GEAR_CATEGORY_INFO[category].label,
            effect: String(sys.effect ?? "").trim(),
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
            if (target?.matches?.("[data-aspect-input]") && (event.key === "Enter")) {
                event.preventDefault();
                this.#addAspect(target.value);
                return;
            }
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
     * A cleared number input submits null, which the schema would reject: the stored value is kept instead.
     * @override
     */
    _processFormData(event, form, formData) {
        for (const [name, value] of Object.entries(formData.object)) {
            if ((value === null) && (form.elements.namedItem(name)?.type === "number")) delete formData.object[name];
        }
        const data = super._processFormData(event, form, formData);
        const sourceImg = this.actor._source.img;
        const hasOwnImage = !!sourceImg && sourceImg !== CONST.DEFAULT_TOKEN;
        if (!hasOwnImage && data.img === this._portraitPlaceholder) delete data.img;
        return data;
    }

    /**
     * Inputs that edit an embedded item carry `data-item-field` (and no `name`), so they never reach the actor form
     * submission. Their changes are written to the item here instead. The nature aspect input adds a tag.
     * @override
     */
    _onChangeForm(formConfig, event) {
        const target = event.target;
        if (target?.matches?.("[data-aspect-input]")) {
            event.stopPropagation();
            this.#addAspect(target.value);
            return;
        }
        const input = target?.closest?.("[data-item-field]");
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

    /** Append a nature aspect (no duplicates, case-insensitive). */
    async #addAspect(rawValue) {
        if (!this.isEditable) return;
        const value = String(rawValue ?? "").trim();
        if (!value) return;
        const key = value.toLocaleLowerCase();
        const { names } = this._aspectList();
        if (this.#aspectPending.has(key) || names.some((n) => n.toLocaleLowerCase() === key)) return;
        this.#aspectPending.add(key);
        try {
            await this._saveAspects([...names, value]);
        } finally {
            this.#aspectPending.delete(key);
        }
    }

    /* -------------------------------------------- */
    /*  Drag and drop                               */
    /* -------------------------------------------- */

    /**
     * Why an item may not be dropped on this actor (a localized message), or null when it may.
     * @param {Item} item
     * @returns {string|null}
     * @protected
     */
    _dropRefusal(item) {
        return null;
    }

    /**
     * Tab that shows an item of this type / category, or null.
     * @param {Item} item
     * @returns {string|null}
     * @protected
     */
    _tabForItem(item) {
        return null;
    }

    /**
     * Dropping an item from a compendium, the sidebar or another actor creates it on this actor (core behaviour),
     * except for an item this actor may not have and a skill, trait or wise it already has. Dropping one of its own
     * items sorts it.
     * @inheritDoc
     */
    async _onDropItem(event, item) {
        if (!this.actor.isOwner || !this.isEditable) return null;
        if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
        const refusal = this._dropRefusal(item);
        if (refusal) {
            ui.notifications.warn(refusal);
            return null;
        }
        const duplicate = this.#findDuplicate(item);
        if (duplicate) {
            ui.notifications.info(game.i18n.format("MOUSEGUARD.NPCSheet.AlreadyHas", { name: itemDisplayName(duplicate) }));
            return null;
        }
        const created = await super._onDropItem(event, item);
        const tab = created ? this._tabForItem(created) : null;
        if (tab && (this.tabGroups.primary !== tab)) {
            try { this.changeTab(tab, "primary"); } catch (err) { this.tabGroups.primary = tab; }
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
     * Sort only among the rows of one list (same item type, and for gear the same weapon / gear group); ignore drops
     * on other rows.
     * @inheritDoc
     */
    _onSortItem(event, item) {
        const row = event.target.closest?.("[data-item-id]");
        const target = row && this.actor.items.get(row.dataset.itemId);
        if (!target || (target.id === item.id) || (target.type !== item.type)) return;
        if ((item.type === "item") && (row.parentElement !== this.element.querySelector(`[data-item-id="${item.id}"]`)?.parentElement)) return;
        return super._onSortItem(event, item);
    }

    /* -------------------------------------------- */
    /*  Context menu                                */
    /* -------------------------------------------- */

    /** Item row context menu (right click on the name part of a row). Created once: this.element persists. */
    #createContextMenus() {
        const options = { fixed: true, hookName: "get{}ItemContextOptions", parentClassHooks: false };
        const selector = ".mgs-line[data-item-id] .mgs-line-main, .mgs-gear-row[data-item-id], .mgs-weapon[data-item-id], .mgs-nature-value[data-item-id]";
        const handler = () => this._getItemContextOptions();
        if (typeof this._createContextMenu === "function") this._createContextMenu(handler, selector, options);
        else new foundry.applications.ux.ContextMenu.implementation(this.element, selector, handler(), { fixed: true, jQuery: false });
    }

    /**
     * One context menu entry usable by v14 (label/visible/onClick) and v13 (name/condition/callback) without
     * deprecation warnings.
     * @param {string} label             i18n key
     * @param {string} icon              Font Awesome classes
     * @param {(item: Item) => boolean} visible
     * @param {(item: Item, event?: Event) => any} run
     * @protected
     */
    _contextEntry(label, icon, visible, run) {
        const itemOf = (el) => this.actor.items.get((el instanceof HTMLElement ? el : el?.[0])?.closest("[data-item-id]")?.dataset.itemId);
        return {
            label,
            name: label,
            icon: `<i class="${icon}"></i>`,
            visible: (el) => !!itemOf(el) && visible(itemOf(el)),
            condition: (el) => !!itemOf(el) && visible(itemOf(el)),
            onClick: (event, el) => run(itemOf(el), event),
            callback: (el) => run(itemOf(el))
        };
    }

    /**
     * Item row context menu entries: test / quick test (skills and abilities), edit, delete.
     * @protected
     */
    _getItemContextOptions() {
        const rollable = (i) => (i.type === "skill") || (i.type === "ability");
        const editable = () => this.isEditable;
        return [
            this._contextEntry("MOUSEGUARD.Sheet.MenuTest", "fa-solid fa-dice-d6", (i) => rollable(i) && editable(),
                (i) => this._rollTest(this.#rollTarget(i, false))),
            this._contextEntry("MOUSEGUARD.Sheet.MenuQuickTest", "fa-solid fa-bolt", (i) => rollable(i) && editable(),
                (i) => this._rollTest(this.#rollTarget(i, true))),
            this._contextEntry("MOUSEGUARD.Sheet.MenuEdit", "fa-solid fa-pen-to-square", () => true,
                (i) => i.sheet?.render({ force: true })),
            this._contextEntry("MOUSEGUARD.Sheet.MenuDelete", "fa-solid fa-trash", () => editable(),
                (i) => this._confirmDelete(i))
        ];
    }

    /* -------------------------------------------- */
    /*  Actor API wrappers, with fallbacks          */
    /* -------------------------------------------- */

    /** rollTest options for an item row: rollTest({itemId}) for skills, rollTest({abilityKey}) for keyed abilities. */
    #rollTarget(item, quick, event) {
        const key = item.type === "ability" ? item.system?.key : "";
        if (key) return { abilityKey: key, itemId: item.id, quick, event };
        return { itemId: item.id, quick, event };
    }

    /**
     * actor.rollTest, guarded.
     * @param {object} options  see MouseGuardActor#rollTest
     * @protected
     */
    async _rollTest(options) {
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

    /**
     * Confirm, then delete an embedded item.
     * @param {Item} item
     * @protected
     */
    async _confirmDelete(item) {
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

    /**
     * The embedded item of an action target row.
     * @param {HTMLElement} target
     * @returns {Item|undefined}
     * @protected
     */
    _itemFrom(target) {
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

    /** Click on a skill or ability name: Test dialog; Shift+click (or quick mode): roll at once. */
    static async #onRoll(event, target) {
        event.preventDefault();
        const item = this._itemFrom(target);
        if (!item || !this.isEditable) return;
        const quick = !!event.shiftKey || this.#quickMode;
        return this._rollTest(this.#rollTarget(item, quick, event));
    }

    /** "Test" header button: Test dialog (the ability of `data-ability`, or choose the skill or ability inside it). */
    static async #onTestFree(event, target) {
        event.preventDefault();
        const abilityKey = target.dataset.ability;
        if (abilityKey && this.actor.getAbility?.(abilityKey)) {
            return this._rollTest({ abilityKey, quick: !!event.shiftKey || this.#quickMode, event });
        }
        return this._rollTest({ quick: false, event });
    }

    /** "Quick test" header button: toggles quick mode. */
    static #onToggleQuick(event) {
        event.preventDefault();
        this.#quickMode = !this.#quickMode;
        this.render({ parts: ["header"] });
    }

    /** Toggle a condition. */
    static async #onToggleCondition(event, target) {
        event.preventDefault();
        const key = target.dataset.condition;
        if (!this.isEditable || !this.actor.system.conditions || !CONDITIONS.some((c) => c.key === key)) return;
        if (typeof this.actor.toggleCondition === "function") return this.actor.toggleCondition(key);
        return this.actor.update({ [`system.conditions.${key}`]: !this.actor.system.conditions?.[key] });
    }

    /** Left click +1, right click -1 on an actor number (disposition). */
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

    /** Create a new item of the requested type (and gear category) and open its sheet. */
    static async #onItemCreate(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const type = target.dataset.type;
        if (!(type in (CONFIG.Item.dataModels ?? {})) && !game.documentTypes?.Item?.includes(type)) return;
        const data = { name: loc(NEW_ITEM_NAMES[type] ?? "MOUSEGUARD.Sheet.NewGear"), type };
        const category = target.dataset.category;
        if ((type === "item") && Object.hasOwn(GEAR_CATEGORY_INFO, category)) {
            const info = GEAR_CATEGORY_INFO[category];
            Object.assign(data, { name: loc(info.create), img: info.img, system: { category } });
        }
        const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
        item?.sheet?.render({ force: true });
    }

    /** Open the sheet of an embedded item. */
    static #onItemEdit(event, target) {
        event.preventDefault();
        this._itemFrom(target)?.sheet?.render({ force: true });
    }

    /** Delete an embedded item (after confirmation). */
    static async #onItemDelete(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        return this._confirmDelete(this._itemFrom(target));
    }

    /** Open a compendium pack (skills / traits) to drag entries onto the sheet. */
    static #onOpenCompendium(event, target) {
        event.preventDefault();
        const pack = game.packs.get(target.dataset.pack);
        if (pack) pack.render(true);
        else ui.notifications.warn(game.i18n.format("MOUSEGUARD.Sheet.NoPack", { pack: target.dataset.pack }));
    }

    /** "+" next to the nature aspect input. */
    static async #onAspectAdd(event, target) {
        event.preventDefault();
        const input = target.closest(".mgs-aspects")?.querySelector("[data-aspect-input]");
        await this.#addAspect(input?.value);
    }

    /** Remove one nature aspect. */
    static async #onAspectRemove(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const index = Number(target.dataset.index);
        const { names } = this._aspectList();
        if (!Number.isInteger(index) || (index < 0) || (index >= names.length)) return;
        names.splice(index, 1);
        await this._saveAspects(names);
    }
}
