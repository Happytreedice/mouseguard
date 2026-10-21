/**
 * The Test dialog: builds a Mouse Guard dice pool step by step (layout of the mist-engine "Detailed Dice Roll" app:
 * parchment body, pill list of the pool, steppers, ruled sub-headings, live summary and a full-width roll button).
 */
import { ABILITY_ORDER, itemLabel } from "./labels.js";
import { LIMITS, computeTest, defaultTestState, listSubjects, subjectLabel, traitAvailableFor } from "./pool.js";
import { DIALOG_TEMPLATE, defaultMarkAdvancement, defaultMessageMode, getLastOb, messageModeChoices, performTest } from "./test.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const loc = (key) => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const int = (value, fallback = 0) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
};

const NUMBER_FIELDS = new Set(["ob", "opponent", "helpers", "wiseHelp", "persona", "modifier"]);
const BOOLEAN_FIELDS = new Set(["natureInstead", "recovery", "versus", "gear", "supplies", "homeTown", "contact", "tapNature", "inNature", "markAdvancement"]);

export class MouseGuardTestDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    /** Has the user set the "mark advancement" box explicitly? Until then it follows the default. */
    _markTouched = false;

    /**
     * @param {object} options
     * @param {Actor} options.actor
     * @param {string} [options.subjectId]
     * @param {object} [options.state]
     */
    /** True while a submitted test is being rolled and applied (guards against double submits). */
    #rolling = false;

    constructor({ actor, subjectId = "", state = {}, ...options } = {}) {
        super({ id: MouseGuardTestDialog.idFor(actor), ...options });
        this.actor = actor;
        this.testState = defaultTestState(actor, { ob: getLastOb(actor), messageMode: defaultMessageMode() });
        this.#setSubject(subjectId, state);
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["mg-test-dialog", "themed", "theme-light"],
        tag: "form",
        window: { title: "MOUSEGUARD.Test.Dialog.Title", icon: "fa-solid fa-dice-d6", resizable: true },
        position: { width: 460, height: "auto" },
        form: { handler: MouseGuardTestDialog.#onSubmit, submitOnChange: false, closeOnSubmit: false },
        actions: {
            step: MouseGuardTestDialog.#onStep,
            cancel: MouseGuardTestDialog.#onCancel
        }
    };

    /** @override */
    static PARTS = {
        form: { template: DIALOG_TEMPLATE, scrollable: [".mg-test-body"] }
    };

    /** One dialog per actor (token actors included), so several players can roll at once. */
    static idFor(actor) {
        return `mg-test-${String(actor?.uuid ?? "none").replace(/[^A-Za-z0-9_-]/g, "-")}`;
    }

    /**
     * Open (or refocus) the dialog of an actor.
     * @param {Actor} actor
     * @param {{subjectId?: string, state?: object}} [options]
     * @returns {Promise<MouseGuardTestDialog>}
     */
    static async open(actor, { subjectId = "", state = {} } = {}) {
        const existing = foundry.applications.instances?.get(MouseGuardTestDialog.idFor(actor));
        if (existing instanceof MouseGuardTestDialog) {
            existing.#setSubject(subjectId || existing.testState.subjectId, state);
            await existing.render({ force: true });
            existing.bringToFront?.();
            return existing;
        }
        const app = new MouseGuardTestDialog({ actor, subjectId, state });
        await app.render({ force: true });
        return app;
    }

    /** @override */
    get title() {
        return fmt("MOUSEGUARD.Test.Dialog.TitleFor", { name: this.actor?.name ?? "" });
    }

    /** Select what is tested and reset the options that depend on it. */
    #setSubject(subjectId, preset = {}) {
        const changed = subjectId !== this.testState.subjectId;
        this.testState.subjectId = subjectId ?? "";
        if (changed) {
            const subject = this.actor.items.get(this.testState.subjectId);
            Object.assign(this.testState, {
                natureInstead: false,
                recovery: false,
                tapNature: false,
                inNature: subject?.type === "ability" && subject.system.key === "nature",
                homeTown: false,
                contact: false
            });
        }
        Object.assign(this.testState, preset);
        if (typeof preset.markAdvancement === "boolean") this._markTouched = true;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;
        const state = this.testState;
        const ctx = computeTest(actor, state);
        const { abilities, skills } = listSubjects(actor);
        const option = (item) => {
            const rating = item.type === "skill" ? int(item.system.rank) : int(item.system.rating);
            const suffix = item.type === "skill" && rating <= 0
                ? loc("MOUSEGUARD.Test.Dialog.Untrained")
                : String(rating);
            return { value: item.id, label: `${subjectLabel(actor, item)} (${suffix})`, selected: item.id === state.subjectId };
        };

        const traits = actor.itemTypes.trait ?? [];
        const traitOption = (trait, mode) => {
            const level = int(trait.system.level, 1);
            const spent = mode === "for" && !traitAvailableFor(trait);
            const key = level >= 3 ? "MOUSEGUARD.Test.Dialog.TraitLevel3" : "MOUSEGUARD.Test.Dialog.TraitLevel";
            const label = `${itemLabel(trait)} — ${fmt(key, { level, used: int(trait.system.usedFor) })}`;
            return {
                value: trait.id,
                label: spent ? `${label} — ${loc("MOUSEGUARD.Test.Dialog.TraitSpent")}` : label,
                disabled: spent || (mode === "against" && trait.id === state.traitFor) || (mode === "for" && trait.id === state.traitAgainst),
                selected: mode === "for" ? trait.id === state.traitFor : trait.id === state.traitAgainst
            };
        };

        // "I Know!": wises of other player characters this user can see (book p. 302)
        const wiseHelpers = [];
        for (const other of game.actors ?? []) {
            if (other.type !== "character" || other.id === actor.id || !other.testUserPermission(game.user, "OBSERVER")) continue;
            for (const wise of other.itemTypes.wise ?? []) {
                wiseHelpers.push({
                    uuid: wise.uuid,
                    label: `${itemLabel(wise)} (${other.name})`,
                    checked: state.wiseHelpers.includes(wise.uuid)
                });
            }
        }

        const markAdvancement = state.markAdvancement ?? defaultMarkAdvancement(actor, state);
        const rewards = actor.system.rewards ?? null;
        const summaryKey = state.versus ? "MOUSEGUARD.Test.Dialog.SummaryVersus" : "MOUSEGUARD.Test.Dialog.Summary";
        const isNatureSubject = ctx.kind === "ability" && ctx.rollKey === "nature";

        return Object.assign(context, {
            actor,
            state,
            ctx,
            subjectGroups: [
                { label: loc("MOUSEGUARD.Abilities"), options: abilities.map(option) },
                { label: loc("MOUSEGUARD.Skills"), options: skills.map(option) }
            ].filter((g) => g.options.length),
            hasSubject: !!ctx.subject,
            kindLabel: ctx.kind ? loc({
                skill: "MOUSEGUARD.Test.Kind.Skill",
                ability: "MOUSEGUARD.Test.Kind.Ability",
                beginnersLuck: "MOUSEGUARD.Test.Kind.BeginnersLuck",
                natureInstead: "MOUSEGUARD.Test.Kind.NatureInstead"
            }[ctx.kind]) : "",
            beginnersLuckHint: ctx.kind === "beginnersLuck"
                ? fmt("MOUSEGUARD.Test.Dialog.BeginnersLuckHint", {
                    ability: loc(ctx.beginnersLuck === "health" ? "MOUSEGUARD.Health" : "MOUSEGUARD.Will"),
                    n: int(ctx.subject?.system?.learning)
                })
                : "",
            parts: ctx.parts.map((p) => ({ ...p, cls: p.kind === "negative" ? "negative" : p.kind === "neutral" ? "neutral" : "positive" })),
            traitsFor: traits.map((t) => traitOption(t, "for")),
            traitsAgainst: traits.map((t) => traitOption(t, "against")),
            hasTraits: traits.length > 0,
            wiseHelpers,
            hasRewards: !!rewards,
            personaAvailable: int(rewards?.persona),
            personaMax: Math.max(0, ctx.personaBudget - (ctx.tapNature ? 1 : 0)),
            showInNature: ctx.tapNature || ctx.natureTest,
            againstSelf: state.againstMode !== "opponent" || !state.versus,
            againstOpponent: state.againstMode === "opponent" && !!state.versus,
            isNatureSubject,
            showHomeTown: ctx.resCirc,
            showContact: ctx.resCirc && ctx.rollKey === "circles",
            markAdvancement,
            canMark: !!ctx.testedItem,
            messageModes: messageModeChoices().map((m) => ({ ...m, selected: m.value === (state.messageMode || defaultMessageMode()) })),
            limits: LIMITS,
            summary: fmt(summaryKey, { dice: ctx.dice, ob: int(state.ob), opponent: int(state.opponent) })
                + (ctx.bonusSuccesses ? ` ${loc("MOUSEGUARD.Test.Part.PlusSuccess")}` : ""),
            canRoll: !ctx.blocked
        });
    }

    /* -------------------------------------------- */
    /*  Form handling                               */
    /* -------------------------------------------- */

    /** Copy the form values into the dialog state. */
    #readForm() {
        const form = this.element;
        if (!form) return;
        const state = this.testState;
        const wiseHelpers = [];
        for (const el of form.querySelectorAll("[name]")) {
            const name = el.name;
            if (name === "wiseHelpers") {
                if (el.checked) wiseHelpers.push(el.value);
                continue;
            }
            if (el.type === "radio" && !el.checked) continue;
            if (BOOLEAN_FIELDS.has(name)) state[name] = !!el.checked;
            else if (NUMBER_FIELDS.has(name)) state[name] = int(el.value);
            else state[name] = el.value;
        }
        state.wiseHelpers = wiseHelpers;
    }

    /** @override */
    _onChangeForm(formConfig, event) {
        super._onChangeForm(formConfig, event);
        const name = event.target?.name;
        const previousSubject = this.testState.subjectId;
        this.#readForm();
        if (name === "markAdvancement") this._markTouched = true;
        if (!this._markTouched) this.testState.markAdvancement = null;     // follow the default (setting, Ob > 0) until touched
        if (name === "subjectId" && this.testState.subjectId !== previousSubject) {
            const next = this.testState.subjectId;
            this.testState.subjectId = previousSubject;
            this.#setSubject(next);
        }
        this.render();
    }

    /**
     * Stepper buttons: <button data-action="step" data-field="helpers" data-delta="1">.
     * @this {MouseGuardTestDialog}
     */
    static #onStep(event, target) {
        this.#readForm();
        if (!this._markTouched) this.testState.markAdvancement = null;
        const field = target.dataset.field;
        const [min, max] = LIMITS[field] ?? [0, 10];
        this.testState[field] = Math.clamp(int(this.testState[field]) + int(target.dataset.delta, 1), min, max);
        this.render();
    }

    /** @this {MouseGuardTestDialog} */
    static #onCancel() {
        this.close();
    }

    /**
     * Roll.
     * @this {MouseGuardTestDialog}
     */
    static async #onSubmit(event) {
        event?.preventDefault?.();
        // A double click or Enter+click would otherwise roll twice and spend persona/traits twice.
        if (this.#rolling) return;
        this.#rolling = true;
        const button = this.element?.querySelector("button[type=submit]");
        if (button) button.disabled = true;
        let message = null;
        try {
            this.#readForm();
            if (!this._markTouched) this.testState.markAdvancement = null;
            message = await performTest(this.actor, { ...this.testState });
        } finally {
            this.#rolling = false;
        }
        if (message) await this.close();
        else if (this.rendered) this.render();
    }
}

/** Ability keys exposed for templates/macros. */
MouseGuardTestDialog.ABILITY_KEYS = ABILITY_ORDER;
