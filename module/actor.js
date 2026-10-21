import { CONDITION_KEYS, ITEM_SCHEMA_VERSION } from "./data-models.js";
import { ABILITY_CAPS, ABILITY_ORDER, CONDITION_STATUS, SKILL_CAP, abilityLabelKey, itemLabel } from "./rolls/labels.js";
import { MouseGuardTestDialog } from "./rolls/test-dialog.js";
import { defaultTestState } from "./rolls/pool.js";
import { getLastOb, performTest } from "./rolls/test.js";

const loc = (key) => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const int = (value, fallback = 0) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
};

/** Is a status effect with this id configured? (v14 keyed proxy or v13 array) */
function hasStatusEffect(id) {
    const list = CONFIG.statusEffects;
    if (!list) return false;
    if (typeof list.find === "function" && list.find((e) => e?.id === id)) return true;
    return !!list[id];
}

/**
 * Extend the base Actor document to support custom Mouse Guard character logic.
 * @extends {Actor}
 */
export class MouseGuardActor extends Actor {
    /** @inheritdoc */
    prepareDerivedData() {
        super.prepareDerivedData();
    }

    /** @inheritdoc */
    prepareData() {
        super.prepareData();
    }

    /**
     * New actors get their ability items: Nature, Will, Health, Resources and Circles for mice and weasels (weasels use
     * the weasel Nature label), Nature only for animals.
     * @inheritdoc
     */
    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if (allowed === false) return false;
        if (this.itemTypes.ability.length > 0) return allowed;

        const type = data.type ?? this.type;
        let keys = [];
        if (["character", "mouse", "weasel"].includes(type)) keys = [...ABILITY_ORDER];
        else if (type === "animal") keys = ["nature"];
        if (!keys.length) return allowed;

        const abilities = keys.map((key, i) => ({
            name: type === "animal"
                ? `${loc("MOUSEGUARD.Nature")} (${data.name ?? this.name})`
                : loc(abilityLabelKey(key, type)),
            type: "ability",
            sort: (i + 1) * 100000,
            system: { key, rating: 1, max: 1 },
            flags: { mouseguard: { schemaVersion: ITEM_SCHEMA_VERSION } }
        }));
        const changes = { items: [...(this._source.items ?? []), ...abilities] };
        if (!data.img) changes.img = "systems/mouseguard/assets/icons/seated-mouse.svg";
        this.updateSource(changes);
        return allowed;
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /**
     * The ability item with this key.
     * @param {"nature"|"will"|"health"|"resources"|"circles"} key
     * @returns {Item|undefined}
     */
    getAbility(key) {
        if (!key) return undefined;
        return this.items.find((i) => i.type === "ability" && i.system?.key === key);
    }

    /**
     * Ability items in display order (nature, will, health, resources, circles, then anything without a key).
     * @type {Item[]}
     */
    get abilities() {
        const rank = (item) => {
            const i = ABILITY_ORDER.indexOf(item.system?.key);
            return i === -1 ? ABILITY_ORDER.length : i;
        };
        return [...this.itemTypes.ability].sort((a, b) => (rank(a) - rank(b)) || (a.sort - b.sort));
    }

    /* -------------------------------------------- */
    /*  Advancement                                 */
    /* -------------------------------------------- */

