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
            href={resolve("/")}
            class="transition-colors hover:text-gray-800"
            class:font-bold={is_active("/")}
            >Subtitles Burner</a
        >
        <a
            href={resolve("/download-srt")}
            class="transition-colors hover:text-gray-800"
            class:font-bold={is_active("/download-srt")}
            >Download SRT</a
        >
        <a
            href={resolve("/clip")}
            class="transition-colors hover:text-gray-800"
            class:font-bold={is_active("/clip")}
            >Clip Extractor</a
        >
        <a
            href={resolve("/transition")}
            class="transition-colors hover:text-gray-800"
            class:font-bold={is_active("/transition")}
            >Transition</a
        >
        <a
            href={resolve("/compose")}
            class="transition-colors hover:text-gray-800"
            class:font-bold={is_active("/compose")}
            >Compose</a
        >
    </div>
</nav>
