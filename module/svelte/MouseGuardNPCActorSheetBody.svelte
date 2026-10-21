<script>
    import { getContext } from "svelte";
    import { updateRating, rollTest } from "./MouseGuardCommon.svelte";
    import { abilityLabel, itemLabel } from "../rolls/labels.js";

    //getContext("sheetStore", dataStore);
    let sheetData = getContext("sheetStore");
    let { sheet } = $sheetData;
    let data;
    let abilities;
    $: data = $sheetData.data;
    $: actorType = $sheetData.data.type;
    $: abilities = [...($sheetData.data.system.itemTypes.ability ?? [])].sort(
        (a, b) => abilityOrder(a) - abilityOrder(b)
    );
    const ABILITY_ORDER = ["nature", "will", "health", "resources", "circles"];
    function abilityOrder(ability) {
        const i = ABILITY_ORDER.indexOf(ability?.system?.key);
        return i === -1 ? ABILITY_ORDER.length : i;
    }
    $: skills = $sheetData.data.system.itemTypes.skill;
    $: wises = $sheetData.data.system.itemTypes.wise;
    $: traits = $sheetData.data.system.itemTypes.trait;
</script>

<div class="box">
    <largecard>
        <h1>{game.i18n.localize("MOUSEGUARD.Abilities")}</h1>
        <div class="flex-container">
            {#each abilities as ability}
                <ability>
                    <div name={ability.id}>
                        <label
                            on:click={(e) =>
                                rollTest(sheet, ability.id ?? ability._id, e)}
                            class="header"
                            ><a>{abilityLabel(ability, actorType)}</a>:
                        </label>
                        <input
                            data-item-id={ability.id ?? ability._id}
                            type="number"
                            min="0"
                            max="20"
                            value={ability.system.rating}
                            disabled={!$sheetData.editable}
                            on:change|stopPropagation={(e) =>
                                updateRating(
                                    sheet,
                                    e.target.dataset.itemId,
                                    "rating",
                                    parseInt(e.target.value)
                                )}
                        />
                    </div>
                </ability>
            {/each}
        </div>
    </largecard>
</div>

{#if Object(skills).length > 0}
    <div class="box">
        <largecard>
            <h1>{game.i18n.localize("MOUSEGUARD.Skills")}</h1>
            {#each skills as skill}
                <skill>
                    <div name={skill.id}>
                        <label
                            on:click={(e) =>
                                rollTest(sheet, skill.id ?? skill._id, e)}
                            class="header"
                            ><a>{itemLabel(skill)}</a>:
                        </label>
                        <input
                            data-item-id={skill.id ?? skill._id}
                            type="number"
                            min="0"
                            max="6"
                            value={skill.system.rank}
                            disabled={!$sheetData.editable}
                            on:change|stopPropagation={(e) =>
                                updateRating(
                                    sheet,
                                    e.target.dataset.itemId,
                                    "rank",
                                    parseInt(e.target.value)
                                )}
                        />
                    </div>
                    <div class="item-controls">
                        <a
                            on:click={() => sheet?._onItemDelete(skill.id ?? skill._id)}
                            class="item-control item-delete"
                            title={game.i18n.localize("MOUSEGUARD.DeleteItem")}><i class="fas fa-trash" /></a
                        >
                    </div>
                </skill>
            {/each}
        </largecard>
    </div>
{/if}

{#if Object(traits).length > 0}
    <div class="box">
        <largecard>
            <h1>{game.i18n.localize("MOUSEGUARD.Traits")}</h1>
            {#each traits as trait}
                <trait>
                    <div name={trait.id}>
                        <label class="header">{itemLabel(trait)}:</label>
                        <input
                            data-item-id={trait.id ?? trait._id}
                            type="number"
                            min="1"
                            max="3"
                            value={trait.system.level}
                            disabled={!$sheetData.editable}
                            on:change|stopPropagation={(e) =>
                                updateRating(
                                    sheet,
                                    e.target.dataset.itemId,
                                    "level",
                                    parseInt(e.target.value)
                                )}
                        />
                    </div>
                    <div class="item-controls">
                        <a
                            on:click={() => sheet?._onItemDelete(trait.id ?? trait._id)}
                            class="item-control item-delete"
                            title={game.i18n.localize("MOUSEGUARD.DeleteItem")}><i class="fas fa-trash" /></a
                        >
                    </div>
                </trait>
            {/each}
        </largecard>
    </div>
{/if}

{#if Object(wises).length > 0}
    <h1>{game.i18n.localize("MOUSEGUARD.Wises")}</h1>
    {#each wises as wise}
        <wise>
            <div name={wise.id}>
                <label class="header">{itemLabel(wise)}</label>
            </div>
            <div class="item-controls">
                <a
                    on:click={() => sheet?._onItemDelete(wise.id ?? wise._id)}
                    class="item-control item-delete"
                    title={game.i18n.localize("MOUSEGUARD.DeleteItem")}><i class="fas fa-trash" /></a
                >
            </div>
        </wise>
    {/each}
{/if}

<style>
    .box {
        border-radius: 0 0 0.5rem 0.5rem;
        border-top: 0;
        clear: both;
        height: 100%;
        display: flex;
    }

    largecard {
        margin: 0 auto;
        height: 100%;
        width: 100%;
        font-family: "Khula", sans-serif;
        flex-wrap: wrap;
        display: block;
    }

    ability {
        display: inline-block;
        align-self: flex-end;
        width: 20%;
        padding-left: 20px;
    }

    skill {
        display: flex;
        padding-left: 20px;
        float: left;
        height: 80px;
    }

    wise {
        display: flex;
        padding-left: 20px;
        float: left;
        height: 80px;
    }

    trait {
        display: flex;
        padding-left: 20px;
        float: left;
        height: 80px;
    }

    input {
        border: none;
        width: 40px;
        float: left;
        text-align: center;
        background-color: white;
        margin-right: 5px;
        margin-top: 2px;
        height: 35px;
        font-family: "Germania One", cursive;
        font-size: large;
    }

    h1 {
        font-family: "Germania One", cursive;
        padding-left: 30px;
        width: 100%;
    }

    label {
        margin-top: 3px;
        width: 100%;
        display: block;
        cursor: pointer;
    }

    label:hover {
    }

    .header {
        font-family: "Germania One", cursive;
        font-size: large;
        width: 100%;
        display: block;
    }

    .flex-container {
        display: flex;
    }
</style>
