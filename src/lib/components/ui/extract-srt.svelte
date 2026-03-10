<script lang="ts">
import JSZip from "jszip"
import * as FileDropZone from "$lib/components/ui/file-drop-zone"
import { temp_state } from "$lib/temporary-storage.svelte"

export async function parse_odt(file: File) {
    const zip = await JSZip.loadAsync(file)

    const content = zip.file("content.xml")
    if (content === null) {
        return null
    }
    const xml = await content.async("text")

    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")

    const data = doc.getElementsByTagName("table:table")
    // @ts-expect-error
    const sheet_row_column = [...data].map((sheet: HTMLElement) => {
        // console.log(data)
        // @ts-expect-error
        return [...sheet.getElementsByTagName("table:table-row")].map((row: HTMLElement) => {
            // console.log(row)
            // @ts-expect-error
            return [...row.getElementsByTagName("table:table-cell")].map((cell: HTMLElement) => {
                // console.log(cell)
                return cell.textContent
            })
        })
    })
    return sheet_row_column
}

const ods_data = $derived.by(async () => {
    if (temp_state.extract_srt.file === null) {
        return null
    }
    return await parse_odt(temp_state.extract_srt.file)
})

const srt_data = $derived.by(async () => {
    const sheet = temp_state.extract_srt.selected_sheet
    const start = temp_state.extract_srt.selected_start_row
    const end = temp_state.extract_srt.selected_end_row
    const column = temp_state.extract_srt.selected_column

    const resolved = await ods_data
    if (resolved === null) {
        return null
    }
    return resolved[sheet]
        .filter((_data, index) => {
            return start <= index && index <= end
        })
        .map((row) => {
            // console.log(row)
            return row[column] ?? ""
        })
})

const on_upload: FileDropZone.FileDropZoneRootProps["onUpload"] = async (uploaded_files: File[]) => {
    // console.log(uploaded_files)
    for (const file of uploaded_files) {
        if (file.name.endsWith(".ods")) {
            // Parse .ods file
            const parsed = parse_odt(file)
            if (parsed !== null) {
                temp_state.extract_srt.file = file
                // Able to parse .odt file, exit
                break
            }
        }
    }
}

const on_file_rejected: FileDropZone.FileDropZoneRootProps["onFileRejected"] = async ({ reason, file }) => {
    // toast.error(`${file.name} failed to upload!`, { description: reason })
}

async function download_srt() {
    const data = await srt_data
    if (data === null) {
        return
    }
    const blob = new Blob([data.join("\n") + "\n"], { type: "text/vtt+srt;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a');
    link.href = url
    link.download = "subtitles.srt"
    link.click()
    URL.revokeObjectURL(url)
}
</script>

<div class="flex flex-col h-full my-6 mx-40 items-center space-y-4">
    <!-- Input .ods file drop -->
    <FileDropZone.Root
        onUpload={on_upload}
        onFileRejected={on_file_rejected}
        maxFileSize={100 * FileDropZone.MEGABYTE}
    >
        <FileDropZone.Trigger
            class="bg-gray-900 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition text-center"
        >
            <pre>Click to upload .ods file
or drag & drop file here</pre>
        </FileDropZone.Trigger>
    </FileDropZone.Root>
    <div class="grid grid-cols-4 space-y-4">
        <label
            class="select-none col-start-1 col-span-2"
            for="selected-column"
            >Sheet to extract</label
        >
        <input
            id="selected-column"
            class="col-span-2"
            type="number"
            bind:value={temp_state.extract_srt.selected_sheet}
        >
        <label
            class="select-none col-span-2"
            for="selected-column"
            >Column to extract</label
        >
        <input
            id="selected-column"
            class="col-span-2"
            type="number"
            bind:value={temp_state.extract_srt.selected_column}
        >
        <label
            class="select-none col-span-2"
            for="selected-column"
            >Start row</label
        >
        <input
            id="selected-column"
            class="col-span-2"
            type="number"
            bind:value={temp_state.extract_srt.selected_start_row}
        >
        <label
            class="select-none col-span-2"
            for="selected-column"
            >End row</label
        >
        <input
            id="selected-column"
            class="col-span-2"
            type="number"
            bind:value={temp_state.extract_srt.selected_end_row}
        >
    </div>
    <button onclick={download_srt}>Download SRT</button>
    {#await srt_data then a}
        {#if a !== null}
            <pre class="srt-display overflow-y-auto col-span-4 line-numbers">
{#each a as line, i}
<span>{line}</span>{/each}
</pre>
        {/if}
    {/await}
</div>

<style>
.srt-display {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
    background: #f6f8fa;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #e1e4e8;
    max-height: 500px;
}

.line-numbers {
    counter-reset: line;
    position: relative;
    padding-left: 3.5rem;
    white-space: pre-wrap;
}

.line-numbers span::before {
    counter-increment: line;
    content: counter(line);
    position: absolute;
    left: 0;
    width: 3rem;
    text-align: right;
    padding-right: 0.75rem;
    color: #888;
    font-size: 0.9em;
}
</style>
