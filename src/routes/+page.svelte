<script lang="ts">
import { onMount } from "svelte"
import ASSSubtitleProcessor from "$lib/components/ASSSubtitleProcessor.svelte"

onMount(() => {
	function sendHeight() {
		const height = document.documentElement.scrollHeight
		window.parent.postMessage(
			{
				type: "resize-iframe",
				height: height,
			},
			"*",
		)
	}

	// Send once after load
	sendHeight()

	// Observe DOM changes (better than resize listener)
	const observer = new ResizeObserver(() => {
		sendHeight()
	})

	observer.observe(document.body)
})
</script>

<div class="flex flex-col items-center justify-center py-8">
	<ASSSubtitleProcessor />
</div>