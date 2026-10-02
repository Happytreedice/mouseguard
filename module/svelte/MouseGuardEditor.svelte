<script>
    import { onDestroy, getContext } from "svelte";
    export let target;

    let sheetData = getContext("sheetStore");
    let data;
    $: data = $sheetData.data;

    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    let editorContent;
    let height;
    let mce;
    let rawContent = "";
    let content = "";
    let editor = {};

    $: {
        rawContent = foundry.utils.getProperty($sheetData?.data, target) ?? "";
        TextEditor.enrichHTML(rawContent, {
            secrets: $sheetData?.isOwner ?? false
        }).then((res) => {
            content = res;
        });
    }

    onDestroy(async () => {
        if (mce) mce.destroy?.();
    });

    const createEditor = async () => {
        const doc = $sheetData?.actor ?? $sheetData?.document;
        TextEditor.create({
            target: editorContent,
            invalid_elements: "iframe",
            document: doc,
            fieldName: target,
            save_onsavecallback: async (m) => {
                mce = m;
                const isDirty = (mce.getContent ? mce.getContent() : editorContent?.innerHTML) !== editor.initial;
                mce.remove?.();
                if (isDirty && doc) {
                    const newContent = mce.getContent ? mce.getContent() : (editorContent?.innerHTML ?? "");
                    await doc.update({ [target]: newContent });
                }
                mce.destroy?.();
            }
        }, rawContent).then((m) => {
            editor.m = m;
            mce = m;
            editor.initial = mce.getContent ? mce.getContent() : "";
            editor.changed = false;
            editor.active = true;
            mce.focus?.();
            mce.on?.("change", (ev) => (editor.changed = true));
        });
    };
</script>

<div class="editor">
    <span />
    <div
        class="editor-content"
        data-edit={target}
        bind:this={editorContent}
        bind:clientHeight={height}
    >
        {@html content}
    </div>
    {#if $sheetData.editable}
        <a class="editor-edit" on:click|preventDefault={createEditor}>
            <i class="fas fa-edit" />
        </a>
    {/if}
</div>

<style>
    .editor {
        display: grid;
        grid-template-rows: 1px 1fr;
    }
    .editor-content {
        min-height: 100px;
    }
</style>
