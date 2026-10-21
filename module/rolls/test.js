/**
 * Mouse Guard test engine: rolls the pool, posts the chat card, applies the consequences to the actor and handles the
 * post-roll chat buttons (Fate, "Deeper Understanding", "Of Course!", versus tie resolution).
 */
import { MouseRoll } from "../mousedie.js";
import { itemLabel } from "./labels.js";
import { computeTest, hasRewards, subjectLabel, tiebreakerAbility } from "./pool.js";

export const SYSTEM_ID = "mouseguard";
export const CARD_TEMPLATE = "systems/mouseguard/templates/rolls/test-card.hbs";
export const DIALOG_TEMPLATE = "systems/mouseguard/templates/rolls/test-dialog.hbs";
/** CONFIG.queries name of the GM relay (registered in rolls/index.js). */
export const TEST_QUERY = "mouseguard.testUpdate";

const loc = (key) => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const int = (value, fallback = 0) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
};

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

const lastObstacles = new Map();

/** Last obstacle used by this actor in this client session (quick tests reuse it). */
export function getLastOb(actor) {
    return lastObstacles.get(actor?.uuid) ?? 0;
}

/** Whether tests mark advancement automatically (world setting, default true). */
export function autoMarkAdvancement() {
    try {
        return game.settings.get(SYSTEM_ID, "autoMarkAdvancement") !== false;
    } catch (err) {
        return true;
    }
}

/** Default chat visibility mode (v14 messageMode, v13 rollMode). */
export function defaultMessageMode() {
    try {
        if (CONFIG.ChatMessage?.modes) return game.settings.get("core", "messageMode");
        return game.settings.get("core", "rollMode");
    } catch (err) {
        return "public";
    }
}

/** Selectable chat visibility modes. */
export function messageModeChoices() {
    if (CONFIG.ChatMessage?.modes) {
        return Object.entries(CONFIG.ChatMessage.modes).map(([value, mode]) => ({ value, label: loc(mode.label) }));
    }
    return Object.entries(CONFIG.Dice?.rollModes ?? {}).map(([value, mode]) => ({
        value, label: loc(typeof mode === "string" ? mode : mode.label)
    }));
}

const DICE_IMG = {
    snake: "systems/mouseguard/assets/dice/snake.png",
    sword: "systems/mouseguard/assets/dice/sword.png",
    axe: "systems/mouseguard/assets/dice/axe.png"
};

const faceOf = (r) => (r >= 6 ? "axe" : r >= 4 ? "sword" : "snake");

/**
 * Roll n Mouse Guard dice (d6 with snake/sword/axe faces; 4-6 is a success).
 * @param {number} n
 * @returns {Promise<{roll: Roll|null, results: number[]}>}
 */
export async function rollMouseDice(n) {
    if (!(n > 0)) return { roll: null, results: [] };
    const roll = new MouseRoll(`${n}dmcs>3`);
    await roll.evaluate();
    const results = roll.dice.flatMap((d) => d.results.filter((r) => r.active !== false).map((r) => r.result));
    return { roll, results };
}

/** Show extra dice with Dice So Nice (or play the dice sound). */
async function showDice(roll, message) {
    if (!roll) return;
    if (game.dice3d) {
        try {
            await game.dice3d.showForRoll(roll, game.user, true, message?.whisper?.length ? message.whisper : null, !!message?.blind);
            return;
        } catch (err) {
            console.warn("Mouse Guard | Dice So Nice failed", err);
        }
    }
    try {
        foundry.audio?.AudioHelper?.play({ src: CONFIG.sounds.dice, volume: 0.8, autoplay: true, loop: false }, false);
    } catch (err) { /* sound is optional */ }
}

/** Resolve the actor of a test record (works for unlinked token actors). */
export function recordActor(record, message) {
    let actor = null;
    try {
        actor = record?.actorUuid ? fromUuidSync(record.actorUuid) : null;
    } catch (err) {
        actor = null;
    }
    if (!actor && message) actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
    return actor instanceof Actor ? actor : null;
}

/**
 * Update a document the current user may not own: directly when possible, otherwise through the active GM with an
 * awaited User query (the GM validates the request against the server-authenticated user, see rolls/index.js).
 * Only test chat messages and wise marks are relayed.
 * @param {ClientDocument} doc
 * @param {object} changes
 * @param {object} [options]
 * @param {ChatMessage} [options.message]  The test card that justifies a wise-mark update on another character's wise.
 * @returns {Promise<boolean>}  Whether the update was applied.
 */
