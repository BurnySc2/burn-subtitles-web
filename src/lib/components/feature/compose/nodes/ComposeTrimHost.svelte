<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { TrimNodeData } from "$lib/media/compose-types"
import ComposeTrimNode from "./ComposeTrimNode.svelte"

let { id, data }: { id: string; data: TrimNodeData } = $props()

function update_data(patch: Partial<TrimNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "trim") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeTrimNode
    {id}
    {data}
    {update_data}
/>
