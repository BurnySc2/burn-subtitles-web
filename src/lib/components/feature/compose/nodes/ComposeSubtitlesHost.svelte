<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { SubtitlesNodeData } from "$lib/media/compose-types"
import ComposeSubtitlesNode from "./ComposeSubtitlesNode.svelte"

let { id, data }: { id: string; data: SubtitlesNodeData & { active?: boolean } } = $props()

function update_data(patch: Partial<SubtitlesNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === id)
    if (node !== undefined && node.type === "subtitles") {
        Object.assign(node.data, patch)
    }
}
</script>

<div class:node-active={data.active === true}>
    <ComposeSubtitlesNode
        {id}
        {data}
        {update_data}
    />
</div>
