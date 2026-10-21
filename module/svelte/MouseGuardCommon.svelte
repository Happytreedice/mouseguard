<script context="module">
    export function updateRating(sheet, item, type, value) {
        if (!Number.isFinite(value)) return;
        const ob = { [type]: value };
        const bounds = {
            rank: [0, 6],
            rating: [0, 20],
            level: [1, 3],
            max: [0, 20],
            learning: [0, 10],
            usedFor: [0, 2],
            usedAgainst: [0, 99]
        }[type];
        if (bounds) ob[type] = Math.min(bounds[1], Math.max(bounds[0], Math.trunc(value)));
        sheet?._updateEmbededItem(item, ob);
    }

    export function setMouseDice(sheet, count, message = "", bonus = 0) {
        sheet?._setMouseDice(count, message, bonus);
    }

    /** Open the Test dialog for a skill or ability item (shift-click rolls at once). */
    export function rollTest(sheet, itemId, event) {
        const actor = sheet?.actor ?? sheet?.document;
        if (!actor?.rollTest || !itemId) return;
        event?.preventDefault?.();
        actor.rollTest({ itemId, event });
    }
</script>