async function updateAsOwner(doc, changes, { message = null } = {}) {
    if (!doc) return false;
    if (doc.isOwner) {
        await doc.update(changes);
        return true;
    }
    const gm = game.users.activeGM;
    if (!gm) {
        ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoGM"));
        return false;
    }
    try {
        await gm.query(TEST_QUERY, { uuid: doc.uuid, changes, messageUuid: message?.uuid ?? null }, { timeout: 20000 });
        return true;
    } catch (err) {
        console.error("Mouse Guard | GM relay failed", err);
        ui.notifications.error(loc("MOUSEGUARD.Test.Error.RelayFailed"));
        return false;
    }
}

/* -------------------------------------------- */
/*  Result                                      */
/* -------------------------------------------- */

/**
 * Successes and outcome of a test record (rules A, D, M).
 * @param {object} record
 * @returns {{successes: number, rolled: number, passed: boolean, tie: boolean, margin: number, outcome: string}}
 */
export function computeResult(record) {
    const active = record.dice.filter((d) => !d.replaced);
    const rolled = active.filter((d) => d.r >= 4).length;
    let successes = rolled;
    const ob = int(record.ob);
    const bonus = int(record.bonusSuccesses);
    let passed = false;
    let tie = false;
    let margin = 0;
    if (record.versus) {
        const opp = int(record.opponent);
        if (record.used?.tieTrait && successes <= opp) {
            passed = false;
            margin = 1;     // the opponent wins with a margin of 1 (book p. 288)
        } else {
            if (bonus && successes >= opp) successes += bonus;     // level 3 trait: wins a tie
            tie = successes === opp;
            passed = successes > opp;
            margin = Math.abs(successes - opp);
        }
    } else {
        const pass = (n) => (ob > 0 ? n >= ob : n >= 1);
        if (bonus && pass(successes)) successes += bonus;
        passed = pass(successes);
        margin = passed ? Math.max(0, successes - ob) : Math.max(0, ob - successes);
    }
    const outcome = tie ? "tie" : passed ? "pass" : "fail";
    return { successes, rolled, passed, tie, margin, outcome };
}

/** Nature tax for a result (rules F, M). */
function natureTax(record, result) {
    if (result.tie) return 0;
    const marginOfFailure = result.passed ? 0 : result.margin;
    if (record.tapNature) {
        if (result.passed) return record.inNature ? 0 : 1;
        return Math.max(1, marginOfFailure);
    }
    if (record.natureTest) {
        if (result.passed || record.inNature) return 0;
        return marginOfFailure;
    }
    return 0;
}

/* -------------------------------------------- */
/*  Consequences                                */
/* -------------------------------------------- */

const snapshot = (item) => {
    if (!item) return null;
    const s = item.system;
    const base = { advancement: { passed: int(s.advancement?.passed), failed: int(s.advancement?.failed) } };
    if (item.type === "skill") return { ...base, rank: int(s.rank), learning: int(s.learning) };
    return { ...base, rating: int(s.rating), max: int(s.max) };
};

/**
 * Undo an advancement mark applied by a test (the outcome changed after a reroll). A level-up caused by that mark is
 * undone too, unless the rating was changed by something else in the meantime.
 */
async function revertAdvancement(actor, applied) {
    const item = actor.items.get(applied.itemId);
    if (!item) return;
    if (!applied.leveledUp) {
        await actor.markAdvancement(item.id, applied.mark, -1, { levelUp: false, notify: false });
        return;
    }
    const now = snapshot(item);
    const before = applied.before ?? {};
    const after = applied.after ?? {};
    if (item.type === "skill") {
        if (now.rank === after.rank) await item.update({ "system.rank": before.rank, "system.advancement": before.advancement });
    } else if (item.system.key === "nature") {
        if (now.max === after.max) {
            await item.update({
                "system.max": before.max,
                "system.rating": Math.clamp(now.rating - 1, 0, before.max),
                "system.advancement": before.advancement
            });
        }
    } else if (now.rating === after.rating) {
        await item.update({ "system.rating": before.rating, "system.advancement": before.advancement });
    }
}

/**
 * Bring the actor in line with the current result of a record: advancement mark, Nature tax and "I Know!" wise marks.
 * Previously applied consequences are reverted when the outcome changed (e.g. after a Fate reroll).
 * Beginner's Luck learning marks are applied once, on the initial roll, whatever the result.
 * @param {Actor} actor
 * @param {object} record  mutated: record.applied and record.result
 * @param {{initial?: boolean}} [options]
 */
