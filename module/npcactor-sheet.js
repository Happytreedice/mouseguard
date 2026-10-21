import MouseGuardNPCActorSheetBase from "./svelte/MouseGuardNPCActorSheetBase.svelte";
import { writable } from "svelte/store";

/**
 * Modern ApplicationV2 NPC Actor Sheet for Mouse Guard using Svelte.
 * @extends {foundry.applications.sheets.ActorSheetV2}
 */
export class MouseGuardNPCActorSheet extends foundry.applications.sheets.ActorSheetV2 {
    app = null;
    dataStore = null;

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "sheet", "actor", "npc"],
        position: {
            width: 780,
            height: 720
        },
        window: {
            resizable: true
        },
        // The Svelte inputs that carry a `name` (actor name, disposition) belong to this sheet's <form> element and
        // are saved by the core DocumentSheetV2 form handler. Embedded-item inputs carry no `name`.
        form: {
            submitOnChange: true,
            closeOnSubmit: false
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const actorData = this.actor.toObject(false);
        actorData.system.itemTypes = Object.fromEntries(
            Object.entries(this.actor.itemTypes).map(([type, items]) => [
                type,
                items.map((item) => ({ ...item.toObject(false), id: item.id }))
            ])
        );
        return {
            actor: this.actor,
            document: this.actor,
            data: actorData,
            system: this.actor.system,
            systemData: this.actor.system,
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
    async _onRender(context, options) {
        // Mount / refresh the Svelte tree first, so the core render steps (disabling inputs of read-only sheets,
        // drag & drop binding) see its elements.
        if (!this.app) {
            this.dataStore = writable(context);
            // Mount inside the window content (this.element is the whole window <form>, header included).
            this.app = new MouseGuardNPCActorSheetBase({
                target: this.element.querySelector(".window-content") ?? this.element,
                props: {
                    dataStore: this.dataStore
                }
            });
        } else {
            this.dataStore?.set(context);
        }
        await super._onRender(context, options);
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

    _setMouseDice(count, message = "", bonus = 0) {
        game.mouseguard.RollCount = Math.max(0, Number(count) || 0) + Math.max(0, Number(bonus) || 0);
        game.mouseguard.RollBonus = Math.max(0, Number(bonus) || 0);
        game.mouseguard.RollMessage = message;
        game.mouseguard.updateDisplay(game.mouseguard.RollCount);
    }

    async _updateActorAbility(id, type, value) {
        if (!this.actor.isOwner) return;
        await this.actor.updateEmbeddedDocuments("Item", [
            { _id: id, system: { [type]: value } }
        ]);
    }

    async _updateEmbededItem(id, _data) {
        if (!this.actor.isOwner || !id) return;
        await this.actor.updateEmbeddedDocuments("Item", [
            { _id: id, system: _data }
        ]);
    }

    async _onItemDelete(itemId) {
        if (!this.actor.isOwner) return;
        const item = this.actor.items.get(itemId);
        if (item) await item.delete();
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;
        if (!this.actor.isOwner || !CONFIG.Item.dataModels[type]) return;
        const NEW_NAMES = {
            skill: "MOUSEGUARD.Sheet.NewSkill", trait: "MOUSEGUARD.Sheet.NewTrait", wise: "MOUSEGUARD.Sheet.NewWise",
            ability: "MOUSEGUARD.Sheet.NewAbility", contact: "MOUSEGUARD.Sheet.NewContact", condition: "MOUSEGUARD.Sheet.NewCondition"
        };
        const name = game.i18n.localize(NEW_NAMES[type] ?? "MOUSEGUARD.Sheet.NewGear");
        const itemData = { name, type };
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
