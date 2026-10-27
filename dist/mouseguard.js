// module/data-models.js
var { TypeDataModel } = foundry.abstract;
var fields = foundry.data.fields;
var ABILITY_KEYS = Object.freeze(["nature", "will", "health", "resources", "circles"]);
var CONDITION_KEYS = Object.freeze(["hungryThirsty", "angry", "tired", "injured", "sick"]);
var ITEM_SCHEMA_VERSION = 2;
var LEGACY_SYSTEM_KEYS = Object.freeze({
  ability: ["tax", "pass", "fail"],
  skill: ["pass", "fail", "groups", "attributes"],
  trait: ["usedfor", "usedagainst", "usesThisSession", "exhausted"],
  wise: ["pass", "fail", "rank"]
});
var ABILITY_NAME_TABLE = {
  will: "will",
  "\u0432\u043E\u043B\u044F": "will",
  health: "health",
  "\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435": "health",
  resources: "resources",
  "\u0440\u0435\u0441\u0443\u0440\u0441\u044B": "resources",
  circles: "circles",
  "\u0441\u0432\u044F\u0437\u0438": "circles"
};
var NATURE_NAME = /^(?:MOUSEGUARD\.)?(?:[MW]?Nature|Природа)(?:\s*\(.*\))?$/i;
function inferAbilityKey(name) {
  if (typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (NATURE_NAME.test(trimmed)) return "nature";
  const bare = trimmed.replace(/^MOUSEGUARD\./, "").toLowerCase();
  return ABILITY_NAME_TABLE[bare] ?? "";
}
var HEALTH_BL_SKILLS = /* @__PURE__ */ new Set([
  "fighter",
  "\u0431\u043E\u0435\u0446",
  "potter",
  "\u0433\u043E\u043D\u0447\u0430\u0440",
  "stonemason",
  "\u043A\u0430\u043C\u0435\u043D\u0449\u0438\u043A",
  "smith",
  "\u043A\u0443\u0437\u043D\u0435\u0446",
  "boatcrafter",
  "\u043A\u043E\u0440\u0430\u0431\u0435\u043B",
  "miller",
  "\u043C\u0435\u043B\u044C\u043D\u0438\u043A",
  "armorer",
  "\u043E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A",
  "hunter",
  "\u043E\u0445\u043E\u0442\u043D\u0438\u043A",
  "brewer",
  "\u043F\u0438\u0432\u043E\u0432\u0430\u0440",
  "carpenter",
  "\u043F\u043B\u043E\u0442\u043D\u0438\u043A",
  "laborer",
  "\u0440\u0430\u0437\u043D\u043E\u0440\u0430\u0431\u043E\u0447\u0438\u0439",
  "scout",
  "\u0440\u0430\u0437\u0432\u0435\u0434\u0447\u0438\u043A",
  "harvester",
  "\u0441\u0431\u043E\u0440\u0449\u0438\u043A",
  "survivalist",
  "\u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442 \u043F\u043E \u0432\u044B\u0436\u0438\u0432\u0430\u043D\u0438\u044E",
  "glazier",
  "\u0441\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A"
]);
function inferBeginnersLuck(...names) {
  for (const name of names) {
    if (typeof name !== "string") continue;
    if (HEALTH_BL_SKILLS.has(name.trim().toLowerCase())) return "health";
  }
  return "will";
}
var toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
var isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function migrateLegacyHTML(source, key = "description") {
  if (!(key in source)) return;
  const value = source[key];
  if (value === null || value === void 0) return;
  if (typeof value === "object") source[key] = "";
  else if (typeof value === "string") {
    const v = value.trim();
    if (v === "[object Object]" || /^MOUSEGUARD\.[\w.-]+$/.test(v)) source[key] = "";
  }
}
function migrateLegacyAdvancement(source, cap) {
  const hasPass = "pass" in source;
  const hasFail = "fail" in source;
  if (!hasPass && !hasFail) return;
  const advancement = isObject(source.advancement) ? source.advancement : {};
  if (hasPass) {
    const legacy = toNumber(source.pass);
    const current = "passed" in advancement ? toNumber(advancement.passed) : 0;
    advancement.passed = Math.clamp(Math.max(legacy, current), 0, cap);
  }
  if (hasFail) {
    const legacy = toNumber(source.fail);
    const current = "failed" in advancement ? toNumber(advancement.failed) : 0;
    advancement.failed = Math.clamp(Math.max(legacy, current), 0, cap);
  }
  source.advancement = advancement;
  delete source.pass;
  delete source.fail;
}
function migrateItemSource(source) {
  if (!isObject(source)) return source;
  const system = source.system;
  if (!isObject(system)) return source;
  const version = toNumber(source.flags?.mouseguard?.schemaVersion, 0);
  const legacyKeys = LEGACY_SYSTEM_KEYS[source.type];
  if (version >= ITEM_SCHEMA_VERSION && legacyKeys) {
    for (const key of legacyKeys) delete system[key];
  }
  if (source.type === "ability" && !system.key) {
    const key = inferAbilityKey(source.name);
    if (key) system.key = key;
  }
  if (source.type === "skill" && !("beginnersLuck" in system) && typeof source.name === "string") {
    system.beginnersLuck = inferBeginnersLuck(source.name, source.flags?.mouseguard?.originalName);
  }
  return source;
}
var conditionsSchema = () => new fields.SchemaField({
  hungryThirsty: new fields.BooleanField({ initial: false }),
  angry: new fields.BooleanField({ initial: false }),
  tired: new fields.BooleanField({ initial: false }),
  injured: new fields.BooleanField({ initial: false }),
  sick: new fields.BooleanField({ initial: false })
});
var dispositionSchema = () => new fields.SchemaField({
  starting: new fields.NumberField({ initial: 4, integer: true, min: 0 }),
  current: new fields.NumberField({ initial: 4, integer: true, min: 0 })
});
var CharacterData = class extends TypeDataModel {
  static defineSchema() {
    return {
      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      player: new fields.StringField({ blank: true, initial: "" }),
      details: new fields.SchemaField({
        age: new fields.NumberField({ initial: 0, integer: true }),
        birth_year: new fields.NumberField({ initial: 0, integer: true }),
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
        fate: new fields.NumberField({ initial: 1, integer: true, min: 0 }),
        persona: new fields.NumberField({ initial: 1, integer: true, min: 0 }),
        belief: new fields.StringField({ blank: true, initial: "" }),
        goal: new fields.StringField({ blank: true, initial: "" }),
        instinct: new fields.StringField({ blank: true, initial: "" }),
        check: new fields.NumberField({ initial: 1, integer: true, min: 0 })
      }),
      conditions: conditionsSchema(),
      disposition: dispositionSchema()
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      migrateLegacyHTML(source, "biography");
      migrateLegacyHTML(source, "notes");
    }
    return super.migrateData(source, options);
  }
  get itemTypes() {
    return this.parent?.itemTypes ?? {};
  }
  set itemTypes(_) {
  }
};
var natureAspectsSchema = () => new fields.ArrayField(new fields.StringField({ blank: true }));
function migrateNatureAspects(source) {
  if (!("natureAspects" in source)) return;
  const value = source.natureAspects;
  if (typeof value === "string") source.natureAspects = value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  else if (Array.isArray(value)) {
    source.natureAspects = value.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
  }
}
var NPCActorData = class extends TypeDataModel {
  static defineSchema() {
    return {
      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      player: new fields.StringField({ blank: true, initial: "" }),
      details: new fields.SchemaField({
        role: new fields.StringField({ blank: true, initial: "" }),
        home: new fields.StringField({ blank: true, initial: "" }),
        age: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        fur_color: new fields.StringField({ blank: true, initial: "" }),
        cloak_color: new fields.StringField({ blank: true, initial: "" })
      }),
      keyCharacter: new fields.BooleanField({ initial: false }),
      motivation: new fields.SchemaField({
        belief: new fields.StringField({ blank: true, initial: "" }),
        goal: new fields.StringField({ blank: true, initial: "" }),
        instinct: new fields.StringField({ blank: true, initial: "" })
      }),
      natureAspects: natureAspectsSchema(),
      conditions: conditionsSchema(),
      disposition: dispositionSchema()
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      migrateLegacyHTML(source, "biography");
      migrateLegacyHTML(source, "notes");
      migrateNatureAspects(source);
    }
    return super.migrateData(source, options);
  }
  get itemTypes() {
    return this.parent?.itemTypes ?? {};
  }
  set itemTypes(_) {
  }
};
var NATURAL_ORDER_MAX = 9;
var NATURAL_ORDER_MOUSE = 3;
var AnimalData = class extends TypeDataModel {
  static defineSchema() {
    return {
      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      species: new fields.StringField({ blank: true, initial: "" }),
      naturalOrder: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
        integer: true,
        min: 0,
        max: NATURAL_ORDER_MAX
      }),
      natureAspects: natureAspectsSchema(),
      disposition: dispositionSchema()
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      migrateLegacyHTML(source, "biography");
      migrateLegacyHTML(source, "notes");
      migrateNatureAspects(source);
      if ("naturalOrder" in source) {
        const level = Math.trunc(toNumber(source.naturalOrder));
        source.naturalOrder = Math.clamp(level, 0, NATURAL_ORDER_MAX);
      }
    }
    return super.migrateData(source, options);
  }
  get itemTypes() {
    return this.parent?.itemTypes ?? {};
  }
  set itemTypes(_) {
  }
};
var MouseGuardItemDataBase = class extends TypeDataModel {
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) migrateLegacyHTML(source, "description");
    return super.migrateData(source, options);
  }
};
var GEAR_CATEGORIES = Object.freeze(["gear", "weapon", "armor", "natural"]);
var ItemData = class extends MouseGuardItemDataBase {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      quantity: new fields.NumberField({ initial: 1, integer: true }),
      weight: new fields.NumberField({ initial: 0 }),
      category: new fields.StringField({ required: true, blank: false, initial: "gear", choices: [...GEAR_CATEGORIES] }),
      effect: new fields.StringField({ blank: true, initial: "" }),
      attributes: new fields.ObjectField(),
      groups: new fields.ObjectField()
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source) && "category" in source && !GEAR_CATEGORIES.includes(source.category)) {
      source.category = "gear";
    }
    return super.migrateData(source, options);
  }
};
var SkillData = class extends MouseGuardItemDataBase {
  static defineSchema() {
    return {
      rank: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 6 }),
      learning: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 10 }),
      beginnersLuck: new fields.StringField({ required: true, blank: false, initial: "will", choices: ["will", "health"] }),
      specialty: new fields.BooleanField({ initial: false }),
      advancement: new fields.SchemaField({
        passed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 6 }),
        failed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 6 })
      }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      supplies: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      factors: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      help: new fields.ArrayField(new fields.StringField({ blank: true }))
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      migrateLegacyHTML(source, "supplies");
      migrateLegacyHTML(source, "factors");
      migrateLegacyAdvancement(source, 6);
      if ("rank" in source && typeof source.rank === "string") source.rank = toNumber(source.rank);
      if ("beginnersLuck" in source && !["will", "health"].includes(source.beginnersLuck)) {
        source.beginnersLuck = String(source.beginnersLuck).toLowerCase() === "health" ? "health" : "will";
      }
      if ("help" in source && typeof source.help === "string") {
        source.help = source.help.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      } else if (Array.isArray(source.help)) {
        source.help = source.help.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
      }
      delete source.groups;
      delete source.attributes;
    }
    return super.migrateData(source, options);
  }
};
var WiseData = class extends MouseGuardItemDataBase {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      checks: new fields.SchemaField({
        pass: new fields.BooleanField({ initial: false }),
        fail: new fields.BooleanField({ initial: false }),
        figuredOut: new fields.BooleanField({ initial: false }),
        realized: new fields.BooleanField({ initial: false })
      })
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      for (const key of ["pass", "fail"]) {
        if (!(key in source)) continue;
        const checks = isObject(source.checks) ? source.checks : {};
        if (!(key in checks)) checks[key] = toNumber(source[key]) > 0;
        source.checks = checks;
        delete source[key];
      }
      delete source.rank;
    }
    return super.migrateData(source, options);
  }
};
var AbilityData = class extends MouseGuardItemDataBase {
  static defineSchema() {
    return {
      key: new fields.StringField({ required: true, blank: true, initial: "", choices: [...ABILITY_KEYS, ""] }),
      rating: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0, max: 20 }),
      max: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0, max: 20 }),
      advancement: new fields.SchemaField({
        passed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 10 }),
        failed: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 10 })
      }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      if ("rating" in source && typeof source.rating === "string") source.rating = toNumber(source.rating);
      if ("key" in source && !ABILITY_KEYS.includes(source.key)) {
        source.key = inferAbilityKey(source.key) || "";
      }
      if ("tax" in source) {
        if (!("max" in source)) {
          const values = [source.rating, source.tax].map((v) => Number(v)).filter(Number.isFinite);
          if (values.length) source.max = Math.clamp(Math.max(...values), 0, 20);
        }
        delete source.tax;
      }
      migrateLegacyAdvancement(source, 10);
    }
    return super.migrateData(source, options);
  }
  /**
   * Nature's maximum can never be below its current rating (a rating raised by hand, without touching the maximum,
   * raises the maximum too). Derived only: every reader (sheets, dice pool, Nature tax, learning) sees one value.
   * @inheritdoc
   */
  prepareBaseData() {
    super.prepareBaseData();
    if (this.max < this.rating) this.max = this.rating;
  }
};
var TraitData = class extends MouseGuardItemDataBase {
  static defineSchema() {
    return {
      level: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 1, max: 3 }),
      usedFor: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 2 }),
      usedAgainst: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 99 }),
      checksEarned: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0, max: 99 }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      levels: new fields.SchemaField({
        level1: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        level2: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        level3: new fields.HTMLField({ required: false, blank: true, initial: "" })
      }),
      against: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      origin: new fields.StringField({ blank: true, initial: "" })
    };
  }
  /** @inheritdoc */
  static migrateData(source, options) {
    if (isObject(source)) {
      migrateLegacyHTML(source, "against");
      if (isObject(source.levels)) {
        for (const key of ["level1", "level2", "level3"]) migrateLegacyHTML(source.levels, key);
      }
      if ("level" in source && typeof source.level === "string") source.level = toNumber(source.level, 1);
      if ("usesThisSession" in source || "usedfor" in source) {
        const values = [source.usedFor, source.usesThisSession, source.usedfor].map((v) => Number(v)).filter(Number.isFinite);
        if (values.length) source.usedFor = Math.clamp(Math.max(...values), 0, 2);
        delete source.usesThisSession;
        delete source.usedfor;
      }
      if ("usedagainst" in source) {
        const values = [source.usedAgainst, source.usedagainst].map((v) => Number(v)).filter(Number.isFinite);
        if (values.length) source.usedAgainst = Math.clamp(Math.max(...values), 0, 99);
        delete source.usedagainst;
      }
      delete source.exhausted;
    }
    return super.migrateData(source, options);
  }
};
var SimpleItemData = class extends MouseGuardItemDataBase {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
};

// module/rolls/labels.js
var ABILITY_ORDER = Object.freeze(["nature", "will", "health", "resources", "circles"]);
var ABILITY_LABEL_KEYS = Object.freeze({
  nature: "MOUSEGUARD.Nature",
  will: "MOUSEGUARD.Will",
  health: "MOUSEGUARD.Health",
  resources: "MOUSEGUARD.Resources",
  circles: "MOUSEGUARD.Circles"
});
var ABILITY_CAPS = Object.freeze({ nature: 7, will: 6, health: 6, resources: 10, circles: 10 });
var SKILL_CAP = 6;
var CONDITION_STATUS = Object.freeze({
  hungryThirsty: "hungthurst",
  angry: "angry",
  tired: "tired",
  injured: "injured",
  sick: "sick"
});
var CONDITION_LABEL_KEYS = Object.freeze({
  hungryThirsty: "MOUSEGUARD.hungthurst",
  angry: "MOUSEGUARD.angry",
  tired: "MOUSEGUARD.tired",
  injured: "MOUSEGUARD.injured",
  sick: "MOUSEGUARD.sick"
});
function abilityLabelKey(key, actorType) {
  if (key === "nature") {
    if (actorType === "weasel") return "MOUSEGUARD.WNature";
    if (actorType === "animal") return "MOUSEGUARD.Nature";
    return "MOUSEGUARD.MNature";
  }
  return ABILITY_LABEL_KEYS[key] ?? null;
}
function abilityLabel(ability, actorType) {
  const key = ability?.system?.key;
  if (key === "nature" && actorType === "animal") {
    const species = String(ability?.parent?.system?.species ?? "").trim();
    if (species) return game.i18n.format("MOUSEGUARD.AnimalSheet.NatureOf", { species });
  }
  const labelKey = key ? abilityLabelKey(key, actorType) : null;
  if (labelKey) return game.i18n.localize(labelKey);
  return itemLabel(ability);
}
function itemLabel(item) {
  const name = item?.name ?? "";
  return typeof name === "string" && name.startsWith("MOUSEGUARD.") ? game.i18n.localize(name) : name;
}

// module/rolls/pool.js
var loc = (key) => game.i18n.localize(key);
var fmt = (key, data) => game.i18n.format(key, data);
var int = (value, fallback = 0) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
};
var LIMITS = Object.freeze({
  helpers: [0, 10],
  wiseHelp: [0, 10],
  persona: [0, 3],
  ob: [0, 10],
  opponent: [0, 30],
  modifier: [-10, 10]
});
function defaultTestState(actor, preset = {}) {
  return {
    subjectId: "",
    natureInstead: false,
    recovery: false,
    ob: 0,
    versus: false,
    opponent: 0,
    helpers: 0,
    wiseHelp: 0,
    wiseHelpers: [],
    gear: false,
    supplies: false,
    homeTown: false,
    contact: false,
    modifier: 0,
    traitFor: "",
    traitAgainst: "",
    againstMode: "self",
    persona: 0,
    tapNature: false,
    inNature: false,
    markAdvancement: null,
    // null = follow the default (setting, Ob > 0, player character)
    messageMode: "",
    ...preset
  };
}
function hasRewards(actor) {
  return actor?.type === "character" && !!actor.system?.rewards;
}
function listSubjects(actor) {
  if (actor?.type === "animal") {
    const nature = actor.getAbility?.("nature");
    return { abilities: nature ? [nature] : [], skills: [] };
  }
  const order = (item) => {
    const i = ABILITY_ORDER.indexOf(item.system?.key);
    return i === -1 ? ABILITY_ORDER.length : i;
  };
  const abilities = [...actor.itemTypes.ability ?? []].sort((a, b) => order(a) - order(b) || a.sort - b.sort);
  const skills = [...actor.itemTypes.skill ?? []].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), game.i18n.lang));
  return { abilities, skills };
}
function subjectLabel(actor, item) {
  if (!item) return "";
  return item.type === "ability" ? abilityLabel(item, actor.type) : itemLabel(item);
}
function traitAvailableFor(trait) {
  const level = int(trait?.system?.level, 1);
  if (level >= 3) return true;
  return int(trait?.system?.usedFor) < level;
}
function tiebreakerAbility(actor, ctx) {
  if (actor.type === "animal") return "nature";
  if (ctx.kind === "skill" || ctx.kind === "beginnersLuck") return ctx.subject?.system?.beginnersLuck === "health" ? "health" : "will";
  if (ctx.rollKey === "will" || ctx.rollKey === "health") return "nature";
  if (ctx.rollKey === "nature") return "will";
  return "will";
}
function computeTest(actor, state) {
  const ctx = {
    subject: null,
    kind: null,
    rollItem: null,
    rollKey: null,
    label: "",
    testedItem: null,
    parts: [],
    warnings: [],
    blocked: null,
    dice: 0,
    bonusSuccesses: 0,
    helpers: 0,
    wiseHelp: 0,
    wiseHelpers: [],
    gear: 0,
    supplies: 0,
    homeTown: 0,
    contact: 0,
    modifier: 0,
    personaDice: 0,
    tapNature: false,
    inNature: false,
    natureRating: 0,
    traitFor: null,
    traitAgainst: null,
    againstMode: "self",
    againstChecks: 0,
    canHelp: false,
    canPersona: false,
    canTapNature: false,
    personaBudget: 0,
    canRecovery: false,
    recovery: false,
    canNatureInstead: false,
    natureInstead: false,
    resCirc: false,
    natureTest: false,
    beginnersLuck: null,
    rewards: hasRewards(actor)
  };
  const subject = actor.type === "animal" ? actor.getAbility?.("nature") ?? null : actor.items.get(state.subjectId);
  if (!subject || !["skill", "ability"].includes(subject.type)) {
    ctx.blocked = loc("MOUSEGUARD.Test.Error.NoSubject");
    return ctx;
  }
  ctx.subject = subject;
  const nature = actor.getAbility?.("nature") ?? null;
  const conditions = actor.system?.conditions ?? {};
  const isSkill = subject.type === "skill";
  const rank = isSkill ? int(subject.system.rank) : 0;
  ctx.canNatureInstead = isSkill && !!nature;
  ctx.natureInstead = ctx.canNatureInstead && !!state.natureInstead;
  const beginnersLuck = isSkill && !ctx.natureInstead && rank <= 0;
  if (!isSkill) {
    ctx.kind = "ability";
    ctx.rollItem = subject;
    ctx.rollKey = subject.system.key || null;
  } else if (ctx.natureInstead) {
    ctx.kind = "natureInstead";
    ctx.rollItem = nature;
    ctx.rollKey = "nature";
  } else if (beginnersLuck) {
    ctx.kind = "beginnersLuck";
    const key = subject.system.beginnersLuck === "health" ? "health" : "will";
    ctx.rollItem = actor.getAbility?.(key) ?? null;
    ctx.rollKey = key;
    ctx.beginnersLuck = key;
  } else {
    ctx.kind = "skill";
    ctx.rollItem = subject;
    ctx.rollKey = null;
  }
  const name = subjectLabel(actor, subject);
  ctx.label = name;
  ctx.natureTest = ctx.rollKey === "nature" && ctx.kind !== "beginnersLuck";
  ctx.resCirc = ctx.kind === "ability" && ["resources", "circles"].includes(ctx.rollKey);
  ctx.canRecovery = ctx.kind === "ability" && ["will", "health"].includes(ctx.rollKey);
  ctx.recovery = ctx.canRecovery && !!state.recovery;
  ctx.testedItem = ctx.kind === "beginnersLuck" ? null : ctx.rollItem;
  ctx.natureRating = int(nature?.system?.rating);
  if (!ctx.rollItem) {
    ctx.blocked = fmt("MOUSEGUARD.Test.Error.NoAbility", {
      ability: loc(ctx.rollKey === "health" ? "MOUSEGUARD.Health" : ctx.rollKey === "nature" ? "MOUSEGUARD.Nature" : "MOUSEGUARD.Will")
    });
    return ctx;
  }
  const rating = ctx.kind === "skill" ? rank : int(ctx.rollItem.system.rating);
  const rollLabel = subjectLabel(actor, ctx.rollItem);
  if (ctx.kind === "beginnersLuck") {
    ctx.parts.push({ label: fmt("MOUSEGUARD.Test.Part.BeginnersLuck", { ability: rollLabel }), value: `+${rating}`, kind: "base" });
  } else if (ctx.kind === "natureInstead") {
    ctx.parts.push({ label: fmt("MOUSEGUARD.Test.Part.NatureInstead", { nature: rollLabel }), value: `+${rating}`, kind: "base" });
  } else {
    ctx.parts.push({ label: name, value: `+${rating}`, kind: "base" });
  }
  const penaltyApplies = !ctx.resCirc && !ctx.recovery;
  let base = rating;
  if (penaltyApplies) {
    for (const key of ["injured", "sick"]) {
      if (!conditions[key]) continue;
      base -= 1;
      ctx.parts.push({ label: loc(`MOUSEGUARD.${key}`), value: "\u22121", kind: "negative" });
    }
  }
  const reducedToZero = penaltyApplies && rating > 0 && base <= 0;
  if (reducedToZero) {
    ctx.blocked = ctx.kind === "beginnersLuck" ? fmt("MOUSEGUARD.Test.Error.BeginnersLuckReduced", { ability: rollLabel }) : fmt("MOUSEGUARD.Test.Error.Reduced", { name: rollLabel });
  }
  base = Math.max(0, base);
  const resourcesZero = ctx.kind === "ability" && ctx.rollKey === "resources" && rating <= 0;
  ctx.canHelp = !ctx.recovery && !reducedToZero;
  if (ctx.canHelp) {
    ctx.helpers = Math.clamp(int(state.helpers), ...LIMITS.helpers);
    const selected = Array.isArray(state.wiseHelpers) ? state.wiseHelpers.filter(Boolean) : [];
    ctx.wiseHelpers = selected;
    ctx.wiseHelp = Math.clamp(int(state.wiseHelp), ...LIMITS.wiseHelp) + selected.length;
  }
  if (ctx.helpers) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Helpers"), value: `+${ctx.helpers}`, kind: "positive" });
  if (ctx.wiseHelp) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.WiseHelp"), value: `+${ctx.wiseHelp}`, kind: "positive" });
  ctx.gear = state.gear ? 1 : 0;
  ctx.supplies = state.supplies ? 1 : 0;
  if (ctx.gear) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Gear"), value: "+1", kind: "positive" });
  if (ctx.supplies) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Supplies"), value: "+1", kind: "positive" });
  if (ctx.resCirc) {
    ctx.homeTown = state.homeTown ? 1 : 0;
    ctx.contact = ctx.rollKey === "circles" && state.contact ? 1 : 0;
    if (ctx.homeTown) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.HomeTown"), value: "+1", kind: "positive" });
    if (ctx.contact) ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Contact"), value: "+1", kind: "positive" });
  }
  let dice = base + ctx.helpers + ctx.wiseHelp + ctx.gear + ctx.supplies + ctx.homeTown + ctx.contact;
  if (ctx.kind === "beginnersLuck") {
    const halved = Math.ceil(dice / 2);
    ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.Halved"), value: `${dice} \u2192 ${halved}`, kind: "neutral" });
    dice = halved;
  }
  if (resourcesZero && !ctx.helpers && !ctx.blocked) ctx.blocked = loc("MOUSEGUARD.Test.Error.ResourcesZero");
  const traitFor = actor.items.get(state.traitFor);
  if (traitFor?.type === "trait" && traitAvailableFor(traitFor)) {
    ctx.traitFor = traitFor;
    if (int(traitFor.system.level, 1) >= 3) {
      ctx.bonusSuccesses = 1;
      ctx.parts.push({ label: itemLabel(traitFor), value: loc("MOUSEGUARD.Test.Part.PlusSuccess"), kind: "positive" });
    } else {
      dice += 1;
      ctx.parts.push({ label: itemLabel(traitFor), value: "+1", kind: "positive" });
    }
  }
  const persona = ctx.rewards ? int(actor.system.rewards.persona) : 0;
  ctx.canPersona = ctx.rewards && !reducedToZero && !(resourcesZero && !ctx.helpers) && persona > 0;
  ctx.personaBudget = ctx.canPersona ? Math.min(3, persona) : 0;
  ctx.canTapNature = ctx.canPersona && !ctx.resCirc && !!nature;
  ctx.tapNature = ctx.canTapNature && !!state.tapNature && ctx.personaBudget >= 1;
  ctx.personaDice = ctx.canPersona ? Math.clamp(int(state.persona), 0, Math.max(0, ctx.personaBudget - (ctx.tapNature ? 1 : 0))) : 0;
  if (ctx.personaDice) {
    dice += ctx.personaDice;
    ctx.parts.push({ label: loc("MOUSEGUARD.Persona"), value: `+${ctx.personaDice}`, kind: "positive" });
  }
  if (ctx.tapNature) {
    dice += ctx.natureRating;
    ctx.parts.push({ label: loc("MOUSEGUARD.Test.Part.TapNature"), value: `+${ctx.natureRating}`, kind: "positive" });
  }
  ctx.inNature = (ctx.tapNature || ctx.natureTest) && !!state.inNature;
  const traitAgainst = actor.items.get(state.traitAgainst);
  if (traitAgainst?.type === "trait" && traitAgainst.id !== ctx.traitFor?.id) {
    ctx.traitAgainst = traitAgainst;
    ctx.againstMode = state.versus && state.againstMode === "opponent" ? "opponent" : "self";
    ctx.againstChecks = ctx.againstMode === "opponent" ? 2 : 1;
    if (ctx.againstMode === "self") {
      dice -= 1;
      ctx.parts.push({ label: itemLabel(traitAgainst), value: "\u22121", kind: "negative" });
    } else {
      ctx.parts.push({ label: itemLabel(traitAgainst), value: loc("MOUSEGUARD.Test.Part.OpponentBonus"), kind: "negative" });
    }
  }
  ctx.modifier = Math.clamp(int(state.modifier), ...LIMITS.modifier);
  if (ctx.modifier) {
    dice += ctx.modifier;
    ctx.parts.push({
      label: loc("MOUSEGUARD.Test.Part.Modifier"),
      value: ctx.modifier > 0 ? `+${ctx.modifier}` : `\u2212${Math.abs(ctx.modifier)}`,
      kind: ctx.modifier > 0 ? "positive" : "negative"
    });
  }
  ctx.dice = Math.max(0, dice);
  if (!ctx.blocked && ctx.dice === 0) ctx.warnings.push(loc("MOUSEGUARD.Test.Warning.NoDice"));
  if ((ctx.natureTest || ctx.tapNature) && ctx.natureRating <= 0) ctx.warnings.push(loc("MOUSEGUARD.Test.Warning.NatureZero"));
  return ctx;
}

// module/mousedie.js
var DieClass = foundry.dice.terms.Die;
var RollClass = foundry.dice.Roll;
var MouseDie = class extends DieClass {
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
};
var mouseChatData = async (roll, chatOptions) => {
  const isPrivate = chatOptions.isPrivate;
  return {
    formula: isPrivate ? "???" : roll.formula,
    flavor: isPrivate ? null : chatOptions.flavor,
    user: chatOptions.author ?? chatOptions.user ?? game.user.id,
    tooltip: isPrivate ? "" : await roll.getTooltip(),
    result: isPrivate ? "?" : roll.total ?? 0,
    dice_count: isPrivate ? "?" : roll.terms?.[0]?.number ?? 1,
    bonus_dice: isPrivate ? "?" : roll.options?.mouseguard?.bonusDice ?? 0,
    drop: false,
    claimed: roll.claimed ?? false
  };
};
var MouseRoll = class extends RollClass {
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
    if (!this._evaluated) await this.evaluate();
    const chatData = await mouseChatData(this, chatOptions);
    return foundry.applications.handlebars.renderTemplate(chatOptions.template, chatData);
  }
  static CHAT_TEMPLATE = "systems/mouseguard/templates/dice/roll.html";
};

