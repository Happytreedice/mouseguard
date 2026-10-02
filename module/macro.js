/**
 * Create a Macro from an attribute drop.
 * Get an existing mouseguard macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise<boolean>}
 */
export async function createMouseGuardMacro(data, slot) {
    const command = `const roll = new Roll("${data.roll}", actor ? actor.getRollData() : {});
await roll.evaluate();
await roll.toMessage({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: "${data.label}"
});`;

    let macro = game.macros.find((m) => m.name === data.label && m.command === command);
    if (!macro) {
        macro = await Macro.create({
            name: data.label,
            type: "script",
            command: command,
            flags: { "mouseguard.attrMacro": true }
        });
    }
    game.user.assignHotbarMacro(macro, slot);
    return false;
}
