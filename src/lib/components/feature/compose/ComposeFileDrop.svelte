<script lang="ts">
import { first_dropped_file } from "$lib/media/compose-drop"

let {
    accept,
    choose_label,
    choose_aria,
    file_name,
    show_remove,
    remove_aria,
    input_id,
    describedby,
    disabled,
    on_file,
    on_remove,
}: {
    accept: string
    choose_label: string
    choose_aria: string
    file_name: string | null
    show_remove: boolean
    remove_aria: string
    input_id?: string | undefined
    describedby?: string | undefined
    disabled: boolean
    on_file: (file: File | null) => void | Promise<void>
    on_remove: () => void
} = $props()

let is_dragging = $state(false)
let file_input = $state<HTMLInputElement | null>(null)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions: inner button/input is the keyboard path; drop is enhancement only, so no role=button -->
<!-- biome-ignore lint/a11y/noStaticElementInteractions: drop is enhancement only; inner button/input is the keyboard path -->
<div
    class="drop-zone nodrag w-full"
    class:drag-over={is_dragging}
    ondragover={(e) => {
        if (disabled) {
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
    ondrop={async (e) => {
        e.preventDefault()
        if (disabled) {
            return
        }
        e.stopPropagation()
        try {
            await on_file(first_dropped_file(e))
        } finally {
            is_dragging = false
        }
    }}
>
    <input
        id={input_id}
        aria-describedby={describedby}
        bind:this={file_input}
        type="file"
        {accept}
        class="nodrag hidden"
        {disabled}
        onchange={async (e) => {
            if (disabled) {
                return
            }
            const file = e.currentTarget.files?.[0] ?? null
            e.currentTarget.value = ""
            try {
                await on_file(file)
            } finally {
                is_dragging = false
            }
        }}
    >
    <div class="flex gap-2 nodrag">
        <button
            type="button"
            onclick={() => file_input?.click()}
            aria-label={choose_aria}
            {disabled}
            class="btn btn-primary btn-sm nodrag"
        >
            {choose_label}
        </button>
        {#if show_remove}
            <button
                type="button"
                onclick={on_remove}
                aria-label={remove_aria}
                title={file_name ?? undefined}
                {disabled}
                class="btn btn-sm nodrag bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
            >
                Remove
            </button>
        {/if}
    </div>
</div>
