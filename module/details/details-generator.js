/**
 * Generator functions for Mouse Guard character and NPC details.
 * Pure functions: generate data objects without mutating documents.
 */
import {
    HOMES,
    GUARD_RANKS,
    FUR_COLORS,
    CLOAK_COLORS,
    CRAFTS,
    NPC_ROLES,
    MOUSE_NAMES,
    BELIEF_SAMPLES,
    GOAL_SAMPLES,
    INSTINCT_SAMPLES
} from "./details-data.js";

/** Pick a random element from an array. */
export function sample(array) {
    if (!Array.isArray(array) || !array.length) return "";
    const index = Math.floor(Math.random() * array.length);
    return array[index];
}

/** Pick a random item by weight. */
export function sampleWeighted(items) {
    if (!Array.isArray(items) || !items.length) return "";
    const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = Math.random() * total;
    for (const item of items) {
        roll -= (item.weight ?? 1);
        if (roll <= 0) return item.name;
    }
    return items[items.length - 1].name;
}

/** Pick a random mouse name (male, female or either). */
export function randomName(gender = "any") {
    if (gender === "male") return sample(MOUSE_NAMES.male);
    if (gender === "female") return sample(MOUSE_NAMES.female);
    return Math.random() < 0.5 ? sample(MOUSE_NAMES.male) : sample(MOUSE_NAMES.female);
}

/** Current campaign reference year for Mouse Guard. Defaults to 1152. */
export const DEFAULT_CAMPAIGN_YEAR = 1152;

/**
 * Generate a consistent set of details for a player Guard Mouse (`character`).
 *
 * @param {object} [overrides={}]   Explicit values to preserve (e.g. if user locked a field).
 * @param {number} [campaignYear]   Current year to derive birth_year from age.
 * @returns {object}                { details: {...}, rewards: {...} }
 */
export function generateCharacterDetails(overrides = {}, campaignYear = DEFAULT_CAMPAIGN_YEAR) {
    // 1. Guard rank
    const rankObj = overrides.guard_rank
        ? (GUARD_RANKS.find((r) => r.name === overrides.guard_rank) ?? sample(GUARD_RANKS))
        : sample(GUARD_RANKS);
    const guard_rank = overrides.guard_rank || rankObj.name;

    // 2. Age & birth year (consistent with rank)
    let age = overrides.age;
    if (!age || age <= 0) {
        const minA = rankObj.minAge ?? 18;
        const maxA = rankObj.maxAge ?? 35;
        age = Math.floor(Math.random() * (maxA - minA + 1)) + minA;
    }
    const birth_year = overrides.birth_year && overrides.birth_year > 0
        ? overrides.birth_year
        : (campaignYear - age);

    // 3. Home
    const homeObj = overrides.home
        ? (HOMES.find((h) => h.name === overrides.home) ?? sample(HOMES))
        : sample(HOMES);
    const home = overrides.home || homeObj.name;

    // 4. Fur color (weighted canonical frequency)
    const fur_color = overrides.fur_color || sampleWeighted(FUR_COLORS);

    // 5. Cloak color: Tenderfoot ("Лапа помощи") has no cloak per book rules!
    let cloak_color = "";
    if (rankObj.allowsCloak) {
        cloak_color = overrides.cloak_color || sample(CLOAK_COLORS).name;
    }

    // 6. Parents: craft + names
    let parents = overrides.parents;
    if (!parents) {
        const craft = sample(CRAFTS);
        const mother = randomName("female");
        const father = randomName("male");
        parents = `${father} и ${mother} (${craft})`;
    }

    // 7. Senior Artisan in Lockhaven
    let senior_artisan = overrides.senior_artisan;
    if (!senior_artisan) {
        const craft = sample(CRAFTS);
        const artisanName = randomName();
        senior_artisan = `Мастер ${craft.toLowerCase()} ${artisanName} (Локхэйвен)`;
    }

    // 8. Mentor
    let mentor = overrides.mentor;
    if (!mentor) {
        const mentorName = randomName();
        const mentorRank = sample(["Патрульный", "Лидер патруля", "Ветеран"]);
        mentor = `${mentorName} (${mentorRank})`;
    }

    // 9. Friend & Enemy
    let friend = overrides.friend;
    if (!friend) {
        const fName = randomName();
        const fTown = sample(HOMES).name;
        const fCraft = sample(CRAFTS);
        friend = `${fName}, ${fCraft.toLowerCase()} из г. ${fTown}`;
    }

    let enemy = overrides.enemy;
    if (!enemy) {
        const eName = randomName();
        const eTown = sample(HOMES).name;
        const reason = sample(["соперник на службе", "старая обида", "недоверие", "деловой спор"]);
        enemy = `${eName} из г. ${eTown} (${reason})`;
    }

    // 10. Rewards / Motivations (Belief, Goal, Instinct)
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

/**
 * Generate a consistent set of details for a GM Mouse NPC (`mouse`).
 *
 * @param {object} [overrides={}]
 * @param {boolean} [isKeyCharacter=false]
 * @returns {object} { details: {...}, motivation?: {...} }
 */
export function generateNPCDetails(overrides = {}, isKeyCharacter = false) {
    // 1. Role: craft, guard or special role
    let role = overrides.role;
    if (!role) {
        const categoryRoll = Math.random();
        if (categoryRoll < 0.65) role = sample(NPC_ROLES.craftsmen);
        else if (categoryRoll < 0.85) role = sample(NPC_ROLES.guard);
        else role = sample(NPC_ROLES.special);
    }

    // 2. Home
    const home = overrides.home || sample(HOMES).name;

    // 3. Age (16 to 55 for adult mice)
    const age = overrides.age && overrides.age > 0
        ? overrides.age
        : Math.floor(Math.random() * 35) + 18;

    // 4. Fur color
    const fur_color = overrides.fur_color || sampleWeighted(FUR_COLORS);

    // 5. Cloak color: only for guard / militia mice, otherwise empty
    let cloak_color = overrides.cloak_color || "";
    if (!cloak_color && (role.toLowerCase().includes("страж") || role.toLowerCase().includes("ополч") || role.toLowerCase().includes("патруль"))) {
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
