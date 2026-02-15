<script lang="ts">
import { onMount, onDestroy } from "svelte"
import ASSSubtitleProcessor from "$lib/components/ASSSubtitleProcessor.svelte"

onMount(() => {
	function sendHeight() {
		const height = document.documentElement.getBoundingClientRect().height
		window.parent.postMessage({ type: "resize-iframe", height }, "*")
	}

	// Initial send
	sendHeight()

	// Listen for browser resize
	window.addEventListener("resize", sendHeight)

	// Optional: observe DOM changes too
	const observer = new ResizeObserver(sendHeight)
	observer.observe(document.body)

	// Cleanup on destroy
	onDestroy(() => {
		window.removeEventListener("resize", sendHeight)
		observer.disconnect()
	})
})
</script>

<div class="flex flex-col items-center justify-center py-8">
	<ASSSubtitleProcessor />
</div>