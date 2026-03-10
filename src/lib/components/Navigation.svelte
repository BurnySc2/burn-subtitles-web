<script lang="ts">
import { resolve } from "$app/paths"
import { page } from "$app/state"

const is_active = (path: string) => {
    return page.url.pathname === path
}
</script>

<nav class="bg-gray-800 p-4 text-white">
    <div class="container mx-auto flex justify-center space-x-8">
        <a
            href={resolve('/')}
            class="transition-colors hover:text-gray-300 {is_active('/') ? 'font-bold' : ''}"
            >Burn Subtitles</a
        >
        <a
            href={resolve('/download-srt')}
            class="transition-colors hover:text-gray-300 {is_active('/download-srt') ? 'font-bold' : ''}"
            >Download SRT</a
        >
    </div>
</nav>
