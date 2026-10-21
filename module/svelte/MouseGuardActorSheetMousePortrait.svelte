<script>
    import { getContext } from "svelte";

    //getContext("sheetStore", dataStore);
    let sheetData = getContext("sheetStore");
    let actor;
    let sheet;
    let data;
    $: actor = $sheetData?.actor;
    $: data = $sheetData?.data;

    /**
     * Opens a File Picker and updates the actor accordingly.
     */
    const filePicker = (event) => {
        if (!$sheetData?.editable) return;
        event.preventDefault();
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        const attr = event.currentTarget.dataset.edit;
        const current = foundry.utils.getProperty(data, attr);
        const fp = new foundry.applications.apps.FilePicker.implementation({
            type: "imagevideo",
            current: current,
            callback: (path) => actor.update({ [attr]: path })
        });
        return fp.browse();
    };
</script>

<portrait>
    <img
        on:click={filePicker}
        on:keydown={(event) => event.key === "Enter" && filePicker(event)}
        role="button"
        tabindex={$sheetData?.editable ? 0 : -1}
        class="profile-img"
        src={data.img}
        data-edit="img"
        title={data.name}
        aria-label={game.i18n.localize("MOUSEGUARD.ChangePortrait")}
        height="100"
        width="100"
    />
</portrait>

<style>
    img {
        border: none;
    }
</style>
