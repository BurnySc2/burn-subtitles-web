<script lang="ts">
// This is a helper file to extract .srt from .ods file
import JSZip from "jszip"
import Spinner from "$lib/components/ui/Spinner.svelte"
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
async function process_file(file: File) {
    if (file.name.endsWith(".ods")) {
        const parsed = await parse_odt(file)
        if (parsed !== null) {
            temp_state.extract_srt.file = file
            return true
        }
    }
    return false
}

const handle_file_change = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files) {
        for (const file of input.files) {
            if (await process_file(file)) {
                break
            }
        }
    }
}

let is_dragging = $state(false)

function handle_drag_over(event: DragEvent) {
    event.preventDefault()
    is_dragging = true
}

function handle_drag_leave() {
    is_dragging = false
}

async function handle_drop(event: DragEvent) {
    event.preventDefault()
    is_dragging = false
    const files = event.dataTransfer?.files
    if (files) {
        for (const file of files) {
            if (await process_file(file)) {
                break
            }
        }
    }
}

async function download_srt() {
    const data = await srt_data
    if (data === null) {
        return
    }
    const blob = new Blob([`${data.join("\n")}\n`], { type: "text/vtt+srt;charset=utf-8" })
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
    <div class="flex flex-col items-center space-y-2">
        <input
            type="file"
            class="hidden"
            onchange={handle_file_change}
            id="ods-file-input"
        >
        <label
            for="ods-file-input"
            class="ods-drop-zone flex flex-col items-center justify-center w-64 h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors {is_dragging ? 'border-primary bg-primary/10' : 'border-gray-400 hover:border-primary'}"
            ondragover={handle_drag_over}
            ondragleave={handle_drag_leave}
            ondrop={handle_drop}
        >
            {#if temp_state.extract_srt.file}
                <span class="text-sm text-gray-600 truncate max-w-full px-2">{temp_state.extract_srt.file.name}</span>
                <span class="text-xs text-gray-400 mt-1">Click or drop to replace</span>
            {:else}
                <span class="text-gray-500">Click or drag & drop .ods file</span>
            {/if}
        </label>
        <p class="text-xs text-gray-500">Upload an .ods file (click or drag and drop a .ods file)</p>
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
            class="btn btn-primary mx-8"
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
.ods-drop-zone {
    border-color: var(--fallback-b1, oklch(var(--b1)));
}

.ods-drop-zone:hover {
    border-color: var(--fallback-p, oklch(var(--p)));
}

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
