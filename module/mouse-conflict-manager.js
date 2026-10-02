import MouseGuardConflictManager from "./svelte/MouseGuardConflictManager.svelte";
import { writable } from "svelte/store";

const { ApplicationV2 } = foundry.applications.api;

export class MouseConflictManager extends ApplicationV2 {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mouseguard-conflict-panel",
        classes: ["mouseguard"],
        window: {
            title: "Conflict Manager"
        },
        position: {
            width: 850,
            height: 600
        }
    };

    app = null;
    dataStore = null;

    /**
     * Debounce request to re-render.
     */
    refresh = foundry.utils.debounce(() => {
        if (this.rendered) this.render(false);
    }, 100);

    /** @inheritDoc */
    async _prepareContext(options) {
        return {};
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
            this.app = new MouseGuardConflictManager({
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
}
