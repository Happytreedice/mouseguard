<script>
    import { setContext } from "svelte";

    //getContext("sheetStore", dataStore);
    export let dataStore;
    setContext("sheetStore", dataStore);
</script>

<content>
    {dataStore.isGM}
</content>
