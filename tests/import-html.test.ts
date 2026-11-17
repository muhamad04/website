import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, htmlToStructuredText } from "@/lib/import/html";

describe("DOCX HTML to structured text", () => {
  it("turns ordered lists into numbered lines", () => {
    const text = htmlToStructuredText(
      "<p>Unit 3 Quiz</p><ol><li>Choose the correct answer.</li><li>Write the past tense.</li></ol>",
    );

    expect(text).toBe(
      "Unit 3 Quiz\n1. Choose the correct answer.\n2. Write the past tense.",
    );
  });

  it("keeps nested and unordered lists distinguishable", () => {
    const text = htmlToStructuredText(
      "<ol><li>Question<ul><li>note</li></ul></li></ol>",
    );

    expect(text).toContain("1. Question");
    expect(text).toContain("• note");
  });

  it("converts table rows into pipe-separated lines", () => {
    const text = htmlToStructuredText(
      "<table><tr><td>cat</td><td>a small animal</td></tr><tr><td>dog</td><td>a loyal pet</td></tr></table>",
    );

    expect(text).toBe("cat | a small animal\ndog | a loyal pet");
  });

  it("decodes entities and collapses empty paragraphs", () => {
    expect(decodeHtmlEntities("True &amp; false &lt;here&gt; &#65;")).toBe(
      "True & false <here> A",
    );
    expect(
      htmlToStructuredText("<p>one</p><p></p><p></p><p>two</p>"),
    ).toBe("one\ntwo");
  });
});
