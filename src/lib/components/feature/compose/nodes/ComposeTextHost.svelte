<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { TextNodeData } from "$lib/media/compose-types"
import ComposeTextNode from "./ComposeTextNode.svelte"

let { id, data }: { id: string; data: TextNodeData } = $props()

function update_data(patch: Partial<TextNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "text") {
        Object.assign(node.data, patch)
    }
}
</script>

<ComposeTextNode
    {id}
    {data}
    {update_data}
/>
