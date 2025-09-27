<script lang="ts">
	import { FFmpeg } from '@ffmpeg/ffmpeg'
	// @ts-ignore
	import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types'
	import { fetchFile, toBlobURL } from '@ffmpeg/util'

	// Subtitle burner imports
	import SubtitleUpload from './SubtitleUpload.svelte'
	import SubtitleConfig from './SubtitleConfig.svelte'
	import SubtitleProcessor from './SubtitleProcessor.svelte'
	import '../stores/subtitle-store.svelte'

	let video_el: HTMLVideoElement

	const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
	// Multithreading:
	// const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm'
	const videoURL = 'https://raw.githubusercontent.com/ffmpegwasm/testdata/master/video-15s.avi'

	let message = 'Click Start to Transcode'

	async function transcode() {
		const ffmpeg = new FFmpeg()
		message = 'Loading ffmpeg-core.js'
		ffmpeg.on('log', ({ message: msg }: LogEvent) => {
			message = msg
			console.log(message)
		})
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
		})
		message = 'Start transcoding'
		await ffmpeg.writeFile('test.avi', await fetchFile(videoURL))
		await ffmpeg.exec(['-i', 'test.avi', 'test.mp4'])
		message = 'Complete transcoding'
		const data = await ffmpeg.readFile('test.mp4')
		console.log('done')
		video_el.src = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }))
	}
</script>

<div class="container mx-auto max-w-7xl p-6">
	<!-- Subtitle Burner -->
	<section class="mb-12">
		<h2 class="mb-6 text-center text-2xl font-bold">Subtitle Burner</h2>
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Upload and Config side by side on large screens -->
			<div class="space-y-6 lg:col-span-1">
				<SubtitleUpload />
				<SubtitleConfig />
			</div>

			<!-- Processor full width on mobile, 2/3 on large screens -->
			<div class="lg:col-span-2">
				<SubtitleProcessor />
			</div>
		</div>
	</section>
</div>
