export interface MacosRelease {
  downloadUrl: string;
  version: string;
  minimumMacos: string;
  fileSize: string;
  sha256: string;
  // false = ad-hoc signed beta (macOS warns on first launch). Only an
  // explicit NEXT_PUBLIC_MACOS_NOTARIZED=true claims Apple notarization.
  notarized: boolean;
}

export function getPublicMacosRelease(
  env: Record<string, string | undefined> = process.env,
): MacosRelease | null {
  const downloadUrl = env.NEXT_PUBLIC_MACOS_DOWNLOAD_URL?.trim();
  const version = env.NEXT_PUBLIC_MACOS_APP_VERSION?.trim();
  const minimumMacos = env.NEXT_PUBLIC_MACOS_MIN_VERSION?.trim();
  const fileSize = env.NEXT_PUBLIC_MACOS_FILE_SIZE?.trim();
  const sha256 = env.NEXT_PUBLIC_MACOS_SHA256?.trim().toLowerCase();

  if (!downloadUrl || !version || !minimumMacos || !fileSize || !sha256) return null;
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;

  try {
    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }

  const notarized = env.NEXT_PUBLIC_MACOS_NOTARIZED?.trim().toLowerCase() === "true";

  return { downloadUrl, version, minimumMacos, fileSize, sha256, notarized };
}