// module/rolls/test.js
var SYSTEM_ID = "mouseguard";
var CARD_TEMPLATE = "systems/mouseguard/templates/rolls/test-card.hbs";
var DIALOG_TEMPLATE = "systems/mouseguard/templates/rolls/test-dialog.hbs";
var TEST_QUERY = "mouseguard.testUpdate";
var loc2 = (key) => game.i18n.localize(key);
var fmt2 = (key, data) => game.i18n.format(key, data);
var int2 = (value, fallback = 0) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
};
var lastObstacles = /* @__PURE__ */ new Map();
function getLastOb(actor) {
  return lastObstacles.get(actor?.uuid) ?? 0;
}
function autoMarkAdvancement() {
  try {
    return game.settings.get(SYSTEM_ID, "autoMarkAdvancement") !== false;
  } catch (err) {
    return true;
  }
}
function defaultMessageMode() {
  try {
    if (CONFIG.ChatMessage?.modes) return game.settings.get("core", "messageMode");
    return game.settings.get("core", "rollMode");
  } catch (err) {
    return "public";
  }
}
function messageModeChoices() {
  if (CONFIG.ChatMessage?.modes) {
    return Object.entries(CONFIG.ChatMessage.modes).map(([value, mode]) => ({ value, label: loc2(mode.label) }));
  }
  return Object.entries(CONFIG.Dice?.rollModes ?? {}).map(([value, mode]) => ({
    value,
    label: loc2(typeof mode === "string" ? mode : mode.label)
  }));
}
var DICE_IMG = {
  snake: "systems/mouseguard/assets/dice/snake.png",
  sword: "systems/mouseguard/assets/dice/sword.png",
  axe: "systems/mouseguard/assets/dice/axe.png"
};
var faceOf = (r) => r >= 6 ? "axe" : r >= 4 ? "sword" : "snake";
async function rollMouseDice(n) {
  if (!(n > 0)) return { roll: null, results: [] };
  const roll = new MouseRoll(`${n}dmcs>3`);
  await roll.evaluate();
  const results = roll.dice.flatMap((d) => d.results.filter((r) => r.active !== false).map((r) => r.result));
  return { roll, results };
}
async function showDice(roll, message) {
  if (!roll) return;
  if (game.dice3d) {
    try {
      await game.dice3d.showForRoll(roll, game.user, true, message?.whisper?.length ? message.whisper : null, !!message?.blind);
      return;
    } catch (err) {
      console.warn("Mouse Guard | Dice So Nice failed", err);
    }
  }
  try {
    foundry.audio?.AudioHelper?.play({ src: CONFIG.sounds.dice, volume: 0.8, autoplay: true, loop: false }, false);
  } catch (err) {
  }
}
function recordActor(record, message) {
  let actor = null;
  try {
    actor = record?.actorUuid ? fromUuidSync(record.actorUuid) : null;
  } catch (err) {
    actor = null;
  }
  if (!actor && message) actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
  return actor instanceof Actor ? actor : null;
}
async function updateAsOwner(doc, changes, { message = null } = {}) {
  if (!doc) return false;
  if (doc.isOwner) {
    await doc.update(changes);
    return true;
  }
  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NoGM"));
    return false;
  }
  try {
    await gm.query(TEST_QUERY, { uuid: doc.uuid, changes, messageUuid: message?.uuid ?? null }, { timeout: 2e4 });
    return true;
  } catch (err) {
    console.error("Mouse Guard | GM relay failed", err);
    ui.notifications.error(loc2("MOUSEGUARD.Test.Error.RelayFailed"));
    return false;
  }
}
function computeResult(record) {
  const active = record.dice.filter((d) => !d.replaced);
  const rolled = active.filter((d) => d.r >= 4).length;
  let successes = rolled;
  const ob = int2(record.ob);
  const bonus = int2(record.bonusSuccesses);
  let passed = false;
  let tie = false;
  let margin = 0;
  if (record.versus) {
    const opp = int2(record.opponent);
    if (record.used?.tieTrait && successes <= opp) {
      passed = false;
      margin = 1;
    } else {
      if (bonus && successes >= opp) successes += bonus;
      tie = successes === opp;
      passed = successes > opp;
      margin = Math.abs(successes - opp);
    }
  } else {
    const pass = (n) => ob > 0 ? n >= ob : n >= 1;
    if (bonus && pass(successes)) successes += bonus;
    passed = pass(successes);
    margin = passed ? Math.max(0, successes - ob) : Math.max(0, ob - successes);
  }
  const outcome = tie ? "tie" : passed ? "pass" : "fail";
  return { successes, rolled, passed, tie, margin, outcome };
}
function natureTax(record, result) {
  if (result.tie) return 0;
  const marginOfFailure = result.passed ? 0 : result.margin;
  if (record.tapNature) {
    if (result.passed) return record.inNature ? 0 : 1;
    return Math.max(1, marginOfFailure);
  }
  if (record.natureTest) {
    if (result.passed || record.inNature) return 0;
    return marginOfFailure;
  }
  return 0;
}
var snapshot = (item) => {
  if (!item) return null;
  const s = item.system;
  const base = { advancement: { passed: int2(s.advancement?.passed), failed: int2(s.advancement?.failed) } };
  if (item.type === "skill") return { ...base, rank: int2(s.rank), learning: int2(s.learning) };
  return { ...base, rating: int2(s.rating), max: int2(s.max) };
};
async function revertAdvancement(actor, applied) {
  const item = actor.items.get(applied.itemId);
  if (!item) return;
  if (!applied.leveledUp) {
    await actor.markAdvancement(item.id, applied.mark, -1, { levelUp: false, notify: false });
    return;
  }
  const now = snapshot(item);
  const before = applied.before ?? {};
  const after = applied.after ?? {};
  if (item.type === "skill") {
    if (now.rank === after.rank) await item.update({ "system.rank": before.rank, "system.advancement": before.advancement });
  } else if (item.system.key === "nature") {
    if (now.max === after.max) {
      await item.update({
        "system.max": before.max,
        "system.rating": Math.clamp(now.rating - 1, 0, before.max),
        "system.advancement": before.advancement
      });
    }
  } else if (now.rating === after.rating) {
    await item.update({ "system.rating": before.rating, "system.advancement": before.advancement });
  }
}
async function applyConsequences(actor, record, { initial = false, message = null, deferred = null } = {}) {
  const result = computeResult(record);
  record.result = result;
  record.applied ??= {};
  const applied = record.applied;
  const canWrite = actor?.isOwner;
  if (initial && canWrite && record.beginnersLuck && record.subjectId && actor.type === "character") {
    const before = snapshot(actor.items.get(record.subjectId));
    const res = await actor.markLearning(record.subjectId, 1, { notify: false });
    if (res) applied.learning = { itemId: record.subjectId, before, value: res.learning, target: res.target, learned: res.learned };
  }
  const desiredMark = actor?.type === "character" && record.markAdvancement && record.testedItemId && !result.tie ? result.passed ? "passed" : "failed" : null;
  const current = applied.advancement ?? null;
  if (canWrite && (current?.mark ?? null) !== desiredMark) {
    if (current?.mark) await revertAdvancement(actor, current);
    applied.advancement = null;
    const item = desiredMark ? actor.items.get(record.testedItemId) : null;
    if (item) {
      const before = snapshot(item);
      const res = await actor.markAdvancement(item.id, desiredMark, 1, { notify: false });
      applied.advancement = {
        itemId: item.id,
        mark: desiredMark,
        before,
        after: snapshot(actor.items.get(item.id)),
        leveledUp: !!res?.leveledUp,
        value: res?.value ?? null
      };
    }
  }
  const nature = actor?.type === "character" ? actor.getAbility?.("nature") : null;
  const desiredTax = nature ? natureTax(record, result) : 0;
  const appliedTax = int2(applied.tax?.amount);
  if (canWrite && nature && desiredTax !== appliedTax) {
    const rating = int2(nature.system.rating);
    const max = Math.max(int2(nature.system.max), rating);
    const next = Math.clamp(rating + appliedTax - desiredTax, 0, max);
    await nature.update({ "system.rating": next, "system.max": max });
    applied.tax = { itemId: nature.id, amount: desiredTax, rating: next, max };
  } else if (applied.tax && nature) {
    applied.tax.rating = int2(nature.system.rating);
  }
  const desiredWise = result.tie ? null : result.passed ? "pass" : "fail";
  applied.wiseMarks ??= [];
  for (const helper of record.wiseHelpers ?? []) {
    const entry = applied.wiseMarks.find((w) => w.uuid === helper.uuid) ?? { uuid: helper.uuid, mark: null, set: false };
    if (entry.mark === desiredWise) continue;
    let wise = null;
    try {
      wise = fromUuidSync(helper.uuid);
    } catch (err) {
      wise = null;
    }
    if (wise?.type !== "wise") continue;
    const changes = {};
    if (entry.mark && entry.set) changes[`system.checks.${entry.mark}`] = false;
    entry.set = false;
    if (desiredWise && !wise.system.checks?.[desiredWise]) {
      changes[`system.checks.${desiredWise}`] = true;
      entry.set = true;
    }
    entry.mark = desiredWise;
    if (!foundry.utils.isEmpty(changes)) {
      if (!wise.isOwner && !message && Array.isArray(deferred)) deferred.push({ wise, changes });
      else await updateAsOwner(wise, changes, { message });
    }
    if (!applied.wiseMarks.includes(entry)) applied.wiseMarks.push(entry);
  }
  return result;
}
async function performTest(actor, state) {
  if (!actor?.isOwner) {
    ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NotOwner"));
    return null;
  }
  const ctx = computeTest(actor, state);
  if (ctx.blocked) {
    ui.notifications.warn(ctx.blocked);
    return null;
  }
  const personaSpent = ctx.personaDice + (ctx.tapNature ? 1 : 0);
  if (personaSpent > 0) {
    const available = int2(actor.system.rewards?.persona);
    if (available < personaSpent) {
      ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NoPersona"));
      return null;
    }
    await actor.update({ "system.rewards.persona": available - personaSpent });
  }
  if (ctx.traitFor) await actor.useTrait(ctx.traitFor.id, "for", { notify: false });
  if (ctx.traitAgainst) await actor.useTrait(ctx.traitAgainst.id, "against", { checks: ctx.againstChecks, notify: false });
  const { roll, results } = await rollMouseDice(ctx.dice);
  const ob = Math.clamp(int2(state.ob), 0, 10);
  const versus = !!state.versus;
  const markAdvancement = state.markAdvancement ?? defaultMarkAdvancement(actor, { ...state, ob });
  const wiseHelpers = (ctx.wiseHelpers ?? []).map((uuid) => {
    let wise = null;
    try {
      wise = fromUuidSync(uuid);
    } catch (err) {
      wise = null;
    }
    return { uuid, name: wise ? itemLabel(wise) : "", actorName: wise?.actor?.name ?? "" };
  }).filter((w) => w.name);
  const record = {
    v: 1,
    actorUuid: actor.uuid,
    subjectId: ctx.subject.id,
    subjectType: ctx.subject.type,
    kind: ctx.kind,
    label: ctx.label,
    rollLabel: subjectLabel(actor, ctx.rollItem),
    rollKey: ctx.rollKey,
    testedItemId: ctx.testedItem?.id ?? null,
    beginnersLuck: ctx.beginnersLuck,
    natureTest: ctx.natureTest,
    recovery: ctx.recovery,
    tiebreakerKey: tiebreakerAbility(actor, ctx),
    ob,
    versus,
    opponent: versus ? Math.clamp(int2(state.opponent), 0, 30) : 0,
    pool: ctx.dice,
    parts: ctx.parts,
    bonusSuccesses: ctx.bonusSuccesses,
    helpers: ctx.helpers,
    wiseHelp: ctx.wiseHelp,
    wiseHelpers,
    persona: ctx.personaDice,
    tapNature: ctx.tapNature,
    inNature: ctx.inNature,
    traitFor: ctx.traitFor ? { id: ctx.traitFor.id, name: itemLabel(ctx.traitFor), level: int2(ctx.traitFor.system.level, 1) } : null,
    traitAgainst: ctx.traitAgainst ? { id: ctx.traitAgainst.id, name: itemLabel(ctx.traitAgainst), mode: ctx.againstMode, checks: hasRewards(actor) ? ctx.againstChecks : 0 } : null,
    markAdvancement: !!markAdvancement,
    dice: results.map((r, i) => ({ id: i, r, src: "pool", replaced: false, exploded: false })),
    used: { fate: false, deeper: null, ofCourse: null, tieTrait: null, tiebreaker: false },
    spent: { persona: personaSpent, fate: 0 },
    applied: {}
  };
  const deferredWise = [];
  await applyConsequences(actor, record, { initial: true, deferred: deferredWise });
  const content = await renderTestCard(record, actor);
  const messageMode = state.messageMode || defaultMessageMode();
  const data = {
    author: game.user.id,
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content,
    rolls: roll ? [roll] : [],
    flags: { [SYSTEM_ID]: { test: record } }
  };
  if (roll) data.sound = CONFIG.sounds.dice;
  const options = CONFIG.ChatMessage?.modes ? { messageMode } : { rollMode: messageMode };
  lastObstacles.set(actor.uuid, ob);
  const message = await ChatMessage.implementation.create(data, options);
  for (const { wise, changes } of deferredWise) await updateAsOwner(wise, changes, { message });
  if (message && state.tiebreakerFor) await markTiebreakerRolled(state.tiebreakerFor);
  return message;
}
async function markTiebreakerRolled(originUuid) {
  const origin = await fromUuid(originUuid).catch(() => null);
  const stored = origin?.getFlag?.(SYSTEM_ID, "test");
  if (!stored || stored.used?.tiebreaker) return;
  const record = foundry.utils.deepClone(stored);
  record.used = { ...record.used ?? {}, tiebreaker: true };
  const content = await renderTestCard(record, recordActor(record, origin));
  await updateAsOwner(origin, { content, [`flags.${SYSTEM_ID}.test`]: record });
}
function defaultMarkAdvancement(actor, state) {
  return autoMarkAdvancement() && actor?.type === "character" && (!!state?.versus || int2(state?.ob) > 0);
}
var hasAllWiseMarks = (wise) => {
  const c = wise?.system?.checks ?? {};
  return !!(c.pass && c.fail && c.figuredOut && c.realized);
};
function availableActions(record, actor) {
  const result = record.result ?? computeResult(record);
  const active = record.dice.filter((d) => !d.replaced);
  const rewards = hasRewards(actor);
  const wises = actor?.itemTypes?.wise ?? [];
  const usedWises = [record.used.deeper, record.used.ofCourse].filter(Boolean);
  const freeWises = wises.filter((w) => !usedWises.includes(w.id));
  const resolvedTie = !!record.used.tieTrait || !!record.used.tiebreaker;
  const actions = [];
  if (rewards && !record.used.fate && !resolvedTie && active.some((d) => d.r === 6 && !d.exploded)) {
    actions.push({ action: "fate", icon: "fa-solid fa-hand-sparkles", label: loc2("MOUSEGUARD.Test.Action.Fate"), hint: loc2("MOUSEGUARD.Test.Action.FateHint") });
  }
  if (rewards && !record.used.ofCourse && !record.used.fate && !resolvedTie && freeWises.length && active.some((d) => d.r <= 3 && d.src !== "fate")) {
    actions.push({ action: "ofCourse", icon: "fa-solid fa-lightbulb", label: loc2("MOUSEGUARD.Test.Action.OfCourse"), hint: loc2("MOUSEGUARD.Test.Action.OfCourseHint") });
  }
  if (rewards && !record.used.deeper && !resolvedTie && freeWises.length && active.some((d) => d.r <= 3 && d.src === "pool")) {
    actions.push({ action: "deeper", icon: "fa-solid fa-magnifying-glass", label: loc2("MOUSEGUARD.Test.Action.Deeper"), hint: loc2("MOUSEGUARD.Test.Action.DeeperHint") });
  }
  if (record.versus && result.tie) {
    const traits = (actor?.itemTypes?.trait ?? []).filter((t) => t.id !== record.traitFor?.id);
    if (!record.used.fate && !record.traitAgainst && !resolvedTie && traits.length) {
      actions.push({
        action: "tieTrait",
        icon: "fa-solid fa-handshake-angle",
        label: loc2("MOUSEGUARD.Test.Action.TieTrait"),
        hint: loc2(rewards ? "MOUSEGUARD.Test.Action.TieTraitHint" : "MOUSEGUARD.Test.Action.TieTraitHintNoChecks")
      });
    }
    if (!resolvedTie) {
      actions.push({ action: "tiebreaker", icon: "fa-solid fa-scale-balanced", label: loc2("MOUSEGUARD.Test.Action.Tiebreaker"), hint: loc2("MOUSEGUARD.Test.Action.TiebreakerHint") });
    }
  }
  return actions;
}
async function renderTestCard(record, actor) {
  const result = record.result ?? computeResult(record);
  const abilityName = (key) => {
    const item = actor?.getAbility?.(key);
    return item ? subjectLabel(actor, item) : loc2(`MOUSEGUARD.${key === "nature" ? "Nature" : key.charAt(0).toUpperCase() + key.slice(1)}`);
  };
  const dice = record.dice.map((d) => {
    const face = faceOf(d.r);
    const cls = [face, d.r >= 4 ? "success" : "failure", `src-${d.src}`];
    if (d.replaced) cls.push("replaced");
    if (d.exploded) cls.push("exploded");
    return { img: DICE_IMG[face], cls: cls.join(" "), title: `${d.r}` };
  });
  const kindKey = {
    skill: "MOUSEGUARD.Test.Kind.Skill",
    ability: "MOUSEGUARD.Test.Kind.Ability",
    beginnersLuck: "MOUSEGUARD.Test.Kind.BeginnersLuck",
    natureInstead: "MOUSEGUARD.Test.Kind.NatureInstead"
  }[record.kind] ?? "MOUSEGUARD.Test.Kind.Ability";
  let outcomeClass = "partial";
  let outcomeLabel = fmt2("MOUSEGUARD.Test.Card.Successes", { n: result.successes });
  if (record.versus) {
    outcomeClass = result.tie ? "partial" : result.passed ? "success" : "failure";
    outcomeLabel = loc2(result.tie ? "MOUSEGUARD.Test.Card.Tie" : result.passed ? "MOUSEGUARD.Test.Card.Won" : "MOUSEGUARD.Test.Card.Lost");
  } else if (record.ob > 0) {
    outcomeClass = result.passed ? "success" : "failure";
    outcomeLabel = loc2(result.passed ? "MOUSEGUARD.Test.Card.Passed" : "MOUSEGUARD.Test.Card.Failed");
  }
  const heading = record.versus ? fmt2("MOUSEGUARD.Test.Card.VersusHeading", { successes: result.successes, opponent: record.opponent }) : record.ob > 0 ? fmt2("MOUSEGUARD.Test.Card.ObHeading", { successes: result.successes, ob: record.ob }) : fmt2("MOUSEGUARD.Test.Card.NoObHeading", { successes: result.successes });
  let marginText = "";
  if (!result.tie && result.margin > 0 && (record.versus || record.ob > 0)) {
    marginText = fmt2(result.passed ? "MOUSEGUARD.Test.Card.MarginSuccess" : "MOUSEGUARD.Test.Card.MarginFailure", { n: result.margin });
  }
  const notes = [];
  if (record.spent?.persona) notes.push(fmt2("MOUSEGUARD.Test.Note.PersonaSpent", { n: record.spent.persona }));
  if (record.tapNature) notes.push(loc2(record.inNature ? "MOUSEGUARD.Test.Note.TapNatureWithin" : "MOUSEGUARD.Test.Note.TapNatureOutside"));
  if (record.traitFor) {
    notes.push(fmt2(record.traitFor.level >= 3 ? "MOUSEGUARD.Test.Note.TraitForSuccess" : "MOUSEGUARD.Test.Note.TraitFor", { name: record.traitFor.name }));
  }
  const earnsChecks = hasRewards(actor);
  if (record.traitAgainst) {
    const key = record.traitAgainst.mode === "opponent" ? "MOUSEGUARD.Test.Note.TraitAgainstOpponent" : "MOUSEGUARD.Test.Note.TraitAgainst";
    notes.push(fmt2(record.traitAgainst.checks ? key : `${key}NoChecks`, { name: record.traitAgainst.name, n: record.traitAgainst.checks }));
  }
  if (record.used.tieTrait) {
    const trait = actor?.items.get(record.used.tieTrait);
    notes.push(fmt2(earnsChecks ? "MOUSEGUARD.Test.Note.TieTrait" : "MOUSEGUARD.Test.Note.TieTraitNoChecks", { name: trait ? itemLabel(trait) : "?" }));
  }
  if (record.used.fate) notes.push(loc2("MOUSEGUARD.Test.Note.FateUsed"));
  for (const [key, labelKey] of [["deeper", "MOUSEGUARD.Test.Note.DeeperUsed"], ["ofCourse", "MOUSEGUARD.Test.Note.OfCourseUsed"]]) {
    const id = record.used[key];
    if (!id) continue;
    const wise = actor?.items.get(id);
    notes.push(fmt2(labelKey, { name: wise ? itemLabel(wise) : "?" }));
    if (wise && hasAllWiseMarks(wise)) notes.push(fmt2("MOUSEGUARD.Test.Note.WiseInsight", { name: itemLabel(wise) }));
  }
  for (const helper of record.wiseHelpers ?? []) {
    notes.push(fmt2("MOUSEGUARD.Test.Note.WiseHelper", { name: helper.name, actor: helper.actorName }));
  }
  const applied = record.applied ?? {};
  if (applied.learning) {
    const item = actor?.items.get(applied.learning.itemId);
    const name = item ? itemLabel(item) : record.label;
    notes.push(applied.learning.learned ? fmt2("MOUSEGUARD.Test.Note.SkillLearned", { name }) : fmt2("MOUSEGUARD.Test.Note.LearningMark", { name, n: applied.learning.value, target: applied.learning.target }));
  }
  if (applied.advancement) {
    const item = actor?.items.get(applied.advancement.itemId);
    const name = item ? subjectLabel(actor, item) : record.label;
    notes.push(fmt2(applied.advancement.mark === "passed" ? "MOUSEGUARD.Test.Note.MarkPassed" : "MOUSEGUARD.Test.Note.MarkFailed", { name }));
    if (applied.advancement.leveledUp) notes.push(fmt2("MOUSEGUARD.Test.Note.Advanced", { name, value: applied.advancement.value }));
  } else if (record.markAdvancement && result.tie) {
    notes.push(loc2("MOUSEGUARD.Test.Note.NoMarkTie"));
  }
  if (applied.tax?.amount) {
    notes.push(fmt2("MOUSEGUARD.Test.Note.NatureTaxed", { n: applied.tax.amount, rating: applied.tax.rating, max: applied.tax.max }));
    if (applied.tax.rating <= 0) notes.push(loc2("MOUSEGUARD.Test.Note.NatureZero"));
  }
  const hints = [];
  if (result.tie) hints.push(fmt2("MOUSEGUARD.Test.Hint.Tie", { ability: abilityName(record.tiebreakerKey ?? "will") }));
  else if (!result.passed && (record.versus || record.ob > 0)) {
    hints.push(loc2(record.recovery ? "MOUSEGUARD.Test.Hint.RecoveryFailed" : "MOUSEGUARD.Test.Hint.Failed"));
    if (record.helpers > 0 && !record.recovery) hints.push(loc2("MOUSEGUARD.Test.Hint.HelpersShare"));
  }
  const context = {
    actorName: actor?.name ?? "",
    actorImg: actor?.img ?? "",
    title: record.label,
    kind: loc2(kindKey),
    rollLabel: record.kind === "skill" || record.kind === "ability" ? "" : record.rollLabel,
    parts: record.parts,
    pool: record.pool,
    dice,
    outcomeClass,
    outcomeIcon: { success: "fa-check", failure: "fa-xmark" }[outcomeClass] ?? "fa-scale-balanced",
    outcomeLabel,
    heading,
    marginText,
    notes,
    hints,
    actions: availableActions(record, actor)
  };
  return foundry.applications.handlebars.renderTemplate(CARD_TEMPLATE, context);
}
var busy = /* @__PURE__ */ new Set();
async function pickItem(items, { title, prompt }) {
  if (!items.length) return null;
  const options = items.map((i) => `<option value="${i.id}">${foundry.utils.escapeHTML(itemLabel(i))}</option>`).join("");
  const content = `<div class="mg-test-pick"><p>${prompt}</p><div class="form-group"><select name="itemId">${options}</select></div></div>`;
  const response = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    classes: ["mg-test-pick-dialog"],
    content,
    rejectClose: false,
    ok: {
      label: loc2("MOUSEGUARD.Test.Dialog.Confirm"),
      callback: (_event, button) => button.form.elements.itemId?.value ?? null
    }
  });
  return response ? items.find((i) => i.id === response) ?? null : null;
}
async function handleCardAction(message, action) {
  const stored = message?.getFlag(SYSTEM_ID, "test");
  if (!stored) return;
  const record = foundry.utils.deepClone(stored);
  const actor = recordActor(record, message);
  if (!actor?.isOwner) {
    ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NotOwner"));
    return;
  }
  if (!message.isOwner && !game.users.activeGM) {
    ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NoGM"));
    return;
  }
  if (busy.has(message.id)) return;
  busy.add(message.id);
  try {
    record.used ??= { fate: false, deeper: null, ofCourse: null, tieTrait: null, tiebreaker: false };
    record.spent ??= { persona: 0, fate: 0 };
    const allowed = availableActions(record, actor).some((a) => a.action === action);
    if (!allowed) {
      ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.ActionUnavailable"));
      return;
    }
    let nextId = record.dice.reduce((m, d) => Math.max(m, d.id), -1) + 1;
    const rewards = actor.system.rewards ?? {};
    if (action === "tiebreaker") {
      await actor.rollTest({ abilityKey: record.tiebreakerKey ?? "will", state: { versus: true, tiebreakerFor: message.uuid } });
      return;
    }
    if (action === "fate") {
      if (int2(rewards.fate) < 1) return ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NoFate"));
      await actor.update({ "system.rewards.fate": int2(rewards.fate) - 1 });
      record.spent.fate += 1;
      record.used.fate = true;
      let pending = record.dice.filter((d) => !d.replaced && d.r === 6 && !d.exploded);
      for (let guard = 0; pending.length && guard < 100; guard++) {
        for (const d of pending) d.exploded = true;
        const { roll, results } = await rollMouseDice(pending.length);
        await showDice(roll, message);
        const added = results.map((r) => ({ id: nextId++, r, src: "fate", replaced: false, exploded: false }));
        record.dice.push(...added);
        pending = added.filter((d) => d.r === 6);
      }
    } else if (action === "deeper" || action === "ofCourse") {
      const usedWises = [record.used.deeper, record.used.ofCourse].filter(Boolean);
      const wises = actor.itemTypes.wise.filter((w) => !usedWises.includes(w.id));
      const isDeeper = action === "deeper";
      const wise = await pickItem(wises, {
        title: loc2(isDeeper ? "MOUSEGUARD.Test.Action.Deeper" : "MOUSEGUARD.Test.Action.OfCourse"),
        prompt: loc2(isDeeper ? "MOUSEGUARD.Test.Dialog.PickWiseDeeper" : "MOUSEGUARD.Test.Dialog.PickWiseOfCourse")
      });
      if (!wise) return;
      const fresh = actor.system.rewards ?? {};
      if (isDeeper && int2(fresh.fate) < 1) return ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NoFate"));
      if (!isDeeper && int2(fresh.persona) < 1) return ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.NoPersona"));
      const targets = isDeeper ? record.dice.filter((d) => !d.replaced && d.r <= 3 && d.src === "pool").slice(0, 1) : record.dice.filter((d) => !d.replaced && d.r <= 3 && d.src !== "fate");
      if (!targets.length) return ui.notifications.warn(loc2("MOUSEGUARD.Test.Error.ActionUnavailable"));
      if (isDeeper) {
        await actor.update({ "system.rewards.fate": int2(fresh.fate) - 1 });
        record.spent.fate += 1;
        record.used.deeper = wise.id;
      } else {
        await actor.update({ "system.rewards.persona": int2(fresh.persona) - 1 });
        record.spent.persona += 1;
        record.used.ofCourse = wise.id;
      }
      await wise.update({ [`system.checks.${isDeeper ? "figuredOut" : "realized"}`]: true });
      const { roll, results } = await rollMouseDice(targets.length);
      await showDice(roll, message);
      targets.forEach((d, i) => {
        d.replaced = true;
        record.dice.push({ id: nextId++, r: results[i], src: action, replaced: false, exploded: false });
      });
    } else if (action === "tieTrait") {
      const traits = actor.itemTypes.trait.filter((t) => t.id !== record.traitFor?.id);
      const trait = await pickItem(traits, {
        title: loc2("MOUSEGUARD.Test.Action.TieTrait"),
        prompt: loc2("MOUSEGUARD.Test.Dialog.PickTraitTie")
      });
      if (!trait) return;
      await actor.useTrait(trait.id, "against", { checks: 2, notify: false });
      record.used.tieTrait = trait.id;
    }
    await applyConsequences(actor, record, { message });
    const content = await renderTestCard(record, actor);
    await updateAsOwner(message, { content, [`flags.${SYSTEM_ID}.test`]: record });
  } finally {
    busy.delete(message.id);
  }
}
function onRenderChatMessage(message, html) {
  const record = message?.flags?.[SYSTEM_ID]?.test;
  if (!record || !(html instanceof HTMLElement)) return;
  const actor = recordActor(record, message);
  const canAct = !!actor?.isOwner;
  const bar = html.querySelector(".mg-test-card .mg-test-actions");
  if (!bar) return;
  if (!canAct) {
    bar.remove();
    return;
  }
  const buttons = [...bar.querySelectorAll("button[data-mg-action]")];
  const refresh = () => {
    const rewards = actor.system?.rewards ?? {};
    for (const button of buttons) {
      const action = button.dataset.mgAction;
      const noFate = (action === "fate" || action === "deeper") && int2(rewards.fate) < 1;
      const noPersona = action === "ofCourse" && int2(rewards.persona) < 1;
      button.disabled = noFate || noPersona;
      if (noFate) button.dataset.tooltip = loc2("MOUSEGUARD.Test.Error.NoFate");
      else if (noPersona) button.dataset.tooltip = loc2("MOUSEGUARD.Test.Error.NoPersona");
    }
  };
  refresh();
  for (const button of buttons) {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      buttons.forEach((b) => b.disabled = true);
      try {
        await handleCardAction(message, button.dataset.mgAction);
      } catch (err) {
        console.error("Mouse Guard | Test action failed", err);
        ui.notifications.error(loc2("MOUSEGUARD.Test.Error.ActionFailed"));
      } finally {
        refresh();
      }
    });
  }
}

// module/rolls/test-dialog.js
var { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
var loc3 = (key) => game.i18n.localize(key);
var fmt3 = (key, data) => game.i18n.format(key, data);
var int3 = (value, fallback = 0) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
};
var NUMBER_FIELDS = /* @__PURE__ */ new Set(["ob", "opponent", "helpers", "wiseHelp", "persona", "modifier"]);
var BOOLEAN_FIELDS = /* @__PURE__ */ new Set(["natureInstead", "recovery", "versus", "gear", "supplies", "homeTown", "contact", "tapNature", "inNature", "markAdvancement"]);
var MouseGuardTestDialog = class _MouseGuardTestDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Has the user set the "mark advancement" box explicitly? Until then it follows the default. */
  _markTouched = false;
  /**
   * @param {object} options
   * @param {Actor} options.actor
   * @param {string} [options.subjectId]
   * @param {object} [options.state]
   */
  /** True while a submitted test is being rolled and applied (guards against double submits). */
  #rolling = false;
  constructor({ actor, subjectId = "", state = {}, ...options } = {}) {
    super({ id: _MouseGuardTestDialog.idFor(actor), ...options });
    this.actor = actor;
    this.testState = defaultTestState(actor, { ob: getLastOb(actor), messageMode: defaultMessageMode() });
    this.#setSubject(subjectId, state);
  }
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mg-test-dialog", "themed", "theme-light"],
    tag: "form",
    window: { title: "MOUSEGUARD.Test.Dialog.Title", icon: "fa-solid fa-dice-d6", resizable: true },
    position: { width: 460, height: "auto" },
    form: { handler: _MouseGuardTestDialog.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      step: _MouseGuardTestDialog.#onStep,
      cancel: _MouseGuardTestDialog.#onCancel
    }
  };
  /** @override */
  static PARTS = {
    form: { template: DIALOG_TEMPLATE, scrollable: [".mg-test-body"] }
  };
  /** One dialog per actor (token actors included), so several players can roll at once. */
  static idFor(actor) {
    return `mg-test-${String(actor?.uuid ?? "none").replace(/[^A-Za-z0-9_-]/g, "-")}`;
  }
  /**
   * Open (or refocus) the dialog of an actor.
   * @param {Actor} actor
   * @param {{subjectId?: string, state?: object}} [options]
   * @returns {Promise<MouseGuardTestDialog>}
   */
  static async open(actor, { subjectId = "", state = {} } = {}) {
    const existing = foundry.applications.instances?.get(_MouseGuardTestDialog.idFor(actor));
    if (existing instanceof _MouseGuardTestDialog) {
      existing.#setSubject(subjectId || existing.testState.subjectId, state);
      await existing.render({ force: true });
      existing.bringToFront?.();
      return existing;
    }
    const app = new _MouseGuardTestDialog({ actor, subjectId, state });
    await app.render({ force: true });
    return app;
  }
  /** @override */
  get title() {
    return fmt3("MOUSEGUARD.Test.Dialog.TitleFor", { name: this.actor?.name ?? "" });
  }
  /** Select what is tested and reset the options that depend on it. */
  #setSubject(subjectId, preset = {}) {
    const changed = subjectId !== this.testState.subjectId;
    this.testState.subjectId = subjectId ?? "";
    if (changed) {
      const subject = this.actor.items.get(this.testState.subjectId);
      Object.assign(this.testState, {
        natureInstead: false,
        recovery: false,
        tapNature: false,
        inNature: subject?.type === "ability" && subject.system.key === "nature",
        homeTown: false,
        contact: false
      });
    }
    Object.assign(this.testState, preset);
    if (typeof preset.markAdvancement === "boolean") this._markTouched = true;
  }
  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */
  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const state = this.testState;
    const ctx = computeTest(actor, state);
    const { abilities, skills } = listSubjects(actor);
    const option = (item) => {
      const rating = item.type === "skill" ? int3(item.system.rank) : int3(item.system.rating);
      const suffix = item.type === "skill" && rating <= 0 ? loc3("MOUSEGUARD.Test.Dialog.Untrained") : String(rating);
      return { value: item.id, label: `${subjectLabel(actor, item)} (${suffix})`, selected: item.id === state.subjectId };
    };
    const traits = actor.itemTypes.trait ?? [];
    const traitOption = (trait, mode) => {
      const level = int3(trait.system.level, 1);
      const spent = mode === "for" && !traitAvailableFor(trait);
      const key = level >= 3 ? "MOUSEGUARD.Test.Dialog.TraitLevel3" : "MOUSEGUARD.Test.Dialog.TraitLevel";
      const label = `${itemLabel(trait)} \u2014 ${fmt3(key, { level, used: int3(trait.system.usedFor) })}`;
      return {
        value: trait.id,
        label: spent ? `${label} \u2014 ${loc3("MOUSEGUARD.Test.Dialog.TraitSpent")}` : label,
        disabled: spent || mode === "against" && trait.id === state.traitFor || mode === "for" && trait.id === state.traitAgainst,
        selected: mode === "for" ? trait.id === state.traitFor : trait.id === state.traitAgainst
      };
    };
    const wiseHelpers = [];
    for (const other of game.actors ?? []) {
      if (other.type !== "character" || other.id === actor.id || !other.testUserPermission(game.user, "OBSERVER")) continue;
      for (const wise of other.itemTypes.wise ?? []) {
        wiseHelpers.push({
          uuid: wise.uuid,
          label: `${itemLabel(wise)} (${other.name})`,
          checked: state.wiseHelpers.includes(wise.uuid)
        });
      }
    }
    const markAdvancement = state.markAdvancement ?? defaultMarkAdvancement(actor, state);
    const rewards = actor.system.rewards ?? null;
    const summaryKey = state.versus ? "MOUSEGUARD.Test.Dialog.SummaryVersus" : "MOUSEGUARD.Test.Dialog.Summary";
    const isNatureSubject = ctx.kind === "ability" && ctx.rollKey === "nature";
    return Object.assign(context, {
      actor,
      state,
      ctx,
      subjectGroups: [
        { label: loc3("MOUSEGUARD.Abilities"), options: abilities.map(option) },
        { label: loc3("MOUSEGUARD.Skills"), options: skills.map(option) }
      ].filter((g) => g.options.length),
      hasSubject: !!ctx.subject,
      kindLabel: ctx.kind ? loc3({
        skill: "MOUSEGUARD.Test.Kind.Skill",
        ability: "MOUSEGUARD.Test.Kind.Ability",
        beginnersLuck: "MOUSEGUARD.Test.Kind.BeginnersLuck",
        natureInstead: "MOUSEGUARD.Test.Kind.NatureInstead"
      }[ctx.kind]) : "",
      beginnersLuckHint: ctx.kind === "beginnersLuck" ? fmt3("MOUSEGUARD.Test.Dialog.BeginnersLuckHint", {
        ability: loc3(ctx.beginnersLuck === "health" ? "MOUSEGUARD.Health" : "MOUSEGUARD.Will"),
        n: int3(ctx.subject?.system?.learning)
      }) : "",
      parts: ctx.parts.map((p) => ({ ...p, cls: p.kind === "negative" ? "negative" : p.kind === "neutral" ? "neutral" : "positive" })),
      traitsFor: traits.map((t) => traitOption(t, "for")),
      traitsAgainst: traits.map((t) => traitOption(t, "against")),
      hasTraits: traits.length > 0,
      wiseHelpers,
      hasRewards: !!rewards,
      personaAvailable: int3(rewards?.persona),
      personaMax: Math.max(0, ctx.personaBudget - (ctx.tapNature ? 1 : 0)),
      showInNature: (ctx.tapNature || ctx.natureTest) && actor.type === "character",
      againstSelf: state.againstMode !== "opponent" || !state.versus,
      againstOpponent: state.againstMode === "opponent" && !!state.versus,
      isNatureSubject,
      showHomeTown: ctx.resCirc,
      showContact: ctx.resCirc && ctx.rollKey === "circles",
      markAdvancement,
      canMark: !!ctx.testedItem && actor.type === "character",
      messageModes: messageModeChoices().map((m) => ({ ...m, selected: m.value === (state.messageMode || defaultMessageMode()) })),
      limits: LIMITS,
      summary: fmt3(summaryKey, { dice: ctx.dice, ob: int3(state.ob), opponent: int3(state.opponent) }) + (ctx.bonusSuccesses ? ` ${loc3("MOUSEGUARD.Test.Part.PlusSuccess")}` : ""),
      canRoll: !ctx.blocked
    });
  }
  /* -------------------------------------------- */
  /*  Form handling                               */
  /* -------------------------------------------- */
  /** Copy the form values into the dialog state. */
  #readForm() {
    const form = this.element;
    if (!form) return;
    const state = this.testState;
    const wiseHelpers = [];
    for (const el of form.querySelectorAll("[name]")) {
      const name = el.name;
      if (name === "wiseHelpers") {
        if (el.checked) wiseHelpers.push(el.value);
        continue;
      }
      if (el.type === "radio" && !el.checked) continue;
      if (BOOLEAN_FIELDS.has(name)) state[name] = !!el.checked;
      else if (NUMBER_FIELDS.has(name)) state[name] = int3(el.value);
      else state[name] = el.value;
    }
    state.wiseHelpers = wiseHelpers;
  }
  /** @override */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const name = event.target?.name;
    const previousSubject = this.testState.subjectId;
    this.#readForm();
    if (name === "markAdvancement") this._markTouched = true;
    if (!this._markTouched) this.testState.markAdvancement = null;
    if (name === "subjectId" && this.testState.subjectId !== previousSubject) {
      const next = this.testState.subjectId;
      this.testState.subjectId = previousSubject;
      this.#setSubject(next);
    }
    this.render();
  }
  /**
   * Stepper buttons: <button data-action="step" data-field="helpers" data-delta="1">.
   * @this {MouseGuardTestDialog}
   */
  static #onStep(event, target) {
    this.#readForm();
    if (!this._markTouched) this.testState.markAdvancement = null;
    const field = target.dataset.field;
    const [min, max] = LIMITS[field] ?? [0, 10];
    this.testState[field] = Math.clamp(int3(this.testState[field]) + int3(target.dataset.delta, 1), min, max);
    this.render();
  }
  /** @this {MouseGuardTestDialog} */
  static #onCancel() {
    this.close();
  }
  /**
   * Roll.
   * @this {MouseGuardTestDialog}
   */
  static async #onSubmit(event) {
    event?.preventDefault?.();
    if (this.#rolling) return;
    this.#rolling = true;
    const button = this.element?.querySelector("button[type=submit]");
    if (button) button.disabled = true;
    let message = null;
    try {
      this.#readForm();
      if (!this._markTouched) this.testState.markAdvancement = null;
      message = await performTest(this.actor, { ...this.testState });
    } finally {
      this.#rolling = false;
    }
    if (message) await this.close();
    else if (this.rendered) this.render();
  }
};
MouseGuardTestDialog.ABILITY_KEYS = ABILITY_ORDER;

