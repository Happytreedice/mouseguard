/**
 * Mouse Guard RPG System for Foundry Virtual Tabletop
 */

// Import Modules
import { MouseGuardActor } from "./actor.js";
import { MouseGuardItem } from "./item.js";
import { MouseGuardItemSheet } from "./item-sheet.js";
import { MouseGuardActorSheet } from "./actor-sheet.js";
import { MouseGuardNPCActorSheet } from "./npcactor-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js";
import { createMouseGuardMacro } from "./macro.js";
import { MouseDie, MouseRoll } from "./mousedie.js";
import ConflictTracker from "./conflict-tracker.js";
import MouseCombatant from "./mouse-combantant.js";
import MouseCombat from "./mouse-combat.js";
import MouseCombatTracker from "./mouse-combat-tracker.js";
import MouseSocket from "./socket.js";
import { EffectsPanel } from "./mouse-effects.js";
import { MouseConflictManager } from "./mouse-conflict-manager.js";
import { statusEffects } from "./status-effects.js";
import {
    CharacterData,
    NPCActorData,
    ItemData,
    SkillData,
    WiseData,
    AbilityData,
    TraitData,
    SimpleItemData
} from "./data-models.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
    console.log("Mouse Guard | Initializing Mouse Guard System");

    let RollCount = 0;
    let RollMessage = "";

    game.mouseguard = {
        MouseGuardActor,
        MouseGuardItem,
        createMouseGuardMacro,
        RollCount,
        RollMessage,
        updateDisplay,
        MouseDie,
        MouseRoll,
        ConflictTracker,
        MouseConflictManager,
        effectPanel: new EffectsPanel()
    };

    // Define custom Document classes
    CONFIG.Actor.documentClass = MouseGuardActor;
    CONFIG.Item.documentClass = MouseGuardItem;

    // Register System Data Models (modern replacement for template.json)
    CONFIG.Actor.dataModels = {
        character: CharacterData,
        mouse: NPCActorData,
        weasel: NPCActorData,
        animal: NPCActorData
    };

    CONFIG.Item.dataModels = {
        item: ItemData,
        skill: SkillData,
        wise: WiseData,
        ability: AbilityData,
        trait: TraitData,
        contact: SimpleItemData,
        condition: SimpleItemData
    };

    // Define custom Combat classes
    CONFIG.Combatant.documentClass = MouseCombatant;
    CONFIG.Combat.documentClass = MouseCombat;
    CONFIG.ui.combat = MouseCombatTracker;

    CONFIG.Combat.initiative = {
        formula: "1d20",
        decimals: 2
    };

    // Register Dice terms and rolls
    CONFIG.Dice.terms["m"] = MouseDie;
    CONFIG.Dice.terms["6"] = MouseDie;
    CONFIG.Dice.types.push(MouseDie);
    CONFIG.Dice.rolls.push(MouseRoll);

    // Register sheet application classes (No unregisterSheet for core to avoid v14 deprecation warnings)
    foundry.documents.collections.Actors.registerSheet("mouseguard", MouseGuardNPCActorSheet, {
        types: ["mouse", "weasel", "animal"],
        makeDefault: true
    });
    foundry.documents.collections.Actors.registerSheet("mouseguard", MouseGuardActorSheet, {
        types: ["character"],
        makeDefault: true
    });
    foundry.documents.collections.Items.registerSheet("mouseguard", MouseGuardItemSheet, {
        makeDefault: true
    });

    // Register system settings
    game.settings.register("mouseguard", "macroShorthand", {
        name: "SETTINGS.MouseGuardMacroShorthandN",
        hint: "SETTINGS.MouseGuardMacroShorthandL",
        scope: "world",
        type: Boolean,
        default: true,
        config: true
    });

    game.settings.register("mouseguard", "initFormula", {
        name: "SETTINGS.MouseGuardInitFormulaN",
        hint: "SETTINGS.MouseGuardInitFormulaL",
        scope: "world",
        type: String,
        default: "1d20",
        config: true,
        onChange: (formula) => _simpleUpdateInit(formula, true)
    });

    const initFormula = game.settings.get("mouseguard", "initFormula");
    _simpleUpdateInit(initFormula);

    function _simpleUpdateInit(formula, notify = false) {
        const RollClass = foundry.dice.Roll;
        const isValid = RollClass.validate(formula);
        if (!isValid) {
            if (notify) {
                ui.notifications.error(
                    `${game.i18n.localize("MOUSEGUARD.NotifyInitFormulaInvalid")}: ${formula}`
                );
            }
            return;
        }
        CONFIG.Combat.initiative.formula = formula;
    }

    // Register Socket listeners
    game.socket.on("system.mouseguard", (data) => {
        if (data.action === "askGoal") MouseSocket.askGoal(data);
        if (data.action === "setGoal") MouseSocket.setGoal(data);
        if (data.action === "askMoves") MouseSocket.askMoves(data);
        if (data.action === "setMoves") MouseSocket.setMoves(data);
    });

    // Register Handlebars Helpers
    Handlebars.registerHelper("slugify", function (value) {
        return typeof value === "string" ? value.slugify({ strict: true }) : "";
    });

    Handlebars.registerHelper("times", function (n, block) {
        let accum = "";
        for (let i = 0; i < n; ++i) accum += block.fn(i);
        return accum;
    });

    Handlebars.registerHelper("concat", function (...args) {
        args.pop();
        return args.join("");
    });

    Handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
        return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    });

    if (!Handlebars.helpers.or) {
        Handlebars.registerHelper("or", function (...args) {
            args.pop();
            return args.some(Boolean);
        });
    }

    if (!Handlebars.helpers.and) {
        Handlebars.registerHelper("and", function (...args) {
            args.pop();
            return args.every(Boolean);
        });
    }

    if (!Handlebars.helpers.not) {
        Handlebars.registerHelper("not", function (arg) {
            return !arg;
        });
    }

    // Preload template partials
    await preloadHandlebarsTemplates();
    await registerTours();
});

