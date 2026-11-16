<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { SourceNodeData } from "$lib/media/compose-types"
import ComposeSourceNode from "./ComposeSourceNode.svelte"

let { id, data }: { id: string; data: SourceNodeData } = $props()

function update_data(patch: Partial<SourceNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "source") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeSourceNode
    {id}
    {data}
    {update_data}
/>