// module/actor.js
var loc4 = (key) => game.i18n.localize(key);
var fmt4 = (key, data) => game.i18n.format(key, data);
var int4 = (value, fallback = 0) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
};
var ANIMAL_IMG = "icons/svg/pawprint.svg";
var NATURE_ASPECT_KEYS = Object.freeze({
  mouse: [
    "MOUSEGUARD.NPCSheet.AspectEscaping",
    "MOUSEGUARD.NPCSheet.AspectClimbing",
    "MOUSEGUARD.NPCSheet.AspectForaging",
    "MOUSEGUARD.NPCSheet.AspectHiding"
  ],
  weasel: [
    "MOUSEGUARD.NPCSheet.AspectAggressive",
    "MOUSEGUARD.NPCSheet.AspectBurrowRaiding",
    "MOUSEGUARD.NPCSheet.AspectGloating"
  ]
});
function hasStatusEffect(id) {
  const list = CONFIG.statusEffects;
  if (!list) return false;
  if (typeof list.find === "function" && list.find((e) => e?.id === id)) return true;
  return !!list[id];
}
var MouseGuardActor = class extends Actor {
  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
  }
  /** @inheritdoc */
  prepareData() {
    super.prepareData();
  }
  /**
   * New actors get their ability items: Nature, Will, Health, Resources and Circles for mice and weasels (weasels use
   * the weasel Nature label), Nature only for animals. NPC mice and weasels start with the nature aspects of their
   * species (book p. 30, 219); an animal's aspects are written by the GM.
   * @inheritdoc
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    const type = data.type ?? this.type;
    const changes = {};
    if (!data.img) changes.img = ["animal", "weasel"].includes(type) ? ANIMAL_IMG : "systems/mouseguard/assets/icons/seated-mouse.svg";
    const aspects = NATURE_ASPECT_KEYS[type];
    if (aspects && !this._source.system?.natureAspects?.length && !this._source.flags?.mouseguard?.aspectsSet) {
      changes["system.natureAspects"] = aspects.map(loc4);
      changes["flags.mouseguard.aspectsSet"] = true;
    }
    let keys = [];
    if (["character", "mouse", "weasel"].includes(type)) keys = [...ABILITY_ORDER];
    else if (type === "animal") keys = ["nature"];
    if (keys.length && !this.itemTypes.ability.length) {
      const species = String(this._source.system?.species ?? "").trim();
      const abilities = keys.map((key, i) => ({
        name: type === "animal" && species ? fmt4("MOUSEGUARD.AnimalSheet.NatureOf", { species }) : loc4(abilityLabelKey(key, type)),
        type: "ability",
        sort: (i + 1) * 1e5,
        system: { key, rating: 1, max: 1 },
        flags: { mouseguard: { schemaVersion: ITEM_SCHEMA_VERSION } }
      }));
      changes.items = [...this._source.items ?? [], ...abilities];
    }
    if (!foundry.utils.isEmpty(changes)) this.updateSource(changes);
    return allowed;
  }
  /* -------------------------------------------- */
  /*  Accessors                                   */
  /* -------------------------------------------- */
  /**
   * The ability item with this key.
   * @param {"nature"|"will"|"health"|"resources"|"circles"} key
   * @returns {Item|undefined}
   */
  getAbility(key) {
    if (!key) return void 0;
    return this.items.find((i) => i.type === "ability" && i.system?.key === key);
  }
  /**
   * Ability items in display order (nature, will, health, resources, circles, then anything without a key).
   * @type {Item[]}
   */
  get abilities() {
    const rank = (item) => {
      const i = ABILITY_ORDER.indexOf(item.system?.key);
      return i === -1 ? ABILITY_ORDER.length : i;
    };
    return [...this.itemTypes.ability].sort((a, b) => rank(a) - rank(b) || a.sort - b.sort);
  }
  /* -------------------------------------------- */
  /*  Advancement                                 */
  /* -------------------------------------------- */
  /**
   * Ready to advance? Rating N needs N passes and N-1 fails; rating 0 or 1 needs a single pass (book p. 247-249).
   * Nature compares the marks with its maximum (p. 248). Skills at rank 0 are learned through Beginner's Luck instead.
   * @returns {{field: string, from: number, to: number}|null}
   */
  #advancementTarget(item, advancement) {
    if (item.type === "skill") {
      const rank = int4(item.system.rank);
      if (rank <= 0 || rank >= SKILL_CAP) return null;
      if (advancement.passed >= rank && advancement.failed >= rank - 1) return { field: "rank", from: rank, to: rank + 1 };
      return null;
    }
    const key = item.system.key;
    const cap = ABILITY_CAPS[key] ?? 10;
    const value = key === "nature" ? Math.max(int4(item.system.max), int4(item.system.rating)) : int4(item.system.rating);
    if (value >= cap) return null;
    if (advancement.passed >= Math.max(1, value) && advancement.failed >= Math.max(0, value - 1)) {
      return { field: key === "nature" ? "max" : "rating", from: value, to: value + 1 };
    }
    return null;
  }
  /**
   * Add (or remove) a pass/fail advancement mark on a skill or ability. When the marks are complete the rating goes
   * up by one and all marks are erased (Nature: maximum and current rating both go up).
   * @param {string} itemId
   * @param {"passed"|"failed"|"pass"|"fail"} type
   * @param {number} [delta=1]
   * @param {{levelUp?: boolean, notify?: boolean}} [options]
   * @returns {Promise<{itemId: string, field: string, passed: number, failed: number, leveledUp: boolean, value: number|null}|null>}
   */
  async markAdvancement(itemId, type, delta = 1, { levelUp = true, notify = true } = {}) {
    const item = this.items.get(itemId);
    if (!item || !["skill", "ability"].includes(item.type)) return null;
    const field = String(type).startsWith("pass") ? "passed" : "failed";
    const cap = item.type === "skill" ? 6 : 10;
    const advancement = {
      passed: int4(item.system.advancement?.passed),
      failed: int4(item.system.advancement?.failed)
    };
    advancement[field] = Math.clamp(advancement[field] + int4(delta), 0, cap);
    const update2 = { "system.advancement.passed": advancement.passed, "system.advancement.failed": advancement.failed };
    const result = { itemId, field, ...advancement, leveledUp: false, value: null };
    const target = levelUp && delta > 0 ? this.#advancementTarget(item, advancement) : null;
    if (target) {
      update2[`system.${target.field}`] = target.to;
      if (target.field === "max") update2["system.rating"] = Math.min(target.to, int4(item.system.rating) + 1);
      update2["system.advancement.passed"] = 0;
      update2["system.advancement.failed"] = 0;
      Object.assign(result, { passed: 0, failed: 0, leveledUp: true, value: target.to });
    }
    await item.update(update2);
    if (result.leveledUp && notify) {
      ui.notifications.info(fmt4("MOUSEGUARD.Test.Note.Advanced", { name: item.displayName ?? itemLabel(item), value: result.value }));
    }
    return result;
  }
  /**
   * Add (or remove) a Beginner's Luck learning mark on a skill. Once the marks equal the Nature rating (maximum) the
   * skill is learned at rank 2 and the marks are erased (book p. 100-101, 250-251).
   * @param {string} itemId
   * @param {number} [delta=1]
   * @param {{notify?: boolean}} [options]
   * @returns {Promise<{itemId: string, learning: number, target: number, learned: boolean}|null>}
   */
  async markLearning(itemId, delta = 1, { notify = true } = {}) {
    const item = this.items.get(itemId);
    if (item?.type !== "skill") return null;
    const nature = this.getAbility("nature");
    const target = Math.max(1, Math.max(int4(nature?.system?.max), int4(nature?.system?.rating)));
    const learning = Math.clamp(int4(item.system.learning) + int4(delta), 0, 10);
    const result = { itemId, learning, target, learned: false };
    if (delta > 0 && int4(item.system.rank) <= 0 && learning >= target) {
      await item.update({
        "system.rank": 2,
        "system.learning": 0,
        "system.advancement.passed": 0,
        "system.advancement.failed": 0
      });
      result.learned = true;
      result.learning = 0;
      if (notify) ui.notifications.info(fmt4("MOUSEGUARD.Test.Note.SkillLearned", { name: itemLabel(item) }));
    } else {
      await item.update({ "system.learning": learning });
    }
    return result;
  }
  /* -------------------------------------------- */
  /*  Traits                                      */
  /* -------------------------------------------- */
  /**
   * Use a trait in a test.
   * "for": +1D at level 1 (once per session) or level 2 (twice per session); level 3 gives +1s with no limit.
   * "against": counts the use and earns checks (1 for -1D, 2 for helping the opponent in a versus test).
   * @param {string} itemId
   * @param {"for"|"against"} mode
   * @param {{checks?: number, notify?: boolean}} [options]
   * @returns {Promise<boolean>}  false when the trait cannot be used to help any more this session
   */
  async useTrait(itemId, mode, { checks = 1, notify = true } = {}) {
    const trait = this.items.get(itemId);
    if (trait?.type !== "trait") return false;
    const level = int4(trait.system.level, 1);
    if (mode === "for") {
      if (level >= 3) return true;
      const used = int4(trait.system.usedFor);
      if (used >= level) {
        if (notify) ui.notifications.warn(fmt4("MOUSEGUARD.Test.Error.TraitSpent", { name: itemLabel(trait) }));
        return false;
      }
      await trait.update({ "system.usedFor": Math.min(2, used + 1) });
      return true;
    }
    const earned = this.system.rewards ? Math.max(0, int4(checks, 1)) : 0;
    await trait.update({
      "system.usedAgainst": Math.min(99, int4(trait.system.usedAgainst) + 1),
      "system.checksEarned": Math.min(99, int4(trait.system.checksEarned) + earned)
    });
    if (earned) await this.update({ "system.rewards.check": int4(this.system.rewards.check) + earned });
    if (notify && earned) ui.notifications.info(fmt4("MOUSEGUARD.Test.Note.ChecksEarned", { name: itemLabel(trait), n: earned }));
    return true;
  }
  /**
   * Recharge a spent trait with checks: 2 checks for level 1, 4 for level 2 (book p. 289-290).
   * @param {string} itemId
   * @returns {Promise<boolean>}
   */
  async rechargeTrait(itemId) {
    const trait = this.items.get(itemId);
    if (trait?.type !== "trait") return false;
    const level = int4(trait.system.level, 1);
    if (level >= 3 || int4(trait.system.usedFor) <= 0) return false;
    const cost = level === 1 ? 2 : 4;
    const available = int4(this.system.rewards?.check);
    if (!this.system.rewards || available < cost) {
      ui.notifications.warn(fmt4("MOUSEGUARD.Test.Error.NoChecks", { n: cost }));
      return false;
    }
    await this.update({ "system.rewards.check": available - cost });
    await trait.update({ "system.usedFor": 0 });
    return true;
  }
  /* -------------------------------------------- */
  /*  Conditions & sessions                       */
  /* -------------------------------------------- */
  /**
   * Toggle a condition and keep the matching token status effect in sync.
   * @param {"hungryThirsty"|"angry"|"tired"|"injured"|"sick"} key
   * @param {boolean} [active]  force a state instead of toggling
   * @returns {Promise<boolean>} the new state
   */
  async toggleCondition(key, active) {
    if (!CONDITION_KEYS.includes(key) || !this.system.conditions) return false;
    const next = active === void 0 ? !this.system.conditions[key] : !!active;
    if (!!this.system.conditions[key] !== next) await this.update({ [`system.conditions.${key}`]: next });
    const statusId = CONDITION_STATUS[key];
    if (statusId && hasStatusEffect(statusId) && this.statuses?.has(statusId) !== next) {
      try {
        await this.toggleStatusEffect(statusId, { active: next });
      } catch (err) {
        console.warn(`Mouse Guard | Could not sync status effect "${statusId}"`, err);
      }
    }
    return next;
  }
  /**
   * Start a new session: trait uses (for/against) and the per-session check counters are reset.
   * @returns {Promise<number>} number of traits reset
   */
  async startNewSession() {
    if (!this.isOwner) {
      ui.notifications.warn(loc4("MOUSEGUARD.Test.Error.NotOwner"));
      return 0;
    }
    const updates = this.itemTypes.trait.filter((t) => t.system.usedFor || t.system.usedAgainst || t.system.checksEarned).map((t) => ({ _id: t.id, "system.usedFor": 0, "system.usedAgainst": 0, "system.checksEarned": 0 }));
    if (updates.length) await this.updateEmbeddedDocuments("Item", updates);
    ui.notifications.info(fmt4("MOUSEGUARD.Test.Note.NewSession", { name: this.name }));
    return updates.length;
  }
  /* -------------------------------------------- */
  /*  Tests                                       */
  /* -------------------------------------------- */
  /**
   * Open the test dialog for a skill or ability (or a free test), or roll at once with defaults.
   * @param {object} [options]
   * @param {string} [options.itemId]       skill or ability item to test
   * @param {string} [options.abilityKey]   ability to test (nature|will|health|resources|circles)
   * @param {boolean} [options.quick]       roll immediately (defaults to event.shiftKey)
   * @param {Event} [options.event]         the triggering event
   * @param {object} [options.state]        preset dialog values (ob, versus, helpers, ...)
   * @returns {Promise<ChatMessage|MouseGuardTestDialog|null>}
   */
  async rollTest({ itemId, abilityKey, quick, event, state = {} } = {}) {
    if (!this.isOwner) {
      ui.notifications.warn(loc4("MOUSEGUARD.Test.Error.NotOwner"));
      return null;
    }
    const subjectId = itemId ?? this.getAbility(abilityKey)?.id ?? "";
    if ((itemId || abilityKey) && !this.items.get(subjectId)) {
      ui.notifications.warn(loc4("MOUSEGUARD.Test.Error.NoSubject"));
      return null;
    }
    quick ??= !!event?.shiftKey;
    if (quick && subjectId) {
      const subject = this.items.get(subjectId);
      const preset = defaultTestState(this, { subjectId, ob: getLastOb(this), ...state });
      if (subject?.type === "ability" && subject.system.key === "nature") preset.inNature = state.inNature ?? true;
      return performTest(this, preset);
    }
    return MouseGuardTestDialog.open(this, { subjectId, state });
  }
};

// module/item.js
var MouseGuardItem = class extends Item {
  /**
   * Document-level migration: the ability key is inferred from the legacy name, Beginner's Luck from the skill name,
   * and stale legacy fields of already-migrated items are dropped (see data-models.js).
   * Foundry ignores the return value here, so the source is migrated in place.
   * @inheritdoc
   */
  static migrateData(source, options) {
    migrateItemSource(source);
    return super.migrateData(source, options);
  }
  /** @inheritdoc */
  prepareBaseData() {
    super.prepareBaseData();
    const encoded = this.system?.description;
    if (encoded && typeof encoded === "object" && typeof encoded.template === "string") {
      const parts = Object.fromEntries(Object.entries(encoded.parts ?? {}).map(([key, value]) => [
        key,
        typeof value === "string" && value.startsWith("MOUSEGUARD.") ? game.i18n.localize(value) : value
      ]));
      let description = game.i18n.localize(encoded.template);
      for (const [key, value] of Object.entries(parts)) description = description.replaceAll(`{${key}}`, value);
      this.system.description = description;
    }
    if (this.type === "ability" && this.system && !this.system.key) {
      const key = inferAbilityKey(this.name);
      if (key) this.system.key = key;
    }
  }
  /**
   * Display name: abilities with a key use the localized label for that key, i18n-key names are localized,
   * anything else is shown as typed.
   * @type {string}
   */
  get displayName() {
    if (this.type === "ability") return abilityLabel(this, this.actor?.type);
    if (typeof this.name === "string" && this.name.startsWith("MOUSEGUARD.")) return game.i18n.localize(this.name);
    return this.name;
  }
  /** @inheritdoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (LEGACY_SYSTEM_KEYS[this.type]) {
      this.updateSource({ "flags.mouseguard.schemaVersion": ITEM_SCHEMA_VERSION });
    }
    return allowed;
  }
  /**
   * The first write to an item that still carries legacy data persists the whole migrated `system` object together
   * with the schema marker. Without this, values derived during migration (Nature max from the old `tax`, marks from
   * the old `pass`/`fail`) would never reach the database, because updates only send the diff against the already
   * migrated source, and the next load would derive them again from stale legacy fields.
   * @inheritdoc
   */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    this.#persistNatureMax(changes);
    if (!LEGACY_SYSTEM_KEYS[this.type]) return allowed;
    const version = Number(this._source.flags?.mouseguard?.schemaVersion) || 0;
    if (version >= ITEM_SCHEMA_VERSION) return allowed;
    const current = foundry.utils.deepClone(this._source.system ?? {});
    const system = changes.system && typeof changes.system === "object" ? changes.system : {};
    for (const [key, value] of Object.entries(current)) {
      if (!(key in system)) system[key] = value;
      else if (foundry.utils.getType(system[key]) === "Object" && foundry.utils.getType(value) === "Object") {
        for (const [k, v] of Object.entries(value)) if (!(k in system[key])) system[key][k] = v;
      }
    }
    changes.system = system;
    foundry.utils.setProperty(changes, "flags.mouseguard.schemaVersion", ITEM_SCHEMA_VERSION);
    options.diff = false;
    return allowed;
  }
  /**
   * Nature's untaxed maximum must be stored, not only derived: when a rating edit raises Nature above the stored
   * maximum, save the new maximum too, so a later Nature tax (which lowers only the rating) stays visible.
   * @param {object} changes   The (already expanded) update data.
   */
  #persistNatureMax(changes) {
    if (this.type !== "ability") return;
    const system = changes.system;
    if (!system || typeof system !== "object" || system.rating === void 0) return;
    const key = system.key ?? this.system?.key ?? this._source.system?.key;
    if (key !== "nature") return;
    const rating = Number(system.rating);
    const max = Number(system.max ?? this._source.system?.max ?? 0);
    if (Number.isFinite(rating) && rating > max) system.max = rating;
  }
  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
  }
};

// module/item-sheet.js
var { HandlebarsApplicationMixin: HandlebarsApplicationMixin2 } = foundry.applications.api;
var { ItemSheetV2 } = foundry.applications.sheets;
var TEMPLATES = "systems/mouseguard/templates/item";
var PARTIALS = [
  `${TEMPLATES}/parts/rich-section.hbs`,
  `${TEMPLATES}/parts/pips.hbs`
];
var ABILITY_LABELS = Object.freeze({
  nature: "MOUSEGUARD.Nature",
  will: "MOUSEGUARD.Will",
  health: "MOUSEGUARD.Health",
  resources: "MOUSEGUARD.Resources",
  circles: "MOUSEGUARD.Circles"
});
var ABILITY_CAPS2 = Object.freeze({ nature: 7, will: 6, health: 6, resources: 10, circles: 10 });
var SKILL_CAP2 = 6;
var ANIMAL_NATURE_CAP = 12;
var GEAR_CATEGORY_LABELS = Object.freeze({
  gear: "MOUSEGUARD.ItemSheet.CategoryGear",
  weapon: "MOUSEGUARD.ItemSheet.CategoryWeapon",
  armor: "MOUSEGUARD.ItemSheet.CategoryArmor",
  natural: "MOUSEGUARD.ItemSheet.CategoryNatural"
});
var TYPE_HEIGHTS = Object.freeze({
  skill: 720,
  trait: 720,
  wise: 560,
  ability: 560,
  item: 520,
  contact: 500,
  condition: 500
});
var TYPE_ICONS = Object.freeze({
  skill: "fa-solid fa-feather",
  trait: "fa-solid fa-paw",
  wise: "fa-solid fa-book-open",
  ability: "fa-solid fa-shield-halved",
  item: "fa-solid fa-box-open",
  contact: "fa-solid fa-address-book",
  condition: "fa-solid fa-heart-crack"
});
var ROMAN = ["", "I", "II", "III"];
var loc5 = (key) => game.i18n.localize(key);
var fmt5 = (key, data) => game.i18n.format(key, data);
var num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
function hasHTML(html) {
  if (typeof html !== "string") return false;
  if (html === "[object Object]") return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0 || /<img|<table/i.test(html);
}
function rawHTML(html) {
  return typeof html === "string" && html !== "[object Object]" ? html : "";
}
function makePips(value, target, cap) {
  const v = Math.max(0, num(value));
  const count = Math.min(cap, Math.max(target, v));
  return Array.from({ length: count }, (_, i) => ({ on: i < v, over: i >= target }));
}
function makeScale(value, cap, max = value) {
  return Array.from({ length: cap }, (_, i) => ({ on: i < value, taxed: i >= value && i < max }));
}
function itemDisplayName(item) {
  const shared = item?.displayName;
  if (typeof shared === "string" && shared) return shared;
  const key = item?.type === "ability" ? item.system?.key : "";
  if (key && ABILITY_LABELS[key]) return loc5(ABILITY_LABELS[key]);
  const name = item?.name ?? "";
  return name.startsWith("MOUSEGUARD.") ? loc5(name) : name;
}
var MouseGuardItemSheet = class _MouseGuardItemSheet extends HandlebarsApplicationMixin2(ItemSheetV2) {
  /** Edit mode of this sheet instance; null = decide on first use. */
  #editMode = null;
  /** Help entries being added right now (guards against Enter + change firing twice). */
  #helpPending = /* @__PURE__ */ new Set();
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mouseguard", "sheet", "item", "themed", "theme-light"],
    position: { width: 580, height: 640 },
    window: { resizable: true, icon: "fa-solid fa-scroll" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleMode: _MouseGuardItemSheet.#onToggleMode,
      adjust: { handler: _MouseGuardItemSheet.#onAdjust, buttons: [0, 2] },
      toggleFlag: _MouseGuardItemSheet.#onToggleFlag,
      helpAdd: _MouseGuardItemSheet.#onHelpAdd,
      helpRemove: _MouseGuardItemSheet.#onHelpRemove,
      roll: _MouseGuardItemSheet.#onRoll
    }
  };
  /**
   * The header part is shared; exactly one of the other parts (the one named after the item type) is rendered.
   * @override
   */
  static PARTS = {
    header: { template: `${TEMPLATES}/header.hbs` },
    skill: { template: `${TEMPLATES}/skill.hbs`, templates: PARTIALS, scrollable: [""] },
    trait: { template: `${TEMPLATES}/trait.hbs`, templates: PARTIALS, scrollable: [""] },
    wise: { template: `${TEMPLATES}/wise.hbs`, templates: PARTIALS, scrollable: [""] },
    ability: { template: `${TEMPLATES}/ability.hbs`, templates: PARTIALS, scrollable: [""] },
    item: { template: `${TEMPLATES}/gear.hbs`, templates: PARTIALS, scrollable: [""] },
    contact: { template: `${TEMPLATES}/simple.hbs`, templates: PARTIALS, scrollable: [""] },
    condition: { template: `${TEMPLATES}/simple.hbs`, templates: PARTIALS, scrollable: [""] }
  };
  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */
  /**
   * Is the sheet in edit mode? Never for users who cannot edit the item (locked compendium, observers).
   * New, empty items open in edit mode; items with a description (e.g. from the compendium) open in view mode.
   * @type {boolean}
   */
  get editMode() {
    if (!this.isEditable) return false;
    if (this.#editMode === null) {
      this.#editMode = this.item.type !== "ability" && !hasHTML(this.item.system?.description);
    }
    return this.#editMode;
  }
  /** @override */
  get title() {
    const label = CONFIG.Item.typeLabels?.[this.item.type];
    const name = itemDisplayName(this.item) || this.item.id;
    return label ? `${loc5(label)}: ${name}` : name;
  }
  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */
  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    const explicitHeight = options?.position?.height;
    const opts = super._initializeApplicationOptions(options);
    const type = opts.document?.type;
    if (type) {
      opts.classes.push(`mgi-type-${type}`);
      if (TYPE_ICONS[type]) opts.window.icon = TYPE_ICONS[type];
      if (explicitHeight === void 0 && TYPE_HEIGHTS[type]) opts.position.height = TYPE_HEIGHTS[type];
    }
    return opts;
  }
  /** @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    const body = this.item.type in parts && this.item.type !== "header" ? this.item.type : "contact";
    for (const id of Object.keys(parts)) {
      if (id !== "header" && id !== body) delete parts[id];
    }
    return parts;
  }
  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const system = item.system ?? {};
    const editMode = this.editMode;
    Object.assign(context, {
      item,
      system,
      editMode,
      interactive: this.isEditable,
      typeLabel: loc5(CONFIG.Item.typeLabels?.[item.type] ?? "TYPES.Item.item"),
      displayName: itemDisplayName(item),
      // Legacy ability items are named with an i18n key: edit the readable name instead of the raw key.
      nameValue: item.name?.startsWith("MOUSEGUARD.") ? loc5(item.name) : item.name,
      enriched: {},
      raw: {},
      badge: null,
      subtitle: [],
      canRoll: false
    });
    await this.#prepareRichText(context, "description", system.description);
    switch (item.type) {
      case "skill":
        await this.#prepareSkill(context);
        break;
      case "trait":
        await this.#prepareTrait(context);
        break;
      case "wise":
        this.#prepareWise(context);
        break;
      case "ability":
        this.#prepareAbility(context);
        break;
      case "item":
        this.#prepareGear(context);
        break;
      default:
        break;
    }
    return context;
  }
  /**
   * Enrich one HTML field for display and keep its raw value for the editor.
   * @param {object} context
   * @param {string} key      Key under context.enriched / context.raw
   * @param {string} html     The stored HTML
   */
  async #prepareRichText(context, key, html) {
    const raw = rawHTML(html);
    context.raw[key] = raw;
    context.enriched[key] = hasHTML(raw) ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, {
      secrets: this.item.isOwner,
      rollData: this.item.getRollData?.() ?? {},
      relativeTo: this.item
    }) : "";
  }
  /** The owning actor's Nature item, if any. */
  #natureItem() {
    const actor = this.item.actor;
    if (!actor) return void 0;
    const viaApi = typeof actor.getAbility === "function" ? actor.getAbility("nature") : void 0;
    return viaApi ?? actor.items.find((i) => i.type === "ability" && i.system?.key === "nature");
  }
  /** Is the item owned by an NPC or an animal (no advancement, no learning, no player caps)? */
  #ownedByNpc() {
    const actor = this.item.actor;
    return !!actor && actor.type !== "character";
  }
  /** May the test button be shown? */
  #canRoll() {
    const actor = this.item.actor;
    return !!actor && this.item.isEmbedded && actor.isOwner && typeof actor.rollTest === "function";
  }
  /**
   * Advancement trackers (rulebook p. 247: to go from rating N to N+1 you need N passed and N-1 failed tests;
   * from 0 or 1 a single passed test is enough).
   */
  #advancementView(system, rating, cap, pipCap) {
    const passedNeed = Math.max(1, rating);
    const failedNeed = Math.max(0, rating - 1);
    const passed = num(system.advancement?.passed);
    const failed = num(system.advancement?.failed);
    return {
      passed: { value: passed, need: passedNeed, pips: makePips(passed, passedNeed, pipCap) },
      failed: { value: failed, need: failedNeed, pips: makePips(failed, failedNeed, pipCap) },
      hint: rating >= cap ? loc5("MOUSEGUARD.ItemSheet.AdvanceMax") : fmt5("MOUSEGUARD.ItemSheet.AdvanceNeed", { rating, passed: passedNeed, failed: failedNeed })
    };
  }
  async #prepareSkill(context) {
    const system = context.system;
    await this.#prepareRichText(context, "supplies", system.supplies);
    await this.#prepareRichText(context, "factors", system.factors);
    const rank = Math.clamp(num(system.rank), 0, SKILL_CAP2);
    const learned = rank > 0;
    const bl = system.beginnersLuck === "health" ? "health" : "will";
    const blLabel = loc5(ABILITY_LABELS[bl]);
    const learning = num(system.learning);
    const nature = this.#natureItem();
    const npc = this.#ownedByNpc();
    const natureTarget = nature ? Math.max(1, num(nature.system?.max, num(nature.system?.rating))) : null;
    context.skill = {
      rank,
      learned,
      scale: makeScale(rank, SKILL_CAP2),
      specialty: !!system.specialty,
      advancement: this.#advancementView(system, rank, SKILL_CAP2, SKILL_CAP2),
      beginnersLuck: bl,
      beginnersLuckLabel: blLabel,
      beginnersLuckOptions: ["will", "health"].map((k) => ({ value: k, label: loc5(ABILITY_LABELS[k]), selected: k === bl })),
      learning: {
        value: learning,
        need: natureTarget,
        pips: natureTarget ? makePips(learning, natureTarget, 10) : makePips(learning, 0, 10),
        hint: natureTarget ? fmt5("MOUSEGUARD.ItemSheet.LearningNeed", { count: natureTarget }) : loc5("MOUSEGUARD.ItemSheet.LearningHint")
      },
      help: this.#helpList(),
      helpOptions: context.editMode ? this.#helpOptions() : [],
      showAdvancement: !npc
    };
    context.badge = {
      value: learned ? String(rank) : "\xD7",
      label: loc5(learned ? "MOUSEGUARD.ItemSheet.Rank" : "MOUSEGUARD.ItemSheet.Unlearned"),
      tooltip: learned ? "" : loc5("MOUSEGUARD.ItemSheet.UnlearnedHint"),
      cssClass: [learned ? "" : "is-unlearned", system.specialty ? "is-specialty" : ""].filter(Boolean).join(" ")
    };
    context.subtitle.push(fmt5("MOUSEGUARD.ItemSheet.BeginnersLuckWith", { ability: blLabel }));
    context.canRoll = this.#canRoll();
  }
  async #prepareTrait(context) {
    const system = context.system;
    await this.#prepareRichText(context, "against", system.against);
    const level = Math.clamp(num(system.level, 1) || 1, 1, 3);
    const levels = [];
    for (const n of [1, 2, 3]) {
      const key = `level${n}`;
      await this.#prepareRichText(context, key, system.levels?.[key]);
      levels.push({
        n,
        roman: ROMAN[n],
        current: n === level,
        rule: loc5(`MOUSEGUARD.ItemSheet.Level${n}Rule`),
        field: `system.levels.${key}`,
        raw: context.raw[key],
        html: context.enriched[key]
      });
    }
    const usedFor = num(system.usedFor);
    const forMax = level >= 3 ? 0 : level;
    context.trait = {
      level,
      roman: ROMAN[level],
      levelOptions: [1, 2, 3].map((n) => ({ value: n, label: fmt5("MOUSEGUARD.ItemSheet.LevelN", { level: ROMAN[n] }), selected: n === level })),
      scale: makeScale(level, 3),
      usedFor: {
        value: usedFor,
        max: forMax,
        unlimited: level >= 3,
        pips: makePips(usedFor, forMax, 2),
        hint: level >= 3 ? loc5("MOUSEGUARD.ItemSheet.UsedForUnlimited") : fmt5("MOUSEGUARD.ItemSheet.UsedForCount", { used: usedFor, max: forMax })
      },
      usedAgainst: num(system.usedAgainst),
      checksEarned: num(system.checksEarned),
      origin: typeof system.origin === "string" ? system.origin : "",
      levels
    };
    context.badge = { value: ROMAN[level], label: loc5("MOUSEGUARD.ItemSheet.Level"), tooltip: "", cssClass: "is-roman" };
    if (context.trait.origin) context.subtitle.push(context.trait.origin);
  }
  #prepareWise(context) {
    const checks = context.system.checks ?? {};
    const marks = [
      { key: "pass", short: "MOUSEGUARD.ItemSheet.WisePassShort", label: "MOUSEGUARD.ItemSheet.WisePass" },
      { key: "fail", short: "MOUSEGUARD.ItemSheet.WiseFailShort", label: "MOUSEGUARD.ItemSheet.WiseFail" },
      { key: "figuredOut", short: "MOUSEGUARD.ItemSheet.WiseFiguredOutShort", label: "MOUSEGUARD.ItemSheet.WiseFiguredOut" },
      { key: "realized", short: "MOUSEGUARD.ItemSheet.WiseRealizedShort", label: "MOUSEGUARD.ItemSheet.WiseRealized" }
    ].map((m) => ({ ...m, short: loc5(m.short), label: loc5(m.label), on: !!checks[m.key], path: `system.checks.${m.key}` }));
    const count = marks.filter((m) => m.on).length;
    context.wise = { marks, count, enlightened: count === 4 };
    context.badge = { value: `${count}/4`, label: loc5("MOUSEGUARD.ItemSheet.WiseMarks"), tooltip: "", cssClass: count === 4 ? "is-full" : "" };
  }
  #prepareAbility(context) {
    const system = context.system;
    const key = Object.hasOwn(ABILITY_LABELS, system.key) ? system.key : "";
    const isNature = key === "nature";
    const rating = num(system.rating);
    const actor = this.item.actor;
    const npc = this.#ownedByNpc();
    const fixedNature = isNature && npc;
    const max = isNature && !fixedNature ? Math.max(rating, num(system.max, rating)) : rating;
    let cap = isNature && actor?.type === "animal" ? ANIMAL_NATURE_CAP : ABILITY_CAPS2[key] ?? 10;
    if (npc) cap = Math.max(cap, rating);
    const measured = isNature ? max : rating;
    context.ability = {
      key,
      isNature,
      fixedNature,
      npc,
      rating,
      max,
      cap,
      taxed: isNature && rating < max,
      scale: makeScale(Math.min(rating, Math.max(cap, max)), Math.max(cap, max), max),
      keyOptions: [
        ...Object.entries(ABILITY_LABELS).map(([k, label]) => ({ value: k, label: loc5(label), selected: k === key })),
        { value: "", label: loc5("MOUSEGUARD.ItemSheet.AbilityCustom"), selected: key === "" }
      ],
      advancement: this.#advancementView(system, measured, cap, 10),
      showAdvancement: !npc
    };
    const split = isNature && !fixedNature;
    context.badge = {
      value: split ? `${rating}/${max}` : String(rating),
      label: loc5("MOUSEGUARD.ItemSheet.Rating"),
      tooltip: split ? loc5("MOUSEGUARD.ItemSheet.NatureHint") : "",
      cssClass: split ? "is-wide" : ""
    };
    if (key && context.displayName !== context.item.name && !context.item.name.startsWith("MOUSEGUARD.")) {
      context.subtitle.push(context.item.name);
    }
    context.canRoll = this.#canRoll();
  }
  #prepareGear(context) {
    const system = context.system;
    const category = Object.hasOwn(GEAR_CATEGORY_LABELS, system.category) ? system.category : "gear";
    context.gear = {
      quantity: num(system.quantity, 1),
      weight: num(system.weight),
      category,
      categoryLabel: loc5(GEAR_CATEGORY_LABELS[category]),
      categoryOptions: Object.entries(GEAR_CATEGORY_LABELS).map(([value, label]) => ({ value, label: loc5(label), selected: value === category })),
      effect: typeof system.effect === "string" ? system.effect.trim() : "",
      isConflictGear: category !== "gear"
    };
    if (category !== "gear") context.subtitle.push(context.gear.categoryLabel);
  }
  /** Current "help" list of a skill, sanitized. */
  #helpList() {
    const help = this.item.system?.help;
    if (!Array.isArray(help)) return [];
    return help.filter((h) => typeof h === "string" && h.trim()).map((h) => h.trim());
  }
  /** Skill names offered as suggestions in the help editor (world items, owner's skills, item compendiums). */
  #helpOptions() {
    const names = /* @__PURE__ */ new Set();
    const add = (entry) => {
      if (entry?.type === "skill" && entry.name) names.add(entry.name);
    };
    for (const i of game.items ?? []) add(i);
    for (const i of this.item.actor?.items ?? []) add(i);
    for (const pack of game.packs ?? []) {
      if (pack.documentName !== "Item") continue;
      for (const entry of pack.index ?? []) add(entry);
    }
    names.delete(this.item.name);
    for (const h of this.#helpList()) names.delete(h);
    return Array.from(names).sort((a, b) => a.localeCompare(b, game.i18n.lang));
  }
  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#renderModeToggle();
    const input = this.element.querySelector("[data-help-input]");
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.#addHelp(input.value);
    });
  }
  /** Insert (once) and refresh the edit/view padlock in the window header, left of the title. */
  #renderModeToggle() {
    if (!this.hasFrame) return;
    const header = this.element.querySelector(":scope > .window-header");
    if (!header) return;
    let button = header.querySelector(".mgi-mode-toggle");
    if (!this.isEditable) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "header-control icon fa-solid mgi-mode-toggle";
      button.dataset.action = "toggleMode";
      header.insertBefore(button, header.querySelector(".window-title"));
    }
    const edit = this.editMode;
    button.classList.toggle("fa-lock-open", edit);
    button.classList.toggle("fa-lock", !edit);
    button.classList.toggle("active", edit);
    const label = loc5(edit ? "MOUSEGUARD.ItemSheet.ToViewMode" : "MOUSEGUARD.ItemSheet.ToEditMode");
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
  }
  /* -------------------------------------------- */
  /*  Form handling                               */
  /* -------------------------------------------- */
  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    if (event.target?.matches?.("[data-help-input]")) {
      this.#addHelp(event.target.value);
      return;
    }
    return super._onChangeForm(formConfig, event);
  }
  /** @inheritDoc */
  _processFormData(event, form, formData) {
    for (const [name, value] of Object.entries(formData.object)) {
      if (value === null && form.elements.namedItem(name)?.type === "number") delete formData.object[name];
    }
    return super._processFormData(event, form, formData);
  }
  /* -------------------------------------------- */
  /*  Drag and drop                               */
  /* -------------------------------------------- */
  /**
   * Dropping a skill onto a skill sheet adds that skill to the "help" list; everything else keeps the core behaviour
   * (Active Effects are copied onto the item).
   * @inheritDoc
   */
  async _onDropDocument(event, document2) {
    if (this.item.type === "skill" && document2?.documentName === "Item" && document2.type === "skill" && document2.uuid !== this.item.uuid) {
      await this.#addHelp(itemDisplayName(document2));
      return document2;
    }
    return await super._onDropDocument?.(event, document2) ?? null;
  }
  /** Append a skill name to system.help (no duplicates, case-insensitive). */
  async #addHelp(rawValue) {
    if (!this.isEditable) return;
    const value = String(rawValue ?? "").trim();
    if (!value) return;
    const key = value.toLocaleLowerCase();
    const help = this.#helpList();
    if (this.#helpPending.has(key) || help.some((h) => h.toLocaleLowerCase() === key)) return;
    this.#helpPending.add(key);
    try {
      await this.item.update({ "system.help": [...help, value] });
    } finally {
      this.#helpPending.delete(key);
    }
  }
  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */
  /** Switch between view and edit mode. */
  static #onToggleMode(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    this.#editMode = !this.editMode;
    this.render();
  }
  /**
   * Step a number field: left click +1, right click -1, clamped to [data-min, data-max].
   * Advancement trackers of owned items go through actor.markAdvancement so the actor applies the advancement rules.
   */
  static async #onAdjust(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const item = this.item;
    const { path, advance } = target.dataset;
    if (!path) return;
    const delta = event.button === 2 ? -1 : 1;
    if ((advance || target.dataset.learn) && this.#ownedByNpc()) return;
    if (advance && item.isEmbedded && typeof item.actor?.markAdvancement === "function") {
      return item.actor.markAdvancement(item.id, advance, delta);
    }
    if (target.dataset.learn && item.isEmbedded && typeof item.actor?.markLearning === "function") {
      if (delta < 0 && num(item.system?.learning) <= 0) return;
      return item.actor.markLearning(item.id, delta);
    }
    const min = target.dataset.min ? Number(target.dataset.min) : 0;
    const max = target.dataset.max ? Number(target.dataset.max) : 99;
    const current = num(foundry.utils.getProperty(item, path));
    const next = Math.clamp(current + delta, min, max);
    if (next !== current) await item.update({ [path]: next });
  }
  /** Toggle a boolean field (wise marks). */
  static async #onToggleFlag(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const path = target.dataset.path;
    if (!path) return;
    await this.item.update({ [path]: !foundry.utils.getProperty(this.item, path) });
  }
  /** Add the content of the help input as a tag. */
  static async #onHelpAdd(event) {
    event.preventDefault();
    const input = this.element.querySelector("[data-help-input]");
    await this.#addHelp(input?.value);
  }
  /** Remove one tag from the help list. */
  static async #onHelpRemove(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const index = Number(target.dataset.index);
    const help = this.#helpList();
    if (!Number.isInteger(index) || index < 0 || index >= help.length) return;
    help.splice(index, 1);
    await this.item.update({ "system.help": help });
  }
  /** Open the Test dialog of the owning actor for this skill/ability (shift-click: roll at once). */
  static async #onRoll(event) {
    event.preventDefault();
    const item = this.item;
    const actor = item.actor;
    if (!actor || typeof actor.rollTest !== "function") return;
    const abilityKey = item.type === "ability" ? item.system?.key || void 0 : void 0;
    return actor.rollTest({ itemId: item.id, abilityKey, quick: !!event.shiftKey, event });
  }
};

