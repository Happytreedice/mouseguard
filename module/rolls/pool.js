/**
 * Dice pool builder for Mouse Guard tests (rules cheat-sheet B, E, F, G, H, I, J, M).
 * Pure with respect to documents: it only reads the actor and the dialog state.
 */
import { ABILITY_ORDER, abilityLabel, itemLabel } from "./labels.js";

const loc = (key) => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const int = (value, fallback = 0) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
};

/** Upper bounds of the dialog steppers. */
export const LIMITS = Object.freeze({
    helpers: [0, 10],
    wiseHelp: [0, 10],
    persona: [0, 3],
    ob: [0, 10],
    opponent: [0, 30],
    modifier: [-10, 10]
});

/**
 * Default dialog state.
 * @param {Actor} actor
 * @param {object} [preset]
 * @returns {object}
 */
export function defaultTestState(actor, preset = {}) {
    return {
        subjectId: "",
        natureInstead: false,
        recovery: false,
        ob: 0,
        versus: false,
        opponent: 0,
        helpers: 0,
        wiseHelp: 0,
        wiseHelpers: [],
        gear: false,
        supplies: false,
        homeTown: false,
        contact: false,
        modifier: 0,
        traitFor: "",
        traitAgainst: "",
        againstMode: "self",
        persona: 0,
        tapNature: false,
        inNature: false,
        markAdvancement: null,      // null = follow the default (setting, Ob > 0, player character)
        messageMode: "",
        ...preset
    };
}

/** Is this actor able to spend fate/persona and earn checks? */
export function hasRewards(actor) {
    return actor?.type === "character" && !!actor.system?.rewards;
}

/**
 * Ability items ordered by key, then skills by name.
 * @param {Actor} actor
 * @returns {{abilities: Item[], skills: Item[]}}
 */
export function listSubjects(actor) {
    const order = (item) => {
        const i = ABILITY_ORDER.indexOf(item.system?.key);
        return i === -1 ? ABILITY_ORDER.length : i;
    };
    const abilities = [...(actor.itemTypes.ability ?? [])].sort((a, b) => (order(a) - order(b)) || (a.sort - b.sort));
    const skills = [...(actor.itemTypes.skill ?? [])]
        .sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), game.i18n.lang));
    return { abilities, skills };
}

/** Label of a skill or ability item for this actor. */
export function subjectLabel(actor, item) {
    if (!item) return "";
    return item.type === "ability" ? abilityLabel(item, actor.type) : itemLabel(item);
}

/** Can this trait still be used to help this session? (book p. 285-286) */
export function traitAvailableFor(trait) {
    const level = int(trait?.system?.level, 1);
    if (level >= 3) return true;
    return int(trait?.system?.usedFor) < level;
}

/**
 * Ability suggested for a versus tiebreaker (book p. 93-94): mental/social skill -> Will, physical -> Health,
 * Will/Health -> Nature, Nature -> GM's choice (Will proposed). Animals always use Nature.
 * @param {Actor} actor
 * @param {object} ctx  computed test
 * @returns {string}
 */
export function tiebreakerAbility(actor, ctx) {
    if (actor.type === "animal") return "nature";
    if (ctx.kind === "skill" || ctx.kind === "beginnersLuck") return ctx.subject?.system?.beginnersLuck === "health" ? "health" : "will";
    if (ctx.rollKey === "will" || ctx.rollKey === "health") return "nature";
    if (ctx.rollKey === "nature") return "will";
    return "will";
}

/**
 * Compute the dice pool for a test.
 * @param {Actor} actor
 * @param {object} state  dialog state (see defaultTestState)
 * @returns {object} computed test context
 */
