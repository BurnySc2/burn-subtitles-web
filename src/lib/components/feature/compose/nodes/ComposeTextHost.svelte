<script lang="ts">
import type { TextNodeData } from "$lib/media/compose-types"
import ComposeTextNode from "./ComposeTextNode.svelte"

let { id, data }: { id: string; data: TextNodeData } = $props()
</script>

<ComposeTextNode
    {id}
    {data}
/>