export async function applyConsequences(actor, record, { initial = false, message = null, deferred = null } = {}) {
    const result = computeResult(record);
    record.result = result;
    record.applied ??= {};
    const applied = record.applied;
    const canWrite = actor?.isOwner;

    // Beginner's Luck: one learning mark per test, pass or fail (book p. 100-101)
    if (initial && canWrite && record.beginnersLuck && record.subjectId) {
        const before = snapshot(actor.items.get(record.subjectId));
        const res = await actor.markLearning(record.subjectId, 1, { notify: false });
        if (res) applied.learning = { itemId: record.subjectId, before, value: res.learning, target: res.target, learned: res.learned };
    }

    // Advancement mark (none on a tie until it is resolved; none for Beginner's Luck)
    const desiredMark = (record.markAdvancement && record.testedItemId && !result.tie)
        ? (result.passed ? "passed" : "failed") : null;
    const current = applied.advancement ?? null;
    if (canWrite && (current?.mark ?? null) !== desiredMark) {
        if (current?.mark) await revertAdvancement(actor, current);
        applied.advancement = null;
        const item = desiredMark ? actor.items.get(record.testedItemId) : null;
        if (item) {
            const before = snapshot(item);
            const res = await actor.markAdvancement(item.id, desiredMark, 1, { notify: false });
            applied.advancement = {
                itemId: item.id, mark: desiredMark, before, after: snapshot(actor.items.get(item.id)),
                leveledUp: !!res?.leveledUp, value: res?.value ?? null
            };
        }
    }

    // Nature tax
    const nature = actor?.getAbility?.("nature");
    const desiredTax = nature ? natureTax(record, result) : 0;
    const appliedTax = int(applied.tax?.amount);
    if (canWrite && nature && desiredTax !== appliedTax) {
        const rating = int(nature.system.rating);
        const max = Math.max(int(nature.system.max), rating);
        const next = Math.clamp(rating + appliedTax - desiredTax, 0, max);
        await nature.update({ "system.rating": next, "system.max": max });
        applied.tax = { itemId: nature.id, amount: desiredTax, rating: next, max };
    } else if (applied.tax && nature) {
        applied.tax.rating = int(nature.system.rating);
    }

    // "I Know!" helpers: pass/fail mark on their wise (book p. 303-304)
    const desiredWise = result.tie ? null : (result.passed ? "pass" : "fail");
    applied.wiseMarks ??= [];
    for (const helper of record.wiseHelpers ?? []) {
        const entry = applied.wiseMarks.find((w) => w.uuid === helper.uuid) ?? { uuid: helper.uuid, mark: null, set: false };
        if (entry.mark === desiredWise) continue;
        let wise = null;
        try {
            wise = fromUuidSync(helper.uuid);
        } catch (err) {
            wise = null;
        }
        if (wise?.type !== "wise") continue;
        const changes = {};
        if (entry.mark && entry.set) changes[`system.checks.${entry.mark}`] = false;
        entry.set = false;
        if (desiredWise && !wise.system.checks?.[desiredWise]) {
            changes[`system.checks.${desiredWise}`] = true;
            entry.set = true;
        }
        entry.mark = desiredWise;
        if (!foundry.utils.isEmpty(changes)) {
            // Another character's wise can only be relayed once the test card exists (the GM checks the card lists it).
            if (!wise.isOwner && !message && Array.isArray(deferred)) deferred.push({ wise, changes });
            else await updateAsOwner(wise, changes, { message });
        }
        if (!applied.wiseMarks.includes(entry)) applied.wiseMarks.push(entry);
    }
    return result;
}

/* -------------------------------------------- */
/*  Performing a test                           */
/* -------------------------------------------- */

/**
 * Roll a test from a dialog state (see pool.js defaultTestState).
 * @param {Actor} actor
 * @param {object} state
 * @returns {Promise<ChatMessage|null>}
 */
