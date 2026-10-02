/**
 * Socket and Dialog Handler for Mouse Guard Conflict resolution.
 * Uses modern foundry.applications.api.DialogV2 and foundry.utils.
 */
export default class MouseSocket {
    static async askGoal(data) {
        const htmlContent = await foundry.applications.handlebars.renderTemplate(
            "systems/mouseguard/templates/parts/conflict-manager.hbs",
            data
        );

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                title: "Conflict Manager"
            },
            content: htmlContent,
            buttons: [
                {
                    action: "ok",
                    label: "Apply",
                    default: true,
                    callback: (event, button, dialog) => {
                        const form = dialog.element.querySelector("form") ?? dialog.element;
                        const conflictGoal = form.querySelector("#conflict_goal")?.value ?? "";
                        const combatId = data.combat?.id ?? data.combat?._id ?? data.combat;

                        const goalData = {
                            action: "setGoal",
                            combat: combatId,
                            goal: conflictGoal,
                            team: data.team
                        };

                        if (game.user.isGM) {
                            this.setGoal(goalData);
                        } else {
                            game.socket.emit("system.mouseguard", goalData);
                        }
                    }
                },
                {
                    action: "cancel",
                    label: "Cancel"
                }
            ]
        });

        dialog.render(true);
    }

    static async setGoal(data) {
        if (game.user.isGM) {
            const combatId = data.combat?.id ?? data.combat?._id ?? data.combat;
            const combat = game.combats.get(combatId);
            if (combat) {
                await combat.setGoal(data.goal, data.team);
            }
        }
    }

    static async askMoves(data) {
        const htmlContent = await foundry.applications.handlebars.renderTemplate(
            "systems/mouseguard/templates/parts/conflict-move-manager.hbs",
            data
        );

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                title: "Conflict Manager"
            },
            content: htmlContent,
            buttons: [
                {
                    action: "ok",
                    label: game.i18n.localize("MOUSEGUARD.Send"),
                    default: true,
                    callback: async (event, button, dialog) => {
                        const element = dialog.element;
                        const move1Actor = element.querySelector("#move0-actor")?.value;
                        const move1Move = element.querySelector(".move0:checked")?.value;
                        const move2Actor = element.querySelector("#move1-actor")?.value;
                        const move2Move = element.querySelector(".move1:checked")?.value;
                        const move3Actor = element.querySelector("#move2-actor")?.value;
                        const move3Move = element.querySelector(".move2:checked")?.value;

                        if (!move1Move || !move2Move || !move3Move || !move1Actor || !move2Actor || !move3Actor) {
                            ui.notifications.error(
                                "An error occurred while setting your moves. Please select new moves."
                            );
                            this.askMoves(data);
                            return;
                        }

                        const combatantData = {
                            [move1Actor]: [],
                            [move2Actor]: [],
                            [move3Actor]: []
                        };

                        combatantData[move1Actor].push({
                            id: foundry.utils.randomID(),
                            move: move1Move,
                            combatant: move1Actor
                        });
                        combatantData[move2Actor].push({
                            id: foundry.utils.randomID(),
                            move: move2Move,
                            combatant: move2Actor
                        });
                        combatantData[move3Actor].push({
                            id: foundry.utils.randomID(),
                            move: move3Move,
                            combatant: move3Actor
                        });

                        const combatId = data.combat?.id ?? data.combat?._id ?? (typeof data.combat === "string" ? data.combat : null);
                        const moveData = {
                            action: "setMoves",
                            combat: combatId,
                            data: combatantData
                        };

                        if (game.user.isGM) {
                            this.setMoves(moveData);
                        } else {
                            await game.socket.emit("system.mouseguard", moveData);
                        }
                    }
                },
                {
                    action: "cancel",
                    label: "Cancel"
                }
            ]
        });

        dialog.render(true);
    }

    static async setMoves(data) {
        if (game.user.isGM) {
            const combatId = data.combat?.id ?? data.combat?._id ?? data.combat;
            const combat = game.combats.get(combatId);
            if (!combat) return;

            for (const key of Object.keys(data.data)) {
                const combatant = combat.combatants.get(key);
                if (combatant) {
                    await combatant.setFlag("mouseguard", "Moves", data.data[key]);
                }
            }
        }
    }
}
