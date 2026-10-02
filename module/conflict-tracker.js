/**
 * ApplicationV2 Conflict Tracker popup.
 * @extends {foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)}
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class ConflictTracker extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "conflict-tracker",
        classes: ["mouseguard"],
        window: {
            title: "Conflict Tracker"
        },
        position: {
            width: 150,
            height: 105
        }
    };

    /** @inheritDoc */
    static PARTS = {
        tracker: {
            template: "systems/mouseguard/templates/conflict-tracker.html"
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        return {
            isGM: game.user.isGM
        };
    }
}
