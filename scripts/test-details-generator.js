/**
 * Unit test for Mouse Guard details generator.
 * Run with: node scripts/test-details-generator.js
 */
import assert from "node:assert/strict";
import {
    HOMES,
    GUARD_RANKS,
    FUR_COLORS,
    CLOAK_COLORS,
    CRAFTS,
    NPC_ROLES,
    MOUSE_NAMES
} from "../module/details/details-data.js";
import {
    generateCharacterDetails,
    generateNPCDetails,
    randomName,
    sample,
    sampleWeighted
} from "../module/details/details-generator.js";

console.log("Testing Mouse Guard Details Generator...");

// 1. Reference tables integrity
assert.equal(HOMES.length, 11, "Must have 11 canonical settlements");
assert.equal(GUARD_RANKS.length, 5, "Must have 5 guard ranks");
assert.equal(FUR_COLORS.length, 6, "Must have 6 fur colors");
assert.ok(CLOAK_COLORS.length >= 10, "Must have at least 10 cloak colors");
assert.equal(CRAFTS.length, 19, "Must have 19 crafts");
assert.ok(MOUSE_NAMES.male.length > 20, "Must have male names list");
assert.ok(MOUSE_NAMES.female.length > 20, "Must have female names list");

// 2. Character generation (multiple iterations)
for (let i = 0; i < 50; i++) {
    const pc = generateCharacterDetails();
    assert.ok(pc.details, "Character must have details");
    assert.ok(pc.rewards, "Character must have rewards");
    assert.ok(pc.details.age >= 14 && pc.details.age <= 60, "Age must be in 14..60");
    assert.ok(pc.details.birth_year > 1050 && pc.details.birth_year < 1152, "Birth year must be consistent");
    assert.ok(pc.details.home.length > 0, "Home must be non-empty");
    assert.ok(pc.details.fur_color.length > 0, "Fur color must be non-empty");
    assert.ok(pc.details.guard_rank.length > 0, "Guard rank must be non-empty");
    assert.ok(pc.details.parents.length > 0, "Parents must be non-empty");
    assert.ok(pc.details.senior_artisan.length > 0, "Senior artisan must be non-empty");
    assert.ok(pc.details.mentor.length > 0, "Mentor must be non-empty");
    assert.ok(pc.details.friend.length > 0, "Friend must be non-empty");
    assert.ok(pc.details.enemy.length > 0, "Enemy must be non-empty");
    assert.ok(pc.rewards.belief.length > 0, "Belief must be non-empty");
    assert.ok(pc.rewards.goal.length > 0, "Goal must be non-empty");
    assert.ok(pc.rewards.instinct.length > 0, "Instinct must be non-empty");
}

// 3. Tenderfoot ("Лапа помощи") rule check
for (let i = 0; i < 20; i++) {
    const tenderfoot = generateCharacterDetails({ guard_rank: "«Лапа помощи»" });
    assert.equal(tenderfoot.details.guard_rank, "«Лапа помощи»");
    assert.equal(tenderfoot.details.cloak_color, "", "Tenderfoot must NOT have a cloak color");
    assert.ok(tenderfoot.details.age >= 14 && tenderfoot.details.age <= 17, "Tenderfoot age must be 14..17");
}

// 4. Overrides preservation
const custom = generateCharacterDetails({
    home: "Моховяз",
    age: 28,
    guard_rank: "Страж",
    fur_color: "Рыжий"
});
assert.equal(custom.details.home, "Моховяз");
assert.equal(custom.details.age, 28);
assert.equal(custom.details.guard_rank, "Страж");
assert.equal(custom.details.fur_color, "Рыжий");
assert.equal(custom.details.birth_year, 1152 - 28);

// 5. NPC generation (regular and key)
for (let i = 0; i < 30; i++) {
    const npc = generateNPCDetails({}, false);
    assert.ok(npc.details.role.length > 0, "NPC role must be non-empty");
    assert.ok(npc.details.home.length > 0, "NPC home must be non-empty");
    assert.ok(npc.details.age >= 16, "NPC age must be >= 16");
    assert.ok(npc.details.fur_color.length > 0, "NPC fur color must be non-empty");
    assert.equal(npc.motivation, undefined, "Regular NPC must NOT have motivation");
}

for (let i = 0; i < 30; i++) {
    const keyNPC = generateNPCDetails({}, true);
    assert.ok(keyNPC.motivation, "Key NPC must have motivation");
    assert.ok(keyNPC.motivation.belief.length > 0, "Key NPC belief must be non-empty");
    assert.ok(keyNPC.motivation.goal.length > 0, "Key NPC goal must be non-empty");
    assert.ok(keyNPC.motivation.instinct.length > 0, "Key NPC instinct must be non-empty");
}

console.log("All generator tests passed successfully! ✓");
