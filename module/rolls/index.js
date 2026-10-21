/**
 * Roll system registration: settings, templates, chat card hooks, condition <-> status effect sync and a GM relay for
 * updates the rolling user may not perform (another player's wise marks, a test card authored by someone else).
 * Called from the system init hook (module/mouseguard.js).
 */
import { CONDITION_STATUS } from "./labels.js";
import { MouseGuardTestDialog } from "./test-dialog.js";
import { CARD_TEMPLATE, DIALOG_TEMPLATE, SYSTEM_ID, TEST_QUERY, handleCardAction, onRenderChatMessage, performTest, recordActor, renderTestCard } from "./test.js";

/** status effect id -> condition key */
const STATUS_CONDITION = Object.fromEntries(Object.entries(CONDITION_STATUS).map(([key, id]) => [id, key]));

export function registerRollSystem() {
    // World setting: tests mark advancement automatically (the dialog still lets the player switch it off)
    game.settings.register(SYSTEM_ID, "autoMarkAdvancement", {
        name: "MOUSEGUARD.Test.Setting.AutoMarkName",
        hint: "MOUSEGUARD.Test.Setting.AutoMarkHint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    foundry.applications.handlebars.loadTemplates([CARD_TEMPLATE, DIALOG_TEMPLATE])
        .catch((err) => console.error("Mouse Guard | Could not preload test templates", err));

    // Public helpers for macros and other code
    if (game.mouseguard) {
        Object.assign(game.mouseguard, {
            TestDialog: MouseGuardTestDialog,
            performTest,
            handleTestCardAction: handleCardAction,
            /**
             * Open the test dialog (or quick-roll) for an actor.
             * @param {Actor|string} actorOrUuid
             * @param {object} [options]  see MouseGuardActor#rollTest
             */
            rollTest: async (actorOrUuid, options = {}) => {
                const actor = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
                if (!actor?.rollTest) return null;
                return actor.rollTest(options);
            }
        });
    }

    // Test chat cards: post-roll buttons
    Hooks.on("renderChatMessageHTML", onRenderChatMessage);

    // Keep system.conditions in sync when a status is toggled from the token HUD or the effects panel
    const syncCondition = (effect, active, userId) => {
        if (userId !== game.user.id) return;
        const actor = effect?.parent;
        if (!(actor instanceof Actor) || !actor.system?.conditions) return;
        const changes = {};
        for (const status of effect.statuses ?? []) {
            const key = STATUS_CONDITION[status];
            if (!key) continue;
            const value = active
                || actor.effects.some((e) => e.id !== effect.id && !e.disabled && e.statuses?.has(status));
            if (!!actor.system.conditions[key] !== value) changes[`system.conditions.${key}`] = value;
        }
        if (!foundry.utils.isEmpty(changes) && actor.isOwner) actor.update(changes);
    };
    Hooks.on("createActiveEffect", (effect, _options, userId) => syncCondition(effect, true, userId));
    Hooks.on("deleteActiveEffect", (effect, _options, userId) => syncCondition(effect, false, userId));

    // GM relay (only test cards and wise marks are accepted): an awaited User query, so the caller knows when it landed
    // and the querying user is authenticated by the server instead of being read from the payload.
    CONFIG.queries ??= {};
    CONFIG.queries[TEST_QUERY] = handleTestUpdateQuery;
}

const WISE_MARK_KEY = /^system\.checks\.(pass|fail)$/;

/**
 * GM side of the test relay.
 * @param {{uuid: string, changes: object, messageUuid?: string}} data
 * @param {{user: User}} context
 * @returns {Promise<boolean>}
 */
async function handleTestUpdateQuery({ uuid, changes, messageUuid } = {}, { user } = {}) {
    if (!game.user.isGM) throw new Error("Mouse Guard test relay: only the GM handles this query");
    if (!(user instanceof User) || !uuid || !changes || typeof changes !== "object") throw new Error("Mouse Guard test relay: bad request");
    const doc = await fromUuid(uuid).catch(() => null);
    if (!doc) throw new Error("Mouse Guard test relay: document not found");

    // Test card: only the owner of the tested actor may update it. Identity fields come from the stored card, and the
    // card HTML is rendered here from the record instead of trusting client HTML.
    if (doc instanceof ChatMessage) {
        const stored = doc.getFlag(SYSTEM_ID, "test");
        const actor = stored ? recordActor(stored, doc) : null;
        if (!actor?.testUserPermission(user, "OWNER")) throw new Error("Mouse Guard test relay: permission denied");
        const record = changes[`flags.${SYSTEM_ID}.test`];
        if (!record || typeof record !== "object") throw new Error("Mouse Guard test relay: missing test record");
        record.actorUuid = stored.actorUuid;
        record.wiseHelpers = stored.wiseHelpers;
        const content = await renderTestCard(record, actor);
        await doc.update({ content, [`flags.${SYSTEM_ID}.test`]: record });
        return true;
    }

    // Wise pass/fail marks: the requester owns the wise, or the wise helped on a test card of an actor the requester owns.
    if (doc.documentName === "Item" && doc.type === "wise") {
        const allowed = Object.fromEntries(Object.entries(changes)
            .filter(([k, v]) => WISE_MARK_KEY.test(k) && typeof v === "boolean"));
        if (foundry.utils.isEmpty(allowed)) throw new Error("Mouse Guard test relay: nothing allowed to update");
        let permitted = doc.testUserPermission(user, "OWNER");
        if (!permitted && messageUuid) {
            const message = await fromUuid(messageUuid).catch(() => null);
            const record = message?.getFlag?.(SYSTEM_ID, "test");
            permitted = !!record
                && (record.wiseHelpers ?? []).some((h) => h?.uuid === doc.uuid)
                && !!recordActor(record, message)?.testUserPermission(user, "OWNER");
        }
        if (!permitted) throw new Error("Mouse Guard test relay: permission denied");
        await doc.update(allowed);
        return true;
    }
    throw new Error("Mouse Guard test relay: unsupported document");
}
