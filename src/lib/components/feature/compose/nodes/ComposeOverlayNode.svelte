<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import ComposeFileDrop from "$lib/components/feature/compose/ComposeFileDrop.svelte"
import { handle_accepted_file } from "$lib/media/compose-file-handler"
import { compose_node_title, type OverlayNodeData } from "$lib/media/compose-types"
import type { ImageProbe } from "$lib/media/mediabunny-overlay"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: OverlayNodeData
    update_data: (patch: Partial<OverlayNodeData>) => void
} = $props()

let probing = $state(false)
let error = $state<string | null>(null)
let image_probe = $state<ImageProbe | null>(null)
let probed_file = $state<File | null>(null)
let token = { n: 0 }
let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("overlay", data.label))
let has_image = $derived(data.image !== null)
let choose_label = $derived(has_image ? "Replace image" : "Choose image")
let choose_aria = $derived(has_image ? "Replace overlay image" : "Choose overlay image")
let summary = $derived(`${data.position} · ${data.scale}% · ${data.opacity}`)

let file_name = $derived(data.image ? data.image.name : "No image selected")
let meta_line = $derived(image_probe && probed_file === data.image ? `${image_probe.width}x${image_probe.height}` : "")
let show_remove = $derived(data.image !== null)
let remove_aria = $derived(data.image ? `Remove overlay image ${data.image.name}` : "Remove overlay image")

async function handle_file(file: File | null): Promise<void> {
    if (!file || !id) {
        return
    }
    const target = file
    await handle_accepted_file({
        file: target,
        kind: "overlay",
        token,
        on_accept: async (mine) => {
            probing = true
            error = null
            image_probe = null
            probed_file = null
            update_data({ image: target })
            try {
                const { probe_image } = await import("$lib/media/mediabunny-overlay")
                const result = await probe_image(target)
                if (mine !== token.n) {
                    return
                }
                image_probe = result
                probed_file = target
            } catch (caught) {
                if (mine !== token.n) {
                    return
                }
                error = caught instanceof Error ? caught.message : `Failed to read image: ${target.name}`
                image_probe = null
                probed_file = null
                update_data({ image: null })
            } finally {
                if (mine === token.n) {
                    probing = false
                }
            }
        },
        on_reject: (message) => {
            token.n += 1
            update_data({ image: null })
            error = message
            probing = false
        },
    })
}

function handle_remove(): void {
    token.n += 1
    probing = false
    error = null
    image_probe = null
    probed_file = null
    update_data({ image: null })
}
</script>

<div
    class="w-64 overflow-hidden rounded-lg border border-gray-300 bg-white p-3"
    data-testid="compose-node"
    data-kind="overlay"
>
    <Handle
        type="target"
        position={Position.Left}
    />
    <Handle
        type="source"
        position={Position.Right}
    />
    <p
        class="text-sm font-medium"
        ondblclick={() => {
            label_draft = data.label ?? ""
            editing_label = true
        }}
        title="Double-click to rename"
    >
        {title}
    </p>
    {#if editing_label}
        <input
            type="text"
            value={label_draft}
            placeholder="Name (optional)"
            aria-label="Node name (optional)"
            oninput={(e) => {
                label_draft = e.currentTarget.value
            }}
            onblur={() => {
                update_data({ label: label_draft.trim() === "" ? null : label_draft.trim() })
                editing_label = false
            }}
            onkeydown={(e) => {
                if (e.key === "Enter") {
                    update_data({ label: label_draft.trim() === "" ? null : label_draft.trim() })
                    editing_label = false
                } else if (e.key === "Escape") {
                    editing_label = false
                }
            }}
            class="nodrag mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
    {/if}
    <p
        id={id ? `${id}-summary` : undefined}
        class="mt-1 text-xs text-gray-500"
    >
        {summary}
    </p>
    <div
        aria-live="polite"
        class="mt-1 min-w-0"
    >
        <p
            class="block w-full min-w-0 max-w-full truncate text-xs text-gray-600"
            title={file_name}
        >
            {file_name}
        </p>
        {#if meta_line}
            <p
                class="block w-full min-w-0 max-w-full truncate text-xs text-gray-500"
                title={meta_line}
            >
                {meta_line}
            </p>
        {/if}
    </div>
    <p
        id={id ? `${id}-status` : undefined}
        aria-live="polite"
        class={error && !probing ? "mt-1 text-xs text-red-700" : "mt-1 text-xs text-gray-500"}
    >
        {probing ? "Reading image…" : (error ?? "")}
    </p>
    <ComposeFileDrop
        accept="image/*"
        input_id={id ? `${id}-file` : undefined}
        {choose_label}
        {choose_aria}
        file_name={data.image ? data.image.name : null}
        {show_remove}
        {remove_aria}
        describedby={id ? `${id}-status` : undefined}
        disabled={probing}
        on_file={handle_file}
        on_remove={handle_remove}
    />
</div>
