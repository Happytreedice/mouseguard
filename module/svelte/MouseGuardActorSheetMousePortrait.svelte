<script>
    import { getContext } from "svelte";

    //getContext("sheetStore", dataStore);
    let sheetData = getContext("sheetStore");
    let actor;
    let sheet;
    let data;
    $: actor = $sheetData?.actor;
    $: sheet = $sheetData?.sheet;
    $: data = $sheetData?.data;

    /**
     * Opens a File Picker and updates the actor accordingly.
     */
    const filePicker = (event) => {
        const attr = event.currentTarget.dataset.edit;
        const current = foundry.utils.getProperty(data, attr);
        const fp = new foundry.applications.apps.FilePicker.implementation({
            type: "image",
            current: current,
            callback: (path) => {
                actor.update({ [attr]: path });
            },
            top: sheet.position.top + 40,
            left: sheet.position.left + 10
        });
        return fp.browse();
    };
</script>

<portrait>
    <img
        on:click={filePicker}
        class="profile-img"
        src={data.img}
        data-edit="img"
        title={data.name}
        height="100"
        width="100"
    />
</portrait>

<style>
    img {
        border: none;
    }
</style>
