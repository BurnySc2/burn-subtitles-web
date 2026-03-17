<script lang="ts">
import { resolve } from "$app/paths"
import { page } from "$app/state"

const is_active = (path: string) => {
    return page.url.pathname === path
}
</script>

<nav class="bg-gray-300 p-4 text-black">
    <div class="container mx-auto flex justify-center space-x-8">
        <a
            href={resolve('/')}
            class="transition-colors hover:text-gray-800 {is_active('/') ? 'font-bold' : ''}"
            >Subtitles Burner</a
        >
        <a
            href={resolve('/download-srt')}
            class="transition-colors hover:text-gray-800 {is_active('/download-srt') ? 'font-bold' : ''}"
            >Download SRT</a
        >
    </div>
</nav>
