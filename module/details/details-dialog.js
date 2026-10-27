/**
 * Mouse Guard Details Dialog (ApplicationV2)
 *
 * Allows players and GMs to fill in or randomly generate character and NPC details
 * (Age, Rank/Role, Home, Fur color, Cloak, Parents, Senior Artisan, Mentor, Friend, Enemy, Belief, Goal, Instinct).
 */
import {
    HOMES,
    GUARD_RANKS,
    FUR_COLORS,
    CLOAK_COLORS,
    CRAFTS,
    NPC_ROLES,
    BELIEF_SAMPLES,
    GOAL_SAMPLES,
    INSTINCT_SAMPLES
} from "./details-data.js";
import {
    sample,
    sampleWeighted,
    randomName,
    generateCharacterDetails,
    generateNPCDetails
} from "./details-generator.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const TEMPLATE = "systems/mouseguard/templates/actor/dialog-fill-details.hbs";

/** Helper to check if a string or number value is considered "empty". */
function isEmptyValue(val) {
    if (val === null || val === undefined) return true;
    if (typeof val === "string") return val.trim() === "";
    if (typeof val === "number") return val <= 0;
    return false;
}

export class MouseGuardDetailsDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {object} options
     * @param {Actor} options.actor
     */
    constructor({ actor, ...options } = {}) {
        super({ id: MouseGuardDetailsDialog.idFor(actor), ...options });
        this.actor = actor;
        this.onlyEmpty = true;
        this.formState = MouseGuardDetailsDialog.getInitialState(this.actor);
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "mgs-details-dialog", "themed", "theme-light"],
        tag: "div",
        window: {
            title: "MOUSEGUARD.DetailsDialog.Title",
            icon: "fa-solid fa-feather-pointed",
            resizable: true
        },
        position: { width: 560, height: "auto" },
        actions: {
            generateAll: MouseGuardDetailsDialog.#onGenerateAll,
            randomizeField: MouseGuardDetailsDialog.#onRandomizeField,
            resetForm: MouseGuardDetailsDialog.#onResetForm,
            toggleKey: MouseGuardDetailsDialog.#onToggleKey,
            closeDialog: MouseGuardDetailsDialog.#onCloseDialog
        }
    };

    /** @override */
    static PARTS = {
        dialog: { template: TEMPLATE, scrollable: [".mgs-dialog-form"] }
    };

    /** Unique window ID per actor to avoid duplicate dialogs. */
    static idFor(actor) {
        return `mgs-details-${String(actor?.uuid ?? "none").replace(/[^A-Za-z0-9_-]/g, "-")}`;
    }

    /**
     * Open (or focus) the details dialog for an actor.
     * @param {Actor} actor
     * @returns {Promise<MouseGuardDetailsDialog>}
     */
    static async open(actor) {
        if (!actor) return null;
        if (!actor.isOwner) {
            ui.notifications.warn(game.i18n.localize("MOUSEGUARD.Test.Error.NotOwner"));
            return null;
        }

        const existing = foundry.applications.instances?.get(MouseGuardDetailsDialog.idFor(actor));
        if (existing instanceof MouseGuardDetailsDialog) {
            existing.formState = MouseGuardDetailsDialog.getInitialState(existing.actor);
            await existing.render({ force: true });
            existing.bringToFront?.();
            return existing;
        }

        const app = new MouseGuardDetailsDialog({ actor });
        await app.render({ force: true });
        return app;
    }

    /** @override */
    get title() {
        return game.i18n.format("MOUSEGUARD.DetailsDialog.TitleFor", { name: this.actor?.name ?? "" });
    }

    /**
     * Gather current actor values into a clean working state.
     * @param {Actor} actor
     * @returns {object}
     */
    static getInitialState(actor) {
        const system = actor?.system ?? {};
        const details = system.details ?? {};
        const isCharacter = actor?.type === "character";

        if (isCharacter) {
            const rewards = system.rewards ?? {};
            return {
                guard_rank: details.guard_rank || "Страж",
                home: details.home || "",
                age: details.age || 0,
                birth_year: details.birth_year || 0,
                fur_color: details.fur_color || "",
                cloak_color: details.cloak_color || "",
                parents: details.parents || "",
                senior_artisan: details.senior_artisan || "",
                mentor: details.mentor || "",
                friend: details.friend || "",
                enemy: details.enemy || "",
                belief: rewards.belief || "",
                goal: rewards.goal || "",
                instinct: rewards.instinct || ""
            };
        }

        // NPC (mouse)
        const motivation = system.motivation ?? {};
        return {
            role: details.role || "",
            home: details.home || "",
            age: details.age || 0,
            fur_color: details.fur_color || "",
            cloak_color: details.cloak_color || "",
            keyCharacter: Boolean(system.keyCharacter),
            belief: motivation.belief || "",
            goal: motivation.goal || "",
            instinct: motivation.instinct || ""
        };
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const isCharacter = this.actor.type === "character";

        // Flatten NPC roles for datalist
        const allNpcRoles = [
            ...NPC_ROLES.craftsmen,
            ...NPC_ROLES.guard,
            ...NPC_ROLES.special
        ];

        const isTenderfoot = isCharacter && (this.formState.guard_rank?.toLowerCase().includes("лапа помощи") || false);

        return {
            ...context,
            actor: this.actor,
            isCharacter,
            isNPC: !isCharacter,
            form: this.formState,
            onlyEmpty: this.onlyEmpty,
            isTenderfoot,
            ranks: GUARD_RANKS,
            homes: HOMES,
            furColors: FUR_COLORS,
            cloakColors: CLOAK_COLORS,
            crafts: CRAFTS,
            allNpcRoles,
            beliefs: BELIEF_SAMPLES,
            goals: GOAL_SAMPLES,
            instincts: INSTINCT_SAMPLES
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;

        // Sync inputs back to formState on change
        html.querySelectorAll("input, select").forEach((input) => {
            input.addEventListener("input", (e) => {
                const name = e.target.name;
                if (!name) return;
                if (name === "onlyEmpty") {
                    this.onlyEmpty = e.target.checked;
                    return;
                }
                if (name === "keyCharacter") {
                    this.formState.keyCharacter = e.target.checked;
                    return;
                }
                const val = e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value;
                this.formState[name] = val;
            });
        });

        // Form submit handler
        const form = html.querySelector("form.mgs-dialog-form");
        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                this.#handleFormSubmit();
            });
        }
    }

    /* -------------------------------------------- */
    /*  Action Handlers                             */
    /* -------------------------------------------- */

    /**
     * Generate all fields (or only empty fields if toggle is active).
     * @this {MouseGuardDetailsDialog}
     */
    static async #onGenerateAll(event) {
        event.preventDefault();
        const isCharacter = this.actor.type === "character";
        const overrides = {};

        // If onlyEmpty is active, preserve non-empty fields in formState
        if (this.onlyEmpty) {
            for (const [key, val] of Object.entries(this.formState)) {
                if (!isEmptyValue(val)) {
                    overrides[key] = val;
                }
            }
        }

        if (isCharacter) {
            const generated = generateCharacterDetails(overrides);
            Object.assign(this.formState, generated.details, generated.rewards);
        } else {
            const isKey = this.formState.keyCharacter;
            const generated = generateNPCDetails(overrides, isKey);
            Object.assign(this.formState, generated.details);
            if (generated.motivation) {
                Object.assign(this.formState, generated.motivation);
            }
        }

        this.render();
    }

    /**
     * Randomize a single specific field.
     * @this {MouseGuardDetailsDialog}
     */
    static async #onRandomizeField(event, target) {
        event.preventDefault();
        const field = target.dataset.field;
        if (!field) return;

        const isCharacter = this.actor.type === "character";

        switch (field) {
            case "guard_rank": {
                const rankObj = sample(GUARD_RANKS);
                this.formState.guard_rank = rankObj.name;
                // If Tenderfoot, clear cloak
                if (!rankObj.allowsCloak) this.formState.cloak_color = "";
                // If age out of rank bounds, adjust age
                if (this.formState.age < rankObj.minAge || this.formState.age > rankObj.maxAge) {
                    this.formState.age = Math.floor(Math.random() * (rankObj.maxAge - rankObj.minAge + 1)) + rankObj.minAge;
                    this.formState.birth_year = 1152 - this.formState.age;
                }
                break;
            }
            case "home":
                this.formState.home = sample(HOMES).name;
                break;
            case "age": {
                if (isCharacter) {
                    const r = GUARD_RANKS.find((item) => item.name === this.formState.guard_rank) ?? GUARD_RANKS[1];
                    this.formState.age = Math.floor(Math.random() * (r.maxAge - r.minAge + 1)) + r.minAge;
                } else {
                    this.formState.age = Math.floor(Math.random() * 35) + 18;
                }
                if (this.formState.birth_year) this.formState.birth_year = 1152 - this.formState.age;
                break;
            }
            case "birth_year": {
                const age = this.formState.age > 0 ? this.formState.age : 22;
                this.formState.birth_year = 1152 - age;
                break;
            }
            case "fur_color":
                this.formState.fur_color = sampleWeighted(FUR_COLORS);
                break;
            case "cloak_color": {
                const isTenderfoot = isCharacter && this.formState.guard_rank?.includes("Лапа помощи");
                if (isTenderfoot) {
                    this.formState.cloak_color = "";
                } else {
                    this.formState.cloak_color = sample(CLOAK_COLORS).name;
                }
                break;
            }
            case "parents": {
                const craft = sample(CRAFTS);
                const father = randomName("male");
                const mother = randomName("female");
                this.formState.parents = `${father} и ${mother} (${craft})`;
                break;
            }
            case "senior_artisan": {
                const craft = sample(CRAFTS);
                const name = randomName();
                this.formState.senior_artisan = `Мастер ${craft.toLowerCase()} ${name} (Локхэйвен)`;
                break;
            }
            case "mentor": {
                const name = randomName();
                const rank = sample(["Патрульный", "Лидер патруля", "Ветеран"]);
                this.formState.mentor = `${name} (${rank})`;
                break;
            }
            case "friend": {
                const fName = randomName();
                const fTown = sample(HOMES).name;
                const fCraft = sample(CRAFTS);
                this.formState.friend = `${fName}, ${fCraft.toLowerCase()} из г. ${fTown}`;
                break;
            }
            case "enemy": {
                const eName = randomName();
                const eTown = sample(HOMES).name;
                const reason = sample(["соперник на службе", "старая обида", "недоверие", "деловой спор"]);
                this.formState.enemy = `${eName} из г. ${eTown} (${reason})`;
                break;
            }
            case "belief":
                this.formState.belief = sample(BELIEF_SAMPLES);
                break;
            case "goal":
                this.formState.goal = sample(GOAL_SAMPLES);
                break;
            case "instinct":
                this.formState.instinct = sample(INSTINCT_SAMPLES);
                break;
            case "role": {
                const roll = Math.random();
                if (roll < 0.6) this.formState.role = sample(NPC_ROLES.craftsmen);
                else if (roll < 0.85) this.formState.role = sample(NPC_ROLES.guard);
                else this.formState.role = sample(NPC_ROLES.special);
                break;
            }
        }

        this.render();
    }

    /**
     * Reset form state to current database values.
     * @this {MouseGuardDetailsDialog}
     */
    static async #onResetForm(event) {
        event.preventDefault();
        this.formState = MouseGuardDetailsDialog.getInitialState(this.actor);
        this.render();
    }

    /**
     * Toggle key character for NPC.
     * @this {MouseGuardDetailsDialog}
     */
    static async #onToggleKey(_event, target) {
        this.formState.keyCharacter = target.checked;
        this.render();
    }

    /**
     * Close dialog without saving.
     * @this {MouseGuardDetailsDialog}
     */
    static async #onCloseDialog(event) {
        event.preventDefault();
        this.close();
    }

    /** Save updates to actor. */
    async #handleFormSubmit() {
        if (!this.actor?.isOwner) {
            ui.notifications.error(game.i18n.localize("MOUSEGUARD.Test.Error.NotOwner"));
            return;
        }

        const isCharacter = this.actor.type === "character";
        const currentSystem = this.actor.system ?? {};
        const currentDetails = currentSystem.details ?? {};
        const updateData = {};

        if (isCharacter) {
            const charKeys = [
                "guard_rank", "home", "age", "birth_year", "fur_color", "cloak_color",
                "parents", "senior_artisan", "mentor", "friend", "enemy"
            ];

            for (const key of charKeys) {
                const currentVal = currentDetails[key];
                const newVal = this.formState[key];
                if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
                if (newVal !== undefined && newVal !== currentVal) {
                    updateData[`system.details.${key}`] = newVal;
                }
            }

            const currentRewards = currentSystem.rewards ?? {};
            const rewardKeys = ["belief", "goal", "instinct"];
            for (const key of rewardKeys) {
                const currentVal = currentRewards[key];
                const newVal = this.formState[key];
                if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
                if (newVal !== undefined && newVal !== currentVal) {
                    updateData[`system.rewards.${key}`] = newVal;
                }
            }
        } else {
            // NPC (mouse)
            const npcKeys = ["role", "home", "age", "fur_color", "cloak_color"];
            for (const key of npcKeys) {
                const currentVal = currentDetails[key];
                const newVal = this.formState[key];
                if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
                if (newVal !== undefined && newVal !== currentVal) {
                    updateData[`system.details.${key}`] = newVal;
                }
            }

            if (this.formState.keyCharacter !== undefined && this.formState.keyCharacter !== currentSystem.keyCharacter) {
                updateData["system.keyCharacter"] = Boolean(this.formState.keyCharacter);
            }

            if (this.formState.keyCharacter) {
                const currentMotivation = currentSystem.motivation ?? {};
                const motKeys = ["belief", "goal", "instinct"];
                for (const key of motKeys) {
                    const currentVal = currentMotivation[key];
                    const newVal = this.formState[key];
                    if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
                    if (newVal !== undefined && newVal !== currentVal) {
                        updateData[`system.motivation.${key}`] = newVal;
                    }
                }
            }
        }

        if (foundry.utils.isEmpty(updateData)) {
            ui.notifications.info(game.i18n.localize("MOUSEGUARD.DetailsDialog.NoChanges"));
            this.close();
            return;
        }

        try {
            await this.actor.update(updateData);
            ui.notifications.info(
                game.i18n.format("MOUSEGUARD.DetailsDialog.SuccessApplied", { name: this.actor.name })
            );
            this.close();
        } catch (err) {
            console.error("Mouse Guard | Error updating actor details:", err);
            ui.notifications.error(game.i18n.localize("MOUSEGUARD.DetailsDialog.ErrorUpdate"));
        }
    }
}