// module/sheets/character-sheet.js
var { HandlebarsApplicationMixin: HandlebarsApplicationMixin3, DialogV2 } = foundry.applications.api;
var { ActorSheetV2 } = foundry.applications.sheets;
var TEMPLATES2 = "systems/mouseguard/templates/actor/character";
var PARTIALS2 = {
  track: `${TEMPLATES2}/parts/track.hbs`,
  tools: `${TEMPLATES2}/parts/line-tools.hbs`,
  ribbon: `${TEMPLATES2}/parts/ribbon-tools.hbs`
};
var ABILITY_ORDER2 = ["nature", "will", "health", "resources", "circles"];
var ABILITY_LABELS2 = Object.freeze({
  nature: "MOUSEGUARD.Nature",
  will: "MOUSEGUARD.Will",
  health: "MOUSEGUARD.Health",
  resources: "MOUSEGUARD.Resources",
  circles: "MOUSEGUARD.Circles"
});
var ABILITY_CAPS3 = Object.freeze({ nature: 7, will: 6, health: 6, resources: 10, circles: 10 });
var SKILL_CAP3 = 6;
var NATURE_NAME2 = /^(?:MOUSEGUARD\.)?(?:[MW]?Nature|Природа)(?:\s*\(.*\))?$/i;
var ABILITY_NAMES = Object.freeze({
  will: ["will", "\u0432\u043E\u043B\u044F"],
  health: ["health", "\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435"],
  resources: ["resources", "\u0440\u0435\u0441\u0443\u0440\u0441\u044B"],
  circles: ["circles", "\u0441\u0432\u044F\u0437\u0438"]
});
var CONDITIONS = Object.freeze([
  { key: "hungryThirsty", label: "MOUSEGUARD.Sheet.HungryShort", tooltip: "MOUSEGUARD.hungthurstToolTip", icon: "hungthurst" },
  { key: "angry", label: "MOUSEGUARD.angry", tooltip: "MOUSEGUARD.angryToolTip", icon: "angry" },
  { key: "tired", label: "MOUSEGUARD.tired", tooltip: "MOUSEGUARD.tiredToolTip", icon: "tired" },
  { key: "injured", label: "MOUSEGUARD.injured", tooltip: "MOUSEGUARD.injuredToolTip", icon: "injured" },
  { key: "sick", label: "MOUSEGUARD.sick", tooltip: "MOUSEGUARD.sickToolTip", icon: "sick" }
]);
var AGE_KEYS = Object.freeze({
  one: "MOUSEGUARD.Sheet.AgeYearsOne",
  few: "MOUSEGUARD.Sheet.AgeYearsFew",
  many: "MOUSEGUARD.Sheet.AgeYearsMany",
  other: "MOUSEGUARD.Sheet.AgeYearsOther"
});
var WISE_MARKS = Object.freeze([
  { key: "pass", short: "MOUSEGUARD.Sheet.WisePassShort", tooltip: "MOUSEGUARD.Sheet.WisePassHint" },
  { key: "fail", short: "MOUSEGUARD.Sheet.WiseFailShort", tooltip: "MOUSEGUARD.Sheet.WiseFailHint" },
  { key: "figuredOut", short: "MOUSEGUARD.Sheet.WiseFiguredOutShort", tooltip: "MOUSEGUARD.Sheet.WiseFiguredOutHint" },
  { key: "realized", short: "MOUSEGUARD.Sheet.WiseRealizedShort", tooltip: "MOUSEGUARD.Sheet.WiseRealizedHint" }
]);
var DETAILS = Object.freeze([
  { key: "age", label: "MOUSEGUARD.Sheet.Age", type: "number" },
  { key: "birth_year", label: "MOUSEGUARD.Sheet.BirthYear", type: "number" },
  { key: "home", label: "MOUSEGUARD.Sheet.Home" },
  { key: "fur_color", label: "MOUSEGUARD.Sheet.FurColor" },
  { key: "guard_rank", label: "MOUSEGUARD.Sheet.GuardRank" },
  { key: "cloak_color", label: "MOUSEGUARD.Sheet.CloakColor" },
  { key: "parents", label: "MOUSEGUARD.Sheet.Parents" },
  { key: "senior_artisan", label: "MOUSEGUARD.Sheet.SeniorArtisan" },
  { key: "mentor", label: "MOUSEGUARD.Sheet.Mentor" },
  { key: "friend", label: "MOUSEGUARD.Sheet.Friend" },
  { key: "enemy", label: "MOUSEGUARD.Sheet.Enemy" }
]);
var NEW_ITEM_NAMES = Object.freeze({
  skill: "MOUSEGUARD.Sheet.NewSkill",
  trait: "MOUSEGUARD.Sheet.NewTrait",
  wise: "MOUSEGUARD.Sheet.NewWise",
  ability: "MOUSEGUARD.Sheet.NewAbility",
  item: "MOUSEGUARD.Sheet.NewGear",
  contact: "MOUSEGUARD.Sheet.NewContact",
  condition: "MOUSEGUARD.Sheet.NewCondition"
});
var PACKS = Object.freeze({ skill: "mouseguard.skills", trait: "mouseguard.traits" });
var PORTRAIT_PLACEHOLDER = "systems/mouseguard/assets/seated-mouse.svg";
var UNIQUE_TYPES = /* @__PURE__ */ new Set(["skill", "trait", "wise"]);
var CLOAK_COLOURS = Object.freeze({
  \u043A\u0440\u0430\u0441\u043D\u044B\u0439: "#9b2d20",
  \u0430\u043B\u044B\u0439: "#c0392b",
  \u0431\u043E\u0440\u0434\u043E\u0432\u044B\u0439: "#6d1f1f",
  \u0431\u0430\u0433\u0440\u043E\u0432\u044B\u0439: "#7a1e1e",
  \u0432\u0438\u0448\u043D\u0451\u0432\u044B\u0439: "#7b1e2f",
  \u0432\u0438\u0448\u043D\u0435\u0432\u044B\u0439: "#7b1e2f",
  \u043C\u0430\u043B\u0438\u043D\u043E\u0432\u044B\u0439: "#a3264d",
  \u0440\u043E\u0437\u043E\u0432\u044B\u0439: "#c8798c",
  \u043E\u0440\u0430\u043D\u0436\u0435\u0432\u044B\u0439: "#c46a24",
  \u0440\u044B\u0436\u0438\u0439: "#b5652b",
  \u0436\u0451\u043B\u0442\u044B\u0439: "#c9a227",
  \u0436\u0435\u043B\u0442\u044B\u0439: "#c9a227",
  \u0437\u043E\u043B\u043E\u0442\u043E\u0439: "#b8912f",
  \u0433\u043E\u0440\u0447\u0438\u0447\u043D\u044B\u0439: "#a8862a",
  \u043E\u0445\u0440\u0438\u0441\u0442\u044B\u0439: "#b07a2a",
  \u0437\u0435\u043B\u0451\u043D\u044B\u0439: "#3f6b3a",
  \u0437\u0435\u043B\u0435\u043D\u044B\u0439: "#3f6b3a",
  \u0438\u0437\u0443\u043C\u0440\u0443\u0434\u043D\u044B\u0439: "#2e7d5b",
  \u043E\u043B\u0438\u0432\u043A\u043E\u0432\u044B\u0439: "#6b6b2a",
  \u0442\u0440\u0430\u0432\u044F\u043D\u043E\u0439: "#5a8a3a",
  \u0433\u043E\u043B\u0443\u0431\u043E\u0439: "#5b8fb9",
  \u0441\u0438\u043D\u0438\u0439: "#2c4f86",
  \u043B\u0430\u0437\u0443\u0440\u043D\u044B\u0439: "#3a7ca5",
  \u0431\u0438\u0440\u044E\u0437\u043E\u0432\u044B\u0439: "#2f8f88",
  \u0444\u0438\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u0439: "#5d3a7a",
  \u043F\u0443\u0440\u043F\u0443\u0440\u043D\u044B\u0439: "#7a2f6b",
  \u0441\u0438\u0440\u0435\u043D\u0435\u0432\u044B\u0439: "#8e7cb0",
  \u043B\u0438\u043B\u043E\u0432\u044B\u0439: "#86608e",
  \u043A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0439: "#6b4428",
  \u0431\u0443\u0440\u044B\u0439: "#5e3d26",
  \u0441\u0435\u0440\u044B\u0439: "#6e6a64",
  \u0447\u0451\u0440\u043D\u044B\u0439: "#1d1b19",
  \u0447\u0435\u0440\u043D\u044B\u0439: "#1d1b19",
  \u0431\u0435\u043B\u044B\u0439: "#e8e2d6",
  \u0431\u0435\u0436\u0435\u0432\u044B\u0439: "#cdb994",
  \u043F\u0435\u0441\u043E\u0447\u043D\u044B\u0439: "#c7a875"
});
var clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
var loc6 = (key) => game.i18n.localize(key);
function abilityKeyOf(item) {
  const key = item.system?.key;
  if (key) return key;
  const name = String(item.name ?? "").trim();
  if (NATURE_NAME2.test(name)) return "nature";
  const bare = name.replace(/^MOUSEGUARD\./i, "").toLowerCase();
  for (const [k, names] of Object.entries(ABILITY_NAMES)) if (names.includes(bare)) return k;
  return "";
}
function ownDisplayName(item) {
  try {
    const name = item.displayName;
    return typeof name === "string" && name ? name : "";
  } catch (err) {
    return "";
  }
}
function abilityDisplayName(item) {
  const own = ownDisplayName(item);
  if (own && !own.startsWith("MOUSEGUARD.")) return own;
  const key = abilityKeyOf(item);
  if (ABILITY_LABELS2[key]) return loc6(ABILITY_LABELS2[key]);
  const name = String(item.name ?? "");
  return name.startsWith("MOUSEGUARD.") ? loc6(name) : name;
}
function itemDisplayName2(item) {
  if (item.type === "ability") return abilityDisplayName(item);
  const own = ownDisplayName(item);
  if (own && !own.startsWith("MOUSEGUARD.")) return own;
  const name = String(item.name ?? "");
  return name.startsWith("MOUSEGUARD.") && game.i18n.has(name) ? loc6(name) : name;
}
function pips(count, value) {
  const n = clamp(count, 0, 10);
  const v = clamp(value, 0, n);
  return Array.from({ length: n }, (_, index) => ({ index, on: index < v }));
}
function track({ kind, label, tooltip, count, value, action = "advance", mode }) {
  const list = pips(count, value);
  return { kind, label, tooltip, action, mode, pips: list, full: list.length > 0 && list.every((p) => p.on) };
}
var ROMAN2 = ["", "I", "II", "III"];
function excerpt(html, length = 90) {
  const text = String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}\u2026` : text;
}
function formatAge(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n <= 0) return "";
  let rule = "other";
  try {
    rule = new Intl.PluralRules(game.i18n.lang).select(n);
  } catch (err) {
  }
  return game.i18n.format(AGE_KEYS[rule] ?? AGE_KEYS.other, { age: n });
}
function cloakSwatch(text) {
  const value = String(text ?? "").trim();
  if (!value) return "";
  if (globalThis.CSS?.supports?.("color", value)) return value;
  const words = value.toLowerCase().split(/[\s,.;/-]+/);
  for (const word of words) {
    if (CLOAK_COLOURS[word]) return CLOAK_COLOURS[word];
    const stem = Object.keys(CLOAK_COLOURS).find((k) => k.length > 4 && word.startsWith(k.slice(0, -2)));
    if (stem) return CLOAK_COLOURS[stem];
  }
  return "";
}
var MouseGuardCharacterSheet = class _MouseGuardCharacterSheet extends HandlebarsApplicationMixin3(ActorSheetV2) {
  /** Play (false) or edit (true) mode; null until first decided. Sheet-instance state, not saved. */
  #editMode = null;
  /** Quick-test mode: a click on a skill or ability rolls at once, like Shift+click. */
  #quickMode = false;
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mouseguard", "sheet", "actor", "character", "mgs-sheet", "themed", "theme-light"],
    position: { width: 1100, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleMode: _MouseGuardCharacterSheet.#onToggleMode,
      roll: _MouseGuardCharacterSheet.#onRoll,
      testFree: _MouseGuardCharacterSheet.#onTestFree,
      toggleQuick: _MouseGuardCharacterSheet.#onToggleQuick,
      newSession: _MouseGuardCharacterSheet.#onNewSession,
      advance: { handler: _MouseGuardCharacterSheet.#onAdvance, buttons: [0, 2] },
      traitUse: { handler: _MouseGuardCharacterSheet.#onTraitUse, buttons: [0, 2] },
      wiseMark: _MouseGuardCharacterSheet.#onWiseMark,
      toggleCondition: _MouseGuardCharacterSheet.#onToggleCondition,
      adjust: { handler: _MouseGuardCharacterSheet.#onAdjust, buttons: [0, 2] },
      toggleSpecialty: _MouseGuardCharacterSheet.#onToggleSpecialty,
      itemCreate: _MouseGuardCharacterSheet.#onItemCreate,
      itemEdit: _MouseGuardCharacterSheet.#onItemEdit,
      itemDelete: _MouseGuardCharacterSheet.#onItemDelete,
      openCompendium: _MouseGuardCharacterSheet.#onOpenCompendium,
      openDetails: _MouseGuardCharacterSheet.#onOpenDetails
    }
  };
  /** @override */
  static PARTS = {
    portrait: { template: `${TEMPLATES2}/portrait.hbs` },
    header: { template: `${TEMPLATES2}/header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs", classes: ["mgs-tabs"] },
    mouse: {
      template: `${TEMPLATES2}/tab-mouse.hbs`,
      templates: [PARTIALS2.track, PARTIALS2.tools, PARTIALS2.ribbon],
      scrollable: [""]
    },
    biography: {
      template: `${TEMPLATES2}/tab-biography.hbs`,
      templates: [PARTIALS2.tools, PARTIALS2.ribbon],
      scrollable: [""]
    },
    gear: {
      template: `${TEMPLATES2}/tab-gear.hbs`,
      templates: [PARTIALS2.tools, PARTIALS2.ribbon],
      scrollable: [""]
    },
    notes: { template: `${TEMPLATES2}/tab-notes.hbs`, scrollable: [""] }
  };
  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "mouse", label: "MOUSEGUARD.Sheet.TabMouse" },
        { id: "biography", label: "MOUSEGUARD.Sheet.TabBiography" },
        { id: "gear", label: "MOUSEGUARD.Sheet.TabGear" },
        { id: "notes", label: "MOUSEGUARD.Sheet.TabNotes" }
      ],
      initial: "mouse"
    }
  };
  /* -------------------------------------------- */
  /** Is the sheet in edit mode? A new character (no skills, traits or wises yet) opens in edit mode. */
  get isEditMode() {
    if (!this.isEditable) return false;
    this.#editMode ??= !this.actor.items.some((i) => UNIQUE_TYPES.has(i.type));
    return this.#editMode;
  }
  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    const title = frame.querySelector(".window-header .window-title");
    if (title && this.isEditable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "header-control icon fa-solid fa-lock mgs-mode-toggle";
      button.dataset.action = "toggleMode";
      title.before(button);
      const detailsBtn = document.createElement("button");
      detailsBtn.type = "button";
      detailsBtn.className = "header-control icon fa-solid fa-feather-pointed mgs-details-toggle";
      detailsBtn.dataset.action = "openDetails";
      detailsBtn.dataset.tooltip = "MOUSEGUARD.DetailsDialog.ButtonHint";
      title.before(detailsBtn);
    }
    return frame;
  }
  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const editMode = this.isEditMode;
    const byType = (type) => actor.items.filter((i) => i.type === type).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    const abilities = this.#prepareAbilities();
    const nature = abilities.find((a) => a.key === "nature");
    const natureMax = Math.max(1, nature?.max ?? 1);
    const shownTypes = /* @__PURE__ */ new Set(["ability", "skill", "trait", "wise", "item", "contact"]);
    const gear = byType("item").map((i) => this.#prepareGear(i));
    const totalWeight = gear.reduce((sum, g) => sum + (Number(g.quantity) || 0) * (Number(g.weight) || 0), 0);
    Object.assign(context, {
      actor,
      system,
      editMode,
      quickMode: this.#quickMode,
      owner: actor.isOwner,
      portrait: this.#preparePortrait(),
      conditions: this.#prepareConditions(),
      healthy: !CONDITIONS.some((c) => system.conditions?.[c.key]),
      rewards: [
        { path: "system.rewards.fate", value: system.rewards?.fate ?? 0, label: "MOUSEGUARD.Sheet.Fate", tooltip: "MOUSEGUARD.Sheet.FateHint" },
        { path: "system.rewards.persona", value: system.rewards?.persona ?? 0, label: "MOUSEGUARD.Sheet.Persona", tooltip: "MOUSEGUARD.Sheet.PersonaHint" },
        { path: "system.rewards.check", value: system.rewards?.check ?? 0, label: "MOUSEGUARD.Sheet.Checks", tooltip: "MOUSEGUARD.Sheet.ChecksHint" }
      ],
      disposition: { current: system.disposition?.current ?? 0, starting: system.disposition?.starting ?? 0 },
      quests: [
        { key: "belief", path: "system.rewards.belief", value: system.rewards?.belief ?? "", label: "MOUSEGUARD.Sheet.Belief", hint: "MOUSEGUARD.Sheet.BeliefHint" },
        { key: "goal", path: "system.rewards.goal", value: system.rewards?.goal ?? "", label: "MOUSEGUARD.Sheet.Goal", hint: "MOUSEGUARD.Sheet.GoalHint" },
        { key: "instinct", path: "system.rewards.instinct", value: system.rewards?.instinct ?? "", label: "MOUSEGUARD.Sheet.Instinct", hint: "MOUSEGUARD.Sheet.InstinctHint" }
      ],
      abilities,
      skills: byType("skill").map((i) => this.#prepareSkill(i, natureMax)),
      traits: byType("trait").map((i) => this.#prepareTrait(i)),
      wises: byType("wise").map((i) => this.#prepareWise(i)),
      gear,
      totalWeight: Math.round(totalWeight * 100) / 100,
      contacts: byType("contact").map((i) => ({ id: i.id, name: itemDisplayName2(i), img: i.img, excerpt: excerpt(i.system?.description) })),
      others: actor.items.filter((i) => !shownTypes.has(i.type)).sort((a, b) => a.sort - b.sort).map((i) => ({ id: i.id, name: itemDisplayName2(i), img: i.img, typeLabel: loc6(CONFIG.Item.typeLabels?.[i.type] ?? i.type) })),
      details: DETAILS.map((d) => ({ ...d, name: `system.details.${d.key}`, value: system.details?.[d.key] ?? (d.type === "number" ? 0 : "") })),
      packs: { skill: !!game.packs.get(PACKS.skill), trait: !!game.packs.get(PACKS.trait) }
    });
    return context;
  }
  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId in context.tabs) context.tab = context.tabs[partId];
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrich = (html) => TextEditor.enrichHTML(html ?? "", {
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor
    });
    if (partId === "biography") context.biographyHTML = await enrich(this.actor.system.biography);
    if (partId === "notes") context.notesHTML = await enrich(this.actor.system.notes);
    return context;
  }
  /* -------------------------------------------- */
  /** Portrait column data. */
  #preparePortrait() {
    const { system } = this.actor;
    const img = this.actor.img;
    const isDefault = !img || img === CONST.DEFAULT_TOKEN;
    const src = isDefault ? PORTRAIT_PLACEHOLDER : img;
    const details = system.details ?? {};
    const subtitle = [details.guard_rank, formatAge(details.age), details.home].map((s) => String(s ?? "").trim()).filter(Boolean);
    return {
      src,
      isIcon: isDefault || /\.svg(\?.*)?$/i.test(src),
      subtitle: subtitle.join(" \xB7 "),
      cloak: String(details.cloak_color ?? "").trim(),
      cloakSwatch: cloakSwatch(details.cloak_color),
      player: String(system.player ?? "").trim(),
      age: details.age ?? 0
    };
  }
  /** Condition chips for the header box. */
  #prepareConditions() {
    const conditions = this.actor.system.conditions ?? {};
    return CONDITIONS.map((c) => ({
      key: c.key,
      active: !!conditions[c.key],
      label: c.label,
      tooltip: c.tooltip,
      icon: `systems/mouseguard/assets/icons/${c.icon}.svg`
    }));
  }
  /** Ability rows, in rulebook order (nature, will, health, resources, circles), then any other ability. */
  #prepareAbilities() {
    const rows = this.actor.items.filter((i) => i.type === "ability").map((item) => {
      const sys = item.system ?? {};
      const key = abilityKeyOf(item);
      const rating = Number(sys.rating) || 0;
      const legacyMax = Number(sys.tax) || 0;
      const max = key === "nature" ? Math.max(rating, Number(sys.max) || 0, legacyMax) : rating;
      const r = key === "nature" ? max : rating;
      const passed = Number(sys.advancement?.passed) || 0;
      const failed = Number(sys.advancement?.failed) || 0;
      const passNeed = Math.max(1, r);
      const failNeed = Math.max(0, r - 1);
      return {
        id: item.id,
        key,
        label: abilityDisplayName(item),
        rating,
        max,
        isNature: key === "nature",
        taxed: key === "nature" && rating < max,
        ready: r < (ABILITY_CAPS3[key] ?? 10) && passed >= passNeed && failed >= failNeed,
        passTrack: track({ kind: "passed", label: "MOUSEGUARD.Sheet.PassShort", tooltip: "MOUSEGUARD.Sheet.PassHint", count: passNeed, value: passed }),
        failTrack: failNeed ? track({ kind: "failed", label: "MOUSEGUARD.Sheet.FailShort", tooltip: "MOUSEGUARD.Sheet.FailHint", count: failNeed, value: failed }) : null,
        order: ABILITY_ORDER2.includes(key) ? ABILITY_ORDER2.indexOf(key) : 10 + (item.sort || 0) / 1e6
      };
    });
    return rows.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }
  /** Skill row. Rank 0 = not learned yet (Beginner's Luck): shows learning marks toward Nature instead of P/F. */
  #prepareSkill(item, natureMax) {
    const sys = item.system ?? {};
    const rank = Number(sys.rank) || 0;
    const passed = Number(sys.advancement?.passed) || 0;
    const failed = Number(sys.advancement?.failed) || 0;
    const learned = rank > 0;
    const blKey = sys.beginnersLuck === "health" ? "health" : "will";
    const row = {
      id: item.id,
      name: itemDisplayName2(item),
      rank,
      learned,
      specialty: !!sys.specialty,
      ready: learned && rank < SKILL_CAP3 && passed >= Math.max(1, rank) && failed >= Math.max(0, rank - 1)
    };
    if (learned) {
      row.passTrack = track({ kind: "passed", label: "MOUSEGUARD.Sheet.PassShort", tooltip: "MOUSEGUARD.Sheet.PassHint", count: Math.max(1, rank), value: passed });
      row.failTrack = rank > 1 ? track({ kind: "failed", label: "MOUSEGUARD.Sheet.FailShort", tooltip: "MOUSEGUARD.Sheet.FailHint", count: rank - 1, value: failed }) : null;
    } else {
      row.learnTrack = track({ kind: "learning", label: "MOUSEGUARD.Sheet.LearningShort", tooltip: "MOUSEGUARD.Sheet.LearningHint", count: natureMax, value: Number(sys.learning) || 0 });
      row.blTooltip = game.i18n.format("MOUSEGUARD.Sheet.BeginnersLuckHint", { ability: loc6(ABILITY_LABELS2[blKey]) });
    }
    return row;
  }
  /** Trait row: level I-III, beneficial uses this session, uses against yourself. */
  #prepareTrait(item) {
    const sys = item.system ?? {};
    const level = clamp(sys.level ?? 1, 1, 3);
    const usedFor = Number(sys.usedFor ?? sys.usedfor) || 0;
    const usedAgainst = Number(sys.usedAgainst ?? sys.usedagainst) || 0;
    return {
      id: item.id,
      name: itemDisplayName2(item),
      level,
      roman: ROMAN2[level],
      unlimited: level >= 3,
      usedAgainst,
      checksEarned: Number(sys.checksEarned) || 0,
      spent: level < 3 && usedFor >= level,
      forTrack: level < 3 ? track({ kind: "usedFor", label: "MOUSEGUARD.Sheet.TraitForShort", tooltip: "MOUSEGUARD.Sheet.TraitForHint", count: level, value: usedFor, action: "traitUse", mode: "for" }) : null
    };
  }
  /** Wise row with its four marks. */
  #prepareWise(item) {
    const checks = item.system?.checks ?? {};
    const marks = WISE_MARKS.map((m) => ({ ...m, on: !!checks[m.key] }));
    return { id: item.id, name: itemDisplayName2(item), marks, ready: marks.every((m) => m.on) };
  }
  /** Gear row. */
  #prepareGear(item) {
    const sys = item.system ?? {};
    return {
      id: item.id,
      name: itemDisplayName2(item),
      img: item.img,
      quantity: sys.quantity ?? 1,
      weight: sys.weight ?? 0,
      excerpt: excerpt(sys.description, 120)
    };
  }
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#createContextMenus();
    this.element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!target?.matches?.('[role="button"][data-action]')) return;
      event.preventDefault();
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: event.shiftKey, button: 0 }));
    });
  }
  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const editMode = this.isEditMode;
    this.element.classList.toggle("mgs-edit-mode", editMode);
    this.element.classList.toggle("mgs-play-mode", !editMode);
    const toggle = this.element.querySelector(".window-header .mgs-mode-toggle");
    if (toggle) {
      toggle.classList.toggle("fa-lock-open", editMode);
      toggle.classList.toggle("fa-lock", !editMode);
      const label = loc6(editMode ? "MOUSEGUARD.Sheet.ToPlayMode" : "MOUSEGUARD.Sheet.ToEditMode");
      toggle.dataset.tooltip = label;
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("aria-pressed", String(editMode));
    }
  }
  /* -------------------------------------------- */
  /*  Form handling                               */
  /* -------------------------------------------- */
  /**
   * The portrait <img data-edit="img"> is submitted with every form change. While the actor has no picture of its own
   * it shows the placeholder, which must not be written into actor.img (and from there into the token).
   * @override
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const sourceImg = this.actor._source.img;
    const hasOwnImage = !!sourceImg && sourceImg !== CONST.DEFAULT_TOKEN;
    if (!hasOwnImage && data.img === PORTRAIT_PLACEHOLDER) delete data.img;
    return data;
  }
  /**
   * Inputs that edit an embedded item carry `data-item-field` (and no `name`), so they never reach the actor form
   * submission. Their changes are written to the item here instead.
   * @override
   */
  _onChangeForm(formConfig, event) {
    const input = event.target?.closest?.("[data-item-field]");
    if (input) {
      event.stopPropagation();
      this.#updateItemField(input);
      return;
    }
    return super._onChangeForm(formConfig, event);
  }
  /** Write one embedded-item input to its item. */
  async #updateItemField(input) {
    const item = this.actor.items.get(input.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    let value;
    if (input.type === "checkbox") value = input.checked;
    else if (input.type === "number" || input.dataset.dtype === "Number") {
      if (input.value === "") return;
      value = Number(input.value);
      if (!Number.isFinite(value)) return;
      if (input.min !== "") value = Math.max(value, Number(input.min));
      if (input.max !== "") value = Math.min(value, Number(input.max));
    } else value = input.value;
    await item.update({ [input.dataset.itemField]: value });
  }
  /* -------------------------------------------- */
  /*  Drag and drop                               */
  /* -------------------------------------------- */
  /**
   * Dropping an item from a compendium, the sidebar or another actor creates it on this mouse (core behaviour),
   * except for a skill, trait or wise the mouse already has. Dropping one of this mouse's own items sorts it.
   * @inheritDoc
   */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner || !this.isEditable) return null;
    if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
    const duplicate = this.#findDuplicate(item);
    if (duplicate) {
      ui.notifications.info(game.i18n.format("MOUSEGUARD.Sheet.AlreadyHas", { name: itemDisplayName2(duplicate) }));
      return null;
    }
    const created = await super._onDropItem(event, item);
    if (created) {
      const tab = { item: "gear", contact: "biography", condition: "gear" }[created.type] ?? (["ability", "skill", "trait", "wise"].includes(created.type) ? "mouse" : null);
      if (tab && this.tabGroups.primary !== tab) {
        try {
          this.changeTab(tab, "primary");
        } catch (err) {
          this.tabGroups.primary = tab;
        }
      }
    }
    return created;
  }
  /** An existing item that the dropped one would duplicate. */
  #findDuplicate(item) {
    const norm = (s) => String(s ?? "").trim().toLowerCase();
    if (item.type === "ability") {
      const key = abilityKeyOf(item);
      return key ? this.actor.items.find((i) => i.type === "ability" && abilityKeyOf(i) === key) : null;
    }
    if (!UNIQUE_TYPES.has(item.type)) return null;
    const names = new Set([norm(item.name), norm(item.flags?.mouseguard?.originalName)].filter(Boolean));
    const source = item.uuid;
    return this.actor.items.find((i) => {
      if (i.type !== item.type) return false;
      if (source && i._stats?.compendiumSource === source) return true;
      return names.has(norm(i.name)) || i.flags?.mouseguard?.originalName && names.has(norm(i.flags.mouseguard.originalName));
    }) ?? null;
  }
  /**
   * Sort only among items of the same type (rows of one list); ignore drops on other rows.
   * @inheritDoc
   */
  _onSortItem(event, item) {
    const row = event.target.closest?.("[data-item-id]");
    const target = row && this.actor.items.get(row.dataset.itemId);
    if (!target || target.id === item.id || target.type !== item.type) return;
    return super._onSortItem(event, item);
  }
  /* -------------------------------------------- */
  /*  Context menu                                */
  /* -------------------------------------------- */
  /** Item row context menu (right click on the name part of a row). Created once: this.element persists. */
  #createContextMenus() {
    const options = { fixed: true, hookName: "get{}ItemContextOptions", parentClassHooks: false };
    const selector = ".mgs-line[data-item-id] .mgs-line-main, .mgs-gear-row[data-item-id], .mgs-contact[data-item-id]";
    const handler = () => this.#getItemContextOptions();
    if (typeof this._createContextMenu === "function") this._createContextMenu(handler, selector, options);
    else new foundry.applications.ux.ContextMenu.implementation(this.element, selector, handler(), { fixed: true, jQuery: false });
  }
  /** Entries usable by v14 (label/visible/onClick) and v13 (name/condition/callback) without deprecation warnings. */
  #getItemContextOptions() {
    const itemOf = (el) => this.actor.items.get((el instanceof HTMLElement ? el : el?.[0])?.closest("[data-item-id]")?.dataset.itemId);
    const entry = (label, icon, visible, run2) => ({
      label,
      name: label,
      icon: `<i class="${icon}"></i>`,
      visible: (el) => !!itemOf(el) && visible(itemOf(el)),
      condition: (el) => !!itemOf(el) && visible(itemOf(el)),
      onClick: (event, el) => run2(itemOf(el), event),
      callback: (el) => run2(itemOf(el))
    });
    const rollable = (i) => i.type === "skill" || i.type === "ability";
    const editable = () => this.isEditable;
    return [
      entry(
        "MOUSEGUARD.Sheet.MenuTest",
        "fa-solid fa-dice-d6",
        (i) => rollable(i) && editable(),
        (i) => this.#rollTest(this.#rollTarget(i, false))
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuQuickTest",
        "fa-solid fa-bolt",
        (i) => rollable(i) && editable(),
        (i) => this.#rollTest(this.#rollTarget(i, true))
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuMarkPass",
        "fa-solid fa-circle-check",
        (i) => rollable(i) && editable() && (i.type !== "skill" || Number(i.system?.rank) > 0),
        (i) => this.#markAdvancement(i, "passed", 1)
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuMarkFail",
        "fa-solid fa-circle-xmark",
        (i) => rollable(i) && editable() && (i.type !== "skill" || Number(i.system?.rank) > 1) && (i.type !== "ability" || Number(i.system?.rating) > 1 || abilityKeyOf(i) === "nature"),
        (i) => this.#markAdvancement(i, "failed", 1)
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuSpecialty",
        "fa-solid fa-star",
        (i) => i.type === "skill" && editable(),
        (i) => this.#toggleSpecialty(i)
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuTraitFor",
        "fa-solid fa-angles-up",
        (i) => i.type === "trait" && editable(),
        (i) => this.#useTrait(i, "for")
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuTraitAgainst",
        "fa-solid fa-angles-down",
        (i) => i.type === "trait" && editable(),
        (i) => this.#useTrait(i, "against")
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuTraitRecharge",
        "fa-solid fa-battery-half",
        (i) => i.type === "trait" && editable() && typeof this.actor.rechargeTrait === "function" && Number(i.system?.level) < 3 && Number(i.system?.usedFor) > 0,
        (i) => this.actor.rechargeTrait(i.id)
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuEdit",
        "fa-solid fa-pen-to-square",
        () => true,
        (i) => i.sheet?.render({ force: true })
      ),
      entry(
        "MOUSEGUARD.Sheet.MenuDelete",
        "fa-solid fa-trash",
        () => editable(),
        (i) => this.#confirmDelete(i)
      )
    ];
  }
  /* -------------------------------------------- */
  /*  Actor API wrappers (contract), with fallbacks */
  /* -------------------------------------------- */
  /** rollTest options for an item row: rollTest({itemId}) for skills, rollTest({abilityKey}) for keyed abilities. */
  #rollTarget(item, quick, event) {
    const key = item.type === "ability" ? item.system?.key : "";
    if (key && ABILITY_LABELS2[key]) return { abilityKey: key, itemId: item.id, quick, event };
    return { itemId: item.id, quick, event };
  }
  /** actor.rollTest, guarded. */
  async #rollTest(options) {
    const actor = this.actor;
    if (typeof actor.rollTest !== "function") {
      ui.notifications.warn(loc6("MOUSEGUARD.Sheet.NoRollSystem"));
      return null;
    }
    try {
      return await actor.rollTest(options);
    } catch (err) {
      console.error("Mouse Guard | rollTest failed", err);
      ui.notifications.error(loc6("MOUSEGUARD.Sheet.RollFailed"));
      return null;
    }
  }
  /** actor.markAdvancement, or a plain clamped update of the advancement / learning counter. */
  async #markAdvancement(item, kind, delta) {
    if (!delta) return;
    if (kind === "learning") {
      if (typeof this.actor.markLearning === "function") return this.actor.markLearning(item.id, delta);
      return item.update({ "system.learning": clamp((Number(item.system?.learning) || 0) + delta, 0, 10) });
    }
    if (typeof this.actor.markAdvancement === "function") return this.actor.markAdvancement(item.id, kind, delta);
    const path = `system.advancement.${kind}`;
    const current = Number(foundry.utils.getProperty(item, path)) || 0;
    return item.update({ [path]: clamp(current + delta, 0, 10) });
  }
  /** actor.useTrait (for / against), or a plain update of the counters. */
  async #useTrait(item, mode) {
    if (typeof this.actor.useTrait === "function") return this.actor.useTrait(item.id, mode);
    const sys = item.system ?? {};
    if (mode === "for") {
      const level = clamp(sys.level ?? 1, 1, 3);
      if (level < 3 && (Number(sys.usedFor) || 0) >= level) return;
      return item.update({ "system.usedFor": clamp((Number(sys.usedFor) || 0) + 1, 0, 2) });
    }
    await item.update({
      "system.usedAgainst": clamp((Number(sys.usedAgainst) || 0) + 1, 0, 99),
      "system.checksEarned": clamp((Number(sys.checksEarned) || 0) + 1, 0, 99)
    });
    return this.actor.update({ "system.rewards.check": clamp((Number(this.actor.system.rewards?.check) || 0) + 1, 0, 99) });
  }
  /** Make a skill the patrol specialty (only one per mouse), or remove the mark. */
  async #toggleSpecialty(item) {
    const on = !item.system?.specialty;
    const updates = [{ _id: item.id, "system.specialty": on }];
    if (on) {
      for (const other of this.actor.items) {
        if (other.type === "skill" && other.id !== item.id && other.system?.specialty) updates.push({ _id: other.id, "system.specialty": false });
      }
    }
    return this.actor.updateEmbeddedDocuments("Item", updates);
  }
  /** Confirm, then delete an embedded item. */
  async #confirmDelete(item) {
    if (!item) return;
    const name = foundry.utils.escapeHTML?.(itemDisplayName2(item)) ?? itemDisplayName2(item);
    const confirmed = await DialogV2.confirm({
      window: { title: loc6("MOUSEGUARD.Sheet.DeleteTitle"), icon: "fa-solid fa-trash" },
      content: `<p>${game.i18n.format("MOUSEGUARD.Sheet.DeleteConfirm", { name })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed) await item.delete();
  }
  /** The embedded item of an action target row. */
  #itemFrom(target) {
    return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }
  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */
  /** Switch between play and edit mode. */
  static #onToggleMode(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    this.#editMode = !this.isEditMode;
    this.render();
  }
  /** Open details fill and generator dialog. */
  static #onOpenDetails(event) {
    event.preventDefault();
    const dlg = game.mouseguard?.MouseGuardDetailsDialog;
    if (dlg) dlg.open(this.actor);
  }
  /** Click on a skill or ability name: Test dialog; Shift+click (or quick mode): roll at once. */
  static async #onRoll(event, target) {
    event.preventDefault();
    const item = this.#itemFrom(target);
    if (!item || !this.isEditable) return;
    const quick = !!event.shiftKey || this.#quickMode;
    return this.#rollTest(this.#rollTarget(item, quick, event));
  }
  /** "Test" header button: free Test dialog (choose the skill or ability inside it). */
  static async #onTestFree(event) {
    event.preventDefault();
    return this.#rollTest({ quick: false, event });
  }
  /** "Quick test" header button: toggles quick mode. */
  static #onToggleQuick(event) {
    event.preventDefault();
    this.#quickMode = !this.#quickMode;
    this.render({ parts: ["header"] });
  }
  /** "New session" header button. */
  static async #onNewSession(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const confirmed = await DialogV2.confirm({
      window: { title: loc6("MOUSEGUARD.Sheet.NewSession"), icon: "fa-solid fa-hourglass-start" },
      content: `<p>${loc6("MOUSEGUARD.Sheet.NewSessionConfirm")}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    if (typeof this.actor.startNewSession === "function") return this.actor.startNewSession();
    const updates = this.actor.items.filter((i) => i.type === "trait").map((i) => ({ _id: i.id, "system.usedFor": 0, "system.usedAgainst": 0, "system.checksEarned": 0 }));
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
    ui.notifications.info(game.i18n.format("MOUSEGUARD.Sheet.NewSessionDone", { name: this.actor.name }));
  }
  /**
   * Pip track click (advancement P/F of skills and abilities, learning marks of rank-0 skills).
   * Left click on pip n sets the count to n (or n-1 when pip n is the last filled one); right click removes one.
   */
  static async #onAdvance(event, target) {
    event.preventDefault();
    const item = this.#itemFrom(target);
    if (!item || !this.isEditable) return;
    const kind = target.dataset.track;
    const value = kind === "learning" ? Number(item.system?.learning) || 0 : Number(item.system?.advancement?.[kind]) || 0;
    let delta = -1;
    if (event.button !== 2) {
      const pip = event.target.closest?.(".mgs-pip");
      if (pip) {
        const n = Number(pip.dataset.index) + 1;
        delta = (n === value ? n - 1 : n) - value;
      } else delta = 1;
    }
    if (value + delta < 0) return;
    return this.#markAdvancement(item, kind, delta);
  }
  /** Trait use: left click = use the trait (for / against); right click = take one mark back. */
  static async #onTraitUse(event, target) {
    event.preventDefault();
    const item = this.#itemFrom(target);
    if (!item || !this.isEditable) return;
    const mode = target.dataset.mode === "against" ? "against" : "for";
    if (event.button === 2) {
      const path = mode === "for" ? "system.usedFor" : "system.usedAgainst";
      const current = Number(foundry.utils.getProperty(item, path)) || 0;
      if (current > 0) await item.update({ [path]: current - 1 });
      return;
    }
    const pip = event.target.closest?.(".mgs-pip");
    if (mode === "for" && pip?.classList.contains("on")) {
      return item.update({ "system.usedFor": Math.max(0, (Number(item.system?.usedFor) || 0) - 1) });
    }
    return this.#useTrait(item, mode);
  }
  /** Toggle one of the four marks of a wise. */
  static async #onWiseMark(event, target) {
    event.preventDefault();
    const item = this.#itemFrom(target);
    const mark = target.dataset.mark;
    if (!item || !this.isEditable || !WISE_MARKS.some((m) => m.key === mark)) return;
    return item.update({ [`system.checks.${mark}`]: !item.system?.checks?.[mark] });
  }
  /** Toggle a condition. */
  static async #onToggleCondition(event, target) {
    event.preventDefault();
    const key = target.dataset.condition;
    if (!this.isEditable || !CONDITIONS.some((c) => c.key === key)) return;
    if (typeof this.actor.toggleCondition === "function") return this.actor.toggleCondition(key);
    return this.actor.update({ [`system.conditions.${key}`]: !this.actor.system.conditions?.[key] });
  }
  /** Left click +1, right click -1 on an actor number (fate, persona, checks, disposition). */
  static async #onAdjust(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const path = target.dataset.path;
    if (!path?.startsWith("system.")) return;
    const delta = event.button === 2 ? -1 : 1;
    const min = Number(target.dataset.min ?? 0);
    const max = Number(target.dataset.max ?? 99);
    const current = Number(foundry.utils.getProperty(this.actor, path)) || 0;
    const value = clamp(current + delta, min, max);
    if (value !== current) return this.actor.update({ [path]: value });
  }
  /** Star toggle on a skill row (edit mode). */
  static async #onToggleSpecialty(event, target) {
    event.preventDefault();
    const item = this.#itemFrom(target);
    if (item && this.isEditable) return this.#toggleSpecialty(item);
  }
  /** Create a new item of the requested type and open its sheet. */
  static async #onItemCreate(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const type = target.dataset.type;
    if (!(type in (CONFIG.Item.dataModels ?? {})) && !game.documentTypes?.Item?.includes(type)) return;
    const name = loc6(NEW_ITEM_NAMES[type] ?? "MOUSEGUARD.Sheet.NewGear");
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet?.render({ force: true });
  }
  /** Open the sheet of an embedded item. */
  static #onItemEdit(event, target) {
    event.preventDefault();
    this.#itemFrom(target)?.sheet?.render({ force: true });
  }
  /** Delete an embedded item (after confirmation). */
  static async #onItemDelete(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    return this.#confirmDelete(this.#itemFrom(target));
  }
  /** Open a compendium pack (skills / traits) to drag entries onto the sheet. */
  static #onOpenCompendium(event, target) {
    event.preventDefault();
    const pack = game.packs.get(target.dataset.pack);
    if (pack) pack.render(true);
    else ui.notifications.warn(game.i18n.format("MOUSEGUARD.Sheet.NoPack", { pack: target.dataset.pack }));
  }
};

