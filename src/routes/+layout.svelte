<script lang="ts">
import "../app.css"
import favicon from "$lib/assets/favicon.svg"

let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Header -->
<header class="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
	<div class="container mx-auto px-4 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<h1 class="text-2xl font-bold text-gray-800">
					Subtitle Burner
				</h1>
			</div>
			
			<!-- Navigation -->
			<nav class="flex items-center space-x-6">
				<a
					href="/"
					class="text-gray-600 hover:text-emerald-600 transition-colors duration-200"
				>
					Home
				</a>
				<a
					href="/srt"
					class="text-gray-600 hover:text-emerald-600 transition-colors duration-200"
				>
					SRT
				</a>
				<a
					href="/ass"
					class="text-gray-600 hover:text-emerald-600 transition-colors duration-200"
				>
					ASS
				</a>
			</nav>
		</div>
	</div>
</header>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
	{@render children?.()}
</main>
