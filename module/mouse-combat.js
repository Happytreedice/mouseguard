import MouseSocket from "./socket.js";

/**
 * Specialized Combat class for Mouse Guard conflicts.
 * @extends {Combat}
 */
export default class MouseCombat extends Combat {
    get getGoal1() {
        return this.getFlag("mouseguard", "goal1");
    }

    get getGoal2() {
        return this.getFlag("mouseguard", "goal2");
    }

    get getConflictCaptain() {
        return this.getFlag("mouseguard", "ConflictCaptain");
    }

    get getConflictCaptainTeam2() {
        return this.getFlag("mouseguard", "ConflictCaptain2");
    }

    async setConflictCaptain(value) {
        return this.setFlag("mouseguard", "ConflictCaptain", value);
    }

    async setConflictCaptainTeam2(value) {
        return this.setFlag("mouseguard", "ConflictCaptain2", value);
    }

    /** @inheritDoc */
    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if (allowed === false) return false;

        this.updateSource({
            flags: {
                mouseguard: {
                    ConflictCaptain: null,
                    ConflictCaptain2: null,
                    goal1: null,
                    goal2: null,
                    team1Move: null,
                    team2Move: null
                }
            }
        });
        return allowed;
    }

    async startCombat() {
        const goal = this.getFlag("mouseguard", "goal1");
        const goal2 = this.getFlag("mouseguard", "goal2");
        const CC = this.getFlag("mouseguard", "ConflictCaptain");
        const CC2 = this.getFlag("mouseguard", "ConflictCaptain2");

        if (!CC) {
            ui.notifications.error(game.i18n.localize("COMBAT.NeedCC"));
            return false;
        }
        if (!goal) {
            ui.notifications.error(game.i18n.localize("COMBAT.NeedGoal"));
            await this.askGoal();
            return false;
        }

        if (!goal2) {
            ui.notifications.error(game.i18n.localize("COMBAT.NeedGoal"));
            await this.askGoal();
            return false;
        }

        if (goal && goal2 && CC && CC2) {
            await this.askMove();
            return this.update({ round: 1, turn: 0 });
        }
        return false;
    }

    getCCPlayerByID(conflictCaptainID) {
        const combatant = this.combatants.get(conflictCaptainID);
        if (!combatant) return game.users.activeGM;
        const actor = combatant.actor ?? game.actors.get(combatant.actorId);
        if (!actor) return game.users.activeGM;

        return (
            game.users.filter(
                (u) => !u.isGM && u.active && actor.testUserPermission(u, "OWNER")
            )?.[0] ?? game.users.activeGM
        );
    }

    async askGoal() {
        const CC = this.getFlag("mouseguard", "ConflictCaptain");
        const CC2 = this.getFlag("mouseguard", "ConflictCaptain2");

        if (!CC) {
            ui.notifications.error("A Conflict Captain Must be set for team 1");
            return false;
        }

        if (!CC2) {
            ui.notifications.error("A Conflict Captain Must be set for team 2");
            return false;
        }

        const player = this.getCCPlayerByID(CC);
        if (player) {
            await game.socket.emit(
                "system.mouseguard",
                { action: "askGoal", combat: this.id, team: "1" },
                { recipients: [player.id] }
            );
        }

        const player2 = this.getCCPlayerByID(CC2);
        if (player2) {
            await game.socket.emit(
                "system.mouseguard",
                { action: "askGoal", combat: this.id, team: "2" },
                { recipients: [player2.id] }
            );
        }
    }

    async setGoal(goal, team) {
        await this.setFlag("mouseguard", "goal" + team, goal);
        await this.startCombat();
        return true;
    }

    async askMove() {
        const CC = this.getFlag("mouseguard", "ConflictCaptain");
        const CC2 = this.getFlag("mouseguard", "ConflictCaptain2");

        if (!CC) {
            ui.notifications.error(game.i18n.localize("COMBAT.NeedCC"));
            return false;
        }

        const data = { combat: this.id };
        const team1 = [];
        const team2 = [];

        // Team 1
        const combatants = this.combatants.filter((comb) => comb.team === "1" || comb.team === 1);
        for (const comb of combatants) {
            team1.push({
                combatant: comb.id,
                name: comb.name ?? comb.token?.name
            });
        }

        data.actors = team1;
        data.action = "askMoves";

        const player = this.getCCPlayerByID(CC);
        if (player) {
            await game.socket.emit("system.mouseguard", data, {
                recipients: [player.id]
            });
        }

        const player2 = this.getCCPlayerByID(CC2);
        const data2 = { ...data };
        if (!player2 || player2.isGM) {
            data2.npc = true;
        }

        // Team 2
        const team2combatants = this.combatants.filter((comb) => comb.team === "2" || comb.team === 2);
        for (const comb of team2combatants) {
            team2.push({
                combatant: comb.id,
                name: comb.name ?? comb.token?.name
            });
        }

        data2.actors = team2;
        if (player2) {
            await game.socket.emit("system.mouseguard", data2, {
                recipients: [player2.id]
            });
        }
    }

    async askNPCMove(data) {
        await MouseSocket.askMoves(data);
    }

    /** @override */
    async nextRound() {
        await this.askMove();
        return super.nextRound();
    }
}
