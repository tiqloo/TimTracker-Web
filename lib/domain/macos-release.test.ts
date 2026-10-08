import assert from "node:assert/strict";
import test from "node:test";
import { getPublicMacosRelease } from "./macos-release.ts";

test("release stays hidden until all public metadata is complete", () => {
  assert.equal(getPublicMacosRelease({}), null);
  assert.equal(getPublicMacosRelease({ NEXT_PUBLIC_MACOS_DOWNLOAD_URL: "https://example.com/app.dmg" }), null);
});

test("release rejects non-HTTPS download URLs", () => {
  assert.equal(getPublicMacosRelease({
    NEXT_PUBLIC_MACOS_DOWNLOAD_URL: "http://example.com/app.dmg",
    NEXT_PUBLIC_MACOS_APP_VERSION: "1.0.0-beta.1",
    NEXT_PUBLIC_MACOS_MIN_VERSION: "14.0",
    NEXT_PUBLIC_MACOS_FILE_SIZE: "24 MB",
    NEXT_PUBLIC_MACOS_SHA256: "a".repeat(64),
  }), null);
});

test("release exposes a complete signed-download configuration", () => {
  assert.deepEqual(getPublicMacosRelease({
    NEXT_PUBLIC_MACOS_DOWNLOAD_URL: "https://downloads.tiqloo.com/Tiqloo.dmg",
    NEXT_PUBLIC_MACOS_APP_VERSION: "1.0.0-beta.1",
    NEXT_PUBLIC_MACOS_MIN_VERSION: "14.0",
    NEXT_PUBLIC_MACOS_FILE_SIZE: "24 MB",
    NEXT_PUBLIC_MACOS_SHA256: "A".repeat(64),
  }), {
    downloadUrl: "https://downloads.tiqloo.com/Tiqloo.dmg",
    version: "1.0.0-beta.1",
    minimumMacos: "14.0",
    fileSize: "24 MB",
    sha256: "a".repeat(64),
    notarized: false,
  });
});

test("release only claims notarization when explicitly configured", () => {
  const base = {
    NEXT_PUBLIC_MACOS_DOWNLOAD_URL: "https://downloads.tiqloo.com/Tiqloo.dmg",
    NEXT_PUBLIC_MACOS_APP_VERSION: "1.0.0",
    NEXT_PUBLIC_MACOS_MIN_VERSION: "14.0",
    NEXT_PUBLIC_MACOS_FILE_SIZE: "24 MB",
    NEXT_PUBLIC_MACOS_SHA256: "a".repeat(64),
  };
  assert.equal(getPublicMacosRelease(base)?.notarized, false);
  assert.equal(getPublicMacosRelease({ ...base, NEXT_PUBLIC_MACOS_NOTARIZED: "yes" })?.notarized, false);
  assert.equal(getPublicMacosRelease({ ...base, NEXT_PUBLIC_MACOS_NOTARIZED: "true" })?.notarized, true);
});

test("release rejects an invalid checksum", () => {
  assert.equal(getPublicMacosRelease({
    NEXT_PUBLIC_MACOS_DOWNLOAD_URL: "https://downloads.tiqloo.com/Tiqloo.dmg",
    NEXT_PUBLIC_MACOS_APP_VERSION: "1.0.0-beta.1",
    NEXT_PUBLIC_MACOS_MIN_VERSION: "14.0",
    NEXT_PUBLIC_MACOS_FILE_SIZE: "24 MB",
    NEXT_PUBLIC_MACOS_SHA256: "not-a-checksum",
  }), null);
});