// module/rolls/index.js
var STATUS_CONDITION = Object.fromEntries(Object.entries(CONDITION_STATUS).map(([key, id]) => [id, key]));
function registerRollSystem() {
  game.settings.register(SYSTEM_ID, "autoMarkAdvancement", {
    name: "MOUSEGUARD.Test.Setting.AutoMarkName",
    hint: "MOUSEGUARD.Test.Setting.AutoMarkHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  foundry.applications.handlebars.loadTemplates([CARD_TEMPLATE, DIALOG_TEMPLATE]).catch((err) => console.error("Mouse Guard | Could not preload test templates", err));
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
  Hooks.on("renderChatMessageHTML", onRenderChatMessage);
  const syncCondition = (effect, active, userId) => {
    if (userId !== game.user.id) return;
    const actor = effect?.parent;
    if (!(actor instanceof Actor) || !actor.system?.conditions) return;
    const changes = {};
    for (const status of effect.statuses ?? []) {
      const key = STATUS_CONDITION[status];
      if (!key) continue;
      const value = active || actor.effects.some((e) => e.id !== effect.id && !e.disabled && e.statuses?.has(status));
      if (!!actor.system.conditions[key] !== value) changes[`system.conditions.${key}`] = value;
    }
    if (!foundry.utils.isEmpty(changes) && actor.isOwner) actor.update(changes);
  };
  Hooks.on("createActiveEffect", (effect, _options, userId) => syncCondition(effect, true, userId));
  Hooks.on("deleteActiveEffect", (effect, _options, userId) => syncCondition(effect, false, userId));
  CONFIG.queries ??= {};
  CONFIG.queries[TEST_QUERY] = handleTestUpdateQuery;
}
var WISE_MARK_KEY = /^system\.checks\.(pass|fail)$/;
async function handleTestUpdateQuery({ uuid, changes, messageUuid } = {}, { user } = {}) {
  if (!game.user.isGM) throw new Error("Mouse Guard test relay: only the GM handles this query");
  if (!(user instanceof User) || !uuid || !changes || typeof changes !== "object") throw new Error("Mouse Guard test relay: bad request");
  const doc = await fromUuid(uuid).catch(() => null);
  if (!doc) throw new Error("Mouse Guard test relay: document not found");
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
  if (doc.documentName === "Item" && doc.type === "wise") {
    const allowed = Object.fromEntries(Object.entries(changes).filter(([k, v]) => WISE_MARK_KEY.test(k) && typeof v === "boolean"));
    if (foundry.utils.isEmpty(allowed)) throw new Error("Mouse Guard test relay: nothing allowed to update");
    let permitted = doc.testUserPermission(user, "OWNER");
    if (!permitted && messageUuid) {
      const message = await fromUuid(messageUuid).catch(() => null);
      const record = message?.getFlag?.(SYSTEM_ID, "test");
      permitted = !!record && (record.wiseHelpers ?? []).some((h) => h?.uuid === doc.uuid) && !!recordActor(record, message)?.testUserPermission(user, "OWNER");
    }
    if (!permitted) throw new Error("Mouse Guard test relay: permission denied");
    await doc.update(allowed);
    return true;
  }
  throw new Error("Mouse Guard test relay: unsupported document");
}

// module/sheets/npc-base-sheet.js
var { HandlebarsApplicationMixin: HandlebarsApplicationMixin4, DialogV2: DialogV22 } = foundry.applications.api;
var { ActorSheetV2: ActorSheetV22 } = foundry.applications.sheets;
var CHARACTER_TEMPLATES = "systems/mouseguard/templates/actor/character";
var NPC_TEMPLATES = "systems/mouseguard/templates/actor/npc";
var PARTIALS3 = Object.freeze({
  track: `${CHARACTER_TEMPLATES}/parts/track.hbs`,
  tools: `${CHARACTER_TEMPLATES}/parts/line-tools.hbs`,
  ribbon: `${CHARACTER_TEMPLATES}/parts/ribbon-tools.hbs`,
  aspects: `${NPC_TEMPLATES}/parts/aspects.hbs`,
  weapons: `${NPC_TEMPLATES}/parts/weapons.hbs`,
  disposition: `${NPC_TEMPLATES}/parts/disposition.hbs`
});
var GEAR_CATEGORY_INFO = Object.freeze({
  gear: { label: "MOUSEGUARD.ItemSheet.CategoryGear", create: "MOUSEGUARD.Sheet.NewGear", img: "icons/svg/item-bag.svg" },
  weapon: { label: "MOUSEGUARD.ItemSheet.CategoryWeapon", create: "MOUSEGUARD.NPCSheet.NewWeapon", img: "icons/svg/sword.svg" },
  armor: { label: "MOUSEGUARD.ItemSheet.CategoryArmor", create: "MOUSEGUARD.NPCSheet.NewArmor", img: "icons/svg/shield.svg" },
  natural: { label: "MOUSEGUARD.ItemSheet.CategoryNatural", create: "MOUSEGUARD.AnimalSheet.NewWeapon", img: "icons/svg/pawprint.svg" }
});
function gearCategory(item) {
  const category = item?.system?.category;
  return Object.hasOwn(GEAR_CATEGORY_INFO, category) ? category : "gear";
}
var DEFAULT_ASPECTS = Object.freeze({
  mouse: [
    "MOUSEGUARD.NPCSheet.AspectEscaping",
    "MOUSEGUARD.NPCSheet.AspectClimbing",
    "MOUSEGUARD.NPCSheet.AspectForaging",
    "MOUSEGUARD.NPCSheet.AspectHiding"
  ],
  weasel: [
    "MOUSEGUARD.NPCSheet.AspectAggressive",
    "MOUSEGUARD.NPCSheet.AspectBurrowRaiding",
    "MOUSEGUARD.NPCSheet.AspectGloating"
  ]
});
var MouseGuardNPCBaseSheet = class _MouseGuardNPCBaseSheet extends HandlebarsApplicationMixin4(ActorSheetV22) {
  /** Play (false) or edit (true) mode; null until first decided. Sheet-instance state, not saved. */
  #editMode = null;
  /** Quick-test mode: a click on a skill or ability rolls at once, like Shift+click. */
  #quickMode = false;
  /** Nature aspects being added right now (guards against Enter + change firing twice). */
  #aspectPending = /* @__PURE__ */ new Set();
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mouseguard", "sheet", "actor", "mgs-sheet", "themed", "theme-light"],
    position: { width: 1e3, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleMode: _MouseGuardNPCBaseSheet.#onToggleMode,
      roll: _MouseGuardNPCBaseSheet.#onRoll,
      testFree: _MouseGuardNPCBaseSheet.#onTestFree,
      toggleQuick: _MouseGuardNPCBaseSheet.#onToggleQuick,
      toggleCondition: _MouseGuardNPCBaseSheet.#onToggleCondition,
      adjust: { handler: _MouseGuardNPCBaseSheet.#onAdjust, buttons: [0, 2] },
      itemCreate: _MouseGuardNPCBaseSheet.#onItemCreate,
      itemEdit: _MouseGuardNPCBaseSheet.#onItemEdit,
      itemDelete: _MouseGuardNPCBaseSheet.#onItemDelete,
      openCompendium: _MouseGuardNPCBaseSheet.#onOpenCompendium,
      aspectAdd: _MouseGuardNPCBaseSheet.#onAspectAdd,
      aspectRemove: _MouseGuardNPCBaseSheet.#onAspectRemove
    }
  };
  /* -------------------------------------------- */
  /** Is the sheet in edit mode? A blank actor (see {@link _isBlank}) opens in edit mode. */
  get isEditMode() {
    if (!this.isEditable) return false;
    this.#editMode ??= this._isBlank();
    return this.#editMode;
  }
  /** Is the quick-test mode on? */
  get isQuickMode() {
    return this.#quickMode;
  }
  /**
   * Has nothing been written on this actor yet? Then the sheet opens in edit mode.
   * @returns {boolean}
   * @protected
   */
  _isBlank() {
    return !this.actor.items.some((i) => UNIQUE_TYPES.has(i.type));
  }
  /**
   * Portrait image shown while the actor still has the core default image (never saved to the actor).
   * @type {string}
   * @protected
   */
  get _portraitPlaceholder() {
    return PORTRAIT_PLACEHOLDER;
  }
  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    const title = frame.querySelector(".window-header .window-title");
    if (title && this.isEditable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "header-control icon fa-solid fa-lock mgs-mode-toggle";
      button.dataset.action = "toggleMode";
      title.before(button);
    }
    return frame;
  }
  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    Object.assign(context, {
      actor,
      system,
      editMode: this.isEditMode,
      quickMode: this.#quickMode,
      owner: actor.isOwner,
      disposition: { current: system.disposition?.current ?? 0, starting: system.disposition?.starting ?? 0 },
      aspects: this._prepareAspects()
    });
    return context;
  }
  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId in (context.tabs ?? {})) context.tab = context.tabs[partId];
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrich = (html) => TextEditor.enrichHTML(html ?? "", {
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor
    });
    if (partId === "biography" || partId === "description") context.biographyHTML = await enrich(this.actor.system.biography);
    if (partId === "notes") context.notesHTML = await enrich(this.actor.system.notes);
    return context;
  }
  /* -------------------------------------------- */
  /**
   * Portrait column data: image (placeholder while the actor has the core default image) and a subtitle line.
   * @param {string[]} subtitle  parts of the subtitle, joined with " · "
   * @returns {{src: string, isIcon: boolean, subtitle: string}}
   * @protected
   */
  _preparePortrait(subtitle = []) {
    const img = this.actor.img;
    const isDefault = !img || img === CONST.DEFAULT_TOKEN;
    const src = isDefault ? this._portraitPlaceholder : img;
    return {
      src,
      isIcon: isDefault || /\.svg(\?.*)?$/i.test(src),
      subtitle: subtitle.map((s) => String(s ?? "").trim()).filter(Boolean).join(" \xB7 ")
    };
  }
  /**
   * Condition chips for the header box.
   * @protected
   */
  _prepareConditions() {
    const conditions = this.actor.system.conditions ?? {};
    return CONDITIONS.map((c) => ({
      key: c.key,
      active: !!conditions[c.key],
      label: c.label,
      tooltip: c.tooltip,
      icon: `systems/mouseguard/assets/icons/${c.icon}.svg`
    }));
  }
  /**
   * The nature aspects actually shown: the actor's own list, or the rulebook aspects of the species for a mouse or
   * weasel whose list was never written (actors made before the field existed). Editing a shown default list saves it
   * as the actor's own; once written (flags.mouseguard.aspectsSet), an emptied list stays empty.
   * @returns {{names: string[], isDefault: boolean}}
   * @protected
   */
  _aspectList() {
    const own = (this.actor.system.natureAspects ?? []).filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
    if (own.length || this.actor.flags?.mouseguard?.aspectsSet) return { names: own, isDefault: false };
    const defaults = (DEFAULT_ASPECTS[this.actor.type] ?? []).map(loc6);
    return { names: defaults, isDefault: defaults.length > 0 };
  }
  /**
   * Save the nature aspect list (and mark it as written, so the rulebook defaults never come back).
   * @param {string[]} names
   * @protected
   */
  _saveAspects(names) {
    return this.actor.update({ "system.natureAspects": names, "flags.mouseguard.aspectsSet": true });
  }
  /**
   * Nature aspect chips.
   * @protected
   */
  _prepareAspects() {
    const { names, isDefault } = this._aspectList();
    return { list: names.map((name, index) => ({ name, index })), isDefault, empty: !names.length };
  }
  /**
   * Gear row (any category), with the conflict effect line of weapons, armor and animal weapons.
   * @param {Item} item
   * @protected
   */
  _prepareGear(item) {
    const sys = item.system ?? {};
    const category = gearCategory(item);
    return {
      id: item.id,
      name: itemDisplayName2(item),
      img: item.img,
      category,
      categoryLabel: GEAR_CATEGORY_INFO[category].label,
      effect: String(sys.effect ?? "").trim(),
      quantity: sys.quantity ?? 1,
      weight: sys.weight ?? 0,
      excerpt: excerpt(sys.description, 120)
    };
  }
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#createContextMenus();
    this.element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (target?.matches?.("[data-aspect-input]") && event.key === "Enter") {
        event.preventDefault();
        this.#addAspect(target.value);
        return;
      }
      if (!target?.matches?.('[role="button"][data-action]')) return;
      event.preventDefault();
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: event.shiftKey, button: 0 }));
    });
  }
  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const editMode = this.isEditMode;
    this.element.classList.toggle("mgs-edit-mode", editMode);
    this.element.classList.toggle("mgs-play-mode", !editMode);
    const toggle = this.element.querySelector(".window-header .mgs-mode-toggle");
    if (toggle) {
      toggle.classList.toggle("fa-lock-open", editMode);
      toggle.classList.toggle("fa-lock", !editMode);
      const label = loc6(editMode ? "MOUSEGUARD.Sheet.ToPlayMode" : "MOUSEGUARD.Sheet.ToEditMode");
      toggle.dataset.tooltip = label;
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("aria-pressed", String(editMode));
    }
  }
  /* -------------------------------------------- */
  /*  Form handling                               */
  /* -------------------------------------------- */
  /**
   * The portrait <img data-edit="img"> is submitted with every form change. While the actor has no picture of its own
   * it shows the placeholder, which must not be written into actor.img (and from there into the token).
   * A cleared number input submits null, which the schema would reject: the stored value is kept instead.
   * @override
   */
  _processFormData(event, form, formData) {
    for (const [name, value] of Object.entries(formData.object)) {
      if (value === null && form.elements.namedItem(name)?.type === "number") delete formData.object[name];
    }
    const data = super._processFormData(event, form, formData);
    const sourceImg = this.actor._source.img;
    const hasOwnImage = !!sourceImg && sourceImg !== CONST.DEFAULT_TOKEN;
    if (!hasOwnImage && data.img === this._portraitPlaceholder) delete data.img;
    return data;
  }
  /**
   * Inputs that edit an embedded item carry `data-item-field` (and no `name`), so they never reach the actor form
   * submission. Their changes are written to the item here instead. The nature aspect input adds a tag.
   * @override
   */
  _onChangeForm(formConfig, event) {
    const target = event.target;
    if (target?.matches?.("[data-aspect-input]")) {
      event.stopPropagation();
      this.#addAspect(target.value);
      return;
    }
    const input = target?.closest?.("[data-item-field]");
    if (input) {
      event.stopPropagation();
      this.#updateItemField(input);
      return;
    }
    return super._onChangeForm(formConfig, event);
  }
  /** Write one embedded-item input to its item. */
  async #updateItemField(input) {
    const item = this.actor.items.get(input.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    let value;
    if (input.type === "checkbox") value = input.checked;
    else if (input.type === "number" || input.dataset.dtype === "Number") {
      if (input.value === "") return;
      value = Number(input.value);
      if (!Number.isFinite(value)) return;
      if (input.min !== "") value = Math.max(value, Number(input.min));
      if (input.max !== "") value = Math.min(value, Number(input.max));
    } else value = input.value;
    await item.update({ [input.dataset.itemField]: value });
  }
  /** Append a nature aspect (no duplicates, case-insensitive). */
  async #addAspect(rawValue) {
    if (!this.isEditable) return;
    const value = String(rawValue ?? "").trim();
    if (!value) return;
    const key = value.toLocaleLowerCase();
    const { names } = this._aspectList();
    if (this.#aspectPending.has(key) || names.some((n) => n.toLocaleLowerCase() === key)) return;
    this.#aspectPending.add(key);
    try {
      await this._saveAspects([...names, value]);
    } finally {
      this.#aspectPending.delete(key);
    }
  }
  /* -------------------------------------------- */
  /*  Drag and drop                               */
  /* -------------------------------------------- */
  /**
   * Why an item may not be dropped on this actor (a localized message), or null when it may.
   * @param {Item} item
   * @returns {string|null}
   * @protected
   */
  _dropRefusal(item) {
    return null;
  }
  /**
   * Tab that shows an item of this type / category, or null.
   * @param {Item} item
   * @returns {string|null}
   * @protected
   */
  _tabForItem(item) {
    return null;
  }
  /**
   * Dropping an item from a compendium, the sidebar or another actor creates it on this actor (core behaviour),
   * except for an item this actor may not have and a skill, trait or wise it already has. Dropping one of its own
   * items sorts it.
   * @inheritDoc
   */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner || !this.isEditable) return null;
    if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
    const refusal = this._dropRefusal(item);
    if (refusal) {
      ui.notifications.warn(refusal);
      return null;
    }
    const duplicate = this.#findDuplicate(item);
    if (duplicate) {
      ui.notifications.info(game.i18n.format("MOUSEGUARD.NPCSheet.AlreadyHas", { name: itemDisplayName2(duplicate) }));
      return null;
    }
    const created = await super._onDropItem(event, item);
    const tab = created ? this._tabForItem(created) : null;
    if (tab && this.tabGroups.primary !== tab) {
      try {
        this.changeTab(tab, "primary");
      } catch (err) {
        this.tabGroups.primary = tab;
      }
    }
    return created;
  }
  /** An existing item that the dropped one would duplicate. */
  #findDuplicate(item) {
    const norm = (s) => String(s ?? "").trim().toLowerCase();
    if (item.type === "ability") {
      const key = abilityKeyOf(item);
      return key ? this.actor.items.find((i) => i.type === "ability" && abilityKeyOf(i) === key) : null;
    }
    if (!UNIQUE_TYPES.has(item.type)) return null;
    const names = new Set([norm(item.name), norm(item.flags?.mouseguard?.originalName)].filter(Boolean));
    const source = item.uuid;
    return this.actor.items.find((i) => {
      if (i.type !== item.type) return false;
      if (source && i._stats?.compendiumSource === source) return true;
      return names.has(norm(i.name)) || i.flags?.mouseguard?.originalName && names.has(norm(i.flags.mouseguard.originalName));
    }) ?? null;
  }
  /**
   * Sort only among the rows of one list (same item type, and for gear the same weapon / gear group); ignore drops
   * on other rows.
   * @inheritDoc
   */
  _onSortItem(event, item) {
    const row = event.target.closest?.("[data-item-id]");
    const target = row && this.actor.items.get(row.dataset.itemId);
    if (!target || target.id === item.id || target.type !== item.type) return;
    if (item.type === "item" && row.parentElement !== this.element.querySelector(`[data-item-id="${item.id}"]`)?.parentElement) return;
    return super._onSortItem(event, item);
  }
  /* -------------------------------------------- */
  /*  Context menu                                */
  /* -------------------------------------------- */
  /** Item row context menu (right click on the name part of a row). Created once: this.element persists. */
  #createContextMenus() {
    const options = { fixed: true, hookName: "get{}ItemContextOptions", parentClassHooks: false };
    const selector = ".mgs-line[data-item-id] .mgs-line-main, .mgs-gear-row[data-item-id], .mgs-weapon[data-item-id], .mgs-nature-value[data-item-id]";
    const handler = () => this._getItemContextOptions();
    if (typeof this._createContextMenu === "function") this._createContextMenu(handler, selector, options);
    else new foundry.applications.ux.ContextMenu.implementation(this.element, selector, handler(), { fixed: true, jQuery: false });
  }
  /**
   * One context menu entry usable by v14 (label/visible/onClick) and v13 (name/condition/callback) without
   * deprecation warnings.
   * @param {string} label             i18n key
   * @param {string} icon              Font Awesome classes
   * @param {(item: Item) => boolean} visible
   * @param {(item: Item, event?: Event) => any} run
   * @protected
   */
  _contextEntry(label, icon, visible, run2) {
    const itemOf = (el) => this.actor.items.get((el instanceof HTMLElement ? el : el?.[0])?.closest("[data-item-id]")?.dataset.itemId);
    return {
      label,
      name: label,
      icon: `<i class="${icon}"></i>`,
      visible: (el) => !!itemOf(el) && visible(itemOf(el)),
      condition: (el) => !!itemOf(el) && visible(itemOf(el)),
      onClick: (event, el) => run2(itemOf(el), event),
      callback: (el) => run2(itemOf(el))
    };
  }
  /**
   * Item row context menu entries: test / quick test (skills and abilities), edit, delete.
   * @protected
   */
  _getItemContextOptions() {
    const rollable = (i) => i.type === "skill" || i.type === "ability";
    const editable = () => this.isEditable;
    return [
      this._contextEntry(
        "MOUSEGUARD.Sheet.MenuTest",
        "fa-solid fa-dice-d6",
        (i) => rollable(i) && editable(),
        (i) => this._rollTest(this.#rollTarget(i, false))
      ),
      this._contextEntry(
        "MOUSEGUARD.Sheet.MenuQuickTest",
        "fa-solid fa-bolt",
        (i) => rollable(i) && editable(),
        (i) => this._rollTest(this.#rollTarget(i, true))
      ),
      this._contextEntry(
        "MOUSEGUARD.Sheet.MenuEdit",
        "fa-solid fa-pen-to-square",
        () => true,
        (i) => i.sheet?.render({ force: true })
      ),
      this._contextEntry(
        "MOUSEGUARD.Sheet.MenuDelete",
        "fa-solid fa-trash",
        () => editable(),
        (i) => this._confirmDelete(i)
      )
    ];
  }
  /* -------------------------------------------- */
  /*  Actor API wrappers, with fallbacks          */
  /* -------------------------------------------- */
  /** rollTest options for an item row: rollTest({itemId}) for skills, rollTest({abilityKey}) for keyed abilities. */
  #rollTarget(item, quick, event) {
    const key = item.type === "ability" ? item.system?.key : "";
    if (key) return { abilityKey: key, itemId: item.id, quick, event };
    return { itemId: item.id, quick, event };
  }
  /**
   * actor.rollTest, guarded.
   * @param {object} options  see MouseGuardActor#rollTest
   * @protected
   */
  async _rollTest(options) {
    const actor = this.actor;
    if (typeof actor.rollTest !== "function") {
      ui.notifications.warn(loc6("MOUSEGUARD.Sheet.NoRollSystem"));
      return null;
    }
    try {
      return await actor.rollTest(options);
    } catch (err) {
      console.error("Mouse Guard | rollTest failed", err);
      ui.notifications.error(loc6("MOUSEGUARD.Sheet.RollFailed"));
      return null;
    }
  }
  /**
   * Confirm, then delete an embedded item.
   * @param {Item} item
   * @protected
   */
  async _confirmDelete(item) {
    if (!item) return;
    const name = foundry.utils.escapeHTML?.(itemDisplayName2(item)) ?? itemDisplayName2(item);
    const confirmed = await DialogV22.confirm({
      window: { title: loc6("MOUSEGUARD.Sheet.DeleteTitle"), icon: "fa-solid fa-trash" },
      content: `<p>${game.i18n.format("MOUSEGUARD.Sheet.DeleteConfirm", { name })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed) await item.delete();
  }
  /**
   * The embedded item of an action target row.
   * @param {HTMLElement} target
   * @returns {Item|undefined}
   * @protected
   */
  _itemFrom(target) {
    return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }
  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */
  /** Switch between play and edit mode. */
  static #onToggleMode(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    this.#editMode = !this.isEditMode;
    this.render();
  }
  /** Click on a skill or ability name: Test dialog; Shift+click (or quick mode): roll at once. */
  static async #onRoll(event, target) {
    event.preventDefault();
    const item = this._itemFrom(target);
    if (!item || !this.isEditable) return;
    const quick = !!event.shiftKey || this.#quickMode;
    return this._rollTest(this.#rollTarget(item, quick, event));
  }
  /** "Test" header button: Test dialog (the ability of `data-ability`, or choose the skill or ability inside it). */
  static async #onTestFree(event, target) {
    event.preventDefault();
    const abilityKey = target.dataset.ability;
    if (abilityKey && this.actor.getAbility?.(abilityKey)) {
      return this._rollTest({ abilityKey, quick: !!event.shiftKey || this.#quickMode, event });
    }
    return this._rollTest({ quick: false, event });
  }
  /** "Quick test" header button: toggles quick mode. */
  static #onToggleQuick(event) {
    event.preventDefault();
    this.#quickMode = !this.#quickMode;
    this.render({ parts: ["header"] });
  }
  /** Toggle a condition. */
  static async #onToggleCondition(event, target) {
    event.preventDefault();
    const key = target.dataset.condition;
    if (!this.isEditable || !this.actor.system.conditions || !CONDITIONS.some((c) => c.key === key)) return;
    if (typeof this.actor.toggleCondition === "function") return this.actor.toggleCondition(key);
    return this.actor.update({ [`system.conditions.${key}`]: !this.actor.system.conditions?.[key] });
  }
  /** Left click +1, right click -1 on an actor number (disposition). */
  static async #onAdjust(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const path = target.dataset.path;
    if (!path?.startsWith("system.")) return;
    const delta = event.button === 2 ? -1 : 1;
    const min = Number(target.dataset.min ?? 0);
    const max = Number(target.dataset.max ?? 99);
    const current = Number(foundry.utils.getProperty(this.actor, path)) || 0;
    const value = clamp(current + delta, min, max);
    if (value !== current) return this.actor.update({ [path]: value });
  }
  /** Create a new item of the requested type (and gear category) and open its sheet. */
  static async #onItemCreate(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const type = target.dataset.type;
    if (!(type in (CONFIG.Item.dataModels ?? {})) && !game.documentTypes?.Item?.includes(type)) return;
    const data = { name: loc6(NEW_ITEM_NAMES[type] ?? "MOUSEGUARD.Sheet.NewGear"), type };
    const category = target.dataset.category;
    if (type === "item" && Object.hasOwn(GEAR_CATEGORY_INFO, category)) {
      const info = GEAR_CATEGORY_INFO[category];
      Object.assign(data, { name: loc6(info.create), img: info.img, system: { category } });
    }
    const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
    item?.sheet?.render({ force: true });
  }
  /** Open the sheet of an embedded item. */
  static #onItemEdit(event, target) {
    event.preventDefault();
    this._itemFrom(target)?.sheet?.render({ force: true });
  }
  /** Delete an embedded item (after confirmation). */
  static async #onItemDelete(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    return this._confirmDelete(this._itemFrom(target));
  }
  /** Open a compendium pack (skills / traits) to drag entries onto the sheet. */
  static #onOpenCompendium(event, target) {
    event.preventDefault();
    const pack = game.packs.get(target.dataset.pack);
    if (pack) pack.render(true);
    else ui.notifications.warn(game.i18n.format("MOUSEGUARD.Sheet.NoPack", { pack: target.dataset.pack }));
  }
  /** "+" next to the nature aspect input. */
  static async #onAspectAdd(event, target) {
    event.preventDefault();
    const input = target.closest(".mgs-aspects")?.querySelector("[data-aspect-input]");
    await this.#addAspect(input?.value);
  }
  /** Remove one nature aspect. */
  static async #onAspectRemove(event, target) {
    event.preventDefault();
    if (!this.isEditable) return;
    const index = Number(target.dataset.index);
    const { names } = this._aspectList();
    if (!Number.isInteger(index) || index < 0 || index >= names.length) return;
    names.splice(index, 1);
    await this._saveAspects(names);
  }
};

// module/sheets/npc-sheet.js
var { DialogV2: DialogV23 } = foundry.applications.api;
var DETAILS2 = Object.freeze([
  { key: "role", label: "MOUSEGUARD.NPCSheet.Role" },
  { key: "home", label: "MOUSEGUARD.Sheet.Home" },
  { key: "age", label: "MOUSEGUARD.Sheet.Age", type: "number" },
  { key: "fur_color", label: "MOUSEGUARD.Sheet.FurColor" },
  { key: "cloak_color", label: "MOUSEGUARD.Sheet.CloakColor" }
]);
var MAIN_TAB_LABELS = Object.freeze({ mouse: "MOUSEGUARD.Sheet.TabMouse", weasel: "MOUSEGUARD.NPCSheet.TabWeasel" });
var WEAPON_CATEGORIES = /* @__PURE__ */ new Set(["weapon", "armor"]);
var MouseGuardNPCSheet = class _MouseGuardNPCSheet extends MouseGuardNPCBaseSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["npc", "mgs-npc"],
    position: { width: 1100, height: 800 },
    actions: {
      newSession: _MouseGuardNPCSheet.#onNewSession,
      traitUse: { handler: _MouseGuardNPCSheet.#onTraitUse, buttons: [0, 2] },
      toggleKey: _MouseGuardNPCSheet.#onToggleKey,
      openDetails: _MouseGuardNPCSheet.#onOpenDetails
    }
  };
  /** @override */
  static PARTS = {
    portrait: { template: `${NPC_TEMPLATES}/portrait.hbs` },
    header: { template: `${NPC_TEMPLATES}/header.hbs`, templates: [PARTIALS3.disposition] },
    tabs: { template: "templates/generic/tab-navigation.hbs", classes: ["mgs-tabs"] },
    main: {
      template: `${NPC_TEMPLATES}/tab-main.hbs`,
      templates: [PARTIALS3.track, PARTIALS3.tools, PARTIALS3.ribbon, PARTIALS3.aspects],
      scrollable: [""]
    },
    biography: { template: `${NPC_TEMPLATES}/tab-biography.hbs`, scrollable: [""] },
    gear: {
      template: `${NPC_TEMPLATES}/tab-gear.hbs`,
      templates: [PARTIALS3.tools, PARTIALS3.ribbon, PARTIALS3.weapons],
      scrollable: [""]
    },
    notes: { template: `${NPC_TEMPLATES}/tab-notes.hbs`, scrollable: [""] }
  };
  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "MOUSEGUARD.Sheet.TabMouse" },
        { id: "biography", label: "MOUSEGUARD.NPCSheet.TabDescription" },
        { id: "gear", label: "MOUSEGUARD.Sheet.TabGear" },
        { id: "notes", label: "MOUSEGUARD.Sheet.TabNotes" }
      ],
      initial: "main"
    }
  };
  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    const title = frame.querySelector(".window-header .window-title");
    if (title && this.isEditable && this.actor.type === "mouse") {
      const detailsBtn = document.createElement("button");
      detailsBtn.type = "button";
      detailsBtn.className = "header-control icon fa-solid fa-feather-pointed mgs-details-toggle";
      detailsBtn.dataset.action = "openDetails";
      detailsBtn.dataset.tooltip = "MOUSEGUARD.DetailsDialog.ButtonHint";
      title.before(detailsBtn);
    }
    return frame;
  }
  /* -------------------------------------------- */
  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    const opts = super._initializeApplicationOptions(options);
    const type = opts.document?.type;
    if (type) opts.classes.push(`mgs-npc--${type}`);
    return opts;
  }
  /** Weasels get the paw print instead of the seated mouse while they have no picture. @override */
  get _portraitPlaceholder() {
    return this.actor.type === "weasel" ? "icons/svg/pawprint.svg" : super._portraitPlaceholder;
  }
  /** The profile tab is named after the species (Mouse / Weasel). @inheritDoc */
  _getTabsConfig(group) {
    const config = super._getTabsConfig(group);
    if (group !== "primary" || !config) return config;
    const label = MAIN_TAB_LABELS[this.actor.type] ?? "MOUSEGUARD.Sheet.TabMouse";
    return { ...config, tabs: config.tabs.map((t) => t.id === "main" ? { ...t, label } : t) };
  }
  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const byType = (type) => actor.items.filter((i) => i.type === type).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    const keyCharacter = !!system.keyCharacter;
    const details = system.details ?? {};
    const gearItems = byType("item").map((i) => this._prepareGear(i));
    const gear = gearItems.filter((g) => !WEAPON_CATEGORIES.has(g.category));
    const totalWeight = gearItems.reduce((sum, g) => sum + (Number(g.quantity) || 0) * (Number(g.weight) || 0), 0);
    const shownTypes = /* @__PURE__ */ new Set(["ability", "skill", "trait", "wise", "item"]);
    const portrait = this._preparePortrait([details.role, formatAge(details.age), details.home]);
    portrait.cloak = String(details.cloak_color ?? "").trim();
    portrait.cloakSwatch = cloakSwatch(details.cloak_color);
    Object.assign(context, {
      isWeasel: actor.type === "weasel",
      keyCharacter,
      portrait,
      conditions: this._prepareConditions(),
      healthy: !CONDITIONS.some((c) => system.conditions?.[c.key]),
      showQuests: keyCharacter,
      quests: [
        { key: "belief", path: "system.motivation.belief", value: system.motivation?.belief ?? "", label: "MOUSEGUARD.Sheet.Belief", hint: "MOUSEGUARD.NPCSheet.BeliefHint" },
        { key: "goal", path: "system.motivation.goal", value: system.motivation?.goal ?? "", label: "MOUSEGUARD.Sheet.Goal", hint: "MOUSEGUARD.NPCSheet.GoalHint" },
        { key: "instinct", path: "system.motivation.instinct", value: system.motivation?.instinct ?? "", label: "MOUSEGUARD.Sheet.Instinct", hint: "MOUSEGUARD.NPCSheet.InstinctHint" }
      ],
      abilities: this.#prepareAbilities(),
      skills: byType("skill").map((i) => this.#prepareSkill(i)),
      traits: byType("trait").map((i) => this.#prepareTrait(i)),
      wises: byType("wise").map((i) => ({ id: i.id, name: itemDisplayName2(i) })),
      weapons: gearItems.filter((g) => WEAPON_CATEGORIES.has(g.category)),
      weaponsEmpty: "MOUSEGUARD.NPCSheet.EmptyWeapons",
      showWeaponCategory: true,
      gear,
      totalWeight: Math.round(totalWeight * 100) / 100,
      others: actor.items.filter((i) => !shownTypes.has(i.type)).sort((a, b) => a.sort - b.sort).map((i) => ({ id: i.id, name: itemDisplayName2(i), img: i.img, typeLabel: loc6(CONFIG.Item.typeLabels?.[i.type] ?? i.type) })),
      details: DETAILS2.map((d) => ({ ...d, name: `system.details.${d.key}`, value: details[d.key] ?? (d.type === "number" ? 0 : "") })),
      packs: { skill: !!game.packs.get(PACKS.skill), trait: !!game.packs.get(PACKS.trait) }
    });
    return context;
  }
  /** Ability rows, in rulebook order (nature, will, health, resources, circles), then any other ability. */
  #prepareAbilities() {
    const rows = this.actor.items.filter((i) => i.type === "ability").map((item) => {
      const key = abilityKeyOf(item);
      return {
        id: item.id,
        key,
        label: abilityDisplayName(item),
        rating: Number(item.system?.rating) || 0,
        isNature: key === "nature",
        order: ABILITY_ORDER2.includes(key) ? ABILITY_ORDER2.indexOf(key) : 10 + (item.sort || 0) / 1e6
      };
    });
    return rows.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }
  /** Skill row: rank, or "–" for an unlearned skill (Beginner's Luck). */
  #prepareSkill(item) {
    const sys = item.system ?? {};
    const rank = Number(sys.rank) || 0;
    const blKey = sys.beginnersLuck === "health" ? "health" : "will";
    return {
      id: item.id,
      name: itemDisplayName2(item),
      rank,
      learned: rank > 0,
      blTooltip: rank > 0 ? "" : game.i18n.format("MOUSEGUARD.Sheet.BeginnersLuckHint", { ability: loc6(ABILITY_LABELS2[blKey]) })
    };
  }
  /** Trait row: level I-III and the beneficial uses this session. */
  #prepareTrait(item) {
    const sys = item.system ?? {};
    const level = clamp(sys.level ?? 1, 1, 3);
    const usedFor = Number(sys.usedFor) || 0;
    return {
      id: item.id,
      name: itemDisplayName2(item),
      level,
      roman: ROMAN2[level],
      unlimited: level >= 3,
      spent: level < 3 && usedFor >= level,
      forTrack: level < 3 ? track({ kind: "usedFor", label: "MOUSEGUARD.Sheet.TraitForShort", tooltip: "MOUSEGUARD.NPCSheet.TraitForHint", count: level, value: usedFor, action: "traitUse", mode: "for" }) : null
    };
  }
  /* -------------------------------------------- */
  /*  Hooks of the base sheet                     */
  /* -------------------------------------------- */
  /** @override */
  _tabForItem(item) {
    if (["ability", "skill", "trait", "wise"].includes(item.type)) return "main";
    return "gear";
  }
  /** Adds "use the trait" to the item context menu. @override */
  _getItemContextOptions() {
    const entries = super._getItemContextOptions();
    const use = this._contextEntry(
      "MOUSEGUARD.Sheet.MenuTraitFor",
      "fa-solid fa-angles-up",
      (i) => i.type === "trait" && this.isEditable,
      (i) => this.#useTrait(i)
    );
    entries.splice(2, 0, use);
    return entries;
  }
  /** Use a trait to help (once per session at level 1, twice at level 2, at will at level 3). */
  async #useTrait(item) {
    if (typeof this.actor.useTrait === "function") return this.actor.useTrait(item.id, "for");
    const level = clamp(item.system?.level ?? 1, 1, 3);
    const used = Number(item.system?.usedFor) || 0;
    if (level < 3 && used >= level) return;
    return item.update({ "system.usedFor": clamp(used + 1, 0, 2) });
  }
  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */
  /** "New session" header button: trait uses of this session are reset. */
  static async #onNewSession(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const name = foundry.utils.escapeHTML?.(this.actor.name) ?? this.actor.name;
    const confirmed = await DialogV23.confirm({
      window: { title: loc6("MOUSEGUARD.Sheet.NewSession"), icon: "fa-solid fa-hourglass-start" },
      content: `<p>${game.i18n.format("MOUSEGUARD.NPCSheet.NewSessionConfirm", { name })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    if (typeof this.actor.startNewSession === "function") return this.actor.startNewSession();
    const updates = this.actor.items.filter((i) => i.type === "trait").map((i) => ({ _id: i.id, "system.usedFor": 0 }));
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
  }
  /** Trait use pips: left click = use the trait (or take back a filled pip), right click = take one use back. */
  static async #onTraitUse(event, target) {
    event.preventDefault();
    const item = this._itemFrom(target);
    if (!item || !this.isEditable) return;
    const used = Number(item.system?.usedFor) || 0;
    const pip = event.target.closest?.(".mgs-pip");
    if (event.button === 2 || pip?.classList.contains("on")) {
      if (used > 0) await item.update({ "system.usedFor": used - 1 });
      return;
    }
    return this.#useTrait(item);
  }
  /** Key character switch: shows Belief, Goal and Instinct. */
  static async #onToggleKey(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    return this.actor.update({ "system.keyCharacter": !this.actor.system.keyCharacter });
  }
  /** Open details fill and generator dialog. */
  static #onOpenDetails(event) {
    event.preventDefault();
    const dlg = game.mouseguard?.MouseGuardDetailsDialog;
    if (dlg) dlg.open(this.actor);
  }
};

