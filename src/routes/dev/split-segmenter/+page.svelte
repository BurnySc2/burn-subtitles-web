<script lang="ts">
import { SAMPLE_LOCALES, tokenize_segmenter, tokenize_whitespace } from "$lib/media/split-prototype"

interface SampleSentence {
    id: string
    locale: string
    text: string
}

interface TokenDetail {
    segment: string
    is_word_like: boolean
    graphemes: number
}

type SegmenterCtor = new (
    locale: string,
    opts: { granularity: string },
) => { segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }> }

const SAMPLE_SENTENCES: SampleSentence[] = [
    { id: "en", locale: "en", text: "When the storm passed over the mountains, the village began to rebuild" },
    { id: "ar", locale: "ar", text: "عندما توقفت الأمطار خرج الناس إلى الشوارع" },
    { id: "ja", locale: "ja", text: "長い冬が終わり桜の花が咲き始めた" },
    { id: "th", locale: "th", text: "เมื่อฤดูฝนสิ้นสุดลงชาวบ้านก็เริ่มเตรียมงาน" },
]

const HANDLING_NOTE =
    "Note: Arabic keeps spaces between words, so the whitespace fallback is close — Segmenter " +
    "mainly detaches particles and punctuation. Japanese, Chinese, Korean and Thai do not delimit " +
    "words with spaces, so the whitespace fallback collapses to a single token while Segmenter " +
    "finds word boundaries."

let active_locale = $state(SAMPLE_LOCALES[0] ?? "en")

const has_segmenter =
    typeof Intl !== "undefined" && typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === "function"

function whitespace_details(text: string): TokenDetail[] {
    return tokenize_whitespace(text).map((segment) => ({
        segment,
        is_word_like: true,
        graphemes: [...segment].length,
    }))
}

function segment_details(text: string, locale: string): TokenDetail[] {
    const holder = Intl as unknown as { Segmenter?: SegmenterCtor }
    if (typeof holder.Segmenter !== "function") {
        return whitespace_details(text)
    }
    try {
        const words = new holder.Segmenter(locale, { granularity: "word" })
        const graphemes = new holder.Segmenter(locale, { granularity: "grapheme" })
        const out: TokenDetail[] = []
        for (const item of words.segment(text)) {
            out.push({
                segment: item.segment,
                is_word_like: item.isWordLike === true,
                graphemes: [...graphemes.segment(item.segment)].length,
            })
        }
        return out
    } catch {
        return whitespace_details(text)
    }
}

const rows = $derived(
    SAMPLE_SENTENCES.map((sample) => {
        const details = segment_details(sample.text, active_locale)
        return {
            sample,
            details,
            word_like_count: tokenize_segmenter(sample.text, active_locale).length,
            fallback_count: tokenize_whitespace(sample.text).length,
        }
    }),
)
</script>

<div class="container mx-auto max-w-4xl space-y-6 p-6">
    <a
        class="text-sm text-blue-600 hover:underline"
        href="/dev/split"
        >← Back to split prototype</a
    >
    <h1 class="text-2xl font-bold">Split Segmenter prototype</h1>

    <label class="flex items-center gap-3">
        <span class="form-label">Locale</span>
        <select
            class="rounded border px-2 py-1"
            bind:value={active_locale}
        >
            {#each SAMPLE_LOCALES as locale}
                <option value={locale}>{locale}</option>
            {/each}
        </select>
    </label>

    {#if !has_segmenter}
        <p class="rounded bg-amber-50 p-4 text-amber-800">
            Intl.Segmenter is unavailable in this browser — showing whitespace fallback only.
        </p>
    {/if}

    {#each rows as row}
        <section class="section">
            <p
                dir="auto"
                class="mb-1 font-medium"
            >
                {row.sample.text}
            </p>
            <p class="mb-3 text-sm text-gray-500">sample {row.sample.id} · segmented as {active_locale}</p>
            <div class="flex flex-col gap-4 md:flex-row">
                <table class="min-w-0 flex-1 text-sm">
                    <thead>
                        <tr class="text-left text-gray-500">
                            <th class="pr-3">#</th>
                            <th class="pr-3">Token</th>
                            <th class="pr-3">Word-like</th>
                            <th>Graphemes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each row.details as token, index}
                            <tr class="border-t">
                                <td class="pr-3">{index + 1}</td>
                                <td
                                    dir="auto"
                                    class="pr-3"
                                >
                                    {token.segment}
                                </td>
                                <td class="pr-3">{token.is_word_like ? "yes" : "no"}</td>
                                <td>{token.graphemes}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
                <aside class="shrink-0 text-sm md:w-44">
                    <p>Segments: {row.details.length}</p>
                    <p>Word-like: {row.word_like_count}</p>
                    <p>Whitespace fallback: {row.fallback_count}</p>
                </aside>
            </div>
        </section>
    {/each}

    <p class="rounded bg-slate-50 p-4 text-sm text-slate-700">{HANDLING_NOTE}</p>
</div>