/* -------------------------------------------- */
/*  Dice So Nice Integration                    */
/* -------------------------------------------- */

Hooks.once("diceSoNiceReady", (dice3d) => {
    dice3d.addSystem({ id: "mouseguard", name: "Mouse Guard" }, true);

    dice3d.addDicePreset(
        {
            type: "dm",
            labels: [
                "systems/mouseguard/assets/dice/snake.png",
                "systems/mouseguard/assets/dice/snake.png",
                "systems/mouseguard/assets/dice/snake.png",
                "systems/mouseguard/assets/dice/sword.png",
                "systems/mouseguard/assets/dice/sword.png",
                "systems/mouseguard/assets/dice/axe.png"
            ],
            colorset: "white",
            system: "mouseguard"
        },
        "d6"
    );

    dice3d.addColorset({
        name: "white-mg",
        description: "Mouse Guard white",
        category: "Colors",
        foreground: "#000000",
        background: "#ffffff",
        outline: "black",
        texture: "none",
        material: "plastic"
    });
});

/* -------------------------------------------- */
/*  ChatLog & Mouse Tray Hook                   */
/* -------------------------------------------- */

Hooks.on("renderChatLog", async (app, html) => {
    const root = html instanceof HTMLElement ? html : (html[0] ?? html);
    if (!root || root.querySelector(".mouse-tray")) return;

    const chatForm = root.querySelector("#chat-form") ?? root.querySelector("form");
    if (!chatForm) return;

    const template = "systems/mouseguard/templates/mousetray.html";
    const rendered = await foundry.applications.handlebars.renderTemplate(template, {});
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rendered.trim();
    const tray = tempDiv.firstElementChild;
    if (!tray) return;

    chatForm.insertAdjacentElement("afterend", tray);

    tray.querySelector(".mouse_dice_button.add")?.addEventListener("click", (event) => {
        event.preventDefault();
        game.mouseguard.RollCount++;
        updateDisplay(game.mouseguard.RollCount);
    });

    tray.querySelector(".mouse_dice_button.subtract")?.addEventListener("click", (event) => {
        event.preventDefault();
        if (game.mouseguard.RollCount > 0) game.mouseguard.RollCount--;
        updateDisplay(game.mouseguard.RollCount);
    });

    tray.querySelector(".mouse_roll_button")?.addEventListener("click", async (event) => {
        event.preventDefault();
        if (game.mouseguard.RollCount > 0) {
            const actor = game.user.character ?? canvas.tokens?.controlled?.[0]?.actor;
            const roll = new MouseRoll(`${game.mouseguard.RollCount}dmcs>3`);
            await roll.evaluate();
            await roll.toMessage({
                author: game.user.id,
                flavor: game.mouseguard.RollMessage,
                speaker: ChatMessage.getSpeaker({ actor: actor })
            });

            game.mouseguard.RollCount = 0;
            game.mouseguard.RollMessage = "";
            updateDisplay(0);
        }
    });

    updateDisplay(game.mouseguard.RollCount);
});