// module/sheets/animal-sheet.js
var ANIMAL_TEMPLATES = "systems/mouseguard/templates/actor/animal";
var NATURE_CAP = 12;
var ARMY_SIZES = Object.freeze({ 2: 20, 3: 100, 4: 200, 5: 2e3, 6: 2e4 });
var orderKey = (level) => `MOUSEGUARD.AnimalSheet.Order${level}`;
var REFUSED_TYPES = /* @__PURE__ */ new Set(["skill", "trait", "wise", "contact"]);
var MouseGuardAnimalSheet = class _MouseGuardAnimalSheet extends MouseGuardNPCBaseSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["animal", "mgs-animal"],
    position: { width: 1100, height: 800 },
    actions: {
      setOrder: _MouseGuardAnimalSheet.#onSetOrder,
      createNature: _MouseGuardAnimalSheet.#onCreateNature
    }
  };
  /** @override */
  static PARTS = {
    portrait: { template: `${ANIMAL_TEMPLATES}/portrait.hbs` },
    header: { template: `${ANIMAL_TEMPLATES}/header.hbs`, templates: [PARTIALS3.disposition] },
    tabs: { template: "templates/generic/tab-navigation.hbs", classes: ["mgs-tabs"] },
    animal: {
      template: `${ANIMAL_TEMPLATES}/tab-animal.hbs`,
      templates: [PARTIALS3.tools, PARTIALS3.aspects, PARTIALS3.weapons],
      scrollable: [""]
    },
    description: {
      template: `${ANIMAL_TEMPLATES}/tab-description.hbs`,
      templates: [PARTIALS3.tools],
      scrollable: [""]
    },
    notes: { template: `${NPC_TEMPLATES}/tab-notes.hbs`, scrollable: [""] }
  };
  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "animal", label: "MOUSEGUARD.AnimalSheet.TabAnimal" },
        { id: "description", label: "MOUSEGUARD.NPCSheet.TabDescription" },
        { id: "notes", label: "MOUSEGUARD.Sheet.TabNotes" }
      ],
      initial: "animal"
    }
  };
  /* -------------------------------------------- */
  /** @override */
  get _portraitPlaceholder() {
    return "icons/svg/pawprint.svg";
  }
  /** A new animal (no species, aspects or animal weapons yet) opens in edit mode. @override */
  _isBlank() {
    const system = this.actor.system;
    return !String(system.species ?? "").trim() && !(system.natureAspects ?? []).length && !this.actor.itemTypes.item?.length;
  }
  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const level = Math.clamp(Number(system.naturalOrder) || 0, 0, NATURAL_ORDER_MAX);
    const natureItem = actor.getAbility?.("nature") ?? actor.items.find((i) => i.type === "ability" && i.system?.key === "nature");
    const rating = Number(natureItem?.system?.rating) || 0;
    const items = actor.items.filter((i) => i.type === "item").sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    const species = String(system.species ?? "").trim();
    Object.assign(context, {
      portrait: this._preparePortrait([species, level ? game.i18n.format("MOUSEGUARD.AnimalSheet.OrderShort", { level }) : ""]),
      species,
      speciesOptions: this.#speciesOptions(),
      nature: natureItem ? { id: natureItem.id, label: natureItem.displayName ?? loc6("MOUSEGUARD.Nature"), rating, cap: NATURE_CAP } : null,
      weapons: items.filter((i) => gearCategory(i) === "natural").map((i) => this._prepareGear(i)),
      weaponsEmpty: "MOUSEGUARD.AnimalSheet.EmptyWeapons",
      showWeaponCategory: false,
      // everything but the Nature shown in the header and the animal weapons, so that legacy items stay reachable
      others: actor.items.filter((i) => i.id !== natureItem?.id && !(i.type === "item" && gearCategory(i) === "natural")).sort((a, b) => a.sort - b.sort).map((i) => ({
        id: i.id,
        name: itemDisplayName2(i),
        img: i.img,
        typeLabel: loc6(i.type === "item" ? GEAR_CATEGORY_INFO[gearCategory(i)].label : CONFIG.Item.typeLabels?.[i.type] ?? i.type)
      })),
      order: this.#prepareOrder(level, rating)
    });
    return context;
  }
  /** Natural Order table (9 = bear, moose ... 1 = insects; mice are 3) and what it means for the guards. */
  #prepareOrder(level, nature) {
    const relative = level ? level - NATURAL_ORDER_MOUSE : null;
    const rows = [];
    for (let n = NATURAL_ORDER_MAX; n >= 1; n--) {
      rows.push({ level: n, label: loc6(orderKey(n)), current: n === level, isMouse: n === NATURAL_ORDER_MOUSE, above: n - NATURAL_ORDER_MOUSE });
    }
    const order = { level, known: level > 0, relative, rows, mighty: (relative ?? 0) >= 2 };
    if (!level) return order;
    if (relative === 0) order.relation = loc6("MOUSEGUARD.AnimalSheet.RelationLevel");
    else {
      const n = Math.abs(relative);
      let one = n === 1;
      try {
        one = new Intl.PluralRules(game.i18n.lang).select(n) === "one";
      } catch (err) {
      }
      const key = `MOUSEGUARD.AnimalSheet.Relation${relative > 0 ? "Above" : "Below"}${one ? "One" : "Other"}`;
      order.relation = game.i18n.format(key, { n });
    }
    if (relative <= 1) order.fight = loc6("MOUSEGUARD.AnimalSheet.FightAny");
    else if (relative === 2) order.fight = loc6("MOUSEGUARD.AnimalSheet.FightNoKill");
    else order.fight = loc6("MOUSEGUARD.AnimalSheet.FightDriveOff");
    const army = ARMY_SIZES[Math.min(relative, 6)];
    order.war = army ? game.i18n.format("MOUSEGUARD.AnimalSheet.WarArmy", { n: army.toLocaleString(game.i18n.lang) }) : loc6("MOUSEGUARD.AnimalSheet.WarNotNeeded");
    order.science = relative >= 2 ? game.i18n.format("MOUSEGUARD.AnimalSheet.ScienceTrap", { ob: nature }) : loc6("MOUSEGUARD.AnimalSheet.ScienceNotNeeded");
    return order;
  }
  /** Species named in the Natural Order table, for the species input's suggestions. */
  #speciesOptions() {
    const names = /* @__PURE__ */ new Set();
    for (let n = 1; n <= NATURAL_ORDER_MAX; n++) {
      for (const name of loc6(orderKey(n)).split(/[,;]/)) if (name.trim()) names.add(name.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, game.i18n.lang));
  }
  /** Natural Order level of a species named in the table (exact name, ignoring case), or 0. */
  #orderOfSpecies(species) {
    const wanted = String(species ?? "").trim().toLocaleLowerCase();
    if (!wanted) return 0;
    for (let n = NATURAL_ORDER_MAX; n >= 1; n--) {
      const names = loc6(orderKey(n)).split(/[,;]/).map((s) => s.trim().toLocaleLowerCase());
      if (names.includes(wanted)) return n;
    }
    return 0;
  }
  /* -------------------------------------------- */
  /*  Form handling                               */
  /* -------------------------------------------- */
  /**
   * Typing a new species from the Natural Order table fills in its level while the level is still unknown (a level
   * cleared on purpose stays cleared while the species stays the same).
   * @inheritDoc
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const species = data.system?.species;
    const changed = typeof species === "string" && species.trim() !== String(this.actor.system.species ?? "").trim();
    if (changed && !(Number(this.actor.system.naturalOrder) > 0) && data.system.naturalOrder === void 0) {
      const level = this.#orderOfSpecies(species);
      if (level) data.system.naturalOrder = level;
    }
    return data;
  }
  /* -------------------------------------------- */
  /*  Hooks of the base sheet                     */
  /* -------------------------------------------- */
  /** Animals have one ability, Nature: no skills, traits, wises, contacts or other abilities. @override */
  _dropRefusal(item) {
    if (REFUSED_TYPES.has(item.type)) return loc6("MOUSEGUARD.AnimalSheet.DropRefused");
    if (item.type === "ability" && item.system?.key !== "nature") return loc6("MOUSEGUARD.AnimalSheet.DropRefused");
    return null;
  }
  /** @override */
  _tabForItem(item) {
    if (item.type === "item" && gearCategory(item) === "natural") return "animal";
    return item.type === "ability" ? "animal" : "description";
  }
  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */
  /** Natural Order row click (edit mode): set the level; a click on the current level clears it. */
  static async #onSetOrder(event, target) {
    event.preventDefault();
    if (!this.isEditable || !this.isEditMode) return;
    const level = Math.clamp(Number(target.dataset.level) || 0, 0, NATURAL_ORDER_MAX);
    const next = level === Number(this.actor.system.naturalOrder) ? 0 : level;
    return this.actor.update({ "system.naturalOrder": next });
  }
  /**
   * Create the missing Nature ability of an animal. A lone ability without a key (a legacy or renamed Nature item) is
   * made the Nature instead of adding a second one.
   */
  static async #onCreateNature(event) {
    event.preventDefault();
    if (!this.isEditable || this.actor.getAbility?.("nature")) return;
    const keyless = (this.actor.itemTypes.ability ?? []).filter((i) => !i.system?.key);
    if (keyless.length === 1) return keyless[0].update({ "system.key": "nature" });
    await this.actor.createEmbeddedDocuments("Item", [{
      name: loc6("MOUSEGUARD.Nature"),
      type: "ability",
      system: { key: "nature", rating: 1, max: 1 }
    }]);
  }
};

// module/templates.js
var preloadHandlebarsTemplates = async function() {
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
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};

// module/macro.js
async function createMouseGuardMacro(data, slot) {
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
      command,
      flags: { "mouseguard.attrMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

// module/conflict-tracker.js
var { ApplicationV2: ApplicationV22, HandlebarsApplicationMixin: HandlebarsApplicationMixin5 } = foundry.applications.api;
var ConflictTracker = class extends HandlebarsApplicationMixin5(ApplicationV22) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "conflict-tracker",
    classes: ["mouseguard"],
    window: {
      title: "MOUSEGUARD.Conflict.Tracker"
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
};

// module/mouse-combantant.js
var MouseCombatant = class extends Combatant {
  get ConflictCaptain() {
    return this.getFlag("mouseguard", "ConflictCaptain") ?? false;
  }
  get team() {
    return this.getFlag("mouseguard", "Team") ?? "0";
  }
  async setConflictCaptain(value) {
    return this.setFlag("mouseguard", "ConflictCaptain", value);
  }
  async SetMove(move) {
    return this.setFlag("mouseguard", "Moves", move);
  }
  async setTeam(value) {
    return this.setFlag("mouseguard", "Team", String(value));
  }
  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    let init2 = 0;
    const actor = this.actor ?? game.actors.get(data.actorId);
    if (actor?.type === "character") init2 = 1;
    this.updateSource({
      initiative: init2,
      flags: {
        mouseguard: {
          ConflictCaptain: false,
          Moves: [],
          Team: "0"
        }
      }
    });
    return allowed;
  }
  async doMove(id) {
    const moves = this.getFlag("mouseguard", "Moves") || [];
    const theMove = moves.find((item) => item.id == id);
    if (!theMove) return;
    const template = "systems/mouseguard/templates/chat/combat-action.hbs";
    const data = { actor: this.actor, move: theMove.move };
    const content = await foundry.applications.handlebars.renderTemplate(template, data);
    const chatData = {
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      flags: {
        mouseguard: {
          unflipped: true
        }
      }
    };
    await ChatMessage.create(chatData);
    const otherMoves = moves.filter((item) => item.id != id);
    await this.SetMove(otherMoves);
  }
};

// module/socket.js
var MouseSocket = class {
  static async askGoal(data) {
    const htmlContent = await foundry.applications.handlebars.renderTemplate(
      "systems/mouseguard/templates/parts/conflict-manager.hbs",
      data
    );
    const dialog = new foundry.applications.api.DialogV2({
      window: {
        title: "MOUSEGUARD.Conflict.Manager"
      },
      content: htmlContent,
      buttons: [
        {
          action: "ok",
          label: "MOUSEGUARD.Conflict.Apply",
          default: true,
          callback: (event, button, dialog2) => {
            const form = dialog2.element.querySelector("form") ?? dialog2.element;
            const conflictGoal = form.querySelector("#conflict_goal")?.value ?? "";
            const combatId = data.combat?.id ?? data.combat?._id ?? data.combat;
            const goalData = {
              action: "setGoal",
              combat: combatId,
              goal: conflictGoal,
              team: data.team
            };
            if (game.user.isGM) {
              this.setGoal(goalData);
            } else {
              game.socket.emit("system.mouseguard", goalData);
            }
          }
        },
        {
          action: "cancel",
          label: "MOUSEGUARD.Conflict.Cancel"
        }
      ]
    });
    dialog.render(true);
  }
  static async setGoal(data) {
    if (game.user.isGM) {
      const combatId = data.combat?.id ?? data.combat?._id ?? data.combat;
      const combat = game.combats.get(combatId);
      if (combat) {
        await combat.setGoal(data.goal, data.team);
      }
    }
  }
  static async askMoves(data) {
    const htmlContent = await foundry.applications.handlebars.renderTemplate(
      "systems/mouseguard/templates/parts/conflict-move-manager.hbs",
      data
    );
    const dialog = new foundry.applications.api.DialogV2({
      window: {
        title: "MOUSEGUARD.Conflict.Manager"
      },
      content: htmlContent,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("MOUSEGUARD.Send"),
          default: true,
          callback: async (event, button, dialog2) => {
            const element = dialog2.element;
            const move1Actor = element.querySelector("#move0-actor")?.value;
            const move1Move = element.querySelector(".move0:checked")?.value;
            const move2Actor = element.querySelector("#move1-actor")?.value;
            const move2Move = element.querySelector(".move1:checked")?.value;
            const move3Actor = element.querySelector("#move2-actor")?.value;
            const move3Move = element.querySelector(".move2:checked")?.value;
            if (!move1Move || !move2Move || !move3Move || !move1Actor || !move2Actor || !move3Actor) {
              ui.notifications.error(
                game.i18n.localize("MOUSEGUARD.Conflict.MovesError")
              );
              this.askMoves(data);
              return;
            }
            const combatantData = {
              [move1Actor]: [],
              [move2Actor]: [],
              [move3Actor]: []
            };
            combatantData[move1Actor].push({
              id: foundry.utils.randomID(),
              move: move1Move,
              combatant: move1Actor
            });
            combatantData[move2Actor].push({
              id: foundry.utils.randomID(),
              move: move2Move,
              combatant: move2Actor
            });
            combatantData[move3Actor].push({
              id: foundry.utils.randomID(),
              move: move3Move,
              combatant: move3Actor
            });
            const combatId = data.combat?.id ?? data.combat?._id ?? (typeof data.combat === "string" ? data.combat : null);
            const moveData = {
              action: "setMoves",
              combat: combatId,
              data: combatantData
            };
            if (game.user.isGM) {
              this.setMoves(moveData);
            } else {
              await game.socket.emit("system.mouseguard", moveData);
            }
          }
        },
        {
          action: "cancel",
          label: "MOUSEGUARD.Conflict.Cancel"
        }
      ]
    });
    dialog.render(true);
  }
  static async setMoves(data) {
    if (game.user.isGM) {
      const combatId = data.combat?.id ?? data.combat?._id ?? data.combat;
      const combat = game.combats.get(combatId);
      if (!combat) return;
      for (const key of Object.keys(data.data)) {
        const combatant = combat.combatants.get(key);
        if (combatant) {
          await combatant.setFlag("mouseguard", "Moves", data.data[key]);
        }
      }
    }
  }
};

// module/mouse-combat.js
var MouseCombat = class extends Combat {
  get getGoal1() {
    return this.getFlag("mouseguard", "goal1");
  }
  get getGoal2() {
    return this.getFlag("mouseguard", "goal2");
  }
  get getConflictCaptain() {
    return this.getFlag("mouseguard", "ConflictCaptain");
  }
  get getConflictCaptainTeam2() {
    return this.getFlag("mouseguard", "ConflictCaptain2");
  }
  async setConflictCaptain(value) {
    return this.setFlag("mouseguard", "ConflictCaptain", value);
  }
  async setConflictCaptainTeam2(value) {
    return this.setFlag("mouseguard", "ConflictCaptain2", value);
  }
  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    this.updateSource({
      flags: {
        mouseguard: {
          ConflictCaptain: null,
          ConflictCaptain2: null,
          goal1: null,
          goal2: null,
          team1Move: null,
          team2Move: null
        }
      }
    });
    return allowed;
  }
  async startCombat() {
    const goal = this.getFlag("mouseguard", "goal1");
    const goal2 = this.getFlag("mouseguard", "goal2");
    const CC = this.getFlag("mouseguard", "ConflictCaptain");
    const CC2 = this.getFlag("mouseguard", "ConflictCaptain2");
    if (!CC) {
      ui.notifications.error(game.i18n.localize("COMBAT.NeedCC"));
      return false;
    }
    if (!goal) {
      ui.notifications.error(game.i18n.localize("COMBAT.NeedGoal"));
      await this.askGoal();
      return false;
    }
    if (!goal2) {
      ui.notifications.error(game.i18n.localize("COMBAT.NeedGoal"));
      await this.askGoal();
      return false;
    }
    if (goal && goal2 && CC && CC2) {
      await this.askMove();
      return this.update({ round: 1, turn: 0 });
    }
    return false;
  }
  getCCPlayerByID(conflictCaptainID) {
    const combatant = this.combatants.get(conflictCaptainID);
    if (!combatant) return game.users.activeGM;
    const actor = combatant.actor ?? game.actors.get(combatant.actorId);
    if (!actor) return game.users.activeGM;
    return game.users.filter(
      (u) => !u.isGM && u.active && actor.testUserPermission(u, "OWNER")
    )?.[0] ?? game.users.activeGM;
  }
  async askGoal() {
    const CC = this.getFlag("mouseguard", "ConflictCaptain");
    const CC2 = this.getFlag("mouseguard", "ConflictCaptain2");
    if (!CC) {
      ui.notifications.error(game.i18n.localize("MOUSEGUARD.Conflict.NeedCaptainTeam1"));
      return false;
    }
    if (!CC2) {
      ui.notifications.error(game.i18n.localize("MOUSEGUARD.Conflict.NeedCaptainTeam2"));
      return false;
    }
    const player = this.getCCPlayerByID(CC);
    if (player) {
      await game.socket.emit(
        "system.mouseguard",
        { action: "askGoal", combat: this.id, team: "1" },
        { recipients: [player.id] }
      );
    }
    const player2 = this.getCCPlayerByID(CC2);
    if (player2) {
      await game.socket.emit(
        "system.mouseguard",
        { action: "askGoal", combat: this.id, team: "2" },
        { recipients: [player2.id] }
      );
    }
  }
  async setGoal(goal, team) {
    await this.setFlag("mouseguard", "goal" + team, goal);
    await this.startCombat();
    return true;
  }
  async askMove() {
    const CC = this.getFlag("mouseguard", "ConflictCaptain");
    const CC2 = this.getFlag("mouseguard", "ConflictCaptain2");
    if (!CC) {
      ui.notifications.error(game.i18n.localize("COMBAT.NeedCC"));
      return false;
    }
    const data = { combat: this.id };
    const team1 = [];
    const team2 = [];
    const combatants = this.combatants.filter((comb) => comb.team === "1" || comb.team === 1);
    for (const comb of combatants) {
      team1.push({
        combatant: comb.id,
        name: comb.name ?? comb.token?.name
      });
    }
    data.actors = team1;
    data.action = "askMoves";
    const player = this.getCCPlayerByID(CC);
    if (player) {
      await game.socket.emit("system.mouseguard", data, {
        recipients: [player.id]
      });
    }
    const player2 = this.getCCPlayerByID(CC2);
    const data2 = { ...data };
    if (!player2 || player2.isGM) {
      data2.npc = true;
    }
    const team2combatants = this.combatants.filter((comb) => comb.team === "2" || comb.team === 2);
    for (const comb of team2combatants) {
      team2.push({
        combatant: comb.id,
        name: comb.name ?? comb.token?.name
      });
    }
    data2.actors = team2;
    if (player2) {
      await game.socket.emit("system.mouseguard", data2, {
        recipients: [player2.id]
      });
    }
  }
  async askNPCMove(data) {
    await MouseSocket.askMoves(data);
  }
  /** @override */
  async nextRound() {
    await this.askMove();
    return super.nextRound();
  }
};

// module/mouse-combat-tracker.js
var CombatTracker = foundry.applications.sidebar.tabs.CombatTracker;
var MouseCombatTracker = class _MouseCombatTracker extends CombatTracker {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      askMove: _MouseCombatTracker.#onAskMove,
      askGoal: _MouseCombatTracker.#onAskGoal,
      doMove: _MouseCombatTracker.#onDoMove
    }
  };
  /** @override */
  static PARTS = {
    header: {
      template: "systems/mouseguard/templates/sidebar/tabs/combat/header.hbs"
    },
    tracker: {
      template: "systems/mouseguard/templates/sidebar/tabs/combat/tracker.hbs",
      scrollable: [""]
    },
    footer: {
      template: "templates/sidebar/tabs/combat/footer.hbs"
    }
  };
  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */
  /** @inheritDoc */
  async _prepareTurnContext(combat, combatant, index) {
    const turn = await super._prepareTurnContext(combat, combatant, index);
    turn.team = combatant.team || "0";
    turn.isConflictCaptain = !!combatant.ConflictCaptain;
    turn.moves = combatant.getFlag("mouseguard", "Moves") || [];
    turn.isFirstOwner = this.isFirstOwner(combatant.actor);
    turn.hasPlayerOwner = this.hasPlayerOwner(combatant.actor);
    return turn;
  }
  /** @inheritDoc */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);
    const combat = this.viewed;
    const turns = context.turns || [];
    context.teams = {
      team1: {
        id: "1",
        label: game.i18n.localize("COMBAT.Team1"),
        goal: combat?.getFlag("mouseguard", "goal1") || game.i18n.localize("COMBAT.NoGoal"),
        turns: turns.filter((t) => t.team === "1" || t.team === 1)
      },
      team2: {
        id: "2",
        label: game.i18n.localize("COMBAT.Team2"),
        goal: combat?.getFlag("mouseguard", "goal2") || game.i18n.localize("COMBAT.NoGoal"),
        turns: turns.filter((t) => t.team === "2" || t.team === 2)
      },
      team0: {
        id: "0",
        label: game.i18n.localize("COMBAT.Team0"),
        goal: null,
        turns: turns.filter((t) => !t.team || t.team === "0" || t.team === 0)
      }
    };
  }
  /* -------------------------------------------- */
  /*  Context Menu                                */
  /* -------------------------------------------- */
  /** @inheritDoc */
  _getEntryContextOptions() {
    const entries = super._getEntryContextOptions();
    entries.unshift({
      label: "COMBAT.ConflictCaptain",
      icon: "fa-solid fa-crown",
      visible: (li) => game.user.isGM,
      onClick: async (event, li) => {
        const combatantId = li.dataset.combatantId;
        const combatant = this.viewed?.combatants.get(combatantId);
        if (!combatant) return;
        const team = combatant.team;
        if (!team || team === "0") {
          ui.notifications.warn(game.i18n.localize("MOUSEGUARD.Conflict.AssignTeamFirst"));
          return;
        }
        const flagKey = team === "2" || team === 2 ? "ConflictCaptain2" : "ConflictCaptain";
        const currentCaptainId = this.viewed.getFlag("mouseguard", flagKey);
        if (currentCaptainId === combatant.id) {
          await this.viewed.setFlag("mouseguard", flagKey, null);
          await combatant.setConflictCaptain(false);
        } else if (!currentCaptainId) {
          await this.viewed.setFlag("mouseguard", flagKey, combatant.id);
          await combatant.setConflictCaptain(true);
        } else {
          ui.notifications.error(game.i18n.localize("COMBAT.CCSet"));
        }
      }
    });
    return entries;
  }
  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */
  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    if (game.user.isGM) {
      this.element.querySelectorAll(".combatant[draggable='true']").forEach((li) => {
        li.addEventListener("dragstart", this.#onDragStart.bind(this));
      });
      this.element.querySelectorAll("[data-team]").forEach((el) => {
        el.addEventListener("dragover", (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        });
        el.addEventListener("drop", this.#onDropTeam.bind(this));
      });
    }
  }
  #onDragStart(event) {
    const li = event.currentTarget.closest(".combatant");
    if (!li) return;
    const combatant = this.viewed?.combatants.get(li.dataset.combatantId);
    if (!combatant) return;
    if (combatant.ConflictCaptain) {
      ui.notifications.error(game.i18n.localize("COMBAT.CCERROR"));
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", JSON.stringify({ id: combatant.id }));
  }
  async #onDropTeam(event) {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (!data.id) return;
      const targetEl = event.target.closest("[data-team]");
      const targetTeam = targetEl?.dataset.team;
      if (targetTeam === void 0) return;
      const combatant = this.viewed?.combatants.get(data.id);
      if (combatant) {
        await combatant.setTeam(targetTeam);
      }
    } catch (err) {
      console.error("MouseGuard | Error during team drop", err);
    }
  }
  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */
  static async #onAskMove(event, target) {
    await this.viewed?.askMove();
  }
  static async #onAskGoal(event, target) {
    await this.viewed?.askGoal();
  }
  static async #onDoMove(event, target) {
    const combatantId = target.dataset.combatantId;
    const moveId = target.dataset.moveId;
    const combatant = this.viewed?.combatants.get(combatantId);
    if (combatant) {
      await combatant.doMove(moveId);
    }
  }
  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */
  firstOwner(doc) {
    if (!doc) return null;
    const owners = Object.entries(doc.ownership || {}).filter(([id, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER).map(([id]) => game.users.get(id)).filter((u) => u && u.active);
    const playerOwner = owners.find((u) => !u.isGM);
    return playerOwner ?? owners.find((u) => u.isGM) ?? null;
  }
  isFirstOwner(doc) {
    const owner = this.firstOwner(doc);
    return owner?.id === game.user.id;
  }
  hasPlayerOwner(doc) {
    if (!doc) return false;
    return Object.entries(doc.ownership || {}).some(([id, level]) => {
      const u = game.users.get(id);
      return u && !u.isGM && u.active && level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    });
  }
};

// module/status-effects.js
var statusEffects = [
  {
    id: "sick",
    name: "MOUSEGUARD.sick",
    img: "systems/mouseguard/assets/icons/sick.svg"
  },
  {
    id: "tired",
    name: "MOUSEGUARD.tired",
    img: "systems/mouseguard/assets/icons/tired.svg"
  },
  {
    id: "hungthurst",
    name: "MOUSEGUARD.hungthurst",
    img: "systems/mouseguard/assets/icons/hungthurst.svg"
  },
  {
    id: "injured",
    name: "MOUSEGUARD.injured",
    img: "systems/mouseguard/assets/icons/injured.svg"
  },
  {
    id: "angry",
    name: "MOUSEGUARD.angry",
    img: "systems/mouseguard/assets/icons/angry.svg"
  }
];

// module/mouse-effects.js
var { ApplicationV2: ApplicationV23, HandlebarsApplicationMixin: HandlebarsApplicationMixin6 } = foundry.applications.api;
var MOUSEGUARD_STATUS_IDS = new Set(statusEffects.map((e) => e.id));
var EffectsPanel = class extends HandlebarsApplicationMixin6(ApplicationV23) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "mouseguard-effects-panel",
    classes: ["mouseguard", "effects-panel"],
    tag: "aside",
    window: {
      frame: false,
      positioned: false
    }
  };
  /** @inheritDoc */
  static PARTS = {
    panel: {
      root: true,
      template: "systems/mouseguard/templates/effects/effects-panel.hbs"
    }
  };
  /**
   * Debounce and slightly delayed request to re-render this panel.
   */
  refresh = foundry.utils.debounce(() => {
    if (this.rendered) this.render(false);
  }, 100);
  get token() {
    return canvas.tokens?.controlled?.at(0)?.document ?? null;
  }
  get actor() {
    return this.token?.actor ?? game.user?.character ?? null;
  }
  /** @inheritDoc */
  async _prepareContext(options) {
    let currentStatus = [];
    const { actor } = this;
    if (actor) {
      currentStatus = Array.from(actor.statuses ?? []).filter((id) => MOUSEGUARD_STATUS_IDS.has(id));
    }
    return { currentStatus };
  }
  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll(".effect-item").forEach((el) => {
      el.addEventListener("click", async (event) => {
        event.preventDefault();
        const effectId = el.dataset.effectId;
        if (this.actor && effectId) {
          await this.actor.toggleStatusEffect(effectId);
        }
      });
    });
  }
};

