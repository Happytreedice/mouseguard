/**
 * Modern ApplicationV2 Effects Panel for displaying active status conditions on controlled token / user character.
 * @extends {foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)}
 */
import { statusEffects } from "./status-effects.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Status ids of the Mouse Guard conditions (module/status-effects.js). */
const MOUSEGUARD_STATUS_IDS = new Set(statusEffects.map((e) => e.id));

export class EffectsPanel extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mouseguard-effects-panel",
        classes: ["mouseguard", "effects-panel"],
        tag: "aside",
        window: {
            frame: false,
            positioned: false
        }
    };

    /** @inheritDoc */
    static PARTS = {
        panel: {
            root: true,
            template: "systems/mouseguard/templates/effects/effects-panel.hbs"
        }
    };

    /**
     * Debounce and slightly delayed request to re-render this panel.
     */
    refresh = foundry.utils.debounce(() => {
        if (this.rendered) this.render(false);
    }, 100);

    get token() {
        return canvas.tokens?.controlled?.at(0)?.document ?? null;
    }

    get actor() {
        return this.token?.actor ?? game.user?.character ?? null;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        let currentStatus = [];
        const { actor } = this;
        if (actor) {
            // Only the Mouse Guard conditions have an icon and a tooltip here (core statuses such as "dead" do not).
            currentStatus = Array.from(actor.statuses ?? []).filter((id) => MOUSEGUARD_STATUS_IDS.has(id));
        }
        return { currentStatus };
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        // Click to toggle status effect on actor
        this.element.querySelectorAll(".effect-item").forEach((el) => {
            el.addEventListener("click", async (event) => {
                event.preventDefault();
                const effectId = el.dataset.effectId;
                if (this.actor && effectId) {
                    await this.actor.toggleStatusEffect(effectId);
                }
            });
        });
    }
}
