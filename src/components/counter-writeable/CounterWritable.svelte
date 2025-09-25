<script lang="ts">
	import { my_counter_writable } from '$lib/persistent-storage.svelte'
</script>

<div>
	{$my_counter_writable}
</div>
