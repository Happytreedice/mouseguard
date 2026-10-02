/**
 * Extend the base Item document for Mouse Guard items.
 * @extends {Item}
 */
export class MouseGuardItem extends Item {
    /** Resolve a pack's localized description keys when the document is prepared. */
    prepareBaseData() {
        super.prepareBaseData();

        const encoded = this.system.description;
        if (!encoded || typeof encoded !== "object" || typeof encoded.template !== "string") return;

        const parts = Object.fromEntries(Object.entries(encoded.parts ?? {}).map(([key, value]) => [
            key,
            typeof value === "string" && value.startsWith("MOUSEGUARD.") ? game.i18n.localize(value) : value
        ]));
        let description = game.i18n.localize(encoded.template);
        for (const [key, value] of Object.entries(parts)) {
            description = description.replaceAll(`{${key}}`, value);
        }
        this.system.description = description;
    }

    /** @inheritdoc */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
}
