export interface ClipV2State {
    sourceFile: File | null
    sourceUrl: string | null
    duration: number | null
    hasVideo: boolean
    hasAudio: boolean
    startStr: string
    endStr: string
    isProcessing: boolean
    resultUrl: string | null
    resultMime: string | null
    error: string | null
    message: string | null
}

function initial_state(): ClipV2State {
    return {
        sourceFile: null,
        sourceUrl: null,
        duration: null,
        hasVideo: false,
        hasAudio: false,
        startStr: "00:00:00.000",
        endStr: "",
        isProcessing: false,
        resultUrl: null,
        resultMime: null,
        error: null,
        message: null,
    }
}

export const clipV2State: ClipV2State = $state(initial_state())

export function resetOutput(): void {
    if (clipV2State.resultUrl) {
        URL.revokeObjectURL(clipV2State.resultUrl)
    }
    clipV2State.resultUrl = null
    clipV2State.resultMime = null
    clipV2State.error = null
    clipV2State.message = null
}

export function revokeAll(): void {
    if (clipV2State.sourceUrl) {
        URL.revokeObjectURL(clipV2State.sourceUrl)
    }
    if (clipV2State.resultUrl) {
        URL.revokeObjectURL(clipV2State.resultUrl)
    }
    const fresh = initial_state()
    clipV2State.sourceFile = fresh.sourceFile
    clipV2State.sourceUrl = fresh.sourceUrl
    clipV2State.duration = fresh.duration
    clipV2State.hasVideo = fresh.hasVideo
    clipV2State.hasAudio = fresh.hasAudio
    clipV2State.startStr = fresh.startStr
    clipV2State.endStr = fresh.endStr
    clipV2State.isProcessing = fresh.isProcessing
    clipV2State.resultUrl = fresh.resultUrl
    clipV2State.resultMime = fresh.resultMime
    clipV2State.error = fresh.error
    clipV2State.message = fresh.message
}
