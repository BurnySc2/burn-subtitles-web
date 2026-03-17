<script lang="ts">
// This is a helper file to extract .srt from .ods file
import JSZip from "jszip"
import { temp_state } from "$lib/temporary-storage.svelte"
import Spinner from "./Spinner.svelte"

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

const ods_data_promise = $derived.by(async () => {
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

    const resolved = await ods_data_promise
    if (resolved === null) {
        return null
    }
    return resolved[sheet - 1]
        .filter((_data, index) => {
            return start <= index && index <= end
        })
        .map((row) => {
            // console.log(row)
            return row[column - 1] ?? ""
        })
})
const handle_file_change = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
        for (const file of input.files) {
            if (file.name.endsWith(".ods")) {
                const parsed = parse_odt(file)
                if (parsed !== null) {
                    temp_state.extract_srt.file = file
                    break
                }
            }
        }
    }
}

async function download_srt() {
    const data = await srt_data
    if (data === null) {
        return
    }
    const blob = new Blob([data.join("\n") + "\n"], { type: "text/vtt+srt;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "subtitles.srt"
    link.click()
    URL.revokeObjectURL(url)
}
</script>

<div class="flex flex-col h-full my-6 mx-16 items-center space-y-4">
    <!-- Input .ods file upload -->
    <div class="flex">
        <input
            type="file"
            class="rounded-lg px-2 py-2 file:rounded file:text-xs"
            onchange={handle_file_change}
            id="ods-file-input"
        >
        <label
            for="ods-file-input"
            class="px-6 py-3 rounded-lg font-medium text-center cursor-pointer inline-block"
        >
            Click to upload .ods file
        </label>
    </div>
    <div class="grid grid-cols-4 gap-4 w-full max-w-2xl">
        <label
            class="select-none col-start-1 col-span-2 text-sm font-medium flex items-center"
            for="selected-sheet"
        >
            Sheet to extract
        </label>
        <input
            id="selected-sheet"
            class="col-span-2 px-4 py-2 rounded-lg"
            type="number"
            min="1"
            bind:value={temp_state.extract_srt.selected_sheet}
        >
        <label
            class="select-none col-span-2 text-sm font-medium flex items-center"
            for="selected-column"
        >
            Column to extract
        </label>
        <input
            id="selected-column"
            class="col-span-2 px-4 py-2 rounded-lg"
            type="number"
            min="1"
            bind:value={temp_state.extract_srt.selected_column}
        >
        <label
            class="select-none col-span-2 text-sm font-medium flex items-center"
            for="selected-start-row"
        >
            Start row (including)
        </label>
        <input
            id="selected-start-row"
            class="col-span-2 px-4 py-2 rounded-lg"
            type="number"
            min="1"
            bind:value={temp_state.extract_srt.selected_start_row}
        >
        <label
            class="select-none col-span-2 text-sm font-medium flex items-center"
            for="selected-end-row"
        >
            End row (including)
        </label>
        <input
            id="selected-end-row"
            class="col-span-2 px-4 py-2 rounded-lg"
            type="number"
            min="1"
            bind:value={temp_state.extract_srt.selected_end_row}
        >
    </div>
    {#await ods_data_promise}
        <Spinner />
    {:then ods_data}
        <button
            onclick={download_srt}
            class="px-6 py-3 rounded-lg font-medium"
            disabled={ods_data===null}
        >
            Download SRT
        </button>
    {/await}
    {#await srt_data then srt_content}
        {#if srt_content !== null}
            <pre
                class="srt-display overflow-y-auto col-span-4 line-numbers w-10/12"
                style="--start-line: {temp_state.extract_srt.selected_start_row - 1}"
            >
{#each srt_content as line}
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
    border-radius: 8px;
    padding: 16px;
    max-height: 500px;
}

.line-numbers {
    counter-reset: line var(--start-line, 0);
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
    font-size: 0.9em;
}
</style>
