<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { RescaleNodeData } from "$lib/media/compose-types"
import ComposeRescaleNode from "./ComposeRescaleNode.svelte"

let { id, data }: { id: string; data: RescaleNodeData } = $props()

function update_data(patch: Partial<RescaleNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "rescale") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeRescaleNode
    {id}
    {data}
    {update_data}
/>
