export function format_dual_size(byte_count: number, decimals: number): string {
    const mib = (byte_count / (1024 * 1024)).toFixed(decimals)
    const mb = (byte_count / 1_000_000).toFixed(decimals)
    return `${mib} MiB · ${mb} MB`
}
