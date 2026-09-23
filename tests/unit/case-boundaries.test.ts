import { describe, it, expect } from "vitest";
import {
  awaitingResult,
  dayDistance,
  localDay,
  toInstant,
} from "../../src/modules/cases/dates";
import { detectMime, safeFilename } from "../../src/modules/cases/files";
describe("firm calendar boundaries", () => {
  it("uses the firm day across UTC midnight", () => {
    expect(localDay("2026-09-20T02:00:00Z", "America/Mexico_City")).toBe(
      "2026-09-19",
    );
    expect(dayDistance("2026-09-20", "2026-09-19")).toBe(1);
  });
  it("converts an entered Mexico City wall clock", () =>
    expect(toInstant("2026-09-19T10:30", "America/Mexico_City")).toBe(
      "2026-09-19T16:30:00.000Z",
    ));
  it("rejects a nonexistent calendar date", () =>
    expect(() => toInstant("2026-02-30T10:30", "America/Mexico_City")).toThrow(
      "INVALID_DATE",
    ));
  it("rejects a DST gap", () =>
    expect(() => toInstant("2026-03-08T02:30", "America/New_York")).toThrow(
      "INVALID_DATE",
    ));
  it("rejects a DST overlap", () =>
    expect(() => toInstant("2026-11-01T01:30", "America/New_York")).toThrow(
      "INVALID_DATE",
    ));
  it("calculates calendar distance across a DST day", () =>
    expect(dayDistance("2026-03-09", "2026-03-08")).toBe(1));
  const settings = {
    timezone: "America/Mexico_City",
    eod_reminder_enabled: true,
    eod_reminder_time: "18:00:00",
  };
  it("waits for firm end of day before prompting for a result", () => {
    expect(
      awaitingResult(
        "2026-09-19T16:00Z",
        settings,
        new Date("2026-09-19T23:59Z"),
      ),
    ).toBe(false);
    expect(
      awaitingResult(
        "2026-09-19T16:00Z",
        settings,
        new Date("2026-09-20T00:00Z"),
      ),
    ).toBe(true);
  });
  it("does not prompt for a future event after end of day", () =>
    expect(
      awaitingResult(
        "2026-09-20T02:00Z",
        settings,
        new Date("2026-09-20T00:00Z"),
      ),
    ).toBe(false));
  it("respects disabled reminders", () =>
    expect(
      awaitingResult(
        "2026-09-18T16:00Z",
        { ...settings, eod_reminder_enabled: false },
        new Date("2026-09-20T00:00Z"),
      ),
    ).toBe(false));
});
describe("file admission", () => {
  it("recognizes allowed signatures", () => {
    expect(detectMime(new TextEncoder().encode("%PDF-1.4\n"))).toBe(
      "application/pdf",
    );
    expect(detectMime(Uint8Array.from([255, 216, 255, 1]))).toBe("image/jpeg");
    expect(detectMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
    expect(detectMime(new TextEncoder().encode("RIFF0000WEBP"))).toBe(
      "image/webp",
    );
  });
  it("rejects HTML and incomplete signatures despite filenames", () => {
    expect(
      detectMime(new TextEncoder().encode("<html>not a pdf</html>")),
    ).toBeNull();
    expect(detectMime(Uint8Array.from([137, 80]))).toBeNull();
  });
  it("neutralizes path separators and response-header control characters", () =>
    expect(safeFilename("../a\r\n.pdf")).toBe(".._a__.pdf"));
});
