import { describe, it, expect } from "vitest";
import { slugToPeptideTags } from "@/lib/peptide-map";

describe("slugToPeptideTags", () => {
  it("maps bpc-157 slug to canonical tag", () => {
    expect(slugToPeptideTags("bpc-157")).toEqual(["bpc-157"]);
  });

  it("handles synonyms (body-protective-compound-157)", () => {
    expect(slugToPeptideTags("body-protective-compound-157")).toEqual(["bpc-157"]);
  });

  it("returns empty array for unknown slug", () => {
    expect(slugToPeptideTags("nonexistent-peptide")).toEqual([]);
  });

  it("is case-insensitive on input", () => {
    expect(slugToPeptideTags("BPC-157")).toEqual(["bpc-157"]);
  });
});