export async function performTest(actor, state) {
    if (!actor?.isOwner) {
        ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NotOwner"));
        return null;
    }
    const ctx = computeTest(actor, state);
    if (ctx.blocked) {
        ui.notifications.warn(ctx.blocked);
        return null;
    }

    // Spend before rolling: persona, traits (book p. 36-37, 285-288)
    const personaSpent = ctx.personaDice + (ctx.tapNature ? 1 : 0);
    if (personaSpent > 0) {
        const available = int(actor.system.rewards?.persona);
        if (available < personaSpent) {
            ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoPersona"));
            return null;
        }
        await actor.update({ "system.rewards.persona": available - personaSpent });
    }
    if (ctx.traitFor) await actor.useTrait(ctx.traitFor.id, "for", { notify: false });
    if (ctx.traitAgainst) await actor.useTrait(ctx.traitAgainst.id, "against", { checks: ctx.againstChecks, notify: false });

    const { roll, results } = await rollMouseDice(ctx.dice);
    const ob = Math.clamp(int(state.ob), 0, 10);
    const versus = !!state.versus;
    const markAdvancement = state.markAdvancement ?? defaultMarkAdvancement(actor, { ...state, ob });

    const wiseHelpers = (ctx.wiseHelpers ?? []).map((uuid) => {
        let wise = null;
        try {
            wise = fromUuidSync(uuid);
        } catch (err) {
            wise = null;
        }
        return { uuid, name: wise ? itemLabel(wise) : "", actorName: wise?.actor?.name ?? "" };
    }).filter((w) => w.name);

    const record = {
        v: 1,
        actorUuid: actor.uuid,
        subjectId: ctx.subject.id,
        subjectType: ctx.subject.type,
        kind: ctx.kind,
        label: ctx.label,
        rollLabel: subjectLabel(actor, ctx.rollItem),
        rollKey: ctx.rollKey,
        testedItemId: ctx.testedItem?.id ?? null,
        beginnersLuck: ctx.beginnersLuck,
        natureTest: ctx.natureTest,
        recovery: ctx.recovery,
        tiebreakerKey: tiebreakerAbility(actor, ctx),
        ob,
        versus,
        opponent: versus ? Math.clamp(int(state.opponent), 0, 30) : 0,
        pool: ctx.dice,
        parts: ctx.parts,
        bonusSuccesses: ctx.bonusSuccesses,
        helpers: ctx.helpers,
        wiseHelp: ctx.wiseHelp,
        wiseHelpers,
        persona: ctx.personaDice,
        tapNature: ctx.tapNature,
        inNature: ctx.inNature,
        traitFor: ctx.traitFor ? { id: ctx.traitFor.id, name: itemLabel(ctx.traitFor), level: int(ctx.traitFor.system.level, 1) } : null,
        traitAgainst: ctx.traitAgainst
            ? { id: ctx.traitAgainst.id, name: itemLabel(ctx.traitAgainst), mode: ctx.againstMode, checks: ctx.againstChecks }
            : null,
        markAdvancement: !!markAdvancement,
        dice: results.map((r, i) => ({ id: i, r, src: "pool", replaced: false, exploded: false })),
        used: { fate: false, deeper: null, ofCourse: null, tieTrait: null, tiebreaker: false },
        spent: { persona: personaSpent, fate: 0 },
        applied: {}
    };

    const deferredWise = [];
    await applyConsequences(actor, record, { initial: true, deferred: deferredWise });
    const content = await renderTestCard(record, actor);
    const messageMode = state.messageMode || defaultMessageMode();
    const data = {
        author: game.user.id,
        speaker: ChatMessage.implementation.getSpeaker({ actor }),
        content,
        rolls: roll ? [roll] : [],
        flags: { [SYSTEM_ID]: { test: record } }
    };
    if (roll) data.sound = CONFIG.sounds.dice;
    const options = CONFIG.ChatMessage?.modes ? { messageMode } : { rollMode: messageMode };
    lastObstacles.set(actor.uuid, ob);
    const message = await ChatMessage.implementation.create(data, options);
    // Helpers' wise marks on characters this user does not own go through the GM, with the card as proof.
    for (const { wise, changes } of deferredWise) await updateAsOwner(wise, changes, { message });
    if (message && state.tiebreakerFor) await markTiebreakerRolled(state.tiebreakerFor);
    return message;
}

/**
 * Once a tiebreaker test has actually been rolled, the tied card can no longer be resolved with a trait or Fate, and
 * it stops offering another tiebreaker (book p. 93-94, 287-288).
 * @param {string} originUuid  UUID of the tied test card.
 */
async function markTiebreakerRolled(originUuid) {
    const origin = await fromUuid(originUuid).catch(() => null);
    const stored = origin?.getFlag?.(SYSTEM_ID, "test");
    if (!stored || stored.used?.tiebreaker) return;
    const record = foundry.utils.deepClone(stored);
    record.used = { ...(record.used ?? {}), tiebreaker: true };
    const content = await renderTestCard(record, recordActor(record, origin));
    await updateAsOwner(origin, { content, [`flags.${SYSTEM_ID}.test`]: record });
}

/**
 * Default of the "mark advancement" option: world setting, a player character, and a versus test or an obstacle above 0
 * (Ob 0 rolls are mostly disposition rolls, which never mark advancement).
 */
export function defaultMarkAdvancement(actor, state) {
    return autoMarkAdvancement() && actor?.type === "character" && (!!state?.versus || int(state?.ob) > 0);
}

