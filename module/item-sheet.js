/**
 * Modern ApplicationV2 Item Sheet for Mouse Guard items.
 * @extends {foundry.applications.sheets.ItemSheetV2}
 * @mixes foundry.applications.api.HandlebarsApplication
 */
export class MouseGuardItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.sheets.ItemSheetV2
) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mouseguard", "sheet", "item"],
        position: {
            width: 520,
            height: 480
        },
        form: {
            submitOnChange: true,
            closeOnSubmit: false
        }
    };

    /** @override */
    static PARTS = {
        sheet: {
            template: "systems/mouseguard/templates/item-sheet.html",
            root: true
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const item = this.item;
        return {
            document: item,
            item: item,
            data: item.toObject(false),
            system: item.system,
            systemData: item.system,
            rollData: item.getRollData(),
            editable: this.isEditable,
            owner: item.isOwner
        };
    }
}
