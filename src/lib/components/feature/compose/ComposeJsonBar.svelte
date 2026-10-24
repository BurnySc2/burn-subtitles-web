<script lang="ts">
import { first_dropped_file } from "$lib/media/compose-drop"
import { compose_filename } from "$lib/media/compose-filename"
import { compose_state, parse_compose_json, revoke_all, serialize_compose } from "$lib/media/compose-state.svelte"

let import_error: string | null = $state(null)
let file_input: HTMLInputElement | null = $state(null)
let is_dragging = $state(false)
let running = $derived(compose_state.run_status === "running")

function handle_download(): void {
    import_error = null
    const json = serialize_compose(compose_state.nodes, compose_state.edges)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = compose_filename("composition", "json")
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function is_json_file(file: File): boolean {
    return file.type === "application/json" || file.name.toLowerCase().endsWith(".json")
}

async function handle_import(file: File | null): Promise<void> {
    if (!file) {
        return
    }
    if (!is_json_file(file)) {
        import_error = "Please drop a JSON file."
        if (file_input) {
            file_input.value = ""
        }
        return
    }
    try {
        const parsed = parse_compose_json(await file.text())
        revoke_all()
        compose_state.nodes = parsed.nodes
        compose_state.edges = parsed.edges
        compose_state.selected_id = null
        compose_state.selected_edge_id = null
        import_error = null
    } catch (error) {
        import_error = error instanceof Error ? error.message : "Import failed."
    } finally {
        if (file_input) {
            file_input.value = ""
        }
    }
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <!-- svelte-ignore a11y_no_static_element_interactions: buttons and input are the keyboard path; drop is enhancement only, so no role=button -->
    <div
        class="drop-zone nodrag flex flex-wrap items-center gap-2"
        class:drag-over={is_dragging}
        ondragover={(e) => {
            if (running) {
                return
            }
            e.preventDefault()
            e.stopPropagation()
            is_dragging = true
        }}
        ondragleave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
                return
            }
            is_dragging = false
        }}
        ondrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            is_dragging = false
            if (running) {
                return
            }
            void handle_import(first_dropped_file(e))
        }}
    >
        <button
            type="button"
            onclick={handle_download}
            disabled={running || compose_state.nodes.length === 0}
            class="btn btn-secondary btn-sm"
        >
            Download JSON
        </button>
        <button
            type="button"
            onclick={() => file_input?.click()}
            disabled={running}
            class="btn btn-secondary btn-sm"
        >
            Upload JSON
        </button>
        <input
            bind:this={file_input}
            type="file"
            accept="application/json,.json"
            onchange={(e) => void handle_import(e.currentTarget.files?.[0] ?? null)}
            class="hidden"
        >
    </div>
    {#if import_error}
        <p
            aria-live="polite"
            class="rounded bg-red-100 p-2 text-sm text-red-800"
        >
            {import_error}
        </p>
    {/if}
</div>
