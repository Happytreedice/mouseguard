/**
 * Custom Combatant implementation for Mouse Guard conflicts.
 * @extends {Combatant}
 */
export default class MouseCombatant extends Combatant {
    get ConflictCaptain() {
        return this.getFlag("mouseguard", "ConflictCaptain") ?? false;
    }

    get team() {
        return this.getFlag("mouseguard", "Team") ?? "0";
    }

    async setConflictCaptain(value) {
        return this.setFlag("mouseguard", "ConflictCaptain", value);
    }

    async SetMove(move) {
        return this.setFlag("mouseguard", "Moves", move);
    }

    async setTeam(value) {
        return this.setFlag("mouseguard", "Team", String(value));
    }

    /** @inheritDoc */
    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if (allowed === false) return false;

        let init = 0;
        const actor = this.actor ?? game.actors.get(data.actorId);
        if (actor?.type === "character") init = 1;

        this.updateSource({
            initiative: init,
            flags: {
                mouseguard: {
                    ConflictCaptain: false,
                    Moves: [],
                    Team: "0"
                }
            }
        });
        return allowed;
    }

    async doMove(id) {
        const moves = this.getFlag("mouseguard", "Moves") || [];
        const theMove = moves.find((item) => item.id == id);
        if (!theMove) return;

        const template = "systems/mouseguard/templates/chat/combat-action.hbs";
        const data = { actor: this.actor, move: theMove.move };
        const content = await foundry.applications.handlebars.renderTemplate(template, data);

        const chatData = {
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content,
            flags: {
                mouseguard: {
                    unflipped: true
                }
            }
        };
        await ChatMessage.create(chatData);

        const otherMoves = moves.filter((item) => item.id != id);
        await this.SetMove(otherMoves);
    }
}
