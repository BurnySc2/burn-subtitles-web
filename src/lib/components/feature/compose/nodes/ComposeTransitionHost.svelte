<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { TransitionNodeData } from "$lib/media/compose-types"
import ComposeTransitionNode from "./ComposeTransitionNode.svelte"

let { id, data }: { id: string; data: TransitionNodeData } = $props()

function update_data(patch: Partial<TransitionNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "transition") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeTransitionNode
    {id}
    {data}
    {update_data}
/>
