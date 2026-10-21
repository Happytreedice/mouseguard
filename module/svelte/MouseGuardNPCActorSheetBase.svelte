<script>
    import { setContext } from "svelte";

    // Sheet component imports
    import MouseGuardActorSheetHeader from "./MouseGuardActorSheetHeader.svelte";
    import MouseGuardNpcActorSheetBody from "./MouseGuardNPCActorSheetBody.svelte";
    import MouseGuardActorSheetMouseDispo from "./MouseGuardActorSheetMouseDispo.svelte";

    //Exports
    export let dataStore;
    setContext("sheetStore", dataStore);
    //let sheetData = getContext("sheetStore");

    // Named inputs (name, system.disposition.*) are part of the sheet's own <form> (the ApplicationV2 element), which
    // saves them on change (DEFAULT_OPTIONS.form.submitOnChange). No nested <form> here.
</script>

<div class="mouseguard-sheet">
<div class="npc-sheet-header"><MouseGuardActorSheetHeader /></div>

<div class="sheet-content">
    <MouseGuardNpcActorSheetBody />
    <MouseGuardActorSheetMouseDispo />
</div>
</div>

<style>
    .mouseguard-sheet {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
    }

    .sheet-content {
        min-height: 0;
        flex: 1;
        overflow: auto;
        padding: 12px;
        border: 1px solid var(--mg-border);
        border-radius: 4px;
        background: var(--mg-panel);
    }

    .npc-sheet-header :global(.profile-img) { width:90px; height:90px; flex-basis:90px; }

</style>
