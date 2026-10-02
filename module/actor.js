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
        this._prepareCharacterData();
    }

    _prepareCharacterData() {
        this.system.itemTypes = this.itemTypes;
    }

    /** @inheritdoc */
    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if (allowed === false) return false;

        const abilities = [];
        let create_ability;

        if (
            (data.type === "character" || data.type === "mouse") &&
            this.itemTypes.ability.length <= 0
        ) {
            create_ability = [
                "MOUSEGUARD.MNature",
                "MOUSEGUARD.Will",
                "MOUSEGUARD.Health",
                "MOUSEGUARD.Resources",
                "MOUSEGUARD.Circles"
            ];
        } else if (
            data.type === "weasel" &&
            this.itemTypes.ability.length <= 0
        ) {
            create_ability = [
                "MOUSEGUARD.WNature",
                "MOUSEGUARD.Will",
                "MOUSEGUARD.Health",
                "MOUSEGUARD.Resources",
                "MOUSEGUARD.Circles"
            ];
        } else if (
            data.type === "animal" &&
            this.itemTypes.ability.length <= 0
        ) {
            create_ability = [
                game.i18n.localize("MOUSEGUARD.Nature") + " (" + data.name + ")"
            ];
        }

        if (create_ability && create_ability.length > 0) {
            for (const i of create_ability) {
                abilities.push({
                    name: i,
                    type: "ability"
                });
            }
            this.updateSource({
                items: abilities,
                img: "systems/mouseguard/assets/icons/seated-mouse.svg"
            });
        }

        return allowed;
    }
}
