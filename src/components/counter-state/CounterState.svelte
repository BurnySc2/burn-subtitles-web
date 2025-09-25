<script lang="ts">
	import { use_local_storage_state } from '$lib/persistent-storage.svelte'

	let my_counter_state = use_local_storage_state('my_counter_state', 0)
</script>

<button
	class="rounded border-2 border-black p-2"
	onclick={() => {
		my_counter_state.value += 1
	}}>Increment</button
>
<div>
	{my_counter_state.value}
</div>
