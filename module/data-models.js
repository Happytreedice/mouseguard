/**
 * Modern TypeDataModels for Mouse Guard Actor and Item documents.
 * Replaces deprecated template.json with modern Schema-based System Data Models.
 */
const { TypeDataModel } = foundry.abstract;
const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Data Models                           */
/* -------------------------------------------- */

export class CharacterData extends TypeDataModel {
    static defineSchema() {
        return {
            biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            details: new fields.SchemaField({
                age: new fields.NumberField({ initial: 0, integer: true }),
                home: new fields.StringField({ blank: true, initial: "" }),
                fur_color: new fields.StringField({ blank: true, initial: "" }),
                guard_rank: new fields.StringField({ blank: true, initial: "" }),
                cloak_color: new fields.StringField({ blank: true, initial: "" }),
                parents: new fields.StringField({ blank: true, initial: "" }),
                senior_artisan: new fields.StringField({ blank: true, initial: "" }),
                mentor: new fields.StringField({ blank: true, initial: "" }),
                friend: new fields.StringField({ blank: true, initial: "" }),
                enemy: new fields.StringField({ blank: true, initial: "" })
            }),
            rewards: new fields.SchemaField({
                fate: new fields.NumberField({ initial: 1, integer: true }),
                persona: new fields.NumberField({ initial: 1, integer: true }),
                belief: new fields.StringField({ blank: true, initial: "" }),
                goal: new fields.StringField({ blank: true, initial: "" }),
                instinct: new fields.StringField({ blank: true, initial: "" }),
                check: new fields.NumberField({ initial: 1, integer: true })
            }),
            disposition: new fields.SchemaField({
                starting: new fields.NumberField({ initial: 1, integer: true }),
                current: new fields.NumberField({ initial: 0, integer: true })
            })
        };
    }

    get itemTypes() {
        return this.parent?.itemTypes ?? {};
    }

    set itemTypes(_) {}
}

export class NPCActorData extends TypeDataModel {
    static defineSchema() {
        return {
            biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            disposition: new fields.SchemaField({
                starting: new fields.NumberField({ initial: 1, integer: true }),
                current: new fields.NumberField({ initial: 0, integer: true })
            })
        };
    }

    get itemTypes() {
        return this.parent?.itemTypes ?? {};
    }

    set itemTypes(_) {}
}

/* -------------------------------------------- */
/*  Item Data Models                            */
/* -------------------------------------------- */

export class ItemData extends TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            quantity: new fields.NumberField({ initial: 1, integer: true }),
            weight: new fields.NumberField({ initial: 0 }),
            attributes: new fields.ObjectField(),
            groups: new fields.ObjectField()
        };
    }
}

export class SkillData extends TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            rank: new fields.NumberField({ initial: 1, integer: true }),
            pass: new fields.NumberField({ initial: 0, integer: true }),
            fail: new fields.NumberField({ initial: 0, integer: true })
        };
    }
}

export class WiseData extends TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            rank: new fields.NumberField({ initial: 1, integer: true }),
            pass: new fields.NumberField({ initial: 0, integer: true }),
            fail: new fields.NumberField({ initial: 0, integer: true })
        };
    }
}

export class AbilityData extends TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            rating: new fields.NumberField({ initial: 1, integer: true }),
            tax: new fields.NumberField({ initial: 1, integer: true }),
            pass: new fields.NumberField({ initial: 0, integer: true }),
            fail: new fields.NumberField({ initial: 0, integer: true })
        };
    }
}

export class TraitData extends TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            level: new fields.NumberField({ initial: 1, integer: true }),
            usedfor: new fields.NumberField({ initial: 0, integer: true }),
            usedagainst: new fields.NumberField({ initial: 0, integer: true })
        };
    }
}

export class SimpleItemData extends TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" })
        };
    }
}