/* -------------------------------------------- */
/*  Chat card                                   */
/* -------------------------------------------- */

const hasAllWiseMarks = (wise) => {
    const c = wise?.system?.checks ?? {};
    return !!(c.pass && c.fail && c.figuredOut && c.realized);
};

/** Post-roll actions currently possible for this record (independent of the viewing user). */
function availableActions(record, actor) {
    const result = record.result ?? computeResult(record);
    const active = record.dice.filter((d) => !d.replaced);
    const rewards = hasRewards(actor);
    const wises = actor?.itemTypes?.wise ?? [];
    const usedWises = [record.used.deeper, record.used.ofCourse].filter(Boolean);
    const freeWises = wises.filter((w) => !usedWises.includes(w.id));
    // A tie settled with a trait, or already handed to a tiebreaker test, offers no more rerolls or tie options.
    const resolvedTie = !!record.used.tieTrait || !!record.used.tiebreaker;
    const actions = [];
    if (rewards && !record.used.fate && !resolvedTie && active.some((d) => d.r === 6 && !d.exploded)) {
        actions.push({ action: "fate", icon: "fa-solid fa-hand-sparkles", label: loc("MOUSEGUARD.Test.Action.Fate"), hint: loc("MOUSEGUARD.Test.Action.FateHint") });
    }
    if (rewards && !record.used.ofCourse && !record.used.fate && !resolvedTie && freeWises.length
        && active.some((d) => d.r <= 3 && d.src !== "fate")) {
        actions.push({ action: "ofCourse", icon: "fa-solid fa-lightbulb", label: loc("MOUSEGUARD.Test.Action.OfCourse"), hint: loc("MOUSEGUARD.Test.Action.OfCourseHint") });
    }
    if (rewards && !record.used.deeper && !resolvedTie && freeWises.length && active.some((d) => d.r <= 3 && d.src === "pool")) {
        actions.push({ action: "deeper", icon: "fa-solid fa-magnifying-glass", label: loc("MOUSEGUARD.Test.Action.Deeper"), hint: loc("MOUSEGUARD.Test.Action.DeeperHint") });
    }
    if (record.versus && result.tie) {
        const traits = (actor?.itemTypes?.trait ?? []).filter((t) => t.id !== record.traitFor?.id);
        if (!record.used.fate && !record.traitAgainst && !resolvedTie && traits.length) {
            actions.push({ action: "tieTrait", icon: "fa-solid fa-handshake-angle", label: loc("MOUSEGUARD.Test.Action.TieTrait"), hint: loc("MOUSEGUARD.Test.Action.TieTraitHint") });
        }
        if (!resolvedTie) {
            actions.push({ action: "tiebreaker", icon: "fa-solid fa-scale-balanced", label: loc("MOUSEGUARD.Test.Action.Tiebreaker"), hint: loc("MOUSEGUARD.Test.Action.TiebreakerHint") });
        }
    }
    return actions;
}

/**
 * Render the chat card of a test record.
 * @param {object} record
 * @param {Actor} actor
 * @returns {Promise<string>}
 */
