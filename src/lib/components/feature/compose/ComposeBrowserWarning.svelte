<script lang="ts">
import { onMount } from "svelte"
import { is_chromium } from "$lib/utils/browser-detect"

const STORAGE_KEY = "compose-browser-warning-dismissed"

let visible = $state(false)
let dismissed = $state(false)

function dismiss_warning() {
    dismissed = true
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, "1")
        }
    } catch {
        /* ignore */
    }
}

onMount(() => {
    try {
        if (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
            dismissed = true
            return
        }
    } catch {
        /* ignore */
    }
    visible = !is_chromium()
})
</script>

{#if visible && !dismissed}
    <div
        role="alert"
        class="section flex items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800"
    >
        <span
            >⚠️ This browser may not support all compose features. For best results, use a Chromium browser such as
            Chrome or Edge.</span
        >
        <button
            class="btn btn-sm btn-secondary ml-auto"
            onclick={() => dismiss_warning()}
            aria-label="Dismiss browser warning"
        >
            Dismiss
        </button>
    </div>
{/if}
