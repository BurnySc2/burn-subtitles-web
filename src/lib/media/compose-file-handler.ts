import { type ComposeDropKind, is_accepted } from "./compose-drop"

export interface ComposeFileHandlerOptions {
    file: File | null
    kind: ComposeDropKind
    token: { n: number }
    on_accept: (mine: number) => Promise<void> | void
    on_reject: (message: string) => void
}

export async function handle_accepted_file(opts: ComposeFileHandlerOptions): Promise<void> {
    const { file, kind, token, on_accept, on_reject } = opts
    if (file === null) {
        return
    }
    if (!is_accepted(file, kind)) {
        on_reject(`Unsupported ${kind} file: ${file.name}`)
        return
    }
    token.n += 1
    const mine = token.n
    try {
        await on_accept(mine)
    } catch (error) {
        if (token.n !== mine) {
            return
        }
        on_reject(error instanceof Error ? error.message : `Failed to load ${kind} file: ${file.name}`)
    }
}