export async function renderTestCard(record, actor) {
    const result = record.result ?? computeResult(record);
    const abilityName = (key) => {
        const item = actor?.getAbility?.(key);
        return item ? subjectLabel(actor, item) : loc(`MOUSEGUARD.${key === "nature" ? "Nature" : key.charAt(0).toUpperCase() + key.slice(1)}`);
    };

    const dice = record.dice.map((d) => {
        const face = faceOf(d.r);
        const cls = [face, d.r >= 4 ? "success" : "failure", `src-${d.src}`];
        if (d.replaced) cls.push("replaced");
        if (d.exploded) cls.push("exploded");
        return { img: DICE_IMG[face], cls: cls.join(" "), title: `${d.r}` };
    });

    const kindKey = {
        skill: "MOUSEGUARD.Test.Kind.Skill",
        ability: "MOUSEGUARD.Test.Kind.Ability",
        beginnersLuck: "MOUSEGUARD.Test.Kind.BeginnersLuck",
        natureInstead: "MOUSEGUARD.Test.Kind.NatureInstead"
    }[record.kind] ?? "MOUSEGUARD.Test.Kind.Ability";

    let outcomeClass = "partial";
    let outcomeLabel = fmt("MOUSEGUARD.Test.Card.Successes", { n: result.successes });
    if (record.versus) {
        outcomeClass = result.tie ? "partial" : result.passed ? "success" : "failure";
        outcomeLabel = loc(result.tie ? "MOUSEGUARD.Test.Card.Tie" : result.passed ? "MOUSEGUARD.Test.Card.Won" : "MOUSEGUARD.Test.Card.Lost");
    } else if (record.ob > 0) {
        outcomeClass = result.passed ? "success" : "failure";
        outcomeLabel = loc(result.passed ? "MOUSEGUARD.Test.Card.Passed" : "MOUSEGUARD.Test.Card.Failed");
    }
    const heading = record.versus
        ? fmt("MOUSEGUARD.Test.Card.VersusHeading", { successes: result.successes, opponent: record.opponent })
        : record.ob > 0
            ? fmt("MOUSEGUARD.Test.Card.ObHeading", { successes: result.successes, ob: record.ob })
            : fmt("MOUSEGUARD.Test.Card.NoObHeading", { successes: result.successes });
    let marginText = "";
    if (!result.tie && result.margin > 0 && (record.versus || record.ob > 0)) {
        marginText = fmt(result.passed ? "MOUSEGUARD.Test.Card.MarginSuccess" : "MOUSEGUARD.Test.Card.MarginFailure", { n: result.margin });
    }

    // Notes: what was spent and what changed on the actor
    const notes = [];
    if (record.spent?.persona) notes.push(fmt("MOUSEGUARD.Test.Note.PersonaSpent", { n: record.spent.persona }));
    if (record.tapNature) notes.push(loc(record.inNature ? "MOUSEGUARD.Test.Note.TapNatureWithin" : "MOUSEGUARD.Test.Note.TapNatureOutside"));
    if (record.traitFor) {
        notes.push(fmt(record.traitFor.level >= 3 ? "MOUSEGUARD.Test.Note.TraitForSuccess" : "MOUSEGUARD.Test.Note.TraitFor", { name: record.traitFor.name }));
    }
    if (record.traitAgainst) {
        notes.push(fmt(record.traitAgainst.mode === "opponent" ? "MOUSEGUARD.Test.Note.TraitAgainstOpponent" : "MOUSEGUARD.Test.Note.TraitAgainst",
            { name: record.traitAgainst.name, n: record.traitAgainst.checks }));
    }
    if (record.used.tieTrait) {
        const trait = actor?.items.get(record.used.tieTrait);
        notes.push(fmt("MOUSEGUARD.Test.Note.TieTrait", { name: trait ? itemLabel(trait) : "?" }));
    }
    if (record.used.fate) notes.push(loc("MOUSEGUARD.Test.Note.FateUsed"));
    for (const [key, labelKey] of [["deeper", "MOUSEGUARD.Test.Note.DeeperUsed"], ["ofCourse", "MOUSEGUARD.Test.Note.OfCourseUsed"]]) {
        const id = record.used[key];
        if (!id) continue;
        const wise = actor?.items.get(id);
        notes.push(fmt(labelKey, { name: wise ? itemLabel(wise) : "?" }));
        if (wise && hasAllWiseMarks(wise)) notes.push(fmt("MOUSEGUARD.Test.Note.WiseInsight", { name: itemLabel(wise) }));
    }
    for (const helper of record.wiseHelpers ?? []) {
        notes.push(fmt("MOUSEGUARD.Test.Note.WiseHelper", { name: helper.name, actor: helper.actorName }));
    }

    const applied = record.applied ?? {};
    if (applied.learning) {
        const item = actor?.items.get(applied.learning.itemId);
        const name = item ? itemLabel(item) : record.label;
        notes.push(applied.learning.learned
            ? fmt("MOUSEGUARD.Test.Note.SkillLearned", { name })
            : fmt("MOUSEGUARD.Test.Note.LearningMark", { name, n: applied.learning.value, target: applied.learning.target }));
    }
    if (applied.advancement) {
        const item = actor?.items.get(applied.advancement.itemId);
        const name = item ? subjectLabel(actor, item) : record.label;
        notes.push(fmt(applied.advancement.mark === "passed" ? "MOUSEGUARD.Test.Note.MarkPassed" : "MOUSEGUARD.Test.Note.MarkFailed", { name }));
        if (applied.advancement.leveledUp) notes.push(fmt("MOUSEGUARD.Test.Note.Advanced", { name, value: applied.advancement.value }));
    } else if (record.markAdvancement && result.tie) {
        notes.push(loc("MOUSEGUARD.Test.Note.NoMarkTie"));
    }
    if (applied.tax?.amount) {
        notes.push(fmt("MOUSEGUARD.Test.Note.NatureTaxed", { n: applied.tax.amount, rating: applied.tax.rating, max: applied.tax.max }));
        if (applied.tax.rating <= 0) notes.push(loc("MOUSEGUARD.Test.Note.NatureZero"));
    }

    // Rules reminders for the table
    const hints = [];
    if (result.tie) hints.push(fmt("MOUSEGUARD.Test.Hint.Tie", { ability: abilityName(record.tiebreakerKey ?? "will") }));
    else if (!result.passed && (record.versus || record.ob > 0)) {
        hints.push(loc(record.recovery ? "MOUSEGUARD.Test.Hint.RecoveryFailed" : "MOUSEGUARD.Test.Hint.Failed"));
        if (record.helpers > 0 && !record.recovery) hints.push(loc("MOUSEGUARD.Test.Hint.HelpersShare"));
    }

    const context = {
        actorName: actor?.name ?? "",
        actorImg: actor?.img ?? "",
        title: record.label,
        kind: loc(kindKey),
        rollLabel: record.kind === "skill" || record.kind === "ability" ? "" : record.rollLabel,
        parts: record.parts,
        pool: record.pool,
        dice,
        outcomeClass,
        outcomeIcon: { success: "fa-check", failure: "fa-xmark" }[outcomeClass] ?? "fa-scale-balanced",
        outcomeLabel,
        heading,
        marginText,
        notes,
        hints,
        actions: availableActions(record, actor)
    };
    return foundry.applications.handlebars.renderTemplate(CARD_TEMPLATE, context);
}

