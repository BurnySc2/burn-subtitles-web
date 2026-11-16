<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { MergeNodeData } from "$lib/media/compose-types"
import ComposeMergeNode from "./ComposeMergeNode.svelte"

let { id, data }: { id: string; data: MergeNodeData } = $props()

function update_data(patch: Partial<MergeNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "merge") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeMergeNode
    {id}
    {data}
    {update_data}
/>
