import MouseGuardActorSheetBase from "./svelte/MouseGuardActorSheetBase.svelte";
import { writable } from "svelte/store";

/**
 * Modern ApplicationV2 Actor Sheet for Mouse Guard characters using Svelte.
 * @extends {foundry.applications.sheets.ActorSheetV2}
 */
export class MouseGuardActorSheet extends foundry.applications.sheets.ActorSheetV2 {
    app = null;
    dataStore = null;

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "sheet", "actor"],
        position: {
            width: 850,
            height: 600
        },
        window: {
            resizable: true
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const actorData = this.actor.toObject(false);
        actorData.system.itemTypes = this.actor.itemTypes;
        return {
            actor: this.actor,
            document: this.actor,
            data: actorData,
            system: this.actor.system,
            sheet: this,
            editable: this.isEditable,
            owner: this.actor.isOwner
        };
    }

    /** @override */
    async _renderHTML(context, options) {
        return "";
    }

    /** @override */
    _replaceHTML(result, content, options) {}

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        if (!this.app) {
            this.dataStore = writable(context);
            this.app = new MouseGuardActorSheetBase({
                target: this.element,
                props: {
                    dataStore: this.dataStore
                }
            });
        } else {
            this.dataStore?.set(context);
        }
    }

    /** @inheritDoc */
    _onClose(options) {
        if (this.app) {
            this.app.$destroy();
            this.app = null;
            this.dataStore = null;
        }
        super._onClose(options);
    }

    _setMouseDice(count, message = "") {
        game.mouseguard.RollCount = count;
        game.mouseguard.RollMessage = message;
        game.mouseguard.updateDisplay(count);
    }

    async _updateActorAbility(id, type, value) {
        await this.actor.updateEmbeddedDocuments("Item", [
            { _id: id, system: { [type]: value } }
        ]);
    }

    async _updateEmbededItem(id, _data) {
        await this.actor.updateEmbeddedDocuments("Item", [
            { _id: id, system: _data }
        ]);
    }

    async _onItemDelete(itemId) {
        const item = this.actor.items.get(itemId);
        if (item) await item.delete();
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;
        const name = `New ${type.capitalize()}`;
        const itemData = {
            name: name,
            type: type,
            system: { rank: 1 }
        };
        const [item] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        item?.sheet?.render(true);
        return item;
    }

    async _onItemRoll(event) {
        const button = event.currentTarget;
        const li = button.closest(".item");
        const itemId = li?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const formula = button.dataset.roll;
        if (!formula) return;
        const RollClass = foundry.dice.Roll;
        const r = new RollClass(formula, this.actor.getRollData());
        await r.evaluate();
        return r.toMessage({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `<h2>${item?.name ?? ""}</h2><h3>${button.textContent}</h3>`
        });
    }
}