/* -------------------------------------------- */
/*  Post-roll actions                           */
/* -------------------------------------------- */

const busy = new Set();

/** Ask which item to use (wise or trait). */
async function pickItem(items, { title, prompt }) {
    if (!items.length) return null;
    const options = items.map((i) => `<option value="${i.id}">${foundry.utils.escapeHTML(itemLabel(i))}</option>`).join("");
    const content = `<div class="mg-test-pick"><p>${prompt}</p><div class="form-group"><select name="itemId">${options}</select></div></div>`;
    const response = await foundry.applications.api.DialogV2.prompt({
        window: { title },
        classes: ["mg-test-pick-dialog"],
        content,
        rejectClose: false,
        ok: {
            label: loc("MOUSEGUARD.Test.Dialog.Confirm"),
            callback: (_event, button) => button.form.elements.itemId?.value ?? null
        }
    });
    return response ? items.find((i) => i.id === response) ?? null : null;
}

/**
 * Handle a post-roll button on a test chat card.
 * @param {ChatMessage} message
 * @param {string} action  fate | deeper | ofCourse | tieTrait | tiebreaker
 */
export async function handleCardAction(message, action) {
    const stored = message?.getFlag(SYSTEM_ID, "test");
    if (!stored) return;
    const record = foundry.utils.deepClone(stored);
    const actor = recordActor(record, message);
    if (!actor?.isOwner) {
        ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NotOwner"));
        return;
    }
    // Without a GM a card this user does not own cannot be updated: refuse before anything is spent.
    if (!message.isOwner && !game.users.activeGM) {
        ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoGM"));
        return;
    }
    if (busy.has(message.id)) return;
    busy.add(message.id);
    try {
        record.used ??= { fate: false, deeper: null, ofCourse: null, tieTrait: null, tiebreaker: false };
        record.spent ??= { persona: 0, fate: 0 };
        const allowed = availableActions(record, actor).some((a) => a.action === action);
        if (!allowed) {
            ui.notifications.warn(loc("MOUSEGUARD.Test.Error.ActionUnavailable"));
            return;
        }
        let nextId = record.dice.reduce((m, d) => Math.max(m, d.id), -1) + 1;
        const rewards = actor.system.rewards ?? {};

        if (action === "tiebreaker") {
            // The original card is marked only when the tiebreaker is actually rolled (see performTest).
            await actor.rollTest({ abilityKey: record.tiebreakerKey ?? "will", state: { versus: true, tiebreakerFor: message.uuid } });
            return;
        }

        if (action === "fate") {
            if (int(rewards.fate) < 1) return ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoFate"));
            await actor.update({ "system.rewards.fate": int(rewards.fate) - 1 });
            record.spent.fate += 1;
            record.used.fate = true;
            // Every unused axe gives a new die; new axes keep exploding (book p. 36, 93)
            let pending = record.dice.filter((d) => !d.replaced && d.r === 6 && !d.exploded);
            for (let guard = 0; pending.length && guard < 100; guard++) {
                for (const d of pending) d.exploded = true;
                const { roll, results } = await rollMouseDice(pending.length);
                await showDice(roll, message);
                const added = results.map((r) => ({ id: nextId++, r, src: "fate", replaced: false, exploded: false }));
                record.dice.push(...added);
                pending = added.filter((d) => d.r === 6);
            }
        }

        else if (action === "deeper" || action === "ofCourse") {
            const usedWises = [record.used.deeper, record.used.ofCourse].filter(Boolean);
            const wises = actor.itemTypes.wise.filter((w) => !usedWises.includes(w.id));
            const isDeeper = action === "deeper";
            const wise = await pickItem(wises, {
                title: loc(isDeeper ? "MOUSEGUARD.Test.Action.Deeper" : "MOUSEGUARD.Test.Action.OfCourse"),
                prompt: loc(isDeeper ? "MOUSEGUARD.Test.Dialog.PickWiseDeeper" : "MOUSEGUARD.Test.Dialog.PickWiseOfCourse")
            });
            if (!wise) return;
            const fresh = actor.system.rewards ?? {};
            if (isDeeper && int(fresh.fate) < 1) return ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoFate"));
            if (!isDeeper && int(fresh.persona) < 1) return ui.notifications.warn(loc("MOUSEGUARD.Test.Error.NoPersona"));
            // Deeper Understanding: one snake, never a rerolled or extra die (book p. 302-303).
            // Of Course!: every snake, before Fate is spent (book p. 303).
            const targets = isDeeper
                ? record.dice.filter((d) => !d.replaced && d.r <= 3 && d.src === "pool").slice(0, 1)
                : record.dice.filter((d) => !d.replaced && d.r <= 3 && d.src !== "fate");
            if (!targets.length) return ui.notifications.warn(loc("MOUSEGUARD.Test.Error.ActionUnavailable"));
            if (isDeeper) {
                await actor.update({ "system.rewards.fate": int(fresh.fate) - 1 });
                record.spent.fate += 1;
                record.used.deeper = wise.id;
            } else {
                await actor.update({ "system.rewards.persona": int(fresh.persona) - 1 });
                record.spent.persona += 1;
                record.used.ofCourse = wise.id;
            }
            await wise.update({ [`system.checks.${isDeeper ? "figuredOut" : "realized"}`]: true });
            const { roll, results } = await rollMouseDice(targets.length);
            await showDice(roll, message);
            targets.forEach((d, i) => {
                d.replaced = true;
                record.dice.push({ id: nextId++, r: results[i], src: action, replaced: false, exploded: false });
            });
        }

        else if (action === "tieTrait") {
            const traits = actor.itemTypes.trait.filter((t) => t.id !== record.traitFor?.id);
            const trait = await pickItem(traits, {
                title: loc("MOUSEGUARD.Test.Action.TieTrait"),
                prompt: loc("MOUSEGUARD.Test.Dialog.PickTraitTie")
            });
            if (!trait) return;
            await actor.useTrait(trait.id, "against", { checks: 2, notify: false });
            record.used.tieTrait = trait.id;
        }

        await applyConsequences(actor, record, { message });
        const content = await renderTestCard(record, actor);
        await updateAsOwner(message, { content, [`flags.${SYSTEM_ID}.test`]: record });
    } finally {
        busy.delete(message.id);
    }
}