/* -------------------------------------------- */
/*  Chat Message Rendering Hook                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", (message, html) => {
    if (message.flags?.mouseguard?.unflipped) {
        const img = html.querySelector("img");
        if (img) img.src = "systems/mouseguard/assets/deck/CardBack.webp";

        if (game.user.isGM) {
            const actionMove = html.querySelector(".action-move");
            if (actionMove && !actionMove.querySelector(".reveal-button")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "reveal-button";
                btn.textContent = "Reveal Card";
                btn.addEventListener("click", async () => {
                    await message.setFlag("mouseguard", "unflipped", false);
                });
                actionMove.appendChild(btn);
            }
        }
    }
});

/* -------------------------------------------- */
/*  System Ready & Status Effects               */
/* -------------------------------------------- */

Hooks.once("setup", () => {
    CONFIG.statusEffects = statusEffects;
});

Hooks.once("ready", async () => {
    // Start welcome tour if first time
    const tourRolls = game.user.getFlag("mouseguard", "tourRolls");
    if (tourRolls === undefined) {
        const tour = game.tours.get("mouseguard.welcome");
        if (tour) {
            tour.start();
            await game.user.setFlag("mouseguard", "tourRolls", 1);
        }
    }

    // Effect Panel listeners
    Hooks.on("controlToken", () => {
        game.mouseguard.effectPanel.refresh();
    });

    for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
        Hooks.on(hook, (effect) => {
            if (effect.parent === game.mouseguard.effectPanel.actor) {
                game.mouseguard.effectPanel.refresh();
            }
        });
    }
});

Hooks.on("canvasReady", () => {
    game.mouseguard.effectPanel.render(true);
});

/* -------------------------------------------- */
/*  Helper Functions                            */
/* -------------------------------------------- */

async function registerTours() {
    try {
        const TourClass = foundry.nue?.tours?.SidebarTour;
        if (TourClass) {
            game.tours.register(
                "mouseguard",
                "welcome",
                await TourClass.fromJSON("/systems/mouseguard/tours/welcome.json")
            );
        }
    } catch (err) {
        console.error("Mouse Guard | Error registering tours:", err);
    }
}

function updateDisplay(count) {
    const diceHTML =
        '<li class="roll mousedie d6"><img src="systems/mouseguard/assets/dice/sword.png" height="24" width="24" alt="die"></li>';
    let theHTML = "";
    for (let i = 0; i < count; i++) {
        theHTML += diceHTML;
    }

    document.querySelectorAll(".mouse-dice-roll").forEach((el) => {
        el.innerHTML = theHTML;
    });

    document.querySelectorAll(".mouse_dice_button.subtract").forEach((btn) => {
        btn.disabled = !count;
    });
    document.querySelectorAll(".mouse_roll_button").forEach((btn) => {
        btn.disabled = !count;
    });

    if (!count) game.mouseguard.RollMessage = "";
}
