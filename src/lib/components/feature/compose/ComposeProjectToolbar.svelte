<script lang="ts">
let { left, right }: { left?: import("svelte").Snippet; right?: import("svelte").Snippet } = $props()
</script>

<div class="rounded-lg bg-gray-100 px-3 py-1.5 flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-2 flex-wrap">
        {#if left}
            {@render left()}
        {/if}
    </div>
    <div
        aria-hidden="true"
        class="border-l border-gray-300 h-5"
    ></div>
    <div class="flex items-center gap-2 ml-auto">
        {#if right}
            {@render right()}
        {/if}
    </div>
</div>