// node_modules/svelte/internal/index.mjs
function noop() {
}
function run(fn) {
  return fn();
}
function blank_object() {
  return /* @__PURE__ */ Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
function is_function(thing) {
  return typeof thing === "function";
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
function is_empty(obj) {
  return Object.keys(obj).length === 0;
}
var is_hydrating = false;
function start_hydrating() {
  is_hydrating = true;
}
function end_hydrating() {
  is_hydrating = false;
}
function detach(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}
function children(element) {
  return Array.from(element.childNodes);
}
var current_component;
function set_current_component(component) {
  current_component = component;
}
var dirty_components = [];
var binding_callbacks = [];
var render_callbacks = [];
var flush_callbacks = [];
var resolved_promise = Promise.resolve();
var update_scheduled = false;
function schedule_update() {
  if (!update_scheduled) {
    update_scheduled = true;
    resolved_promise.then(flush);
  }
}
function add_render_callback(fn) {
  render_callbacks.push(fn);
}
var seen_callbacks = /* @__PURE__ */ new Set();
var flushidx = 0;
function flush() {
  if (flushidx !== 0) {
    return;
  }
  const saved_component = current_component;
  do {
    try {
      while (flushidx < dirty_components.length) {
        const component = dirty_components[flushidx];
        flushidx++;
        set_current_component(component);
        update(component.$$);
      }
    } catch (e) {
      dirty_components.length = 0;
      flushidx = 0;
      throw e;
    }
    set_current_component(null);
    dirty_components.length = 0;
    flushidx = 0;
    while (binding_callbacks.length)
      binding_callbacks.pop()();
    for (let i = 0; i < render_callbacks.length; i += 1) {
      const callback = render_callbacks[i];
      if (!seen_callbacks.has(callback)) {
        seen_callbacks.add(callback);
        callback();
      }
    }
    render_callbacks.length = 0;
  } while (dirty_components.length);
  while (flush_callbacks.length) {
    flush_callbacks.pop()();
  }
  update_scheduled = false;
  seen_callbacks.clear();
  set_current_component(saved_component);
}
function update($$) {
  if ($$.fragment !== null) {
    $$.update();
    run_all($$.before_update);
    const dirty = $$.dirty;
    $$.dirty = [-1];
    $$.fragment && $$.fragment.p($$.ctx, dirty);
    $$.after_update.forEach(add_render_callback);
  }
}
var outroing = /* @__PURE__ */ new Set();
function transition_in(block, local) {
  if (block && block.i) {
    outroing.delete(block);
    block.i(local);
  }
}
var globals = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : global;
function mount_component(component, target, anchor, customElement) {
  const { fragment, after_update } = component.$$;
  fragment && fragment.m(target, anchor);
  if (!customElement) {
    add_render_callback(() => {
      const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
      if (component.$$.on_destroy) {
        component.$$.on_destroy.push(...new_on_destroy);
      } else {
        run_all(new_on_destroy);
      }
      component.$$.on_mount = [];
    });
  }
  after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
  const $$ = component.$$;
  if ($$.fragment !== null) {
    run_all($$.on_destroy);
    $$.fragment && $$.fragment.d(detaching);
    $$.on_destroy = $$.fragment = null;
    $$.ctx = [];
  }
}
function make_dirty(component, i) {
  if (component.$$.dirty[0] === -1) {
    dirty_components.push(component);
    schedule_update();
    component.$$.dirty.fill(0);
  }
  component.$$.dirty[i / 31 | 0] |= 1 << i % 31;
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
  const parent_component = current_component;
  set_current_component(component);
  const $$ = component.$$ = {
    fragment: null,
    ctx: [],
    // state
    props,
    update: noop,
    not_equal,
    bound: blank_object(),
    // lifecycle
    on_mount: [],
    on_destroy: [],
    on_disconnect: [],
    before_update: [],
    after_update: [],
    context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
    // everything else
    callbacks: blank_object(),
    dirty,
    skip_bound: false,
    root: options.target || parent_component.$$.root
  };
  append_styles && append_styles($$.root);
  let ready = false;
  $$.ctx = instance ? instance(component, options.props || {}, (i, ret, ...rest) => {
    const value = rest.length ? rest[0] : ret;
    if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
      if (!$$.skip_bound && $$.bound[i])
        $$.bound[i](value);
      if (ready)
        make_dirty(component, i);
    }
    return ret;
  }) : [];
  $$.update();
  ready = true;
  run_all($$.before_update);
  $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
  if (options.target) {
    if (options.hydrate) {
      start_hydrating();
      const nodes = children(options.target);
      $$.fragment && $$.fragment.l(nodes);
      nodes.forEach(detach);
    } else {
      $$.fragment && $$.fragment.c();
    }
    if (options.intro)
      transition_in(component.$$.fragment);
    mount_component(component, options.target, options.anchor, options.customElement);
    end_hydrating();
    flush();
  }
  set_current_component(parent_component);
}
var SvelteElement;
if (typeof HTMLElement === "function") {
  SvelteElement = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      const { on_mount } = this.$$;
      this.$$.on_disconnect = on_mount.map(run).filter(is_function);
      for (const key in this.$$.slotted) {
        this.appendChild(this.$$.slotted[key]);
      }
    }
    attributeChangedCallback(attr, _oldValue, newValue) {
      this[attr] = newValue;
    }
    disconnectedCallback() {
      run_all(this.$$.on_disconnect);
    }
    $destroy() {
      destroy_component(this, 1);
      this.$destroy = noop;
    }
    $on(type, callback) {
      if (!is_function(callback)) {
        return noop;
      }
      const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index !== -1)
          callbacks.splice(index, 1);
      };
    }
    $set($$props) {
      if (this.$$set && !is_empty($$props)) {
        this.$$.skip_bound = true;
        this.$$set($$props);
        this.$$.skip_bound = false;
      }
    }
  };
}
var SvelteComponent = class {
  $destroy() {
    destroy_component(this, 1);
    this.$destroy = noop;
  }
  $on(type, callback) {
    if (!is_function(callback)) {
      return noop;
    }
    const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
    callbacks.push(callback);
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1)
        callbacks.splice(index, 1);
    };
  }
  $set($$props) {
    if (this.$$set && !is_empty($$props)) {
      this.$$.skip_bound = true;
      this.$$set($$props);
      this.$$.skip_bound = false;
    }
  }
};

// module/svelte/MouseGuardConflictManager.svelte
var MouseGuardConflictManager = class extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, null, null, safe_not_equal, {});
  }
};
var MouseGuardConflictManager_default = MouseGuardConflictManager;

// node_modules/svelte/store/index.mjs
var subscriber_queue = [];
function writable(value, start = noop) {
  let stop;
  const subscribers = /* @__PURE__ */ new Set();
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update2(fn) {
    set(fn(value));
  }
  function subscribe2(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) {
      stop = start(set) || noop;
    }
    run2(value);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
        stop = null;
      }
    };
  }
  return { set, update: update2, subscribe: subscribe2 };
}

// module/mouse-conflict-manager.js
var { ApplicationV2: ApplicationV24 } = foundry.applications.api;
var MouseConflictManager = class extends ApplicationV24 {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "mouseguard-conflict-panel",
    classes: ["mouseguard"],
    window: {
      title: "MOUSEGUARD.Conflict.Manager"
    },
    position: {
      width: 850,
      height: 600
    }
  };
  app = null;
  dataStore = null;
  /**
   * Debounce request to re-render.
   */
  refresh = foundry.utils.debounce(() => {
    if (this.rendered) this.render(false);
  }, 100);
  /** @inheritDoc */
  async _prepareContext(options) {
    return {};
  }
  /** @override */
  async _renderHTML(context, options) {
    return "";
  }
  /** @override */
  _replaceHTML(result, content, options) {
  }
  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.app) {
      this.dataStore = writable(context);
      this.app = new MouseGuardConflictManager_default({
        target: this.element,
        props: {
          dataStore: this.dataStore
        }
      });
    } else {
      this.dataStore?.set(context);
    }
  }
  /** @inheritDoc */
  _onClose(options) {
    if (this.app) {
      this.app.$destroy();
      this.app = null;
      this.dataStore = null;
    }
    super._onClose(options);
  }
};

// module/details/details-data.js
var HOMES = Object.freeze([
  {
    key: "barkstone",
    name: "\u0414\u0440\u0435\u0432\u043E\u0433\u0440\u0430\u0434",
    nameEn: "Barkstone",
    skills: ["\u0413\u043E\u043D\u0447\u0430\u0440", "\u041F\u043B\u043E\u0442\u043D\u0438\u043A", "\u0421\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A"],
    trait: "\u0417\u043E\u043B\u043E\u0442\u044B\u0435 \u043B\u0430\u043F\u044B",
    hint: "\u041A\u0440\u0443\u043F\u043D\u044B\u0439 \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u0439 \u0443\u0437\u0435\u043B, \u0440\u0435\u043C\u0435\u0441\u043B\u0435\u043D\u043D\u044B\u0439 \u0446\u0435\u043D\u0442\u0440 (\u0413\u043E\u043D\u0447\u0430\u0440, \u041F\u043B\u043E\u0442\u043D\u0438\u043A, \u0421\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A \xB7 \u0417\u043E\u043B\u043E\u0442\u044B\u0435 \u043B\u0430\u043F\u044B)"
  },
  {
    key: "copperwood_flintrust",
    name: "\u041A\u0440\u0435\u043C\u043D\u0435\u0440\u0436\u0430\u0432\u044C",
    nameEn: "Copperwood / Flintrust",
    skills: ["\u041A\u0443\u0437\u043D\u0435\u0446", "\u0420\u0430\u0437\u043D\u043E\u0440\u0430\u0431\u043E\u0447\u0438\u0439"],
    traits: ["\u0411\u0435\u0437\u0440\u0430\u0441\u0441\u0443\u0434\u043D\u044B\u0439", "\u0420\u0435\u0448\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439"],
    hint: "\u0411\u0435\u0434\u043D\u044B\u0439 \u0433\u043E\u0440\u043D\u044F\u0446\u043A\u0438\u0439 \u0433\u043E\u0440\u043E\u0434\u043E\u043A \u0443 \u0441\u0442\u0430\u0440\u044B\u0445 \u0448\u0430\u0445\u0442 (\u041A\u0443\u0437\u043D\u0435\u0446, \u0420\u0430\u0437\u043D\u043E\u0440\u0430\u0431\u043E\u0447\u0438\u0439 \xB7 \u0411\u0435\u0437\u0440\u0430\u0441\u0441\u0443\u0434\u043D\u044B\u0439, \u0420\u0435\u0448\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439)"
  },
  {
    key: "lockhaven",
    name: "\u041B\u043E\u043A\u0445\u044D\u0439\u0432\u0435\u043D",
    nameEn: "Lockhaven",
    skills: ["\u041E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A", "\u0422\u043A\u0430\u0447"],
    traits: ["\u0414\u043E\u0432\u0435\u0440\u0438\u0435 \u0421\u0442\u0440\u0430\u0436\u0438", "\u0429\u0435\u0434\u0440\u044B\u0439"],
    hint: "\u0426\u0438\u0442\u0430\u0434\u0435\u043B\u044C \u041C\u044B\u0448\u0438\u043D\u043E\u0439 \u0421\u0442\u0440\u0430\u0436\u0438 (\u041E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A, \u0422\u043A\u0430\u0447 \xB7 \u0414\u043E\u0432\u0435\u0440\u0438\u0435 \u0421\u0442\u0440\u0430\u0436\u0438, \u0429\u0435\u0434\u0440\u044B\u0439)"
  },
  {
    key: "copperwood",
    name: "\u041C\u0435\u0434\u043D\u043E\u043B\u0435\u0441\u044C\u0435",
    nameEn: "Copperwood",
    skills: ["\u041A\u0443\u0437\u043D\u0435\u0446", "\u0422\u043E\u0440\u0433\u0430\u0448"],
    traits: ["\u041D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u044B\u0439"],
    hint: "\u041E\u0434\u0438\u043D \u0438\u0437 \u0441\u0442\u0430\u0440\u0435\u0439\u0448\u0438\u0445 \u0433\u043E\u0440\u043E\u0434\u043E\u0432, \u043C\u0435\u0434\u043D\u044B\u0435 \u0440\u0443\u0434\u043D\u0438\u043A\u0438 (\u041A\u0443\u0437\u043D\u0435\u0446, \u0422\u043E\u0440\u0433\u0430\u0448 \xB7 \u041D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u044B\u0439)"
  },
  {
    key: "elmoss",
    name: "\u041C\u043E\u0445\u043E\u0432\u044F\u0437",
    nameEn: "Elmoss",
    skills: ["\u041F\u043B\u043E\u0442\u043D\u0438\u043A", "\u0421\u0431\u043E\u0440\u0449\u0438\u043A"],
    traits: ["\u0411\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439"],
    hint: "\u0413\u043E\u0440\u043E\u0434 \u0446\u0435\u043B\u0435\u0431\u043D\u043E\u0433\u043E \u043C\u0445\u0430 \u0438 \u0441\u0431\u043E\u0440\u0430 \u0442\u0440\u0430\u0432 (\u041F\u043B\u043E\u0442\u043D\u0438\u043A, \u0421\u0431\u043E\u0440\u0449\u0438\u043A \xB7 \u0411\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439)"
  },
  {
    key: "sandy_ford",
    name: "\u041F\u0435\u0441\u0447\u0430\u043D\u044B\u0439 \u0414\u043E\u043C",
    nameEn: "Sandy Ford",
    skills: ["\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C \u0437\u0430 \u043F\u043E\u0433\u043E\u0434\u043E\u0439", "\u0421\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A"],
    traits: ["\u0421\u043E\u0432\u0430", "\u0422\u0438\u0445\u0438\u0439"],
    hint: "\u041F\u043E\u0441\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u043E\u0447\u043D\u044B\u0445 \u043C\u044B\u0448\u0435\u0439 \u0443 \u0440\u0435\u0447\u043D\u043E\u0433\u043E \u0431\u0440\u043E\u0434\u0430 (\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C \u0437\u0430 \u043F\u043E\u0433\u043E\u0434\u043E\u0439, \u0421\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A \xB7 \u0421\u043E\u0432\u0430, \u0422\u0438\u0445\u0438\u0439)"
  },
  {
    key: "ivydale",
    name: "\u041F\u043B\u044E\u0449\u0438",
    nameEn: "Ivydale",
    skills: ["\u041F\u0435\u043A\u0430\u0440\u044C", "\u0421\u0431\u043E\u0440\u0449\u0438\u043A"],
    traits: ["\u0422\u0440\u0443\u0434\u043E\u043B\u044E\u0431\u0438\u0432\u044B\u0439"],
    hint: "\u0416\u0438\u0442\u043D\u0438\u0446\u0430 \u0422\u0435\u0440\u0440\u0438\u0442\u043E\u0440\u0438\u0439, \u0441\u043B\u0430\u0432\u0438\u0442\u0441\u044F \u0445\u043B\u0435\u0431\u043E\u043C \u0438 \u043F\u0435\u043A\u0430\u0440\u043D\u044F\u043C\u0438 (\u041F\u0435\u043A\u0430\u0440\u044C, \u0421\u0431\u043E\u0440\u0449\u0438\u043A \xB7 \u0422\u0440\u0443\u0434\u043E\u043B\u044E\u0431\u0438\u0432\u044B\u0439)"
  },
  {
    key: "spruce_ford",
    name: "\u041F\u043E\u0434\u044A\u0435\u043B\u044C\u043D\u0438\u043A",
    nameEn: "Spruce Ford",
    skills: ["\u0417\u043D\u0430\u0442\u043E\u043A \u0437\u0432\u0435\u0440\u0435\u0439", "\u0423\u0447\u0451\u043D\u044B\u0439"],
    traits: ["\u0414\u043E\u0442\u043E\u0448\u043D\u044B\u0439", "\u0420\u0430\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439"],
    hint: "\u0413\u043E\u0440\u043E\u0434 \u0443\u0447\u0451\u043D\u044B\u0445, \u043B\u0435\u043A\u0430\u0440\u0435\u0439 \u0438 \u0441\u043E\u0441\u0442\u0430\u0432\u0430 \u0434\u043B\u044F \u041F\u0430\u0445\u0443\u0447\u0435\u0439 \u0413\u0440\u0430\u043D\u0438\u0446\u044B (\u0417\u043D\u0430\u0442\u043E\u043A \u0437\u0432\u0435\u0440\u0435\u0439, \u0423\u0447\u0451\u043D\u044B\u0439 \xB7 \u0414\u043E\u0442\u043E\u0448\u043D\u044B\u0439, \u0420\u0430\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439)"
  },
  {
    key: "port_sumac",
    name: "\u041F\u043E\u0440\u0442-\u0421\u0443\u043C\u0430\u0445",
    nameEn: "Port Sumac",
    skills: ["\u041A\u043E\u0440\u0430\u0431\u0435\u043B", "\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C \u0437\u0430 \u043F\u043E\u0433\u043E\u0434\u043E\u0439"],
    traits: ["\u041A\u0440\u0435\u043F\u043A\u0438\u0439", "\u041C\u0435\u0442\u0435\u043E\u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439"],
    hint: "\u0428\u0443\u043C\u043D\u044B\u0439 \u043F\u043E\u0440\u0442 \u043C\u0435\u0436\u0434\u0443 \u0422\u0435\u043C\u043D\u043E\u0432\u043E\u0434\u044C\u0435\u043C \u0438 \u0420\u0436\u0430\u0432\u043E\u043B\u0438\u0441\u0442\u043E\u043C (\u041A\u043E\u0440\u0430\u0431\u0435\u043B, \u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C \u0437\u0430 \u043F\u043E\u0433\u043E\u0434\u043E\u0439 \xB7 \u041A\u0440\u0435\u043F\u043A\u0438\u0439, \u041C\u0435\u0442\u0435\u043E\u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439)"
  },
  {
    key: "shale_burrow",
    name: "\u0421\u043B\u0430\u043D\u0446\u0435\u0432\u0430\u044F \u041D\u043E\u0440\u0430",
    nameEn: "Shale Burrow",
    skills: ["\u041A\u0430\u043C\u0435\u043D\u0449\u0438\u043A", "\u041C\u0435\u043B\u044C\u043D\u0438\u043A", "\u0421\u0431\u043E\u0440\u0449\u0438\u043A"],
    traits: ["\u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0439"],
    hint: "\u0422\u0440\u0430\u0434\u0438\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0433\u043E\u0440\u043E\u0434 \u043A\u0430\u043C\u0435\u043D\u043D\u044B\u0445 \u043D\u043E\u0440, \u0441\u043B\u0430\u0432\u0438\u0442\u0441\u044F \u043D\u0430\u043F\u0438\u0442\u043A\u0430\u043C\u0438 (\u041A\u0430\u043C\u0435\u043D\u0449\u0438\u043A, \u041C\u0435\u043B\u044C\u043D\u0438\u043A, \u0421\u0431\u043E\u0440\u0449\u0438\u043A \xB7 \u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0439)"
  },
  {
    key: "grasslake",
    name: "\u0422\u0440\u0430\u0432\u043E\u043E\u0437\u0451\u0440\u044C\u0435",
    nameEn: "Grasslake",
    skills: ["\u0412\u043E\u0435\u043D\u043D\u044B\u0439", "\u041D\u0430\u0441\u0435\u043A\u043E\u043C\u043E\u0432\u043E\u0434"],
    traits: ["\u0417\u0430\u0449\u0438\u0442\u043D\u0438\u043A", "\u041F\u0440\u043E\u0432\u043E\u0440\u043D\u044B\u0439"],
    hint: "\u0413\u043E\u0440\u043E\u0434 \u043D\u0430 \u043E\u0437\u0435\u0440\u0435 \u0441 \u0432\u043E\u0438\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u043C \u043D\u0440\u0430\u0432\u043E\u043C (\u0412\u043E\u0435\u043D\u043D\u044B\u0439, \u041D\u0430\u0441\u0435\u043A\u043E\u043C\u043E\u0432\u043E\u0434 \xB7 \u0417\u0430\u0449\u0438\u0442\u043D\u0438\u043A, \u041F\u0440\u043E\u0432\u043E\u0440\u043D\u044B\u0439)"
  }
]);
var GUARD_RANKS = Object.freeze([
  {
    name: "\xAB\u041B\u0430\u043F\u0430 \u043F\u043E\u043C\u043E\u0449\u0438\xBB",
    nameEn: "Tenderfoot",
    minAge: 14,
    maxAge: 17,
    birthMin: 1135,
    birthMax: 1138,
    allowsCloak: false,
    hint: "\u041D\u043E\u0432\u043E\u0431\u0440\u0430\u043D\u0435\u0446 (14\u201317 \u043B\u0435\u0442). \u041F\u043B\u0430\u0449 \u043D\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D."
  },
  {
    name: "\u0421\u0442\u0440\u0430\u0436",
    nameEn: "Guardmouse",
    minAge: 18,
    maxAge: 25,
    birthMin: 1127,
    birthMax: 1134,
    allowsCloak: true,
    hint: "\u0420\u044F\u0434\u043E\u0432\u043E\u0439 \u0441\u0442\u0440\u0430\u0436 (18\u201325 \u043B\u0435\u0442). \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u043F\u043B\u0430\u0449 \u043E\u0442 \u043D\u0430\u0441\u0442\u0430\u0432\u043D\u0438\u043A\u0430."
  },
  {
    name: "\u041F\u0430\u0442\u0440\u0443\u043B\u044C\u043D\u044B\u0439",
    nameEn: "Patrol Guard",
    minAge: 21,
    maxAge: 50,
    birthMin: 1102,
    birthMax: 1131,
    allowsCloak: true,
    hint: "\u041E\u043F\u044B\u0442\u043D\u044B\u0439 \u0431\u043E\u0435\u0446 \u0438 \u0441\u043B\u0435\u0434\u043E\u043F\u044B\u0442 (21\u201350 \u043B\u0435\u0442)."
  },
  {
    name: "\u041B\u0438\u0434\u0435\u0440 \u043F\u0430\u0442\u0440\u0443\u043B\u044F",
    nameEn: "Patrol Leader",
    minAge: 21,
    maxAge: 60,
    birthMin: 1092,
    birthMax: 1131,
    allowsCloak: true,
    hint: "\u041A\u043E\u043C\u0430\u043D\u0434\u0438\u0440 \u043F\u0430\u0442\u0440\u0443\u043B\u044F (21\u201360 \u043B\u0435\u0442)."
  },
  {
    name: "\u041A\u0430\u043F\u0438\u0442\u0430\u043D \u0421\u0442\u0440\u0430\u0436\u0438",
    nameEn: "Guard Captain",
    minAge: 41,
    maxAge: 60,
    birthMin: 1092,
    birthMax: 1111,
    allowsCloak: true,
    hint: "\u0412\u044B\u0441\u0448\u0438\u0439 \u043E\u0444\u0438\u0446\u0435\u0440 \u0421\u0442\u0440\u0430\u0436\u0438 (41\u201360 \u043B\u0435\u0442)."
  }
]);
var FUR_COLORS = Object.freeze([
  { name: "\u041A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0439", weight: 30, rarity: "common" },
  { name: "\u0420\u0443\u0441\u044B\u0439", weight: 25, rarity: "common" },
  { name: "\u0421\u0435\u0440\u044B\u0439", weight: 25, rarity: "common" },
  { name: "\u0427\u0451\u0440\u043D\u044B\u0439", weight: 10, rarity: "uncommon" },
  { name: "\u0411\u0435\u043B\u044B\u0439", weight: 8, rarity: "uncommon" },
  { name: "\u0420\u044B\u0436\u0438\u0439", weight: 2, rarity: "rare" }
]);
var CLOAK_COLORS = Object.freeze([
  { name: "\u042F\u0440\u043A\u043E-\u0436\u0451\u043B\u0442\u044B\u0439", meaning: "\u0429\u0435\u0434\u0440\u043E\u0441\u0442\u044C, \u043E\u0442\u0437\u044B\u0432\u0447\u0438\u0432\u043E\u0441\u0442\u044C \u0438 \u0442\u0435\u043F\u043B\u043E\u0442\u0430 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0430" },
  { name: "\u0421\u043B\u0438\u0432\u043E\u0432\u044B\u0439", meaning: "\u0412\u0434\u0443\u043C\u0447\u0438\u0432\u043E\u0441\u0442\u044C, \u0432\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u0438 \u0440\u0430\u0441\u0441\u0443\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C" },
  { name: "\u0421\u0430\u043B\u0430\u0442\u043E\u0432\u044B\u0439", meaning: "\u041C\u043E\u043B\u043E\u0434\u043E\u0441\u0442\u044C, \u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u043F\u0440\u0438\u0440\u043E\u0434\u043E\u0439" },
  { name: "\u041B\u0435\u0441\u043D\u043E\u0439 \u0437\u0435\u043B\u0451\u043D\u044B\u0439", meaning: "\u0421\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u044C, \u043B\u0435\u0441\u043D\u0430\u044F \u0432\u044B\u0443\u0447\u043A\u0430, \u0443\u043F\u043E\u0440\u0441\u0442\u0432\u043E" },
  { name: "\u041A\u0440\u0430\u0441\u043D\u044B\u0439", meaning: "\u0425\u0440\u0430\u0431\u0440\u043E\u0441\u0442\u044C, \u043F\u044B\u043B\u043A\u043E\u0441\u0442\u044C \u0438 \u0431\u043E\u0435\u0432\u0430\u044F \u0440\u0435\u0448\u0438\u043C\u043E\u0441\u0442\u044C" },
  { name: "\u0410\u043B\u044B\u0439", meaning: "\u041D\u0435\u0443\u0441\u0442\u0440\u0430\u0448\u0438\u043C\u043E\u0441\u0442\u044C \u0438 \u043B\u0438\u0434\u0435\u0440\u0441\u0442\u0432\u043E" },
  { name: "\u0412\u0430\u0441\u0438\u043B\u044C\u043A\u043E\u0432\u044B\u0439", meaning: "\u0421\u043F\u043E\u043A\u043E\u0439\u0441\u0442\u0432\u0438\u0435, \u043D\u0430\u0434\u0435\u0436\u043D\u043E\u0441\u0442\u044C \u0438 \u0445\u043B\u0430\u0434\u043D\u043E\u043A\u0440\u043E\u0432\u0438\u0435" },
  { name: "\u0421\u0438\u043D\u0438\u0439", meaning: "\u041C\u0443\u0434\u0440\u043E\u0441\u0442\u044C, \u0441\u0442\u043E\u0439\u043A\u043E\u0441\u0442\u044C \u0438 \u043F\u0440\u0435\u0434\u0430\u043D\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u0442\u0430\u0432\u0443" },
  { name: "\u0421\u0435\u0440\u044B\u0439", meaning: "\u0421\u043A\u0440\u043E\u043C\u043D\u043E\u0441\u0442\u044C, \u0432\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u044C \u0438 \u043D\u0435\u043F\u0440\u0438\u0445\u043E\u0442\u043B\u0438\u0432\u043E\u0441\u0442\u044C" },
  { name: "\u041A\u0443\u0437\u043D\u0438\u0447\u043D\u043E-\u0436\u0451\u043B\u0442\u044B\u0439", meaning: "\u0422\u0440\u0443\u0434\u043E\u043B\u044E\u0431\u0438\u0435, \u0443\u043F\u043E\u0440\u0441\u0442\u0432\u043E \u0438 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u043E" },
  { name: "\u041E\u0440\u0430\u043D\u0436\u0435\u0432\u044B\u0439", meaning: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u043C, \u043D\u0435\u0443\u043A\u0440\u043E\u0442\u0438\u043C\u0430\u044F \u044D\u043D\u0435\u0440\u0433\u0438\u044F" },
  { name: "\u0418\u043D\u0434\u0438\u0433\u043E", meaning: "\u0413\u043B\u0443\u0431\u043E\u043A\u0430\u044F \u0438\u043D\u0442\u0443\u0438\u0446\u0438\u044F, \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u044C" },
  { name: "\u041E\u043B\u0438\u0432\u043A\u043E\u0432\u044B\u0439", meaning: "\u041C\u0438\u0440\u043E\u043B\u044E\u0431\u0438\u0435, \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0438 \u043E\u0441\u0442\u043E\u0440\u043E\u0436\u043D\u043E\u0441\u0442\u044C" },
  { name: "\u041A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0439", meaning: "\u041F\u0440\u0430\u043A\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u044C, \u043D\u0430\u0434\u0435\u0436\u043D\u043E\u0441\u0442\u044C \u0438 \u0441\u0432\u044F\u0437\u044C \u0441 \u0437\u0435\u043C\u043B\u0435\u0439" }
]);
var CRAFTS = Object.freeze([
  "\u0410\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441",
  "\u0413\u043E\u043D\u0447\u0430\u0440",
  "\u041A\u0430\u043C\u0435\u043D\u0449\u0438\u043A",
  "\u041A\u0430\u0440\u0442\u043E\u0433\u0440\u0430\u0444",
  "\u041A\u043E\u0440\u0430\u0431\u0435\u043B",
  "\u041A\u0443\u0437\u043D\u0435\u0446",
  "\u041B\u0435\u043A\u0430\u0440\u044C",
  "\u041C\u0435\u043B\u044C\u043D\u0438\u043A",
  "\u041D\u0430\u0441\u0435\u043A\u043E\u043C\u043E\u0432\u043E\u0434",
  "\u041E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A",
  "\u041F\u0435\u043A\u0430\u0440\u044C",
  "\u041F\u0438\u0432\u043E\u0432\u0430\u0440",
  "\u041F\u043B\u043E\u0442\u043D\u0438\u043A",
  "\u041F\u043E\u0432\u0430\u0440",
  "\u041F\u0447\u0435\u043B\u043E\u0432\u043E\u0434",
  "\u0420\u0430\u0437\u043D\u043E\u0440\u0430\u0431\u043E\u0447\u0438\u0439",
  "\u0421\u0431\u043E\u0440\u0449\u0438\u043A",
  "\u0421\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A",
  "\u0422\u043A\u0430\u0447"
]);
var NPC_ROLES = Object.freeze({
  craftsmen: [
    "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440",
    "\u0410\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441",
    "\u0413\u043E\u043D\u0447\u0430\u0440",
    "\u0416\u043D\u0435\u0446",
    "\u0416\u0443\u043A\u043E\u043F\u0430\u0441",
    "\u041A\u0430\u043C\u0435\u043D\u0449\u0438\u043A",
    "\u041A\u0430\u0440\u0442\u043E\u0433\u0440\u0430\u0444",
    "\u041A\u043E\u0440\u0430\u0431\u0435\u043B",
    "\u041A\u0443\u0437\u043D\u0435\u0446",
    "\u041B\u0435\u043A\u0430\u0440\u044C",
    "\u041C\u0435\u043B\u044C\u043D\u0438\u043A",
    "\u041D\u0430\u0441\u0435\u043A\u043E\u043C\u043E\u0432\u043E\u0434",
    "\u041E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A",
    "\u041F\u0435\u043A\u0430\u0440\u044C",
    "\u041F\u0438\u0432\u043E\u0432\u0430\u0440",
    "\u041F\u043B\u043E\u0442\u043D\u0438\u043A",
    "\u041F\u043E\u0432\u0430\u0440",
    "\u041F\u0447\u0435\u043B\u043E\u0432\u043E\u0434",
    "\u0420\u0430\u0437\u043D\u043E\u0440\u0430\u0431\u043E\u0447\u0438\u0439",
    "\u0421\u0431\u043E\u0440\u0449\u0438\u043A",
    "\u0421\u0442\u0435\u043A\u043E\u043B\u044C\u0449\u0438\u043A",
    "\u0422\u043A\u0430\u0447",
    "\u0422\u043E\u0440\u0433\u0430\u0448",
    "\u0422\u0440\u0430\u043A\u0442\u0438\u0440\u0449\u0438\u043A"
  ],
  guard: [
    "\xAB\u041B\u0430\u043F\u0430 \u043F\u043E\u043C\u043E\u0449\u0438\xBB (\u0440\u0435\u043A\u0440\u0443\u0442)",
    "\u0421\u0442\u0440\u0430\u0436 \u043F\u0430\u0442\u0440\u0443\u043B\u044F",
    "\u041F\u0430\u0442\u0440\u0443\u043B\u044C\u043D\u044B\u0439-\u0432\u0435\u0442\u0435\u0440\u0430\u043D",
    "\u041A\u0430\u043F\u0438\u0442\u0430\u043D \u0433\u043E\u0440\u043E\u0434\u0441\u043A\u043E\u0433\u043E \u043E\u043F\u043E\u043B\u0447\u0435\u043D\u0438\u044F",
    "\u041E\u043F\u043E\u043B\u0447\u0435\u043D\u0435\u0446",
    "\u0421\u0442\u0440\u0430\u0436 \u0432 \u043E\u0442\u0441\u0442\u0430\u0432\u043A\u0435"
  ],
  special: [
    "\u0411\u0430\u043D\u0434\u0438\u0442",
    "\u0411\u0440\u043E\u0434\u044F\u0433\u0430",
    "\u0414\u0438\u043A\u0430\u044F \u043C\u044B\u0448\u044C",
    "\u041A\u0443\u043F\u0435\u0446-\u043A\u0430\u0440\u0430\u0432\u0430\u043D\u0449\u0438\u043A",
    "\u0421\u0442\u0430\u0440\u0435\u0439\u0448\u0438\u043D\u0430 \u043F\u043E\u0441\u0435\u043B\u0435\u043D\u0438\u044F",
    "\u0411\u0435\u0433\u043B\u0435\u0446",
    "\u041C\u043E\u043D\u0430\u0445-\u043B\u0435\u0442\u043E\u043F\u0438\u0441\u0435\u0446"
  ]
});
var MOUSE_NAMES = Object.freeze({
  male: [
    "\u0410\u043B\u0433\u043E\u043C\u0438\u043D",
    "\u0410\u0440\u0440\u043E\u043D",
    "\u0411\u0438\u0433\u0430\u043D",
    "\u0411\u0440\u044D\u043D\u0434",
    "\u0412\u0430\u0440\u0434",
    "\u0412\u043E\u043B\u043C\u043E\u043D\u0434",
    "\u0413\u0430\u043C\u043B\u0438\u043D",
    "\u0413\u0430\u0440\u043D\u044C\u0435",
    "\u0413\u0430\u0440\u0440\u043E\u0443",
    "\u0413\u0440\u044D\u0445\u0430\u043C",
    "\u0413\u0443\u0440\u043D\u0438",
    "\u0414\u0436\u0430\u0441\u043F\u0435\u0440",
    "\u0414\u0436\u043E\u0437\u0435\u0444",
    "\u041A\u0430\u043B\u043B\u0435\u043D",
    "\u041A\u0435\u043B\u043B",
    "\u041A\u043E\u043D\u043D\u043E\u0440",
    "\u041A\u043E\u0443\u043B",
    "\u041A\u0443\u0440\u0442",
    "\u041B\u044D\u0440\u0434",
    "\u041D\u043E\u043B\u0430\u043D",
    "\u0421\u0435\u0442",
    "\u0421\u0438\u043C\u043E\u043D",
    "\u0421\u043B\u043E\u0443\u043D",
    "\u0422\u0430\u043D\u0434\u0435\u0440",
    "\u0422\u0438\u0437\u043E\u043D",
    "\u0422\u043E\u043C",
    "\u0422\u0440\u0435\u0432\u043E\u0440",
    "\u0424\u0430\u043E\u043B\u0430\u043D",
    "\u0424\u0438\u043D\u043D",
    "\u0424\u043E\u043B\u043A\u0435\u0440",
    "\u0425\u044D\u0439\u043B",
    "\u0425\u044D\u043D\u0441\u043E\u043D",
    "\u042D\u043D\u0433\u0443\u0441"
  ],
  female: [
    "\u0410\u0433\u043D\u0435\u0442\u0430",
    "\u0410\u0439\u0432\u0438",
    "\u0411\u0430\u044D\u043B\u0438\u044F",
    "\u0411\u0440\u0438\u043D\u043D\u0430",
    "\u0412\u0435\u0440\u0430",
    "\u0413\u0435\u0439\u043B\u0430",
    "\u0414\u0430\u043B\u0438\u044F",
    "\u0414\u0435\u0432\u043E\u043D\u0430",
    "\u0414\u0436\u0443\u043B\u0438\u044F",
    "\u0416\u043E\u0437\u0435\u0444\u0438\u043D\u0430",
    "\u0418\u043D\u0433\u0440\u0438\u0434",
    "\u041A\u0432\u0438\u043D\u043D",
    "\u041A\u0435\u0439\u043B\u0438",
    "\u041A\u0438\u0440\u0430",
    "\u041A\u043B\u043E\u0443\u0431\u0438",
    "\u041B\u043E\u0440\u0435\u043B\u044C",
    "\u041B\u0438\u043B\u043B\u0438",
    "\u041B\u043E\u0440\u0435\u043B\u0435\u0439",
    "\u041B\u0443\u043D\u0438\u0441",
    "\u041C\u0430\u0440\u0435\u043D\u0430",
    "\u041C\u0438\u043B\u043B\u0438\u0441\u0435\u043D\u0442\u0430",
    "\u041C\u043E\u0439\u0440\u0430",
    "\u041D\u043E\u043B\u0430",
    "\u0420\u043E\u0437\u0430\u043B\u0438\u043D\u0430",
    "\u0420\u043E\u043D\u0430",
    "\u0421\u0438\u0431\u0438\u043B\u043B\u0430",
    "\u0421\u0438\u043B\u044C\u0432\u0438\u044F",
    "\u0421\u043B\u043E\u0443\u043D\u0438",
    "\u0421\u044C\u0435\u0440\u0440\u0430",
    "\u0422\u0430\u0440\u0438\u043D\u0430",
    "\u0422\u0438\u043D\u0430\u0431\u0435\u043B\u044C",
    "\u042D\u0434\u0430"
  ]
});
var BELIEF_SAMPLES = Object.freeze([
  "\u041C\u044B\u0448\u0438\u043D\u0430\u044F \u0421\u0442\u0440\u0430\u0436\u0430 \u0437\u0430\u0449\u0438\u0449\u0430\u0435\u0442 \u0442\u0435\u0445, \u043A\u0442\u043E \u043D\u0435 \u0432 \u0441\u0438\u043B\u0430\u0445 \u043F\u043E\u0441\u0442\u043E\u044F\u0442\u044C \u0437\u0430 \u0441\u0435\u0431\u044F.",
  "\u041A\u043B\u0438\u043D\u043E\u043A \u2014 \u043A\u0440\u0430\u0439\u043D\u0435\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E; \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C\u0441\u044F.",
  "\u0422\u043E\u043B\u044C\u043A\u043E \u0432 \u0435\u0434\u0438\u043D\u0441\u0442\u0432\u0435 \u043F\u0430\u0442\u0440\u0443\u043B\u044F \u0437\u0430\u043B\u043E\u0433 \u0432\u044B\u0436\u0438\u0432\u0430\u043D\u0438\u044F \u043D\u0430 \u0422\u0435\u0440\u0440\u0438\u0442\u043E\u0440\u0438\u044F\u0445.",
  "\u0427\u0435\u0441\u0442\u044C \u0438 \u0434\u043E\u043B\u0433 \u0441\u0442\u0440\u0430\u0436\u0430 \u043F\u0440\u0435\u0432\u044B\u0448\u0435 \u043B\u0438\u0447\u043D\u043E\u0433\u043E \u0431\u043B\u0430\u0433\u043E\u043F\u043E\u043B\u0443\u0447\u0438\u044F.",
  "\u0414\u0430\u0436\u0435 \u0441\u0430\u043C\u044B\u0439 \u0433\u0440\u043E\u0437\u043D\u044B\u0439 \u0445\u0438\u0449\u043D\u0438\u043A \u043E\u0442\u0441\u0442\u0443\u043F\u0438\u0442 \u043F\u0435\u0440\u0435\u0434 \u043E\u0442\u0432\u0430\u0433\u043E\u0439 \u0438 \u0441\u043C\u0435\u043A\u0430\u043B\u043A\u043E\u0439.",
  "\u0417\u0430\u043A\u043E\u043D\u044B \u041B\u043E\u043A\u0445\u044D\u0439\u0432\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u043E\u0431\u043B\u044E\u0434\u0430\u0442\u044C\u0441\u044F \u0432 \u043A\u0430\u0436\u0434\u043E\u043C \u0443\u0433\u043E\u043B\u043A\u0435 \u0422\u0435\u0440\u0440\u0438\u0442\u043E\u0440\u0438\u0439.",
  "\u0414\u043E\u0431\u0440\u043E\u0435 \u0438\u043C\u044F \u0421\u0442\u0440\u0430\u0436\u0438 \u0437\u0430\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0434\u043E\u0431\u0440\u044B\u043C\u0438 \u0434\u0435\u043B\u0430\u043C\u0438."
]);
var GOAL_SAMPLES = Object.freeze([
  "\u0414\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0430\u043D\u0438\u0435 \u041C\u0430\u0442\u0440\u0438\u0430\u0440\u0445\u0430 \u0432\u043E\u0432\u0440\u0435\u043C\u044F, \u043D\u0435\u0432\u0437\u0438\u0440\u0430\u044F \u043D\u0430 \u043D\u0435\u043F\u043E\u0433\u043E\u0434\u0443.",
  "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0442\u044C \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C \u043A\u0430\u0440\u0430\u0432\u0430\u043D\u0430 \u0434\u043E \u0441\u0430\u043C\u044B\u0445 \u0432\u043E\u0440\u043E\u0442 \u041B\u043E\u043A\u0445\u044D\u0439\u0432\u0435\u043D\u0430.",
  "\u0420\u0430\u0437\u0443\u0437\u043D\u0430\u0442\u044C \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u0431\u0435\u0441\u043F\u043E\u043A\u043E\u0439\u0441\u0442\u0432\u0430 \u0434\u0438\u043A\u0438\u0445 \u0437\u0432\u0435\u0440\u0435\u0439 \u0432 \u0432\u043E\u0441\u0442\u043E\u0447\u043D\u043E\u043C \u043B\u0435\u0441\u0443.",
  "\u0423\u0431\u0435\u0440\u0435\u0447\u044C \u0442\u043E\u0432\u0430\u0440\u0438\u0449\u0435\u0439 \u043F\u043E \u043F\u0430\u0442\u0440\u0443\u043B\u044E \u043E\u0442 \u043B\u044E\u0431\u044B\u0445 \u0440\u0430\u043D\u0435\u043D\u0438\u0439 \u0438 \u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0435\u0439.",
  "\u041D\u0430\u0439\u0442\u0438 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u044B\u0439 \u043E\u0431\u0445\u043E\u0434\u043D\u043E\u0439 \u043F\u0443\u0442\u044C \u0447\u0435\u0440\u0435\u0437 \u0440\u0430\u0437\u043B\u0438\u0432\u0448\u0443\u044E\u0441\u044F \u0440\u0435\u043A\u0443.",
  "\u041F\u043E\u043C\u043E\u0447\u044C \u0436\u0438\u0442\u0435\u043B\u044F\u043C \u043F\u043E\u0441\u0435\u043B\u0435\u043D\u0438\u044F \u043F\u043E\u0447\u0438\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u0440\u0443\u0448\u0435\u043D\u043D\u044B\u0435 \u0443\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F."
]);
var INSTINCT_SAMPLES = Object.freeze([
  "\u0412\u0441\u0435\u0433\u0434\u0430 \u043E\u0431\u043D\u0430\u0436\u0430\u0442\u044C \u043E\u0440\u0443\u0436\u0438\u0435 \u043F\u0440\u0438 \u043F\u0435\u0440\u0432\u043E\u043C \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0435 \u0443\u0433\u0440\u043E\u0437\u044B.",
  "\u0412\u0441\u0435\u0433\u0434\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0438 \u043F\u0440\u0438\u043F\u0430\u0441\u044B \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0445\u043E\u0434\u043E\u043C \u0432 \u043F\u0443\u0442\u044C.",
  "\u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0434\u043E\u0432\u0435\u0440\u044F\u0442\u044C \u043D\u0435\u0437\u043D\u0430\u043A\u043E\u043C\u044B\u043C \u043C\u044B\u0448\u0430\u043C \u0432 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u043C \u043F\u043E\u043B\u0435.",
  "\u0412\u0441\u0435\u0433\u0434\u0430 \u0437\u0430\u0449\u0438\u0449\u0430\u0442\u044C \u0441\u0430\u043C\u043E\u0433\u043E \u0441\u043B\u0430\u0431\u043E\u0433\u043E \u0441\u043F\u0443\u0442\u043D\u0438\u043A\u0430 \u0432 \u043E\u0442\u0440\u044F\u0434\u0435.",
  "\u0412\u0441\u0435\u0433\u0434\u0430 \u043E\u0441\u043C\u0430\u0442\u0440\u0438\u0432\u0430\u0442\u044C \u0432\u0435\u0442\u0432\u0438 \u0438 \u043D\u0435\u0431\u043E \u043D\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0445\u0438\u0449\u043D\u044B\u0445 \u043F\u0442\u0438\u0446.",
  "\u0412\u0441\u0435\u0433\u0434\u0430 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0430\u0442\u044C \u043B\u0438\u0434\u0435\u0440\u0430 \u043F\u0430\u0442\u0440\u0443\u043B\u044F \u043F\u0435\u0440\u0435\u0434 \u043B\u044E\u0431\u044B\u043C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u043C."
]);

// module/details/details-generator.js
function sample(array) {
  if (!Array.isArray(array) || !array.length) return "";
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}
function sampleWeighted(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll <= 0) return item.name;
  }
  return items[items.length - 1].name;
}
function randomName(gender = "any") {
  if (gender === "male") return sample(MOUSE_NAMES.male);
  if (gender === "female") return sample(MOUSE_NAMES.female);
  return Math.random() < 0.5 ? sample(MOUSE_NAMES.male) : sample(MOUSE_NAMES.female);
}
var DEFAULT_CAMPAIGN_YEAR = 1152;
function generateCharacterDetails(overrides = {}, campaignYear = DEFAULT_CAMPAIGN_YEAR) {
  const rankObj = overrides.guard_rank ? GUARD_RANKS.find((r) => r.name === overrides.guard_rank) ?? sample(GUARD_RANKS) : sample(GUARD_RANKS);
  const guard_rank = overrides.guard_rank || rankObj.name;
  let age = overrides.age;
  if (!age || age <= 0) {
    const minA = rankObj.minAge ?? 18;
    const maxA = rankObj.maxAge ?? 35;
    age = Math.floor(Math.random() * (maxA - minA + 1)) + minA;
  }
  const birth_year = overrides.birth_year && overrides.birth_year > 0 ? overrides.birth_year : campaignYear - age;
  const homeObj = overrides.home ? HOMES.find((h) => h.name === overrides.home) ?? sample(HOMES) : sample(HOMES);
  const home = overrides.home || homeObj.name;
  const fur_color = overrides.fur_color || sampleWeighted(FUR_COLORS);
  let cloak_color = "";
  if (rankObj.allowsCloak) {
    cloak_color = overrides.cloak_color || sample(CLOAK_COLORS).name;
  }
  let parents = overrides.parents;
  if (!parents) {
    const craft = sample(CRAFTS);
    const mother = randomName("female");
    const father = randomName("male");
    parents = `${father} \u0438 ${mother} (${craft})`;
  }
  let senior_artisan = overrides.senior_artisan;
  if (!senior_artisan) {
    const craft = sample(CRAFTS);
    const artisanName = randomName();
    senior_artisan = `\u041C\u0430\u0441\u0442\u0435\u0440 ${craft.toLowerCase()} ${artisanName} (\u041B\u043E\u043A\u0445\u044D\u0439\u0432\u0435\u043D)`;
  }
  let mentor = overrides.mentor;
  if (!mentor) {
    const mentorName = randomName();
    const mentorRank = sample(["\u041F\u0430\u0442\u0440\u0443\u043B\u044C\u043D\u044B\u0439", "\u041B\u0438\u0434\u0435\u0440 \u043F\u0430\u0442\u0440\u0443\u043B\u044F", "\u0412\u0435\u0442\u0435\u0440\u0430\u043D"]);
    mentor = `${mentorName} (${mentorRank})`;
  }
  let friend = overrides.friend;
  if (!friend) {
    const fName = randomName();
    const fTown = sample(HOMES).name;
    const fCraft = sample(CRAFTS);
    friend = `${fName}, ${fCraft.toLowerCase()} \u0438\u0437 \u0433. ${fTown}`;
  }
  let enemy = overrides.enemy;
  if (!enemy) {
    const eName = randomName();
    const eTown = sample(HOMES).name;
    const reason = sample(["\u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A \u043D\u0430 \u0441\u043B\u0443\u0436\u0431\u0435", "\u0441\u0442\u0430\u0440\u0430\u044F \u043E\u0431\u0438\u0434\u0430", "\u043D\u0435\u0434\u043E\u0432\u0435\u0440\u0438\u0435", "\u0434\u0435\u043B\u043E\u0432\u043E\u0439 \u0441\u043F\u043E\u0440"]);
    enemy = `${eName} \u0438\u0437 \u0433. ${eTown} (${reason})`;
  }
  const belief = overrides.belief || sample(BELIEF_SAMPLES);
  const goal = overrides.goal || sample(GOAL_SAMPLES);
  const instinct = overrides.instinct || sample(INSTINCT_SAMPLES);
  return {
    details: {
      age,
      birth_year,
      home,
      fur_color,
      guard_rank,
      cloak_color,
      parents,
      senior_artisan,
      mentor,
      friend,
      enemy
    },
    rewards: {
      belief,
      goal,
      instinct
    }
  };
}
function generateNPCDetails(overrides = {}, isKeyCharacter = false) {
  let role = overrides.role;
  if (!role) {
    const categoryRoll = Math.random();
    if (categoryRoll < 0.65) role = sample(NPC_ROLES.craftsmen);
    else if (categoryRoll < 0.85) role = sample(NPC_ROLES.guard);
    else role = sample(NPC_ROLES.special);
  }
  const home = overrides.home || sample(HOMES).name;
  const age = overrides.age && overrides.age > 0 ? overrides.age : Math.floor(Math.random() * 35) + 18;
  const fur_color = overrides.fur_color || sampleWeighted(FUR_COLORS);
  let cloak_color = overrides.cloak_color || "";
  if (!cloak_color && (role.toLowerCase().includes("\u0441\u0442\u0440\u0430\u0436") || role.toLowerCase().includes("\u043E\u043F\u043E\u043B\u0447") || role.toLowerCase().includes("\u043F\u0430\u0442\u0440\u0443\u043B\u044C"))) {
    cloak_color = sample(CLOAK_COLORS).name;
  }
  const result = {
    details: {
      role,
      home,
      age,
      fur_color,
      cloak_color
    }
  };
  if (isKeyCharacter) {
    result.motivation = {
      belief: overrides.belief || sample(BELIEF_SAMPLES),
      goal: overrides.goal || sample(GOAL_SAMPLES),
      instinct: overrides.instinct || sample(INSTINCT_SAMPLES)
    };
  }
  return result;
}

