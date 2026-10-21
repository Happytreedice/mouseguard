<script>
    import { getContext } from "svelte";

    import MouseGuardActorSheetPortrait from "./MouseGuardActorSheetMousePortrait.svelte";
    import MouseGuardActorSheetMouseName from "./MouseGuardActorSheetMouseName.svelte";

    //getContext("sheetStore", dataStore);
    let sheetData = getContext("sheetStore");
</script>

<actorhead>
    <div class="flex-container">
        <div class="flex-item">
            <MouseGuardActorSheetMouseName />
        </div>
        <MouseGuardActorSheetPortrait />
    </div>
</actorhead>

<style>
    .flex-container {
        display: flex;
    }

    .flex-item {
        flex-grow: 1;
    }
</style>
