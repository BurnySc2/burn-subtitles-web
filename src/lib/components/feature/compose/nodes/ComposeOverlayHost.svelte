<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { OverlayNodeData } from "$lib/media/compose-types"
import ComposeOverlayNode from "./ComposeOverlayNode.svelte"

let { id, data }: { id: string; data: OverlayNodeData } = $props()

function update_data(patch: Partial<OverlayNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "overlay") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeOverlayNode
    {id}
    {data}
    {update_data}
/>
