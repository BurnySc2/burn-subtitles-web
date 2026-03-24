<script lang="ts">
import Spinner from "$lib/components/ui/Spinner.svelte"
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { available_fonts } from "$lib/utils/fonts"
// http: //www.tcax.org/docs/ass-specs.htm
</script>

{#if perma_state.loading.subtitle_settings}
    <Spinner />
{:else}
    <!-- Settings Section -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <!-- Basic Font Settings -->
        <div class="section">
            <h2 class="section-title">Font Settings</h2>

            <!-- Font Selection -->
            <div class="mb-4">
                <label
                    for="font-select"
                    class="form-label-lg"
                    >Font Family</label
                >
                <select
                    id="font-select"
                    bind:value={perma_state.subtitle_settings.font.index}
                    disabled={temp_state.ffmpeg.is_processing}
                >
                    {#each available_fonts as font, index}
                        <option value={index}>{font.select_name}</option>
                    {/each}
                </select>
            </div>

            <!-- Font Size -->
            <div class="mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <label
                        for="font-size"
                        class="form-label-lg mb-0 mr-auto"
                        >Font Size</label
                    >
                    <input
                        id="font-size"
                        type="number"
                        min="12"
                        max="120"
                        bind:value={perma_state.subtitle_settings.font.size}
                        class="input-number-xs"
                        disabled={temp_state.ffmpeg.is_processing}
                    >
                    <span class="text-sm text-gray-500">px</span>
                </div>
                <input
                    type="range"
                    min="12"
                    max="120"
                    bind:value={perma_state.subtitle_settings.font.size}
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>

            <!-- RTL Support -->
            <div class="mb-4">
                <label class="flex items-center space-x-3">
                    <input
                        type="checkbox"
                        bind:checked={perma_state.subtitle_settings.font.right_to_left}
                        class="h-5 w-5 rounded"
                        disabled={temp_state.ffmpeg.is_processing}
                    >
                    <span class="text-sm">Enable Right-to-Left (RTL) Text</span>
                </label>
            </div>
        </div>

        <!-- Text Color Settings -->
        <div class="section">
            <h2 class="section-title">Text Colors</h2>

            <!-- Text Color -->
            <div class="mb-4">
                <label
                    for="text-color"
                    class="mb-2 block text-sm font-semibold"
                    >Text Color</label
                >
                <div class="flex items-center space-x-3">
                    <input
                        id="text-color"
                        type="color"
                        bind:value={perma_state.subtitle_settings.text.color}
                        class="h-12 w-20 rounded-lg cursor-pointer"
                        disabled={temp_state.ffmpeg.is_processing}
                    >
                    <span class="text-sm">{perma_state.subtitle_settings.text.color}</span>
                </div>
            </div>

            <!-- Stroke Color -->
            <div class="mb-4">
                <label
                    for="stroke-color"
                    class="mb-2 block text-sm font-semibold"
                    >Stroke Color</label
                >
                <div class="flex items-center space-x-3">
                    <input
                        id="stroke-color"
                        type="color"
                        bind:value={perma_state.subtitle_settings.text.stroke}
                        class="h-12 w-20 rounded-lg cursor-pointer"
                        disabled={temp_state.ffmpeg.is_processing}
                    >
                    <span class="text-sm">{perma_state.subtitle_settings.text.stroke}</span>
                </div>
            </div>

            <!-- Stroke Size -->
            <div class="mb-4">
                <label
                    for="stroke-size"
                    class="mb-2 block text-sm font-semibold"
                    >Outline Size: {perma_state.subtitle_settings.text.outline_size}px</label
                >
                <input
                    id="stroke-size"
                    type="range"
                    min="0"
                    max="10"
                    bind:value={perma_state.subtitle_settings.text.outline_size}
                    class="w-full rounded-lg px-4 py-3 shadow-sm"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
        </div>

        <!-- Shadow & Position Settings -->
        <div class="section">
            <h2 class="section-title">Shadow & Position</h2>

            <!-- Shadow Blur -->
            <div class="mb-4">
                <label
                    for="shadow-blur"
                    class="mb-2 block text-sm font-semibold"
                    >Shadow: {perma_state.subtitle_settings.shadow.size}px</label
                >
                <input
                    id="shadow-blur"
                    type="range"
                    min="0"
                    max="4"
                    bind:value={perma_state.subtitle_settings.shadow.size}
                    class="w-full rounded-lg px-4 py-3 shadow-sm"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>

            <!-- Horizontal Margin -->
            <div class="mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <label
                        for="margin-h"
                        class="form-label-lg mb-0 mr-auto"
                        >Horizontal Margin</label
                    >
                    <input
                        id="margin-h"
                        type="number"
                        min="0"
                        max="1080"
                        bind:value={perma_state.subtitle_settings.position.horizontal_margin}
                        class="input-number-xs"
                        disabled={temp_state.ffmpeg.is_processing}
                    >
                    <span class="text-sm text-gray-500">px</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1080"
                    bind:value={perma_state.subtitle_settings.position.horizontal_margin}
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>

            <!-- Vertical Anchor -->
            <div class="mb-4">
                <label
                    for="anchor-y"
                    class="mb-2 block text-sm font-semibold"
                    >Vertical Anchor</label
                >
                <select
                    id="anchor-y"
                    bind:value={perma_state.subtitle_settings.position.vertical_anchor}
                    class="w-full rounded-lg px-4 py-3 shadow-sm"
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
                    <div class="flex items-center gap-2 mb-2">
                        <label
                            for="position-y"
                            class="form-label-lg mb-0 mr-auto"
                            >Vertical Position</label
                        >
                        <input
                            id="position-y"
                            type="number"
                            min="0"
                            max="1080"
                            bind:value={perma_state.subtitle_settings.position.vertical}
                            class="input-number-xs"
                            disabled={temp_state.ffmpeg.is_processing}
                        >
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1080"
                        bind:value={perma_state.subtitle_settings.position.vertical}
                        disabled={temp_state.ffmpeg.is_processing}
                    >
                </div>
            {/if}
        </div>
    </div>
{/if}
