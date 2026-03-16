<script lang="ts">
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
// See http://www.tcax.org/docs/ass-specs.htm
import {
    available_fonts,
    download_video,
    format_time_remaining,
    generate_ass_file,
    render_video_with_subtitles,
    render_ass_frame_preview,
} from "$lib/utils/subtitle-processing"
</script>

<!-- Settings Section -->
<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    <!-- Basic Font Settings -->
    <div class="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <h2 class="mb-4 text-xl font-bold text-gray-800">Font Settings</h2>

        <!-- Font Selection -->
        <div class="mb-4">
            <label
                for="font-select"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Font Family</label
            >
            <select
                id="font-select"
                bind:value={perma_state.subtitle_settings.font.index}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
                {#each available_fonts as font, index}
                    <option value={index}>{font.select_name}</option>
                {/each}
            </select>
        </div>

        <!-- Font Size -->
        <div class="mb-4">
            <label
                for="font-size"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Font Size: {perma_state.subtitle_settings.font.size}px</label
            >
            <input
                id="font-size"
                type="range"
                min="12"
                max="120"
                bind:value={perma_state.subtitle_settings.font.size}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
        </div>

        <!-- RTL Support -->
        <div class="mb-4">
            <label class="flex items-center space-x-3">
                <input
                    type="checkbox"
                    bind:checked={perma_state.subtitle_settings.font.right_to_left}
                    class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={temp_state.ffmpeg.is_processing}
                >
                <span class="text-sm font-semibold text-gray-700">Enable Right-to-Left (RTL) Text</span>
            </label>
        </div>
    </div>

    <!-- Text Color Settings -->
    <div class="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6">
        <h2 class="mb-4 text-xl font-bold text-gray-800">Text Colors</h2>

        <!-- Text Color -->
        <div class="mb-4">
            <label
                for="text-color"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Text Color</label
            >
            <div class="flex items-center space-x-3">
                <input
                    id="text-color"
                    type="color"
                    bind:value={perma_state.subtitle_settings.text.color}
                    class="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
                    disabled={temp_state.ffmpeg.is_processing}
                >
                <span class="text-sm text-gray-600">{perma_state.subtitle_settings.text.color}</span>
            </div>
        </div>

        <!-- Stroke Color -->
        <div class="mb-4">
            <label
                for="stroke-color"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Stroke Color</label
            >
            <div class="flex items-center space-x-3">
                <input
                    id="stroke-color"
                    type="color"
                    bind:value={perma_state.subtitle_settings.text.stroke}
                    class="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
                    disabled={temp_state.ffmpeg.is_processing}
                >
                <span class="text-sm text-gray-600">{perma_state.subtitle_settings.text.stroke}</span>
            </div>
        </div>

        <!-- Stroke Size -->
        <div class="mb-4">
            <label
                for="stroke-size"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Outline Size: {perma_state.subtitle_settings.text.outline_size}px</label
            >
            <input
                id="stroke-size"
                type="range"
                min="0"
                max="10"
                bind:value={perma_state.subtitle_settings.text.outline_size}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
        </div>
    </div>

    <!-- Shadow & Position Settings -->
    <div class="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6">
        <h2 class="mb-4 text-xl font-bold text-gray-800">Shadow & Position</h2>

        <!-- Shadow Blur -->
        <div class="mb-4">
            <label
                for="shadow-blur"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Shadow: {perma_state.subtitle_settings.shadow.size}px</label
            >
            <input
                id="shadow-blur"
                type="range"
                min="0"
                max="4"
                bind:value={perma_state.subtitle_settings.shadow.size}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
        </div>

        <!-- Horizontal Margin -->
        <div class="mb-4">
            <label
                for="position-y"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Horizontal Margin: {perma_state.subtitle_settings.position.horizontal_margin}px</label
            >
            <input
                id="margin-h"
                type="range"
                min="0"
                max="1080"
                bind:value={perma_state.subtitle_settings.position.horizontal_margin}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
        </div>

        <!-- Vertical Anchor -->
        <div class="mb-4">
            <label
                for="anchor-y"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Vertical Anchor</label
            >
            <select
                id="anchor-y"
                bind:value={perma_state.subtitle_settings.position.vertical_anchor}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
                {#each ["Top", "Center", "Bottom"] as anchor_option}
                    <option value={anchor_option.toLowerCase()}>{anchor_option}</option>
                {/each}
            </select>
        </div>

        <!-- Position Y -->
        {#if perma_state.subtitle_settings.position.vertical_anchor !== "center"}
            <div class="mb-4">
                <label
                    for="position-y"
                    class="mb-2 block text-sm font-semibold text-gray-700"
                    >Vertical Position: {perma_state.subtitle_settings.position.vertical}px</label
                >
                <input
                    id="position-y"
                    type="range"
                    min="0"
                    max="1080"
                    bind:value={perma_state.subtitle_settings.position.vertical}
                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
        {/if}
    </div>
</div>