// module/details/details-dialog.js
var { HandlebarsApplicationMixin: HandlebarsApplicationMixin7, ApplicationV2: ApplicationV25 } = foundry.applications.api;
var TEMPLATE = "systems/mouseguard/templates/actor/dialog-fill-details.hbs";
function isEmptyValue(val) {
  if (val === null || val === void 0) return true;
  if (typeof val === "string") return val.trim() === "";
  if (typeof val === "number") return val <= 0;
  return false;
}
var MouseGuardDetailsDialog = class _MouseGuardDetailsDialog extends HandlebarsApplicationMixin7(ApplicationV25) {
  /**
   * @param {object} options
   * @param {Actor} options.actor
   */
  constructor({ actor, ...options } = {}) {
    super({ id: _MouseGuardDetailsDialog.idFor(actor), ...options });
    this.actor = actor;
    this.onlyEmpty = true;
    this.formState = _MouseGuardDetailsDialog.getInitialState(this.actor);
  }
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mouseguard", "mgs-details-dialog", "themed", "theme-light"],
    tag: "div",
    window: {
      title: "MOUSEGUARD.DetailsDialog.Title",
      icon: "fa-solid fa-feather-pointed",
      resizable: true
    },
    position: { width: 560, height: "auto" },
    actions: {
      generateAll: _MouseGuardDetailsDialog.#onGenerateAll,
      randomizeField: _MouseGuardDetailsDialog.#onRandomizeField,
      resetForm: _MouseGuardDetailsDialog.#onResetForm,
      toggleKey: _MouseGuardDetailsDialog.#onToggleKey,
      closeDialog: _MouseGuardDetailsDialog.#onCloseDialog
    }
  };
  /** @override */
  static PARTS = {
    dialog: { template: TEMPLATE, scrollable: [".mgs-dialog-form"] }
  };
  /** Unique window ID per actor to avoid duplicate dialogs. */
  static idFor(actor) {
    return `mgs-details-${String(actor?.uuid ?? "none").replace(/[^A-Za-z0-9_-]/g, "-")}`;
  }
  /**
   * Open (or focus) the details dialog for an actor.
   * @param {Actor} actor
   * @returns {Promise<MouseGuardDetailsDialog>}
   */
  static async open(actor) {
    if (!actor) return null;
    if (!actor.isOwner) {
      ui.notifications.warn(game.i18n.localize("MOUSEGUARD.Test.Error.NotOwner"));
      return null;
    }
    const existing = foundry.applications.instances?.get(_MouseGuardDetailsDialog.idFor(actor));
    if (existing instanceof _MouseGuardDetailsDialog) {
      existing.formState = _MouseGuardDetailsDialog.getInitialState(existing.actor);
      await existing.render({ force: true });
      existing.bringToFront?.();
      return existing;
    }
    const app = new _MouseGuardDetailsDialog({ actor });
    await app.render({ force: true });
    return app;
  }
  /** @override */
  get title() {
    return game.i18n.format("MOUSEGUARD.DetailsDialog.TitleFor", { name: this.actor?.name ?? "" });
  }
  /**
   * Gather current actor values into a clean working state.
   * @param {Actor} actor
   * @returns {object}
   */
  static getInitialState(actor) {
    const system = actor?.system ?? {};
    const details = system.details ?? {};
    const isCharacter = actor?.type === "character";
    if (isCharacter) {
      const rewards = system.rewards ?? {};
      return {
        guard_rank: details.guard_rank || "\u0421\u0442\u0440\u0430\u0436",
        home: details.home || "",
        age: details.age || 0,
        birth_year: details.birth_year || 0,
        fur_color: details.fur_color || "",
        cloak_color: details.cloak_color || "",
        parents: details.parents || "",
        senior_artisan: details.senior_artisan || "",
        mentor: details.mentor || "",
        friend: details.friend || "",
        enemy: details.enemy || "",
        belief: rewards.belief || "",
        goal: rewards.goal || "",
        instinct: rewards.instinct || ""
      };
    }
    const motivation = system.motivation ?? {};
    return {
      role: details.role || "",
      home: details.home || "",
      age: details.age || 0,
      fur_color: details.fur_color || "",
      cloak_color: details.cloak_color || "",
      keyCharacter: Boolean(system.keyCharacter),
      belief: motivation.belief || "",
      goal: motivation.goal || "",
      instinct: motivation.instinct || ""
    };
  }
  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isCharacter = this.actor.type === "character";
    const allNpcRoles = [
      ...NPC_ROLES.craftsmen,
      ...NPC_ROLES.guard,
      ...NPC_ROLES.special
    ];
    const isTenderfoot = isCharacter && (this.formState.guard_rank?.toLowerCase().includes("\u043B\u0430\u043F\u0430 \u043F\u043E\u043C\u043E\u0449\u0438") || false);
    return {
      ...context,
      actor: this.actor,
      isCharacter,
      isNPC: !isCharacter,
      form: this.formState,
      onlyEmpty: this.onlyEmpty,
      isTenderfoot,
      ranks: GUARD_RANKS,
      homes: HOMES,
      furColors: FUR_COLORS,
      cloakColors: CLOAK_COLORS,
      crafts: CRAFTS,
      allNpcRoles,
      beliefs: BELIEF_SAMPLES,
      goals: GOAL_SAMPLES,
      instincts: INSTINCT_SAMPLES
    };
  }
  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    html.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("input", (e) => {
        const name = e.target.name;
        if (!name) return;
        if (name === "onlyEmpty") {
          this.onlyEmpty = e.target.checked;
          return;
        }
        if (name === "keyCharacter") {
          this.formState.keyCharacter = e.target.checked;
          return;
        }
        const val = e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value;
        this.formState[name] = val;
      });
    });
    const form = html.querySelector("form.mgs-dialog-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.#handleFormSubmit();
      });
    }
  }
  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */
  /**
   * Generate all fields (or only empty fields if toggle is active).
   * @this {MouseGuardDetailsDialog}
   */
  static async #onGenerateAll(event) {
    event.preventDefault();
    const isCharacter = this.actor.type === "character";
    const overrides = {};
    if (this.onlyEmpty) {
      for (const [key, val] of Object.entries(this.formState)) {
        if (!isEmptyValue(val)) {
          overrides[key] = val;
        }
      }
    }
    if (isCharacter) {
      const generated = generateCharacterDetails(overrides);
      Object.assign(this.formState, generated.details, generated.rewards);
    } else {
      const isKey = this.formState.keyCharacter;
      const generated = generateNPCDetails(overrides, isKey);
      Object.assign(this.formState, generated.details);
      if (generated.motivation) {
        Object.assign(this.formState, generated.motivation);
      }
    }
    this.render();
  }
  /**
   * Randomize a single specific field.
   * @this {MouseGuardDetailsDialog}
   */
  static async #onRandomizeField(event, target) {
    event.preventDefault();
    const field = target.dataset.field;
    if (!field) return;
    const isCharacter = this.actor.type === "character";
    switch (field) {
      case "guard_rank": {
        const rankObj = sample(GUARD_RANKS);
        this.formState.guard_rank = rankObj.name;
        if (!rankObj.allowsCloak) this.formState.cloak_color = "";
        if (this.formState.age < rankObj.minAge || this.formState.age > rankObj.maxAge) {
          this.formState.age = Math.floor(Math.random() * (rankObj.maxAge - rankObj.minAge + 1)) + rankObj.minAge;
          this.formState.birth_year = 1152 - this.formState.age;
        }
        break;
      }
      case "home":
        this.formState.home = sample(HOMES).name;
        break;
      case "age": {
        if (isCharacter) {
          const r = GUARD_RANKS.find((item) => item.name === this.formState.guard_rank) ?? GUARD_RANKS[1];
          this.formState.age = Math.floor(Math.random() * (r.maxAge - r.minAge + 1)) + r.minAge;
        } else {
          this.formState.age = Math.floor(Math.random() * 35) + 18;
        }
        if (this.formState.birth_year) this.formState.birth_year = 1152 - this.formState.age;
        break;
      }
      case "birth_year": {
        const age = this.formState.age > 0 ? this.formState.age : 22;
        this.formState.birth_year = 1152 - age;
        break;
      }
      case "fur_color":
        this.formState.fur_color = sampleWeighted(FUR_COLORS);
        break;
      case "cloak_color": {
        const isTenderfoot = isCharacter && this.formState.guard_rank?.includes("\u041B\u0430\u043F\u0430 \u043F\u043E\u043C\u043E\u0449\u0438");
        if (isTenderfoot) {
          this.formState.cloak_color = "";
        } else {
          this.formState.cloak_color = sample(CLOAK_COLORS).name;
        }
        break;
      }
      case "parents": {
        const craft = sample(CRAFTS);
        const father = randomName("male");
        const mother = randomName("female");
        this.formState.parents = `${father} \u0438 ${mother} (${craft})`;
        break;
      }
      case "senior_artisan": {
        const craft = sample(CRAFTS);
        const name = randomName();
        this.formState.senior_artisan = `\u041C\u0430\u0441\u0442\u0435\u0440 ${craft.toLowerCase()} ${name} (\u041B\u043E\u043A\u0445\u044D\u0439\u0432\u0435\u043D)`;
        break;
      }
      case "mentor": {
        const name = randomName();
        const rank = sample(["\u041F\u0430\u0442\u0440\u0443\u043B\u044C\u043D\u044B\u0439", "\u041B\u0438\u0434\u0435\u0440 \u043F\u0430\u0442\u0440\u0443\u043B\u044F", "\u0412\u0435\u0442\u0435\u0440\u0430\u043D"]);
        this.formState.mentor = `${name} (${rank})`;
        break;
      }
      case "friend": {
        const fName = randomName();
        const fTown = sample(HOMES).name;
        const fCraft = sample(CRAFTS);
        this.formState.friend = `${fName}, ${fCraft.toLowerCase()} \u0438\u0437 \u0433. ${fTown}`;
        break;
      }
      case "enemy": {
        const eName = randomName();
        const eTown = sample(HOMES).name;
        const reason = sample(["\u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A \u043D\u0430 \u0441\u043B\u0443\u0436\u0431\u0435", "\u0441\u0442\u0430\u0440\u0430\u044F \u043E\u0431\u0438\u0434\u0430", "\u043D\u0435\u0434\u043E\u0432\u0435\u0440\u0438\u0435", "\u0434\u0435\u043B\u043E\u0432\u043E\u0439 \u0441\u043F\u043E\u0440"]);
        this.formState.enemy = `${eName} \u0438\u0437 \u0433. ${eTown} (${reason})`;
        break;
      }
      case "belief":
        this.formState.belief = sample(BELIEF_SAMPLES);
        break;
      case "goal":
        this.formState.goal = sample(GOAL_SAMPLES);
        break;
      case "instinct":
        this.formState.instinct = sample(INSTINCT_SAMPLES);
        break;
      case "role": {
        const roll = Math.random();
        if (roll < 0.6) this.formState.role = sample(NPC_ROLES.craftsmen);
        else if (roll < 0.85) this.formState.role = sample(NPC_ROLES.guard);
        else this.formState.role = sample(NPC_ROLES.special);
        break;
      }
    }
    this.render();
  }
  /**
   * Reset form state to current database values.
   * @this {MouseGuardDetailsDialog}
   */
  static async #onResetForm(event) {
    event.preventDefault();
    this.formState = _MouseGuardDetailsDialog.getInitialState(this.actor);
    this.render();
  }
  /**
   * Toggle key character for NPC.
   * @this {MouseGuardDetailsDialog}
   */
  static async #onToggleKey(_event, target) {
    this.formState.keyCharacter = target.checked;
    this.render();
  }
  /**
   * Close dialog without saving.
   * @this {MouseGuardDetailsDialog}
   */
  static async #onCloseDialog(event) {
    event.preventDefault();
    this.close();
  }
  /** Save updates to actor. */
  async #handleFormSubmit() {
    if (!this.actor?.isOwner) {
      ui.notifications.error(game.i18n.localize("MOUSEGUARD.Test.Error.NotOwner"));
      return;
    }
    const isCharacter = this.actor.type === "character";
    const currentSystem = this.actor.system ?? {};
    const currentDetails = currentSystem.details ?? {};
    const updateData = {};
    if (isCharacter) {
      const charKeys = [
        "guard_rank",
        "home",
        "age",
        "birth_year",
        "fur_color",
        "cloak_color",
        "parents",
        "senior_artisan",
        "mentor",
        "friend",
        "enemy"
      ];
      for (const key of charKeys) {
        const currentVal = currentDetails[key];
        const newVal = this.formState[key];
        if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
        if (newVal !== void 0 && newVal !== currentVal) {
          updateData[`system.details.${key}`] = newVal;
        }
      }
      const currentRewards = currentSystem.rewards ?? {};
      const rewardKeys = ["belief", "goal", "instinct"];
      for (const key of rewardKeys) {
        const currentVal = currentRewards[key];
        const newVal = this.formState[key];
        if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
        if (newVal !== void 0 && newVal !== currentVal) {
          updateData[`system.rewards.${key}`] = newVal;
        }
      }
    } else {
      const npcKeys = ["role", "home", "age", "fur_color", "cloak_color"];
      for (const key of npcKeys) {
        const currentVal = currentDetails[key];
        const newVal = this.formState[key];
        if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
        if (newVal !== void 0 && newVal !== currentVal) {
          updateData[`system.details.${key}`] = newVal;
        }
      }
      if (this.formState.keyCharacter !== void 0 && this.formState.keyCharacter !== currentSystem.keyCharacter) {
        updateData["system.keyCharacter"] = Boolean(this.formState.keyCharacter);
      }
      if (this.formState.keyCharacter) {
        const currentMotivation = currentSystem.motivation ?? {};
        const motKeys = ["belief", "goal", "instinct"];
        for (const key of motKeys) {
          const currentVal = currentMotivation[key];
          const newVal = this.formState[key];
          if (this.onlyEmpty && !isEmptyValue(currentVal)) continue;
          if (newVal !== void 0 && newVal !== currentVal) {
            updateData[`system.motivation.${key}`] = newVal;
          }
        }
      }
    }
    if (foundry.utils.isEmpty(updateData)) {
      ui.notifications.info(game.i18n.localize("MOUSEGUARD.DetailsDialog.NoChanges"));
      this.close();
      return;
    }
    try {
      await this.actor.update(updateData);
      ui.notifications.info(
        game.i18n.format("MOUSEGUARD.DetailsDialog.SuccessApplied", { name: this.actor.name })
      );
      this.close();
    } catch (err) {
      console.error("Mouse Guard | Error updating actor details:", err);
      ui.notifications.error(game.i18n.localize("MOUSEGUARD.DetailsDialog.ErrorUpdate"));
    }
  }
};

// module/mouseguard.js
Hooks.once("init", async function() {
  console.log("Mouse Guard | Initializing Mouse Guard System");
  let RollCount = 0;
  let RollMessage = "";
  let RollBonus = 0;
  game.mouseguard = {
    MouseGuardActor,
    MouseGuardItem,
    createMouseGuardMacro,
    RollCount,
    RollMessage,
    RollBonus,
    updateDisplay,
    MouseDie,
    MouseRoll,
    ConflictTracker,
    MouseConflictManager,
    MouseGuardDetailsDialog,
    effectPanel: new EffectsPanel()
  };
  CONFIG.Actor.documentClass = MouseGuardActor;
  CONFIG.Item.documentClass = MouseGuardItem;
  CONFIG.Actor.dataModels = {
    character: CharacterData,
    mouse: NPCActorData,
    weasel: NPCActorData,
    animal: AnimalData
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
  CONFIG.Combatant.documentClass = MouseCombatant;
  CONFIG.Combat.documentClass = MouseCombat;
  CONFIG.ui.combat = MouseCombatTracker;
  CONFIG.Combat.initiative = {
    formula: "1d20",
    decimals: 2
  };
  CONFIG.Dice.terms["m"] = MouseDie;
  CONFIG.Dice.terms["6"] = MouseDie;
  CONFIG.Dice.types.push(MouseDie);
  CONFIG.Dice.rolls.push(MouseRoll);
  foundry.documents.collections.Actors.registerSheet("mouseguard", MouseGuardNPCSheet, {
    types: ["mouse", "weasel"],
    makeDefault: true,
    label: "MOUSEGUARD.Sheet.NPCSheetLabel"
  });
  foundry.documents.collections.Actors.registerSheet("mouseguard", MouseGuardAnimalSheet, {
    types: ["animal"],
    makeDefault: true,
    label: "MOUSEGUARD.AnimalSheet.SheetLabel"
  });
  foundry.documents.collections.Actors.registerSheet("mouseguard", MouseGuardCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MOUSEGUARD.Sheet.SheetLabel"
  });
  foundry.documents.collections.Items.registerSheet("mouseguard", MouseGuardItemSheet, {
    makeDefault: true,
    label: "MOUSEGUARD.ItemSheet.SheetLabel"
  });
  registerRollSystem();
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
    const RollClass2 = foundry.dice.Roll;
    const isValid = RollClass2.validate(formula);
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
  game.socket.on("system.mouseguard", (data) => {
    if (data.action === "askGoal") MouseSocket.askGoal(data);
    if (data.action === "setGoal") MouseSocket.setGoal(data);
    if (data.action === "askMoves") MouseSocket.askMoves(data);
    if (data.action === "setMoves") MouseSocket.setMoves(data);
  });
  Handlebars.registerHelper("slugify", function(value) {
    return typeof value === "string" ? value.slugify({ strict: true }) : "";
  });
  Handlebars.registerHelper("times", function(n, block) {
    let accum = "";
    for (let i = 0; i < n; ++i) accum += block.fn(i);
    return accum;
  });
  Handlebars.registerHelper("concat", function(...args) {
    args.pop();
    return args.join("");
  });
  Handlebars.registerHelper("ifEquals", function(arg1, arg2, options) {
    return arg1 == arg2 ? options.fn(this) : options.inverse(this);
  });
  if (!Handlebars.helpers.or) {
    Handlebars.registerHelper("or", function(...args) {
      args.pop();
      return args.some(Boolean);
    });
  }
  if (!Handlebars.helpers.and) {
    Handlebars.registerHelper("and", function(...args) {
      args.pop();
      return args.every(Boolean);
    });
  }
  if (!Handlebars.helpers.not) {
    Handlebars.registerHelper("not", function(arg) {
      return !arg;
    });
  }
  await preloadHandlebarsTemplates();
  await registerTours();
});
Hooks.once("diceSoNiceReady", (dice3d) => {
  if (!dice3d) return;
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
Hooks.on("renderChatLog", async (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0] ?? html;
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
    game.mouseguard.RollBonus = 0;
    updateDisplay(game.mouseguard.RollCount);
  });
  tray.querySelector(".mouse_dice_button.subtract")?.addEventListener("click", (event) => {
    event.preventDefault();
    if (game.mouseguard.RollCount > 0) game.mouseguard.RollCount--;
    game.mouseguard.RollBonus = 0;
    updateDisplay(game.mouseguard.RollCount);
  });
  tray.querySelector(".mouse_roll_button")?.addEventListener("click", async (event) => {
    event.preventDefault();
    if (game.mouseguard.RollCount > 0) {
      const actor = game.user.character ?? canvas.tokens?.controlled?.[0]?.actor;
      const roll = new MouseRoll(`${game.mouseguard.RollCount}dmcs>3`);
      roll.options.mouseguard = {
        baseDice: game.mouseguard.RollCount,
        bonusDice: game.mouseguard.RollBonus ?? 0
      };
      await roll.evaluate();
      await roll.toMessage({
        author: game.user.id,
        flavor: game.mouseguard.RollMessage,
        speaker: ChatMessage.getSpeaker({ actor })
      });
      game.mouseguard.RollCount = 0;
      game.mouseguard.RollMessage = "";
      game.mouseguard.RollBonus = 0;
      for (const input of document.querySelectorAll("#mg-skill-bonus")) input.value = "0";
      updateDisplay(0);
    }
  });
  updateDisplay(game.mouseguard.RollCount);
});
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
        btn.textContent = game.i18n.localize("MOUSEGUARD.RevealCard");
        btn.addEventListener("click", async () => {
          await message.setFlag("mouseguard", "unflipped", false);
        });
        actionMove.appendChild(btn);
      }
    }
  }
});
Hooks.once("setup", () => {
  const defeatedId = CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
  const defeated = Array.from(CONFIG.statusEffects ?? []).find((e) => e?.id === defeatedId);
  CONFIG.statusEffects = defeated ? [...statusEffects, defeated] : [...statusEffects];
});
Hooks.once("ready", async () => {
  const tourRolls = game.user.getFlag("mouseguard", "tourRolls");
  if (tourRolls === void 0) {
    const tour = game.tours.get("mouseguard.welcome");
    if (tour) {
      tour.start();
      await game.user.setFlag("mouseguard", "tourRolls", 1);
    }
  }
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
Hooks.on("getActorDirectoryEntryContext", (html, entryOptions) => {
  entryOptions.push({
    name: "MOUSEGUARD.DetailsDialog.ContextMenu",
    icon: '<i class="fa-solid fa-feather-pointed"></i>',
    condition: (header) => {
      const el = header instanceof HTMLElement ? header : header?.[0];
      const id = el?.dataset?.documentId ?? el?.dataset?.entryId;
      const actor = game.actors?.get(id);
      return Boolean(actor && ["character", "mouse"].includes(actor.type) && actor.isOwner);
    },
    callback: (header) => {
      const el = header instanceof HTMLElement ? header : header?.[0];
      const id = el?.dataset?.documentId ?? el?.dataset?.entryId;
      const actor = game.actors?.get(id);
      if (actor) MouseGuardDetailsDialog.open(actor);
    }
  });
});
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
  const diceHTML = '<li class="roll mousedie d6"><img src="systems/mouseguard/assets/dice/sword.png" height="24" width="24" alt="die"></li>';
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
//# sourceMappingURL=mouseguard.js.map