    /**
     * Ready to advance? Rating N needs N passes and N-1 fails; rating 0 or 1 needs a single pass (book p. 247-249).
     * Nature compares the marks with its maximum (p. 248). Skills at rank 0 are learned through Beginner's Luck instead.
     * @returns {{field: string, from: number, to: number}|null}
     */
    #advancementTarget(item, advancement) {
        if (item.type === "skill") {
            const rank = int(item.system.rank);
            if (rank <= 0 || rank >= SKILL_CAP) return null;
            if (advancement.passed >= rank && advancement.failed >= rank - 1) return { field: "rank", from: rank, to: rank + 1 };
            return null;
        }
        const key = item.system.key;
        const cap = ABILITY_CAPS[key] ?? 10;
        const value = key === "nature" ? Math.max(int(item.system.max), int(item.system.rating)) : int(item.system.rating);
        if (value >= cap) return null;
        if (advancement.passed >= Math.max(1, value) && advancement.failed >= Math.max(0, value - 1)) {
            return { field: key === "nature" ? "max" : "rating", from: value, to: value + 1 };
        }
        return null;
    }

    /**
     * Add (or remove) a pass/fail advancement mark on a skill or ability. When the marks are complete the rating goes
     * up by one and all marks are erased (Nature: maximum and current rating both go up).
     * @param {string} itemId
     * @param {"passed"|"failed"|"pass"|"fail"} type
     * @param {number} [delta=1]
     * @param {{levelUp?: boolean, notify?: boolean}} [options]
     * @returns {Promise<{itemId: string, field: string, passed: number, failed: number, leveledUp: boolean, value: number|null}|null>}
     */
    async markAdvancement(itemId, type, delta = 1, { levelUp = true, notify = true } = {}) {
        const item = this.items.get(itemId);
        if (!item || !["skill", "ability"].includes(item.type)) return null;
        const field = String(type).startsWith("pass") ? "passed" : "failed";
        const cap = item.type === "skill" ? 6 : 10;
        const advancement = {
            passed: int(item.system.advancement?.passed),
            failed: int(item.system.advancement?.failed)
        };
        advancement[field] = Math.clamp(advancement[field] + int(delta), 0, cap);
        const update = { "system.advancement.passed": advancement.passed, "system.advancement.failed": advancement.failed };
        const result = { itemId, field, ...advancement, leveledUp: false, value: null };

        const target = levelUp && delta > 0 ? this.#advancementTarget(item, advancement) : null;
        if (target) {
            update[`system.${target.field}`] = target.to;
            if (target.field === "max") update["system.rating"] = Math.min(target.to, int(item.system.rating) + 1);
            update["system.advancement.passed"] = 0;
            update["system.advancement.failed"] = 0;
            Object.assign(result, { passed: 0, failed: 0, leveledUp: true, value: target.to });
        }
        await item.update(update);
        if (result.leveledUp && notify) {
            ui.notifications.info(fmt("MOUSEGUARD.Test.Note.Advanced", { name: item.displayName ?? itemLabel(item), value: result.value }));
        }
        return result;
    }

    /**
     * Add (or remove) a Beginner's Luck learning mark on a skill. Once the marks equal the Nature rating (maximum) the
     * skill is learned at rank 2 and the marks are erased (book p. 100-101, 250-251).
     * @param {string} itemId
     * @param {number} [delta=1]
     * @param {{notify?: boolean}} [options]
     * @returns {Promise<{itemId: string, learning: number, target: number, learned: boolean}|null>}
     */
    async markLearning(itemId, delta = 1, { notify = true } = {}) {
        const item = this.items.get(itemId);
        if (item?.type !== "skill") return null;
        const nature = this.getAbility("nature");
        const target = Math.max(1, Math.max(int(nature?.system?.max), int(nature?.system?.rating)));
        const learning = Math.clamp(int(item.system.learning) + int(delta), 0, 10);
        const result = { itemId, learning, target, learned: false };
        if (delta > 0 && int(item.system.rank) <= 0 && learning >= target) {
            await item.update({
                "system.rank": 2,
                "system.learning": 0,
                "system.advancement.passed": 0,
                "system.advancement.failed": 0
            });
            result.learned = true;
            result.learning = 0;
            if (notify) ui.notifications.info(fmt("MOUSEGUARD.Test.Note.SkillLearned", { name: itemLabel(item) }));
        } else {
            await item.update({ "system.learning": learning });
        }
        return result;
    }

    /* -------------------------------------------- */
    /*  Traits                                      */
    /* -------------------------------------------- */

    /**
     * Use a trait in a test.
     * "for": +1D at level 1 (once per session) or level 2 (twice per session); level 3 gives +1s with no limit.
     * "against": counts the use and earns checks (1 for -1D, 2 for helping the opponent in a versus test).
     * @param {string} itemId
     * @param {"for"|"against"} mode
     * @param {{checks?: number, notify?: boolean}} [options]
     * @returns {Promise<boolean>}  false when the trait cannot be used to help any more this session
     */
    async useTrait(itemId, mode, { checks = 1, notify = true } = {}) {
        const trait = this.items.get(itemId);
        if (trait?.type !== "trait") return false;
        const level = int(trait.system.level, 1);
        if (mode === "for") {
            if (level >= 3) return true;
            const used = int(trait.system.usedFor);
            if (used >= level) {
                if (notify) ui.notifications.warn(fmt("MOUSEGUARD.Test.Error.TraitSpent", { name: itemLabel(trait) }));
                return false;
            }
            await trait.update({ "system.usedFor": Math.min(2, used + 1) });
            return true;
        }
        const earned = Math.max(0, int(checks, 1));
        await trait.update({
            "system.usedAgainst": Math.min(99, int(trait.system.usedAgainst) + 1),
            "system.checksEarned": Math.min(99, int(trait.system.checksEarned) + earned)
        });
        if (earned && this.system.rewards) {
            await this.update({ "system.rewards.check": int(this.system.rewards.check) + earned });
        }
        if (notify) ui.notifications.info(fmt("MOUSEGUARD.Test.Note.ChecksEarned", { name: itemLabel(trait), n: earned }));
        return true;
    }

    /**
     * Recharge a spent trait with checks: 2 checks for level 1, 4 for level 2 (book p. 289-290).
     * @param {string} itemId
     * @returns {Promise<boolean>}
     */
    async rechargeTrait(itemId) {
        const trait = this.items.get(itemId);
        if (trait?.type !== "trait") return false;
        const level = int(trait.system.level, 1);
        if (level >= 3 || int(trait.system.usedFor) <= 0) return false;
        const cost = level === 1 ? 2 : 4;
        const available = int(this.system.rewards?.check);
        if (!this.system.rewards || available < cost) {
            ui.notifications.warn(fmt("MOUSEGUARD.Test.Error.NoChecks", { n: cost }));
            return false;
        }
        await this.update({ "system.rewards.check": available - cost });
        await trait.update({ "system.usedFor": 0 });
        return true;
    }

    /* -------------------------------------------- */
    /*  Conditions & sessions                       */
    /* -------------------------------------------- */

    /**
     * Toggle a condition and keep the matching token status effect in sync.
     * @param {"hungryThirsty"|"angry"|"tired"|"injured"|"sick"} key
     * @param {boolean} [active]  force a state instead of toggling
     * @returns {Promise<boolean>} the new state
     */
    async toggleCondition(key, active) {
        if (!CONDITION_KEYS.includes(key) || !this.system.conditions) return false;
        const next = active === undefined ? !this.system.conditions[key] : !!active;
        if (!!this.system.conditions[key] !== next) await this.update({ [`system.conditions.${key}`]: next });
        const statusId = CONDITION_STATUS[key];
        if (statusId && hasStatusEffect(statusId) && this.statuses?.has(statusId) !== next) {
            try {
                await this.toggleStatusEffect(statusId, { active: next });
            } catch (err) {
                console.warn(`Mouse Guard | Could not sync status effect "${statusId}"`, err);
            }
        }
        return next;
    }

    /**
     * Start a new session: trait uses (for/against) and the per-session check counters are reset.
     * @returns {Promise<number>} number of traits reset
     */
    async startNewSession() {
        if (!this.isOwner) {
            ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NotOwner"));
            return 0;
        }
        const updates = this.itemTypes.trait
            .filter((t) => t.system.usedFor || t.system.usedAgainst || t.system.checksEarned)
            .map((t) => ({ _id: t.id, "system.usedFor": 0, "system.usedAgainst": 0, "system.checksEarned": 0 }));
        if (updates.length) await this.updateEmbeddedDocuments("Item", updates);
        ui.notifications.info(fmt("MOUSEGUARD.Test.Note.NewSession", { name: this.name }));
        return updates.length;
    }

    /* -------------------------------------------- */
    /*  Tests                                       */
    /* -------------------------------------------- */

    /**
     * Open the test dialog for a skill or ability (or a free test), or roll at once with defaults.
     * @param {object} [options]
     * @param {string} [options.itemId]       skill or ability item to test
     * @param {string} [options.abilityKey]   ability to test (nature|will|health|resources|circles)
     * @param {boolean} [options.quick]       roll immediately (defaults to event.shiftKey)
     * @param {Event} [options.event]         the triggering event
     * @param {object} [options.state]        preset dialog values (ob, versus, helpers, ...)
     * @returns {Promise<ChatMessage|MouseGuardTestDialog|null>}
     */
    async rollTest({ itemId, abilityKey, quick, event, state = {} } = {}) {
        if (!this.isOwner) {
            ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NotOwner"));
            return null;
        }
        const subjectId = itemId ?? this.getAbility(abilityKey)?.id ?? "";
        if ((itemId || abilityKey) && !this.items.get(subjectId)) {
            ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoSubject"));
            return null;
        }
        quick ??= !!event?.shiftKey;
        if (quick && subjectId) {
            const subject = this.items.get(subjectId);
            const preset = defaultTestState(this, { subjectId, ob: getLastOb(this), ...state });
            if (subject?.type === "ability" && subject.system.key === "nature") preset.inNature = state.inNature ?? true;
            return performTest(this, preset);
        }
        return MouseGuardTestDialog.open(this, { subjectId, state });
    }
}
