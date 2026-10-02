/**
 * Custom Die and Roll classes for the Mouse Guard system.
 * Subclasses foundry.dice.terms.Die and foundry.dice.Roll.
 */
const DieClass = foundry.dice.terms.Die;
const RollClass = foundry.dice.Roll;

export class MouseDie extends DieClass {
    constructor(termData) {
        termData.faces = 6;
        super(termData);
    }

    /* -------------------------------------------- */

    /** @override */
    static DENOMINATION = "m";

    /* -------------------------------------------- */

    /** @override */
    getResultLabel(result) {
        return {
            1: '<img src="systems/mouseguard/assets/dice/snake.png" alt="snake" />',
            2: '<img src="systems/mouseguard/assets/dice/snake.png" alt="snake" />',
            3: '<img src="systems/mouseguard/assets/dice/snake.png" alt="snake" />',
            4: '<img src="systems/mouseguard/assets/dice/sword.png" alt="sword" />',
            5: '<img src="systems/mouseguard/assets/dice/sword.png" alt="sword" />',
            6: '<img src="systems/mouseguard/assets/dice/axe.png" alt="axe" />'
        }[result.result];
    }
}

const mouseChatData = async (roll, chatOptions) => {
    const isPrivate = chatOptions.isPrivate;
    return {
        formula: isPrivate ? "???" : roll.formula,
        flavor: isPrivate ? null : chatOptions.flavor,
        user: chatOptions.author ?? chatOptions.user ?? game.user.id,
        tooltip: isPrivate ? "" : await roll.getTooltip(),
        result: isPrivate ? "?" : (roll.total ?? 0),
        dice_count: isPrivate ? "?" : (roll.terms?.[0]?.number ?? 1),
        drop: false,
        claimed: roll.claimed ?? false
    };
};

export class MouseRoll extends RollClass {
    /**
     * Render a DropRoll instance to HTML
     * @param {object} [chatOptions]      An object configuring the behavior of the resulting chat message.
     * @return {Promise<string>}          The rendered HTML template as a string
     */
    async render(chatOptions = {}) {
        chatOptions = foundry.utils.mergeObject(
            {
                author: game.user.id,
                flavor: null,
                template: this.constructor.CHAT_TEMPLATE,
                blind: false
            },
            chatOptions
        );

        // Execute the roll asynchronously if needed
        if (!this._evaluated) await this.evaluate();

        // Define chat data
        const chatData = await mouseChatData(this, chatOptions);

        // Render the roll display template
        return foundry.applications.handlebars.renderTemplate(chatOptions.template, chatData);
    }

    static CHAT_TEMPLATE = "systems/mouseguard/templates/dice/roll.html";
}
