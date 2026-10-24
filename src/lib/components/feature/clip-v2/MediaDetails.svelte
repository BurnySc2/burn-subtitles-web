<script lang="ts">
import type { ProbeResult } from "$lib/media/mediabunny-clip"
import { format_timecode } from "$lib/media/timecode"
import { format_dual_size } from "$lib/utils/format_size"

let { details }: { details: ProbeResult } = $props()
</script>

<details class="mt-3">
    <summary class="cursor-pointer text-sm font-medium text-gray-700">Media details</summary>
    <dl class="mt-2 space-y-1 text-sm text-gray-500">
        <div class="flex gap-2">
            <dt class="font-medium">File:</dt>
            <dd>{details.file_name}</dd>
        </div>
        <div class="flex gap-2">
            <dt class="font-medium">Size:</dt>
            <dd>{format_dual_size(details.file_size, 2)}</dd>
        </div>
        {#if details.container}
            <div class="flex gap-2">
                <dt class="font-medium">Container:</dt>
                <dd>{details.container}</dd>
            </div>
        {/if}
        {#if details.mime_type}
            <div class="flex gap-2">
                <dt class="font-medium">MIME:</dt>
                <dd>{details.mime_type}</dd>
            </div>
        {/if}
        {#if details.duration !== null}
            <div class="flex gap-2">
                <dt class="font-medium">Duration:</dt>
                <dd>{format_timecode(details.duration)}</dd>
            </div>
        {/if}
        {#if details.overall_bitrate !== null}
            <div class="flex gap-2">
                <dt class="font-medium">Overall bitrate:</dt>
                <dd>{Math.round(details.overall_bitrate / 1000)} kbps</dd>
            </div>
        {/if}
        <div class="flex gap-2">
            <dt class="font-medium">Tracks:</dt>
            <dd>Video {details.video_count} · Audio {details.audio_count}</dd>
        </div>
        {#if details.has_video}
            {#if details.video_codec}
                <div class="flex gap-2">
                    <dt class="font-medium">Video codec:</dt>
                    <dd>
                        {details.video_codec}
                        {details.video_codec_param ? ` (${details.video_codec_param})` : ""}
                    </dd>
                </div>
            {/if}
            {#if details.display_width !== null && details.display_height !== null}
                <div class="flex gap-2">
                    <dt class="font-medium">Resolution:</dt>
                    <dd>{details.display_width}x{details.display_height}</dd>
                </div>
            {/if}
            {#if details.coded_width !== null &&
                details.coded_height !== null &&
                (details.coded_width !== details.display_width || details.coded_height !== details.display_height)}
                <div class="flex gap-2">
                    <dt class="font-medium">Coded size:</dt>
                    <dd>{details.coded_width}x{details.coded_height}</dd>
                </div>
            {/if}
            {#if details.frame_rate !== null}
                <div class="flex gap-2">
                    <dt class="font-medium">Frame rate:</dt>
                    <dd>{details.frame_rate.toFixed(2)} fps</dd>
                </div>
            {/if}
            {#if details.video_color_space}
                <div class="flex gap-2">
                    <dt class="font-medium">Color space:</dt>
                    <dd>{details.video_color_space}</dd>
                </div>
            {/if}
            {#if details.video_bitrate !== null}
                <div class="flex gap-2">
                    <dt class="font-medium">Video bitrate:</dt>
                    <dd>{Math.round(details.video_bitrate / 1000)} kbps</dd>
                </div>
            {/if}
        {/if}
        {#if details.has_audio}
            {#if details.audio_codec}
                <div class="flex gap-2">
                    <dt class="font-medium">Audio codec:</dt>
                    <dd>
                        {details.audio_codec}
                        {details.audio_codec_param ? ` (${details.audio_codec_param})` : ""}
                    </dd>
                </div>
            {/if}
            {#if details.audio_channels !== null}
                <div class="flex gap-2">
                    <dt class="font-medium">Channels:</dt>
                    <dd>{details.audio_channels}</dd>
                </div>
            {/if}
            {#if details.audio_sample_rate !== null}
                <div class="flex gap-2">
                    <dt class="font-medium">Sample rate:</dt>
                    <dd>{details.audio_sample_rate} Hz</dd>
                </div>
            {/if}
            {#if details.audio_bitrate !== null}
                <div class="flex gap-2">
                    <dt class="font-medium">Audio bitrate:</dt>
                    <dd>{Math.round(details.audio_bitrate / 1000)} kbps</dd>
                </div>
            {/if}
        {/if}
        <div class="flex gap-2">
            <dt class="font-medium">Type:</dt>
            <dd>
                {details.kind}
                {#if details.can_play}
                    <span class="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-xs text-green-800">plays in browser</span>
                {:else}
                    <span class="ml-1 rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800"
                        >may not play in browser</span
                    >
                {/if}
            </dd>
        </div>
    </dl>
</details>