/**
 * renderChatMessageHTML: wire the post-roll buttons of test cards for users who own the tested actor; hide them for
 * everyone else.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function onRenderChatMessage(message, html) {
    const record = message?.flags?.[SYSTEM_ID]?.test;
    if (!record || !(html instanceof HTMLElement)) return;
    const actor = recordActor(record, message);
    const canAct = !!actor?.isOwner;
    const bar = html.querySelector(".mg-test-card .mg-test-actions");
    if (!bar) return;
    if (!canAct) {
        bar.remove();
        return;
    }
    const buttons = [...bar.querySelectorAll("button[data-mg-action]")];
    const refresh = () => {
        const rewards = actor.system?.rewards ?? {};
        for (const button of buttons) {
            const action = button.dataset.mgAction;
            const noFate = (action === "fate" || action === "deeper") && int(rewards.fate) < 1;
            const noPersona = action === "ofCourse" && int(rewards.persona) < 1;
            button.disabled = noFate || noPersona;
            if (noFate) button.dataset.tooltip = loc("MOUSEGUARD.Test.Error.NoFate");
            else if (noPersona) button.dataset.tooltip = loc("MOUSEGUARD.Test.Error.NoPersona");
        }
    };
    refresh();
    for (const button of buttons) {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            buttons.forEach((b) => (b.disabled = true));
            try {
                await handleCardAction(message, button.dataset.mgAction);
            } catch (err) {
                console.error("Mouse Guard | Test action failed", err);
                ui.notifications.error(loc("MOUSEGUARD.Test.Error.ActionFailed"));
            } finally {
                refresh();
            }
        });
    }
}
