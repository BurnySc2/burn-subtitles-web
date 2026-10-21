<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import { validate_compose } from "$lib/media/compose-validation"

let issues = $derived(validate_compose(compose_state.nodes, compose_state.edges))
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">
        Issues
        {#if issues.length > 0}
            ({issues.length})
        {/if}
    </h2>
    {#if compose_state.run_error}
        <p class="rounded bg-red-100 p-2 text-sm text-red-800">{compose_state.run_error}</p>
    {/if}
    {#if issues.length === 0}
        <p class="text-sm font-medium text-green-700">✓ Graph valid</p>
    {:else}
        <ul class="flex flex-col gap-1">
            {#each issues as issue, index (`${issue.node_id ?? "graph"}-${issue.field ?? "general"}-${index}`)}
                <li>
                    {#if issue.node_id}
                        <button
                            type="button"
                            onclick={() => {
                                compose_state.selected_id = issue.node_id
                                compose_state.selected_edge_id = null
                            }}
                            class="btn btn-secondary w-full p-2 text-left text-sm text-red-800"
                        >
                            <span class="font-mono text-xs">{issue.node_id}</span>
                            {#if issue.field}
                                <span class="text-xs"> · {issue.field}</span>
                            {/if}
                            <span> — {issue.message}</span>
                        </button>
                    {:else}
                        <p class="rounded bg-red-100 p-2 text-sm text-red-800">
                            {#if issue.field}
                                {issue.field}:
                            {/if}
                            {issue.message}
                        </p>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</div>
