<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, MAX_TEXT_ITEMS, TEXT_ANCHORS, type TextNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
}: {
    id?: string
    data: TextNodeData
} = $props()

let title = $derived(compose_node_title("text", data.label))
let item_count = $derived(data.items.length)
let visible_items = $derived(data.items.slice(0, 2))
let overflow_count = $derived(Math.max(0, item_count - 2))
let summary = $derived(`${item_count} / ${MAX_TEXT_ITEMS}`)
let is_invalid = $derived(
    item_count === 0 ||
        item_count > MAX_TEXT_ITEMS ||
        data.items.some(
            (item) =>
                item.text.trim() === "" ||
                !/^#[0-9a-fA-F]{6}$/.test(item.color) ||
                !Number.isFinite(item.opacity) ||
                item.opacity < 0 ||
                item.opacity > 1 ||
                !TEXT_ANCHORS.includes(item.anchor),
        ),
)

function is_dimmed(opacity: number): boolean {
    return opacity < 1
}

function truncate_preview(raw: string): string {
    const trimmed = raw.trim()
    return trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed
}
</script>

<div
    class="w-64 overflow-hidden rounded-lg border bg-white p-3"
    class:border-red-400={is_invalid}
    class:ring-1={is_invalid}
    class:ring-red-200={is_invalid}
    class:border-gray-300={!is_invalid}
    data-testid="compose-node"
    data-kind="text"
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
        class="min-w-0 truncate text-sm font-medium"
        {title}
    >
        {title}
    </p>
    <p
        id={id ? `${id}-summary` : undefined}
        class="mt-1 text-xs text-gray-500"
    >
        {summary}
    </p>
    {#if item_count === 0}
        <p class="mt-1 truncate text-xs text-gray-500">Empty — add item in inspector.</p>
    {:else}
        <ul class="mt-1 min-w-0 space-y-0.5">
            {#each visible_items as item, index (index)}
                <li
                    class="flex min-w-0 items-center gap-1.5 text-xs text-gray-600"
                    class:opacity-50={is_dimmed(item.opacity)}
                >
                    <span
                        aria-hidden="true"
                        title={item.color}
                        style:background-color={item.color}
                        class="h-2.5 w-2.5 shrink-0 rounded-full border border-gray-300"
                    ></span>
                    {#if item.text.trim() === ""}
                        <span class="min-w-0 flex-1 truncate italic">(empty)</span>
                    {:else}
                        <span
                            class="min-w-0 flex-1 truncate"
                            title={item.text}
                        >
                            {truncate_preview(item.text)}
                        </span>
                    {/if}
                    <span
                        class="shrink-0 truncate text-gray-500"
                        title={item.anchor}
                    >
                        {item.anchor}
                    </span>
                </li>
            {/each}
        </ul>
        {#if overflow_count > 0}
            <p class="mt-0.5 truncate text-xs text-gray-500">+{overflow_count} more</p>
        {/if}
    {/if}
</div>
