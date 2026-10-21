import { ITEM_SCHEMA_VERSION, LEGACY_SYSTEM_KEYS, inferAbilityKey, migrateItemSource } from "./data-models.js";
import { abilityLabel } from "./rolls/labels.js";

/**
 * Extend the base Item document for Mouse Guard items.
 * @extends {Item}
 */
export class MouseGuardItem extends Item {
    /**
     * Document-level migration: the ability key is inferred from the legacy name, Beginner's Luck from the skill name,
     * and stale legacy fields of already-migrated items are dropped (see data-models.js).
     * Foundry ignores the return value here, so the source is migrated in place.
     * @inheritdoc
     */
    static migrateData(source, options) {
        migrateItemSource(source);
        return super.migrateData(source, options);
    }

    /** @inheritdoc */
    prepareBaseData() {
        super.prepareBaseData();

        // Old compendium builds stored descriptions as {template, parts} objects. HTMLField casts them to strings, so
        // this only triggers for data that bypassed cleaning; kept harmless on purpose.
        const encoded = this.system?.description;
        if (encoded && typeof encoded === "object" && typeof encoded.template === "string") {
            const parts = Object.fromEntries(Object.entries(encoded.parts ?? {}).map(([key, value]) => [
                key,
                typeof value === "string" && value.startsWith("MOUSEGUARD.") ? game.i18n.localize(value) : value
            ]));
            let description = game.i18n.localize(encoded.template);
            for (const [key, value] of Object.entries(parts)) description = description.replaceAll(`{${key}}`, value);
            this.system.description = description;
        }

        // Runtime fallback for abilities whose key could not be inferred during migration.
        if (this.type === "ability" && this.system && !this.system.key) {
            const key = inferAbilityKey(this.name);
            if (key) this.system.key = key;
        }
    }

    /**
     * Display name: abilities with a key use the localized label for that key, i18n-key names are localized,
     * anything else is shown as typed.
     * @type {string}
     */
    get displayName() {
        if (this.type === "ability") return abilityLabel(this, this.actor?.type);
        if (typeof this.name === "string" && this.name.startsWith("MOUSEGUARD.")) return game.i18n.localize(this.name);
        return this.name;
    }

    /** @inheritdoc */
    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if (allowed === false) return false;
        if (LEGACY_SYSTEM_KEYS[this.type]) {
            this.updateSource({ "flags.mouseguard.schemaVersion": ITEM_SCHEMA_VERSION });
        }
        return allowed;
    }

    /**
     * The first write to an item that still carries legacy data persists the whole migrated `system` object together
     * with the schema marker. Without this, values derived during migration (Nature max from the old `tax`, marks from
     * the old `pass`/`fail`) would never reach the database, because updates only send the diff against the already
     * migrated source, and the next load would derive them again from stale legacy fields.
     * @inheritdoc
     */
    async _preUpdate(changes, options, user) {
        const allowed = await super._preUpdate(changes, options, user);
        if (allowed === false) return false;
        this.#persistNatureMax(changes);
        if (!LEGACY_SYSTEM_KEYS[this.type]) return allowed;
        const version = Number(this._source.flags?.mouseguard?.schemaVersion) || 0;
        if (version >= ITEM_SCHEMA_VERSION) return allowed;

        const current = foundry.utils.deepClone(this._source.system ?? {});
        const system = (changes.system && typeof changes.system === "object") ? changes.system : {};
        for (const [key, value] of Object.entries(current)) {
            if (!(key in system)) system[key] = value;
            else if (foundry.utils.getType(system[key]) === "Object" && foundry.utils.getType(value) === "Object") {
                for (const [k, v] of Object.entries(value)) if (!(k in system[key])) system[key][k] = v;
            }
        }
        changes.system = system;
        foundry.utils.setProperty(changes, "flags.mouseguard.schemaVersion", ITEM_SCHEMA_VERSION);
        options.diff = false;   // send the full migrated system data, not only the diff
        return allowed;
    }

    /**
     * Nature's untaxed maximum must be stored, not only derived: when a rating edit raises Nature above the stored
     * maximum, save the new maximum too, so a later Nature tax (which lowers only the rating) stays visible.
     * @param {object} changes   The (already expanded) update data.
     */
    #persistNatureMax(changes) {
        if (this.type !== "ability") return;
        const system = changes.system;
        if (!system || typeof system !== "object" || system.rating === undefined) return;
        const key = system.key ?? this.system?.key ?? this._source.system?.key;
        if (key !== "nature") return;
        const rating = Number(system.rating);
        const max = Number(system.max ?? this._source.system?.max ?? 0);
        if (Number.isFinite(rating) && rating > max) system.max = rating;
    }

    /** @inheritdoc */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
}
