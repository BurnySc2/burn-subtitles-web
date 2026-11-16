<script lang="ts">
import type { ProbeResult } from "$lib/media/mediabunny-clip"
import { format_timecode } from "$lib/media/timecode"
import { format_dual_size } from "$lib/utils/format_size"

interface Props {
    current_time: number | null
    fps: number
    duration: number | null
    probe: ProbeResult | null
    measured_fps: number | null
    rvfc_supported: boolean
    message: string | null
}

let { current_time, fps, duration, probe, measured_fps, rvfc_supported, message }: Props = $props()

const valid_fps = $derived(Number.isFinite(fps) && fps > 0)
const vfr_unknown = $derived(probe?.frame_rate == null)
</script>

<div class="section">
    <h2 class="section-title">Inspector</h2>
    <dl class="mt-1 space-y-1 text-sm text-gray-500">
        <div class="flex gap-1">
            <dt class="font-medium">Effective fps:</dt>
            <dd>
                {valid_fps ? `${fps.toFixed(2)} fps` : "—"}
                {#if probe?.frame_rate != null}
                    <span class="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-xs text-green-800">probe</span>
                {:else}
                    <span class="ml-1 rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800">fallback</span>
                {/if}
            </dd>
        </div>
        <div class="flex gap-1">
            <dt class="font-medium">Measured fps:</dt>
            <dd>
                {measured_fps === null ? "—" : `${measured_fps.toFixed(2)} fps`}
                {#if rvfc_supported}
                    <span class="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-xs text-green-800">rVFC</span>
                {:else}
                    <span class="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">no rVFC</span>
                {/if}
            </dd>
        </div>
    </dl>
    {#if probe && vfr_unknown}
        <p class="mt-1 text-sm text-yellow-700">
            No container frame rate reported; this may be variable-frame-rate media, so frame numbers are computed from
            the effective fps and may drift from the source.
        </p>
    {/if}
    {#if message}
        <p class="mt-1 text-sm text-gray-600">{message}</p>
    {/if}
    {#if probe}
        <details class="mt-2">
            <summary class="cursor-pointer text-sm font-medium text-gray-700">Media details</summary>
            <dl class="mt-1 space-y-1 text-sm text-gray-500">
                <div class="flex gap-1">
                    <dt class="font-medium">File:</dt>
                    <dd>{probe.file_name}</dd>
                </div>
                <div class="flex gap-1">
                    <dt class="font-medium">Size:</dt>
                    <dd>{format_dual_size(probe.file_size, 2)}</dd>
                </div>
                {#if probe.container}
                    <div class="flex gap-1">
                        <dt class="font-medium">Container:</dt>
                        <dd>{probe.container}</dd>
                    </div>
                {/if}
                {#if probe.mime_type}
                    <div class="flex gap-1">
                        <dt class="font-medium">MIME:</dt>
                        <dd>{probe.mime_type}</dd>
                    </div>
                {/if}
                {#if probe.duration !== null}
                    <div class="flex gap-1">
                        <dt class="font-medium">Duration:</dt>
                        <dd>{format_timecode(probe.duration)}</dd>
                    </div>
                {/if}
                {#if probe.overall_bitrate !== null}
                    <div class="flex gap-1">
                        <dt class="font-medium">Overall bitrate:</dt>
                        <dd>{Math.round(probe.overall_bitrate / 1000)} kbps</dd>
                    </div>
                {/if}
                <div class="flex gap-1">
                    <dt class="font-medium">Tracks:</dt>
                    <dd>Video {probe.video_count} · Audio {probe.audio_count}</dd>
                </div>
                {#if probe.has_video}
                    {#if probe.video_codec}
                        <div class="flex gap-1">
                            <dt class="font-medium">Video codec:</dt>
                            <dd>
                                {probe.video_codec}
                                {probe.video_codec_param ? ` (${probe.video_codec_param})` : ""}
                            </dd>
                        </div>
                    {/if}
                    {#if probe.display_width !== null && probe.display_height !== null}
                        <div class="flex gap-1">
                            <dt class="font-medium">Resolution:</dt>
                            <dd>{probe.display_width}x{probe.display_height}</dd>
                        </div>
                    {/if}
                    {#if probe.coded_width !== null &&
                        probe.coded_height !== null &&
                        (probe.coded_width !== probe.display_width || probe.coded_height !== probe.display_height)}
                        <div class="flex gap-1">
                            <dt class="font-medium">Coded size:</dt>
                            <dd>{probe.coded_width}x{probe.coded_height}</dd>
                        </div>
                    {/if}
                    {#if probe.frame_rate !== null}
                        <div class="flex gap-1">
                            <dt class="font-medium">Frame rate:</dt>
                            <dd>{probe.frame_rate.toFixed(2)} fps</dd>
                        </div>
                    {/if}
                    {#if probe.video_bitrate !== null}
                        <div class="flex gap-1">
                            <dt class="font-medium">Video bitrate:</dt>
                            <dd>{Math.round(probe.video_bitrate / 1000)} kbps</dd>
                        </div>
                    {/if}
                {/if}
                {#if probe.has_audio}
                    {#if probe.audio_codec}
                        <div class="flex gap-1">
                            <dt class="font-medium">Audio codec:</dt>
                            <dd>
                                {probe.audio_codec}
                                {probe.audio_codec_param ? ` (${probe.audio_codec_param})` : ""}
                            </dd>
                        </div>
                    {/if}
                    {#if probe.audio_channels !== null}
                        <div class="flex gap-1">
                            <dt class="font-medium">Channels:</dt>
                            <dd>{probe.audio_channels}</dd>
                        </div>
                    {/if}
                    {#if probe.audio_sample_rate !== null}
                        <div class="flex gap-1">
                            <dt class="font-medium">Sample rate:</dt>
                            <dd>{probe.audio_sample_rate} Hz</dd>
                        </div>
                    {/if}
                    {#if probe.audio_bitrate !== null}
                        <div class="flex gap-1">
                            <dt class="font-medium">Audio bitrate:</dt>
                            <dd>{Math.round(probe.audio_bitrate / 1000)} kbps</dd>
                        </div>
                    {/if}
                {/if}
                <div class="flex gap-1">
                    <dt class="font-medium">Type:</dt>
                    <dd>
                        {probe.kind}
                        {#if probe.can_play}
                            <span class="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-xs text-green-800"
                                >plays in browser</span
                            >
                        {:else}
                            <span class="ml-1 rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800"
                                >may not play in browser</span
                            >
                        {/if}
                    </dd>
                </div>
            </dl>
        </details>
    {/if}
</div>
