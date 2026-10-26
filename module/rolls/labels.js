/**
 * Shared constants and label helpers for abilities, conditions and tests.
 * Safe to import from Svelte components and data code (no side effects).
 */

/** Ability keys in display order. */
export const ABILITY_ORDER = Object.freeze(["nature", "will", "health", "resources", "circles"]);

/** i18n keys of the ability labels. Nature depends on the actor type, see {@link abilityLabelKey}. */
export const ABILITY_LABEL_KEYS = Object.freeze({
    nature: "MOUSEGUARD.Nature",
    will: "MOUSEGUARD.Will",
    health: "MOUSEGUARD.Health",
    resources: "MOUSEGUARD.Resources",
    circles: "MOUSEGUARD.Circles"
});

/** Highest rating an ability can be advanced to (book p. 30-31, 33, 254, 259-263). */
export const ABILITY_CAPS = Object.freeze({ nature: 7, will: 6, health: 6, resources: 10, circles: 10 });

/** Highest skill rank. */
export const SKILL_CAP = 6;

/** Condition key (system.conditions) -> token status effect id (module/status-effects.js). */
export const CONDITION_STATUS = Object.freeze({
    hungryThirsty: "hungthurst",
    angry: "angry",
    tired: "tired",
    injured: "injured",
    sick: "sick"
});

/** Condition key -> label i18n key. */
export const CONDITION_LABEL_KEYS = Object.freeze({
    hungryThirsty: "MOUSEGUARD.hungthurst",
    angry: "MOUSEGUARD.angry",
    tired: "MOUSEGUARD.tired",
    injured: "MOUSEGUARD.injured",
    sick: "MOUSEGUARD.sick"
});

/**
 * i18n key of an ability label.
 * @param {string} key          Ability key
 * @param {string} [actorType]  Owning actor type (Nature is "Nature (Mouse)" / "Nature (Weasel)" / "Nature")
 * @returns {string|null}
 */
export function abilityLabelKey(key, actorType) {
    if (key === "nature") {
        if (actorType === "weasel") return "MOUSEGUARD.WNature";
        if (actorType === "animal") return "MOUSEGUARD.Nature";
        return "MOUSEGUARD.MNature";
    }
    return ABILITY_LABEL_KEYS[key] ?? null;
}

/**
 * Display label for an ability item (document or plain data object).
 * Uses the localized label of its key when set, otherwise the localized name. An animal's Nature names its species,
 * "Nature (wolf)", when the owning actor has one.
 * @param {{name?: string, system?: {key?: string}, parent?: Actor}} ability
 * @param {string} [actorType]
 * @returns {string}
 */
export function abilityLabel(ability, actorType) {
    const key = ability?.system?.key;
    if (key === "nature" && actorType === "animal") {
        const species = String(ability?.parent?.system?.species ?? "").trim();
        if (species) return game.i18n.format("MOUSEGUARD.AnimalSheet.NatureOf", { species });
    }
    const labelKey = key ? abilityLabelKey(key, actorType) : null;
    if (labelKey) return game.i18n.localize(labelKey);
    return itemLabel(ability);
}

/**
 * Display label for any item: localizes names that are i18n keys.
 * @param {{name?: string}} item
 * @returns {string}
 */
export function itemLabel(item) {
    const name = item?.name ?? "";
    return typeof name === "string" && name.startsWith("MOUSEGUARD.") ? game.i18n.localize(name) : name;
}
