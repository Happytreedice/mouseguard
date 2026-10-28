import MouseSocket from "./socket.js";

/**
 * Modern ApplicationV2 Combat Tracker for Mouse Guard conflicts.
 * Supports teams (Team 1, Team 2, Unassigned), Conflict Captains, and Combat Moves.
 * @extends {foundry.applications.sidebar.tabs.CombatTracker}
 */
const CombatTracker = foundry.applications.sidebar.tabs.CombatTracker;

export default class MouseCombatTracker extends CombatTracker {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        actions: {
            askMove: MouseCombatTracker.#onAskMove,
            askGoal: MouseCombatTracker.#onAskGoal,
            askDisposition: MouseCombatTracker.#onAskDisposition,
            adjustDisposition: MouseCombatTracker.#onAdjustDisposition,
            setDisposition: MouseCombatTracker.#onSetDisposition,
            doMove: MouseCombatTracker.#onDoMove
        }
    };

    /** @override */
    static PARTS = {
        header: {
            template: "systems/mouseguard/templates/sidebar/tabs/combat/header.hbs"
        },
        tracker: {
            template: "systems/mouseguard/templates/sidebar/tabs/combat/tracker.hbs",
            scrollable: [""]
        },
        footer: {
            template: "templates/sidebar/tabs/combat/footer.hbs"
        }
    };

    /* -------------------------------------------- */
    /*  Context Preparation                         */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareTurnContext(combat, combatant, index) {
        const turn = await super._prepareTurnContext(combat, combatant, index);
        turn.team = combatant.team || "0";
        turn.isConflictCaptain = !!combatant.ConflictCaptain;
        turn.moves = combatant.getFlag("mouseguard", "Moves") || [];
        turn.isFirstOwner = this.isFirstOwner(combatant.actor);
        turn.hasPlayerOwner = this.hasPlayerOwner(combatant.actor);
        return turn;
    }

    /** @inheritDoc */
    async _prepareTrackerContext(context, options) {
        await super._prepareTrackerContext(context, options);
        const combat = this.viewed;
        const turns = context.turns || [];

        const dispo1 = combat?.getDisposition?.("1") || combat?.getFlag("mouseguard", "disposition1") || null;
        const dispo2 = combat?.getDisposition?.("2") || combat?.getFlag("mouseguard", "disposition2") || null;

        const cc1Id = combat?.getFlag("mouseguard", "ConflictCaptain");
        const cc2Id = combat?.getFlag("mouseguard", "ConflictCaptain2");

        const cc1Combatant = cc1Id ? combat?.combatants.get(cc1Id) : null;
        const cc2Combatant = cc2Id ? combat?.combatants.get(cc2Id) : null;

        const canAdjustTeam1 = game.user.isGM || Boolean(cc1Combatant?.actor?.isOwner);
        const canAdjustTeam2 = game.user.isGM || Boolean(cc2Combatant?.actor?.isOwner);

        context.teams = {
            team1: {
                id: "1",
                label: game.i18n.localize("COMBAT.Team1"),
                goal: combat?.getFlag("mouseguard", "goal1") || game.i18n.localize("COMBAT.NoGoal"),
                disposition: dispo1,
                hasDisposition: Boolean(dispo1 && dispo1.starting > 0),
                canAdjust: canAdjustTeam1,
                isZero: Boolean(dispo1 && dispo1.starting > 0 && dispo1.current === 0),
                turns: turns.filter((t) => t.team === "1" || t.team === 1)
            },
            team2: {
                id: "2",
                label: game.i18n.localize("COMBAT.Team2"),
                goal: combat?.getFlag("mouseguard", "goal2") || game.i18n.localize("COMBAT.NoGoal"),
                disposition: dispo2,
                hasDisposition: Boolean(dispo2 && dispo2.starting > 0),
                canAdjust: canAdjustTeam2,
                isZero: Boolean(dispo2 && dispo2.starting > 0 && dispo2.current === 0),
                turns: turns.filter((t) => t.team === "2" || t.team === 2)
            },
            team0: {
                id: "0",
                label: game.i18n.localize("COMBAT.Team0"),
                goal: null,
                disposition: null,
                hasDisposition: false,
                canAdjust: false,
                isZero: false,
                turns: turns.filter((t) => !t.team || t.team === "0" || t.team === 0)
            }
        };
    }

    /* -------------------------------------------- */
    /*  Context Menu                                */
    /* -------------------------------------------- */

    /** @inheritDoc */
    _getEntryContextOptions() {
        const entries = super._getEntryContextOptions();

        entries.unshift({
            label: "COMBAT.ConflictCaptain",
            icon: "fa-solid fa-crown",
            visible: () => game.user.isGM,
            onClick: async (event, li) => {
                const combatantId = li.dataset.combatantId;
                const combatant = this.viewed?.combatants.get(combatantId);
                if (!combatant) return;

                const team = combatant.team;
                if (!team || team === "0") {
                    ui.notifications.warn(game.i18n.localize("MOUSEGUARD.Conflict.AssignTeamFirst"));
                    return;
                }

                const flagKey = (team === "2" || team === 2) ? "ConflictCaptain2" : "ConflictCaptain";
                const currentCaptainId = this.viewed.getFlag("mouseguard", flagKey);

                if (currentCaptainId === combatant.id) {
                    await this.viewed.setFlag("mouseguard", flagKey, null);
                    await combatant.setConflictCaptain(false);
                } else if (!currentCaptainId) {
                    await this.viewed.setFlag("mouseguard", flagKey, combatant.id);
                    await combatant.setConflictCaptain(true);
                } else {
                    ui.notifications.error(game.i18n.localize("COMBAT.CCSet"));
                }
            }
        });

        return entries;
    }

    /* -------------------------------------------- */
    /*  Drag and Drop                               */
    /* -------------------------------------------- */

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        if (game.user.isGM) {
            this.element.querySelectorAll(".combatant[draggable='true']").forEach((li) => {
                li.addEventListener("dragstart", this.#onDragStart.bind(this));
            });

            this.element.querySelectorAll("[data-team]").forEach((el) => {
                el.addEventListener("dragover", (event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                });
                el.addEventListener("drop", this.#onDropTeam.bind(this));
            });
        }
    }

    #onDragStart(event) {
        const li = event.currentTarget.closest(".combatant");
        if (!li) return;
        const combatant = this.viewed?.combatants.get(li.dataset.combatantId);
        if (!combatant) return;

        if (combatant.ConflictCaptain) {
            ui.notifications.error(game.i18n.localize("COMBAT.CCERROR"));
            event.preventDefault();
            return;
        }

        event.dataTransfer.setData("text/plain", JSON.stringify({ id: combatant.id }));
    }

    async #onDropTeam(event) {
        event.preventDefault();
        event.stopPropagation();

        const raw = event.dataTransfer?.getData("text/plain");
        if (!raw) return;

        try {
            const data = JSON.parse(raw);
            if (!data.id) return;
            const targetEl = event.target.closest("[data-team]");
            const targetTeam = targetEl?.dataset.team;
            if (targetTeam === undefined) return;

            const combatant = this.viewed?.combatants.get(data.id);
            if (combatant) {
                await combatant.setTeam(targetTeam);
            }
        } catch (err) {
            console.error("MouseGuard | Error during team drop", err);
        }
    }

    /* -------------------------------------------- */
    /*  Action Handlers                             */
    /* -------------------------------------------- */

    static async #onAskMove() {
        await this.viewed?.askMove();
    }

    static async #onAskGoal() {
        await this.viewed?.askGoal();
    }

    static async #onAskDisposition(_event, target) {
        const team = target.dataset.team;
        await this.viewed?.askDisposition(team);
    }

    static async #onAdjustDisposition(event, target) {
        event.preventDefault();
        event.stopPropagation();
        const team = target.dataset.team;
        const delta = parseInt(target.dataset.delta, 10) || 0;
        if (!team || !delta || !this.viewed) return;
        await MouseSocket.requestAdjustDisposition(this.viewed.id, team, delta);
    }

    static async #onSetDisposition(event, target) {
        event.preventDefault();
        event.stopPropagation();
        const team = target.dataset.team;
        if (!team || !this.viewed) return;
        await MouseSocket.askDisposition({ combat: this.viewed, team });
    }

    static async #onDoMove(event, target) {
        const combatantId = target.dataset.combatantId;
        const moveId = target.dataset.moveId;
        const combatant = this.viewed?.combatants.get(combatantId);
        if (combatant) {
            await combatant.doMove(moveId);
        }
    }

    /* -------------------------------------------- */
    /*  Helper Methods                              */
    /* -------------------------------------------- */

    firstOwner(doc) {
        if (!doc) return null;
        const owners = Object.entries(doc.ownership || {})
            .filter(([, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
            .map(([id]) => game.users.get(id))
            .filter((u) => u && u.active);

        const playerOwner = owners.find((u) => !u.isGM);
        return playerOwner ?? owners.find((u) => u.isGM) ?? null;
    }

    isFirstOwner(doc) {
        const owner = this.firstOwner(doc);
        return owner?.id === game.user.id;
    }

    hasPlayerOwner(doc) {
        if (!doc) return false;
        return Object.entries(doc.ownership || {}).some(([id, level]) => {
            const u = game.users.get(id);
            return u && !u.isGM && u.active && level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        });
    }
}
