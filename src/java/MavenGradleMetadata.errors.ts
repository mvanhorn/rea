/** Distinguish corrupt POM/module bytes from layouts this reader does not admit. */
export class MavenGradleMetadataFormatFailure extends Error {
  constructor(
    readonly kind: "malformed" | "unsupported",
    message: string,
  ) {
    super(message);
    this.name = "MavenGradleMetadataFormatFailure";
  }
}

/**
 * Refuse a report whose rows would repeat variant names past a fixed allowance.
 * Each dependency row carries its variant's full name, so a long name times many
 * rows grows the report far past the input bytes.
 */
export class MavenGradleMetadataReportFailure extends Error {
  constructor(
    readonly allowance: number,
    readonly required: number,
  ) {
    super(
      `Gradle module metadata would repeat ${String(required)} characters of variant names across its dependency rows, above the ${String(allowance)}-character report allowance.`,
    );
    this.name = "MavenGradleMetadataReportFailure";
  }
}