export function computeTest(actor, state) {
    const ctx = {
        subject: null, kind: null, rollItem: null, rollKey: null, label: "", testedItem: null,
        parts: [], warnings: [], blocked: null, dice: 0, bonusSuccesses: 0,
        helpers: 0, wiseHelp: 0, wiseHelpers: [], gear: 0, supplies: 0, homeTown: 0, contact: 0, modifier: 0,
        personaDice: 0, tapNature: false, inNature: false, natureRating: 0,
        traitFor: null, traitAgainst: null, againstMode: "self", againstChecks: 0,
        canHelp: false, canPersona: false, canTapNature: false, personaBudget: 0,
        canRecovery: false, recovery: false, canNatureInstead: false, natureInstead: false,
        resCirc: false, natureTest: false, beginnersLuck: null, rewards: hasRewards(actor)
    };
    const subject = actor.items.get(state.subjectId);
    if (!subject || !["skill", "ability"].includes(subject.type)) {
        ctx.blocked = loc("MOUSEGUARD.Test.Error.NoSubject");
        return ctx;
    }
    ctx.subject = subject;
    const nature = actor.getAbility?.("nature") ?? null;
    const conditions = actor.system?.conditions ?? {};
    const isSkill = subject.type === "skill";
    const rank = isSkill ? int(subject.system.rank) : 0;

    // What is actually rolled
    ctx.canNatureInstead = isSkill && !!nature;
    ctx.natureInstead = ctx.canNatureInstead && !!state.natureInstead;
    const beginnersLuck = isSkill && !ctx.natureInstead && rank <= 0;
    if (!isSkill) {
        ctx.kind = "ability";
        ctx.rollItem = subject;
        ctx.rollKey = subject.system.key || null;
    } else if (ctx.natureInstead) {
        ctx.kind = "natureInstead";
        ctx.rollItem = nature;
        ctx.rollKey = "nature";
    } else if (beginnersLuck) {
        ctx.kind = "beginnersLuck";
        const key = subject.system.beginnersLuck === "health" ? "health" : "will";
        ctx.rollItem = actor.getAbility?.(key) ?? null;
        ctx.rollKey = key;
        ctx.beginnersLuck = key;
    } else {
        ctx.kind = "skill";
        ctx.rollItem = subject;
        ctx.rollKey = null;
    }
    const name = subjectLabel(actor, subject);
    ctx.label = name;
    ctx.natureTest = ctx.rollKey === "nature" && ctx.kind !== "beginnersLuck";
    ctx.resCirc = ctx.kind === "ability" && ["resources", "circles"].includes(ctx.rollKey);
    ctx.canRecovery = ctx.kind === "ability" && ["will", "health"].includes(ctx.rollKey);
    ctx.recovery = ctx.canRecovery && !!state.recovery;
    ctx.testedItem = ctx.kind === "beginnersLuck" ? null : ctx.rollItem;
    ctx.natureRating = int(nature?.system?.rating);

    if (!ctx.rollItem) {
        ctx.blocked = fmt("MOUSEGUARD.Test.Error.NoAbility", {
            ability: loc(ctx.rollKey === "health" ? "MOUSEGUARD.Health" : ctx.rollKey === "nature" ? "MOUSEGUARD.Nature" : "MOUSEGUARD.Will")
        });
        return ctx;
    }

    // 1. Base rating (Nature: current, taxed rating)
    const rating = ctx.kind === "skill" ? rank : int(ctx.rollItem.system.rating);
    const rollLabel = subjectLabel(actor, ctx.rollItem);
    if (ctx.kind === "beginnersLuck") {
        ctx.parts.push({ label: fmt("MOUSEGUARD.Test.Part.BeginnersLuck", { ability: rollLabel }), value: `+${rating}`, kind: "base" });
    } else if (ctx.kind === "natureInstead") {
        ctx.parts.push({ label: fmt("MOUSEGUARD.Test.Part.NatureInstead", { nature: rollLabel }), value: `+${rating}`, kind: "base" });
    } else {
        ctx.parts.push({ label: name, value: `+${rating}`, kind: "base" });
    }

    // Injured / Sick: -1D each to Nature, Will, Health and skills; not Resources/Circles, not recovery (book p. 34, 138-139)
    const penaltyApplies = !ctx.resCirc && !ctx.recovery;
    let base = rating;
    if (penaltyApplies) {
        for (const key of ["injured", "sick"]) {
            if (!conditions[key]) continue;
            base -= 1;
            ctx.parts.push({ label: loc(`MOUSEGUARD.${key}`), value: "−1", kind: "negative" });
        }
    }
    const reducedToZero = penaltyApplies && rating > 0 && base <= 0;
    if (reducedToZero) {
        ctx.blocked = ctx.kind === "beginnersLuck"
            ? fmt("MOUSEGUARD.Test.Error.BeginnersLuckReduced", { ability: rollLabel })
            : fmt("MOUSEGUARD.Test.Error.Reduced", { name: rollLabel });
    }
    base = Math.max(0, base);

    // Resources 0: only with help; persona only with help (book p. 262)
    const resourcesZero = ctx.kind === "ability" && ctx.rollKey === "resources" && rating <= 0;

    // 2-4. Help, wises, gear, supplies (+1D each)
    ctx.canHelp = !ctx.recovery && !reducedToZero;
    if (ctx.canHelp) {
        ctx.helpers = Math.clamp(int(state.helpers), ...LIMITS.helpers);
        const selected = Array.isArray(state.wiseHelpers) ? state.wiseHelpers.filter(Boolean) : [];
        ctx.wiseHelpers = selected;
        ctx.wiseHelp = Math.clamp(int(state.wiseHelp), ...LIMITS.wiseHelp) + selected.length;
    }
    if (ctx.helpers) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Helpers"), value: `+${ctx.helpers}`, kind: "positive" });
    if (ctx.wiseHelp) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.WiseHelp"), value: `+${ctx.wiseHelp}`, kind: "positive" });
    ctx.gear = state.gear ? 1 : 0;
    ctx.supplies = state.supplies ? 1 : 0;
    if (ctx.gear) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Gear"), value: "+1", kind: "positive" });
    if (ctx.supplies) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Supplies"), value: "+1", kind: "positive" });
    if (ctx.resCirc) {
        ctx.homeTown = state.homeTown ? 1 : 0;
        ctx.contact = (ctx.rollKey === "circles" && state.contact) ? 1 : 0;
        if (ctx.homeTown) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.HomeTown"), value: "+1", kind: "positive" });
        if (ctx.contact) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Contact"), value: "+1", kind: "positive" });
    }
    let dice = base + ctx.helpers + ctx.wiseHelp + ctx.gear + ctx.supplies + ctx.homeTown + ctx.contact;

    // 5. Beginner's Luck: halve (rounded up) ability + wises + help + gear (book p. 100)
    if (ctx.kind === "beginnersLuck") {
        const halved = Math.ceil(dice / 2);
        ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Halved"), value: `${dice} → ${halved}`, kind: "neutral" });
        dice = halved;
    }

    if (resourcesZero && !ctx.helpers && !ctx.blocked) ctx.blocked = loc("MOUSEGUARD.Test.Error.ResourcesZero");

    // 6. Trait used to help: +1D (level 1-2) or +1s (level 3); one per test
    const traitFor = actor.items.get(state.traitFor);
    if (traitFor?.type === "trait" && traitAvailableFor(traitFor)) {
        ctx.traitFor = traitFor;
        if (int(traitFor.system.level, 1) >= 3) {
            ctx.bonusSuccesses = 1;
            ctx.parts.push({ label: itemLabel(traitFor), value: loc("MOUSEGUARD.Test.Part.PlusSuccess"), kind: "positive" });
        } else {
            dice += 1;
            ctx.parts.push({ label: itemLabel(traitFor), value: "+1", kind: "positive" });
        }
    }

    // 7. Persona: +1D per point, max 3 per roll; or 1 point to tap Nature (not for Resources/Circles)
    const persona = ctx.rewards ? int(actor.system.rewards.persona) : 0;
    ctx.canPersona = ctx.rewards && !reducedToZero && !(resourcesZero && !ctx.helpers) && persona > 0;
    ctx.personaBudget = ctx.canPersona ? Math.min(3, persona) : 0;
    ctx.canTapNature = ctx.canPersona && !ctx.resCirc && !!nature;
    ctx.tapNature = ctx.canTapNature && !!state.tapNature && ctx.personaBudget >= 1;
    ctx.personaDice = ctx.canPersona
        ? Math.clamp(int(state.persona), 0, Math.max(0, ctx.personaBudget - (ctx.tapNature ? 1 : 0)))
        : 0;
    if (ctx.personaDice) {
        dice += ctx.personaDice;
        ctx.parts.push({ label: loc("MOUSEGUARD.Persona"), value: `+${ctx.personaDice}`, kind: "positive" });
    }
    if (ctx.tapNature) {
        dice += ctx.natureRating;
        ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.TapNature"), value: `+${ctx.natureRating}`, kind: "positive" });
    }
    ctx.inNature = (ctx.tapNature || ctx.natureTest) && !!state.inNature;

    // 8. Trait used against yourself: -1D (1 check) or, versus only, +2D to the opponent (2 checks)
    const traitAgainst = actor.items.get(state.traitAgainst);
    if (traitAgainst?.type === "trait" && traitAgainst.id !== ctx.traitFor?.id) {
        ctx.traitAgainst = traitAgainst;
        ctx.againstMode = state.versus && state.againstMode === "opponent" ? "opponent" : "self";
        ctx.againstChecks = ctx.againstMode === "opponent" ? 2 : 1;
        if (ctx.againstMode === "self") {
            dice -= 1;
            ctx.parts.push({ label: itemLabel(traitAgainst), value: "−1", kind: "negative" });
        } else {
            ctx.parts.push({ label: itemLabel(traitAgainst), value: loc("MOUSEGUARD.Test.Part.OpponentBonus"), kind: "negative" });
        }
    }

    // Other modifiers (GM rulings)
    ctx.modifier = Math.clamp(int(state.modifier), ...LIMITS.modifier);
    if (ctx.modifier) {
        dice += ctx.modifier;
        ctx.parts.push({
            label: loc("MOUSEGUARD.Test.Part.Modifier"),
            value: ctx.modifier > 0 ? `+${ctx.modifier}` : `−${Math.abs(ctx.modifier)}`,
            kind: ctx.modifier > 0 ? "positive" : "negative"
        });
    }

    ctx.dice = Math.max(0, dice);
    if (!ctx.blocked && ctx.dice === 0) ctx.warnings.push(loc("MOUSEGUARD.Test.Warning.NoDice"));
    if ((ctx.natureTest || ctx.tapNature) && ctx.natureRating <= 0) ctx.warnings.push(loc("MOUSEGUARD.Test.Warning.NatureZero"));
    return ctx;
}
