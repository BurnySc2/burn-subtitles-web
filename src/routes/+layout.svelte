<script lang="ts">
import "../app.css"
import favicon from "$lib/assets/favicon.svg"

let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<style>
		/* Needs to be in sync with `subtitle-processing.ts` */
		@font-face {
			font-family: "Roboto";
			src: url("/fonts/Roboto.ttf") format("truetype");
		}
		@font-face {
			font-family: "OpenSans";
			src: url("/fonts/OpenSans.ttf") format("truetype");
		}
		@font-face {
			font-family: "Tajawal";
			src: url("/fonts/Tajawal.ttf") format("truetype");
		}
		@font-face {
			font-family: "Cairo";
			src: url("/fonts/Cairo.ttf") format("truetype");
		}
		@font-face {
			font-family: "Rubik";
			src: url("/fonts/Rubik.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Kufi Arabic";
			src: url("/fonts/NotoKufiArabic.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Sans";
			src: url("/fonts/NotoSans.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Sans Arabic";
			src: url("/fonts/NotoSansArabic.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Sans Japanese";
			src: url("/fonts/NotoSansJP.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Sans Korean";
			src: url("/fonts/NotoSansKR.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Sans Thai";
			src: url("/fonts/NotoSansThai.ttf") format("truetype");
		}
		@font-face {
			font-family: "Noto Sans Traditional Chinese";
			src: url("/fonts/NotoSansTC.ttf") format("truetype");
		}
	</style>
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
