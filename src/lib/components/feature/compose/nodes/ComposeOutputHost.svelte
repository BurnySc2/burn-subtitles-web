<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { OutputNodeData } from "$lib/media/compose-types"
import ComposeOutputNode from "./ComposeOutputNode.svelte"

let { id, data }: { id: string; data: OutputNodeData } = $props()

function update_data(patch: Partial<OutputNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "output") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeOutputNode
    {id}
    {data}
    {update_data}
/>
