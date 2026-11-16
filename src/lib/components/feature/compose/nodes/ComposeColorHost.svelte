<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ColorNodeData } from "$lib/media/compose-types"
import ComposeColorNode from "./ComposeColorNode.svelte"

let { id, data }: { id: string; data: ColorNodeData } = $props()

function update_data(patch: Partial<ColorNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "color") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeColorNode
    {id}
    {data}
    {update_data}
/>
