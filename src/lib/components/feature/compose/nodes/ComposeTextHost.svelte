<script lang="ts">
import type { TextNodeData } from "$lib/media/compose-types"
import ComposeTextNode from "./ComposeTextNode.svelte"

let { id, data }: { id: string; data: TextNodeData & { active?: boolean } } = $props()
</script>

<div class:node-active={data.active === true}>
    <ComposeTextNode
        {id}
        {data}
    />
</div>
