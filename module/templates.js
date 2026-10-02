/**
 * Define a set of template paths to pre-load.
 * Pre-loaded templates are compiled and cached for fast access when rendering.
 * @returns {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
    const templatePaths = [
        "systems/mouseguard/templates/sidebar/tabs/combat/header.hbs",
        "systems/mouseguard/templates/sidebar/tabs/combat/tracker.hbs",
        "systems/mouseguard/templates/effects/effects-panel.hbs",
        "systems/mouseguard/templates/effects/effect.hbs",
        "systems/mouseguard/templates/parts/conflict-manager.hbs",
        "systems/mouseguard/templates/parts/conflict-move-manager.hbs",
        "systems/mouseguard/templates/parts/sheet-attributes.html",
        "systems/mouseguard/templates/parts/sheet-groups.html",
        "systems/mouseguard/templates/chat/combat-action.hbs",
        "systems/mouseguard/templates/chat/mission.hbs"
    ];

    const loader = foundry.applications.handlebars?.loadTemplates ?? loadTemplates;
    return loader(templatePaths);
};
