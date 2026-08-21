import { brandMark } from "@/lib/reports/report-brand-mark";

export type ReportPdfCompetency = {
  label: string;
  score: number;
  level: "strong" | "developing" | "missing";
};

export type ReportPdfBriefing = {
  verdict: string;
  trend: string;
  summaryText: string;
  strongestLabel: string;
  strongestText: string;
  gapLabel: string;
  gapText: string;
  pressureText: string;
  nextAction: string;
  latestText: string | null;
  history: string[];
  readinessScore: number | null;
  competencyBars: ReportPdfCompetency[];
  /** Cover page only; either may be blank when the profile has no resume yet. */
  candidateName: string;
  candidateDiscipline: string;
};

type PdfColor = [number, number, number];

/**
 * Colors lifted straight from the live app (globals.css / progress-view.tsx)
 * instead of inventing a separate PDF palette. `mix` reproduces what a
 * `text-cream/NN` or `bg-cream/[.NN]` Tailwind utility actually looks like,
 * since this canvas has no real alpha compositing.
 */
const bg: PdfColor = [54, 87, 180]; // #3657b4 — app background
const cream: PdfColor = [241, 234, 216]; // #f1ead8
const mint: PdfColor = [155, 232, 193]; // #9be8c1
const track: PdfColor = [30, 60, 136]; // #1e3c88 — bar track, same as progress view
const coral: PdfColor = [240, 163, 163]; // #f0a3a3 — the "needs work" tint

function mix(base: PdfColor, overlay: PdfColor, alpha: number): PdfColor {
  return [
    base[0] + (overlay[0] - base[0]) * alpha,
    base[1] + (overlay[1] - base[1]) * alpha,
    base[2] + (overlay[2] - base[2]) * alpha
  ];
}

const ink = {
  heading: cream,
  body: mix(bg, cream, 0.74),
  meta: mix(bg, cream, 0.5),
  label: mix(bg, cream, 0.42),
  icon: mix(bg, cream, 0.55),
  hairline: mix(bg, cream, 0.14),
  panel: mix(bg, cream, 0.05),
  panelLine: mix(bg, cream, 0.18),
  ghost: mix(bg, cream, 0.08)
};

/**
 * Taller than Letter on purpose. The report reads as one uninterrupted
 * question-and-answer column, and squeezing that into 792pt either shrinks the
 * type or spills onto a mostly empty second page.
 */
const PAGE_W = 612;
const PAGE_H = 1130;
const MARGIN = 56;
const RIGHT = PAGE_W - MARGIN;
const TEXT_X = MARGIN + 34;
const TEXT_W = RIGHT - TEXT_X;

const HEADER_H = 82;
const INTRO_TOP = 116;
const CONTENT_TOP = 190;
const FOOTER_RULE = PAGE_H - 66;
const CONTENT_BOTTOM = FOOTER_RULE - 26;
const MIN_GAP = 18;
const MAX_GAP = 38;

/** One scale for the whole document, so the rhythm stays even. */
const type = {
  body: { size: 10.5, leading: 16.5 },
  meta: { size: 10, leading: 15.5 },
  verdict: { size: 16.5, leading: 23 },
  action: { size: 13, leading: 19 },
  heading: 12.5,
  title: 12.5
};

/** Space between a section's heading baseline block and its first line. */
const HEADING_H = 28;

type Section = { height: number; draw: (top: number) => void };

type LayoutOptions = {
  historyRows: number;
  signalLines: number;
  stackedSignals: boolean;
  summaryLines: number;
  bars: number;
};

/**
 * Applied in order until the column fits the page. Layout changes come before
 * losing words, so the copy is only trimmed once side-by-side signals are not
 * enough on their own.
 */
const COMPRESSION: LayoutOptions[] = [
  { historyRows: 3, signalLines: 2, stackedSignals: true, summaryLines: 2, bars: 4 },
  { historyRows: 2, signalLines: 2, stackedSignals: true, summaryLines: 2, bars: 4 },
  { historyRows: 2, signalLines: 2, stackedSignals: false, summaryLines: 2, bars: 4 },
  { historyRows: 2, signalLines: 1, stackedSignals: false, summaryLines: 2, bars: 4 },
  { historyRows: 1, signalLines: 1, stackedSignals: false, summaryLines: 1, bars: 2 }
];

export function createThemedReportPdf(briefing: ReportPdfBriefing) {
  return buildPdf([drawCoverPage(briefing), drawReportPage(briefing)]);
}

/* ----------------------------------------------------------- cover page */

function drawCoverPage(briefing: ReportPdfBriefing) {
  const commands: string[] = [];
  fillRect(commands, 0, 0, PAGE_W, PAGE_H, bg);

  const center = PAGE_W / 2;
  const mark = 52;
  const name = fit(briefing.candidateName, 18, false, TEXT_W);
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // One centred block rather than content pinned to the page edges, so the
  // whole cover reads as a single lockup.
  const blockHeight =
    mark + 26 + 13 + 34 + 2 + 42 + 27 + 24 + (name ? 18 + 34 : 0) + (briefing.candidateDiscipline ? 12 + 10 : 0) + 12 + 40 + 10.5;
  // Sits above the mathematical centre: a block centred by measurement on a
  // page this tall reads as sinking.
  let y = Math.round((PAGE_H - blockHeight) * 0.42);

  drawImage(commands, "Im0", center - mark / 2, y, mark, mark);
  y += mark + 26;

  drawTextCentered(commands, center, pdfY(y + 13), "TRAILGRAD", 13, "F2", cream, 3.4);
  y += 13 + 34;

  fillRect(commands, center - 22, pdfY(y + 2), 44, 2, mint);
  y += 2 + 42;

  drawTextCentered(commands, center, pdfY(y + 27), "Interview Readiness Report", 27, "F2", ink.heading);
  y += 27 + 24;

  if (name) {
    drawTextCentered(commands, center, pdfY(y + 18), name, 18, "F1", ink.body);
    y += 18 + 34;
  }

  if (briefing.candidateDiscipline) {
    drawTextCentered(commands, center, pdfY(y + 12), briefing.candidateDiscipline, 12, "F2", ink.meta);
    y += 12 + 10;
  }

  drawTextCentered(commands, center, pdfY(y + 12), date, 12, "F1", ink.meta);
  y += 12 + 40;

  drawTextCentered(commands, center, pdfY(y + 10.5), "Prepared by Maya", 10.5, "F1", ink.meta, 1);

  return commands.join("\n");
}

/* ---------------------------------------------------------- report page */

function drawReportPage(briefing: ReportPdfBriefing) {
  const commands: string[] = [];
  fillRect(commands, 0, 0, PAGE_W, PAGE_H, bg);

  drawHeader(commands);
  drawIntro(commands);

  const budget = CONTENT_BOTTOM - CONTENT_TOP;
  let sections: Section[] = [];
  for (const options of COMPRESSION) {
    sections = buildSections(commands, briefing, options);
    if (columnHeight(sections, MIN_GAP) <= budget) break;
  }

  // Any room left over is spread through the dividers so the column always
  // reaches the footer instead of trailing off mid-page.
  const used = sections.reduce((total, section) => total + section.height, 0);
  const gaps = Math.max(sections.length - 1, 1);
  const gap = clamp((budget - used) / gaps, MIN_GAP, MAX_GAP);

  let cursor = CONTENT_TOP;
  sections.forEach((section, index) => {
    section.draw(cursor);
    cursor += section.height;
    if (index < sections.length - 1) {
      drawRule(commands, cursor + gap / 2, MARGIN, RIGHT);
      cursor += gap;
    }
  });

  drawFooter(commands);
  return commands.join("\n");
}

function columnHeight(sections: Section[], gap: number) {
  return sections.reduce((total, section) => total + section.height, 0) + (sections.length - 1) * gap;
}

/* --------------------------------------------------------------- header */

function drawHeader(commands: string[]) {
  // No tint band here: the mark's transparency is flattened onto the page
  // colour, so any shade behind it would show as a square around the icon.
  drawRule(commands, HEADER_H, 0, PAGE_W);
  drawImage(commands, "Im0", MARGIN, 26, 30, 30);
  drawText(commands, MARGIN + 40, pdfY(46), "TRAILGRAD", 11.5, "F2", cream, 2.2);
}

function drawIntro(commands: string[]) {
  drawWaveMark(commands, RIGHT - 62, 140, 0.72, ink.ghost);

  drawText(commands, MARGIN, pdfY(INTRO_TOP + 9), "INTERVIEW READINESS REPORT", 8.5, "F2", ink.label, 2);

  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const lead = "Generated by Maya";
  drawText(commands, MARGIN, pdfY(INTRO_TOP + 32), lead, 9.5, "F1", ink.meta);
  const dotX = MARGIN + measure(lead, 9.5, false) + 9;
  fillCircle(commands, dotX, INTRO_TOP + 28.5, 1.4, ink.label);
  drawText(commands, dotX + 9, pdfY(INTRO_TOP + 32), date, 9.5, "F2", ink.meta);
}

/* ------------------------------------------------------------- sections */

function buildSections(commands: string[], briefing: ReportPdfBriefing, options: LayoutOptions): Section[] {
  return [
    meaningSection(commands, briefing, options),
    readinessSection(commands, briefing, options),
    signalsSection(commands, briefing, options),
    pressureSection(commands, briefing),
    nextSection(commands, briefing),
    latestSection(commands, briefing),
    historySection(commands, briefing, options)
  ];
}

function meaningSection(commands: string[], briefing: ReportPdfBriefing, options: LayoutOptions): Section {
  const verdict = wrapClamped(briefing.verdict, TEXT_W, type.verdict.size, true, 2);
  const trend = wrapClamped(
    `Maya would put it simply: ${briefing.trend}`,
    TEXT_W,
    type.body.size,
    false,
    options.summaryLines
  );
  const strongest = wrapRuns(
    [
      { text: "Your strongest signal is", color: ink.body },
      { text: `${briefing.strongestLabel}.`, color: mint, bold: true }
    ],
    TEXT_W,
    type.body.size
  ).slice(0, 2);
  const gapRuns = wrapRuns(
    [
      { text: "The repeat gap is", color: ink.body },
      { text: `${briefing.gapLabel}.`, color: coral, bold: true }
    ],
    TEXT_W,
    type.body.size
  ).slice(0, 2);

  const height =
    HEADING_H +
    verdict.length * type.verdict.leading +
    14 +
    trend.length * type.body.leading +
    14 +
    (strongest.length + gapRuns.length) * type.body.leading;

  return {
    height,
    draw(top) {
      let y = drawHeading(commands, top, "What does this report mean?", drawIconChat);
      y = drawLines(commands, TEXT_X, y, verdict, type.verdict, "F2", ink.heading) + 14;
      y = drawLines(commands, TEXT_X, y, trend, type.body, "F1", ink.body) + 14;
      [...strongest, ...gapRuns].forEach((line, index) => {
        drawRunLine(commands, TEXT_X, pdfY(y + type.body.size + index * type.body.leading), line, type.body.size);
      });
    }
  };
}

/** Draws stacked lines from a top edge and returns the y the block ends at. */
function drawLines(
  commands: string[],
  x: number,
  top: number,
  lines: string[],
  scale: { size: number; leading: number },
  font: "F1" | "F2",
  color: PdfColor
) {
  lines.forEach((line, index) => {
    drawText(commands, x, pdfY(top + scale.size + index * scale.leading), line, scale.size, font, color);
  });
  return top + lines.length * scale.leading;
}

function readinessSection(commands: string[], briefing: ReportPdfBriefing, options: LayoutOptions): Section {
  const score = briefing.readinessScore;
  const bars = briefing.competencyBars.slice(0, options.bars);
  const barRows = Math.ceil(bars.length / 2);

  // Without a score the section says so in Maya's voice rather than showing an
  // empty meter, which reads as a zero.
  const pending = wrapClamped(
    "Don't worry about a number yet. You are progressing, and Maya keeps evaluating your readiness across every round you run.",
    TEXT_W,
    type.body.size,
    false,
    2
  );
  const caption =
    score == null
      ? null
      : score >= 78
        ? "That is a strong signal across your recent rounds."
        : score >= 55
          ? "That is a developing signal across your recent rounds."
          : "That is an early signal across your recent rounds.";
  const fallback = bars.length ? null : "Competency scores appear here once your next round is scored.";

  const scoreBlock = score == null ? pending.length * type.body.leading : 34 + type.meta.leading;
  const height = HEADING_H + scoreBlock + 16 + (fallback ? type.meta.leading : barRows * 38);

  return {
    height,
    draw(top) {
      let y = drawHeading(commands, top, "How ready are you overall?", drawIconChart);

      if (score == null) {
        y = drawLines(commands, TEXT_X, y, pending, type.body, "F1", ink.body) + 16;
      } else {
        const label = String(score);
        drawText(commands, TEXT_X, pdfY(y + 27), label, 27, "F2", cream);
        drawText(commands, TEXT_X + measure(label, 27, true) + 8, pdfY(y + 27), "/ 100", 13, "F1", ink.meta);
        y += 34;
        drawText(commands, TEXT_X, pdfY(y + type.meta.size), caption ?? "", type.meta.size, "F1", ink.meta);
        y += type.meta.leading + 16;
      }

      if (fallback) {
        drawText(commands, TEXT_X, pdfY(y + type.meta.size), fallback, type.meta.size, "F1", ink.meta);
        return;
      }

      const colGap = 26;
      const colW = (TEXT_W - colGap) / 2;
      bars.forEach((item, index) => {
        const x = TEXT_X + (index % 2) * (colW + colGap);
        const rowY = y + Math.floor(index / 2) * 38;
        const percent = `${item.score}%`;
        const room = colW - measure(percent, 10, false) - 18;
        const fill = item.level === "strong" ? mint : item.level === "missing" ? coral : ink.body;

        drawText(commands, x, pdfY(rowY + 9.5), fit(item.label, 9.5, true, room), 9.5, "F2", ink.heading);
        drawTextRight(commands, x + colW, pdfY(rowY + 9.5), percent, 10, "F1", ink.meta);
        drawPercentBar(commands, x, rowY + 16, colW, 5, item.score, track, fill);
      });
    }
  };
}

function signalsSection(commands: string[], briefing: ReportPdfBriefing, options: LayoutOptions): Section {
  const colGap = 28;
  const width = options.stackedSignals ? TEXT_W : (TEXT_W - colGap) / 2;
  const strong = wrapClamped(briefing.strongestText, width, type.body.size, false, options.signalLines);
  const gap = wrapClamped(briefing.gapText, width, type.body.size, false, options.signalLines);
  const blockHeight = (lines: number) => 14 + 20 + lines * type.body.leading;
  const height = options.stackedSignals
    ? HEADING_H + blockHeight(strong.length) + 20 + blockHeight(gap.length)
    : HEADING_H + Math.max(blockHeight(strong.length), blockHeight(gap.length));

  return {
    height,
    draw(top) {
      const y = drawHeading(commands, top, "What are your key signals?", drawIconTarget);
      const secondX = options.stackedSignals ? TEXT_X : TEXT_X + width + colGap;
      const secondY = options.stackedSignals ? y + blockHeight(strong.length) + 20 : y;

      drawSignalBlock(commands, TEXT_X, y, "Strongest signal", briefing.strongestLabel, strong, mint, width);
      drawSignalBlock(commands, secondX, secondY, "Repeat gap", briefing.gapLabel, gap, coral, width);
    }
  };
}

function drawSignalBlock(
  commands: string[],
  x: number,
  top: number,
  label: string,
  title: string,
  lines: string[],
  accent: PdfColor,
  width: number
) {
  fillCircle(commands, x + 3, top + 4.5, 3, accent);
  drawText(commands, x + 13, pdfY(top + 8), label, 9.5, "F2", accent);
  drawText(commands, x, pdfY(top + 28), fit(title, type.title, true, width), type.title, "F2", ink.heading);
  drawLines(commands, x, top + 34, lines, type.body, "F1", ink.body);
}

function pressureSection(commands: string[], briefing: ReportPdfBriefing): Section {
  const lines = wrapClamped(briefing.pressureText, TEXT_W, type.body.size, false, 2);
  return {
    height: HEADING_H + lines.length * type.body.leading,
    draw(top) {
      const y = drawHeading(commands, top, "How did Maya need to probe you?", drawIconPulse);
      drawLines(commands, TEXT_X, y, lines, type.body, "F1", ink.body);
    }
  };
}

function nextSection(commands: string[], briefing: ReportPdfBriefing): Section {
  const padding = 20;
  const lines = wrapClamped(briefing.nextAction, TEXT_W - padding * 2 - 8, type.action.size, true, 2);
  const panelHeight = padding * 2 + (lines.length - 1) * type.action.leading + type.action.size + 3;

  return {
    height: HEADING_H + panelHeight,
    draw(top) {
      const y = drawHeading(commands, top, "What should you do next?", drawIconRocket);
      fillRoundedRect(commands, TEXT_X, y, TEXT_W, panelHeight, 10, ink.panel);
      strokeRoundedRect(commands, TEXT_X, y, TEXT_W, panelHeight, 10, ink.panelLine, 1);
      fillRect(commands, TEXT_X, pdfY(y + panelHeight - 10), 2.5, panelHeight - 20, mint);
      drawDotField(commands, RIGHT - 96, y + panelHeight / 2 - 16, 8, 4, ink.ghost);
      drawLines(commands, TEXT_X + padding + 8, y + padding, lines, type.action, "F2", ink.heading);
    }
  };
}

function latestSection(commands: string[], briefing: ReportPdfBriefing): Section {
  const lines = wrapClamped(
    briefing.latestText ?? "Waiting for your next completed round.",
    TEXT_W,
    type.body.size,
    false,
    2
  );
  return {
    height: HEADING_H + lines.length * type.body.leading,
    draw(top) {
      const y = drawHeading(commands, top, "What's the latest round?", drawIconCalendar);
      drawLines(commands, TEXT_X, y, lines, type.body, "F1", ink.body);
    }
  };
}

function historySection(commands: string[], briefing: ReportPdfBriefing, options: LayoutOptions): Section {
  const rows = (briefing.history.length ? briefing.history.slice(0, options.historyRows) : ["No scored history yet."])
    .map((row) => fit(row, type.body.size, false, TEXT_W));
  return {
    height: HEADING_H + rows.length * type.body.leading,
    draw(top) {
      const y = drawHeading(commands, top, "What's your round history?", drawIconClock);
      drawLines(commands, TEXT_X, y, rows, type.body, "F1", ink.body);
    }
  };
}

/* ---------------------------------------------------------- section head */

function drawHeading(
  commands: string[],
  top: number,
  text: string,
  icon: (commands: string[], x: number, top: number) => void
) {
  icon(commands, MARGIN, top);
  drawText(commands, TEXT_X, pdfY(top + type.heading), text, type.heading, "F2", ink.heading);
  return top + HEADING_H;
}

/* --------------------------------------------------------------- footer */

function drawFooter(commands: string[]) {
  drawRule(commands, FOOTER_RULE, MARGIN, RIGHT);
  drawText(commands, MARGIN, pdfY(FOOTER_RULE + 21), "Generated by Trailgrad", 9, "F1", ink.meta);
  drawImage(commands, "Im0", RIGHT - 12, FOOTER_RULE + 12, 12, 12);
  drawTextRight(commands, RIGHT - 20, pdfY(FOOTER_RULE + 21), "trailgrad.com", 9, "F2", ink.meta);
}

/* ----------------------------------------------------------------- icons */

/** 15pt line-art glyphs, drawn to sit next to a 12.5pt heading. */
function drawIconChat(commands: string[], x: number, top: number) {
  strokeRoundedRect(commands, x, top + 1, 15, 12, 3.5, ink.icon, 1.1);
  strokeLine(commands, x + 4, pdfY(top + 13), x + 4, pdfY(top + 16.5), ink.icon, 1.1);
  strokeLine(commands, x + 4, pdfY(top + 16.5), x + 8, pdfY(top + 13), ink.icon, 1.1);
}

function drawIconChart(commands: string[], x: number, top: number) {
  strokeLine(commands, x + 1.5, pdfY(top + 15), x + 1.5, pdfY(top + 9), ink.icon, 2);
  strokeLine(commands, x + 6.5, pdfY(top + 15), x + 6.5, pdfY(top + 3), ink.icon, 2);
  strokeLine(commands, x + 11.5, pdfY(top + 15), x + 11.5, pdfY(top + 7), ink.icon, 2);
}

function drawIconTarget(commands: string[], x: number, top: number) {
  strokeCircle(commands, x + 7.5, top + 8.5, 7, ink.icon, 1.1);
  strokeCircle(commands, x + 7.5, top + 8.5, 3.2, ink.icon, 1.1);
  fillCircle(commands, x + 7.5, top + 8.5, 1.2, ink.icon);
}

function drawIconPulse(commands: string[], x: number, top: number) {
  const points: Array<[number, number]> = [
    [0, 9],
    [3.5, 9],
    [5.5, 3],
    [8.5, 14],
    [10.5, 9],
    [15, 9]
  ];
  points.slice(1).forEach(([px, py], index) => {
    const [prevX, prevY] = points[index]!;
    strokeLine(commands, x + prevX, pdfY(top + prevY), x + px, pdfY(top + py), ink.icon, 1.2);
  });
}

function drawIconRocket(commands: string[], x: number, top: number) {
  strokeLine(commands, x + 1, pdfY(top + 14), x + 13, pdfY(top + 2), ink.icon, 1.2);
  strokeLine(commands, x + 13, pdfY(top + 2), x + 6.5, pdfY(top + 3.5), ink.icon, 1.2);
  strokeLine(commands, x + 13, pdfY(top + 2), x + 11.5, pdfY(top + 8.5), ink.icon, 1.2);
  strokeLine(commands, x + 1, pdfY(top + 9), x + 4, pdfY(top + 9), ink.icon, 1.2);
}

function drawIconCalendar(commands: string[], x: number, top: number) {
  strokeRoundedRect(commands, x, top + 2, 15, 13, 3, ink.icon, 1.1);
  strokeLine(commands, x, pdfY(top + 6.5), x + 15, pdfY(top + 6.5), ink.icon, 1.1);
  strokeLine(commands, x + 4.5, pdfY(top), x + 4.5, pdfY(top + 3.5), ink.icon, 1.2);
  strokeLine(commands, x + 10.5, pdfY(top), x + 10.5, pdfY(top + 3.5), ink.icon, 1.2);
}

function drawIconClock(commands: string[], x: number, top: number) {
  strokeCircle(commands, x + 7.5, top + 8.5, 7, ink.icon, 1.1);
  strokeLine(commands, x + 7.5, pdfY(top + 8.5), x + 7.5, pdfY(top + 4.5), ink.icon, 1.2);
  strokeLine(commands, x + 7.5, pdfY(top + 8.5), x + 10.5, pdfY(top + 8.5), ink.icon, 1.2);
}

/* ------------------------------------------------------------ pdf core */

function buildPdf(pages: string[]) {
  const mark = `${brandMark.data}>`; // ASCIIHexDecode reads up to the > terminator
  const count = pages.length;
  // 1 catalog, 2 page tree, then one dict per page, both fonts, one content
  // stream per page, and the shared brand mark last.
  const pageObj = (index: number) => 3 + index;
  const fontRegular = 3 + count;
  const fontBold = fontRegular + 1;
  const contentObj = (index: number) => fontBold + 1 + index;
  const imageObj = fontBold + 1 + count;
  const resources = `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> /XObject << /Im0 ${imageObj} 0 R >> >>`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObj(index)} 0 R`).join(" ")}] /Count ${count} >>`,
    ...pages.map(
      (_, index) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${resources} /Contents ${contentObj(index)} 0 R >>`
    ),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...pages.map((content) => `<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    `<< /Type /XObject /Subtype /Image /Width ${brandMark.width} /Height ${brandMark.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${mark.length} >>\nstream\n${mark}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

/* --------------------------------------------------------- draw atoms */

/** Places an image XObject in a `width x height` box with its top edge at `top`. */
function drawImage(commands: string[], name: string, x: number, top: number, width: number, height: number) {
  commands.push(
    "q",
    `${formatNumber(width)} 0 0 ${formatNumber(height)} ${formatNumber(x)} ${formatNumber(pdfY(top + height))} cm`,
    `/${name} Do`,
    "Q"
  );
}

function drawWaveMark(commands: string[], centerX: number, centerYTop: number, scale: number, color: PdfColor) {
  const centerY = pdfY(centerYTop);
  const heights = [16, 28, 44, 60, 74, 44, 58, 32, 48, 70, 38, 24];
  strokeLine(commands, centerX - 64 * scale, centerY, centerX - 48 * scale, centerY, color, 1.1 * scale);
  strokeLine(commands, centerX + 48 * scale, centerY, centerX + 64 * scale, centerY, color, 1.1 * scale);
  heights.forEach((height, index) => {
    const x = centerX - 36 * scale + index * 7 * scale;
    strokeLine(commands, x, centerY - (height * scale) / 2, x, centerY + (height * scale) / 2, color, 2 * scale);
  });
}

function drawRule(commands: string[], top: number, x1: number, x2: number) {
  strokeLine(commands, x1, pdfY(top), x2, pdfY(top), ink.hairline, 1);
}

function drawPercentBar(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  percent: number,
  trackColor: PdfColor,
  fillColor: PdfColor
) {
  const clamped = clamp(percent, 0, 100);
  fillRoundedRect(commands, x, top, width, height, height / 2, trackColor);
  if (clamped > 0) {
    fillRoundedRect(commands, x, top, Math.min(Math.max(height, (clamped / 100) * width), width), height, height / 2, fillColor);
  }
}

/** The faint dot texture the reports panels use, for the "do next" callout. */
function drawDotField(commands: string[], x: number, top: number, cols: number, rows: number, color: PdfColor) {
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      fillCircle(commands, x + col * 9, top + row * 9, 1, color);
    }
  }
}

function roundedRectPath(x: number, top: number, width: number, height: number, radius: number) {
  const y = pdfY(top + height);
  const r = Math.min(radius, width / 2, height / 2);
  const right = x + width;
  const topY = y + height;
  const k = 0.5522847498;
  return [
    `${formatNumber(x + r)} ${formatNumber(y)} m`,
    `${formatNumber(right - r)} ${formatNumber(y)} l`,
    `${formatNumber(right - r + r * k)} ${formatNumber(y)} ${formatNumber(right)} ${formatNumber(y + r - r * k)} ${formatNumber(right)} ${formatNumber(y + r)} c`,
    `${formatNumber(right)} ${formatNumber(topY - r)} l`,
    `${formatNumber(right)} ${formatNumber(topY - r + r * k)} ${formatNumber(right - r + r * k)} ${formatNumber(topY)} ${formatNumber(right - r)} ${formatNumber(topY)} c`,
    `${formatNumber(x + r)} ${formatNumber(topY)} l`,
    `${formatNumber(x + r - r * k)} ${formatNumber(topY)} ${formatNumber(x)} ${formatNumber(topY - r + r * k)} ${formatNumber(x)} ${formatNumber(topY - r)} c`,
    `${formatNumber(x)} ${formatNumber(y + r)} l`,
    `${formatNumber(x)} ${formatNumber(y + r - r * k)} ${formatNumber(x + r - r * k)} ${formatNumber(y)} ${formatNumber(x + r)} ${formatNumber(y)} c`,
    "h"
  ];
}

function fillRoundedRect(commands: string[], x: number, top: number, width: number, height: number, radius: number, color: PdfColor) {
  commands.push(`${rgb(color)} rg`, ...roundedRectPath(x, top, width, height, radius), "f");
}

function strokeRoundedRect(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  color: PdfColor,
  lineWidth: number
) {
  commands.push(`${rgb(color)} RG ${formatNumber(lineWidth)} w`, ...roundedRectPath(x, top, width, height, radius), "S");
}

function circlePath(cx: number, cy: number, r: number) {
  const k = r * 0.5522847498;
  return [
    `${formatNumber(cx + r)} ${formatNumber(cy)} m`,
    `${formatNumber(cx + r)} ${formatNumber(cy + k)} ${formatNumber(cx + k)} ${formatNumber(cy + r)} ${formatNumber(cx)} ${formatNumber(cy + r)} c`,
    `${formatNumber(cx - k)} ${formatNumber(cy + r)} ${formatNumber(cx - r)} ${formatNumber(cy + k)} ${formatNumber(cx - r)} ${formatNumber(cy)} c`,
    `${formatNumber(cx - r)} ${formatNumber(cy - k)} ${formatNumber(cx - k)} ${formatNumber(cy - r)} ${formatNumber(cx)} ${formatNumber(cy - r)} c`,
    `${formatNumber(cx + k)} ${formatNumber(cy - r)} ${formatNumber(cx + r)} ${formatNumber(cy - k)} ${formatNumber(cx + r)} ${formatNumber(cy)} c`,
    "h"
  ];
}

function fillCircle(commands: string[], x: number, top: number, r: number, color: PdfColor) {
  commands.push(`${rgb(color)} rg`, ...circlePath(x, pdfY(top), r), "f");
}

function strokeCircle(commands: string[], x: number, top: number, r: number, color: PdfColor, lineWidth: number) {
  commands.push(`${rgb(color)} RG ${formatNumber(lineWidth)} w`, ...circlePath(x, pdfY(top), r), "S");
}

function fillRect(commands: string[], x: number, y: number, width: number, height: number, color: PdfColor) {
  commands.push(`${rgb(color)} rg ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re f`);
}

function strokeLine(commands: string[], x1: number, y1: number, x2: number, y2: number, color: PdfColor, width: number) {
  commands.push(
    `${rgb(color)} RG ${formatNumber(width)} w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`
  );
}

function drawText(
  commands: string[],
  x: number,
  y: number,
  value: string,
  size: number,
  font: "F1" | "F2",
  color: PdfColor,
  charSpacing = 0
) {
  commands.push(
    "BT",
    `${rgb(color)} rg`,
    `/${font} ${formatNumber(size)} Tf`,
    `${formatNumber(charSpacing)} Tc`,
    `1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm`,
    `(${escapePdfText(value)}) Tj`,
    "ET"
  );
}

function drawTextRight(commands: string[], xEnd: number, y: number, value: string, size: number, font: "F1" | "F2", color: PdfColor) {
  drawText(commands, xEnd - measure(value, size, font === "F2"), y, value, size, font, color);
}

function drawTextCentered(
  commands: string[],
  centerX: number,
  y: number,
  value: string,
  size: number,
  font: "F1" | "F2",
  color: PdfColor,
  charSpacing = 0
) {
  // Tracking widens the run by one extra space after every glyph, and the
  // trailing one is not painted, so it does not count toward the centred width.
  const width = measure(value, size, font === "F2") + charSpacing * Math.max(value.length - 1, 0);
  drawText(commands, centerX - width / 2, y, value, size, font, color, charSpacing);
}

/* ------------------------------------------------------------ text flow */

type Run = { text: string; color: PdfColor; bold?: boolean };

/** Word wrap on real glyph width, capped at `maxLines` with an ellipsis. */
function wrapClamped(value: string, width: number, size: number, bold: boolean, maxLines: number) {
  const lines = wrapPdfLine(value, width, size, bold);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(`${kept[maxLines - 1]}...`, size, bold, width);
  return kept;
}

function wrapPdfLine(line: string, width: number, size: number, bold: boolean) {
  if (!line) return [""];
  const lines: string[] = [];
  let current = "";
  line.split(" ").forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (measure(next, size, bold) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

/** Wraps a styled sentence, keeping each word's own color and weight. */
function wrapRuns(runs: Run[], width: number, size: number): Run[][] {
  const words: Run[] = [];
  runs.forEach((run) => {
    run.text
      .split(" ")
      .filter(Boolean)
      .forEach((word) => words.push({ ...run, text: word }));
  });

  const lines: Run[][] = [];
  let line: Run[] = [];
  let lineWidth = 0;
  words.forEach((word) => {
    const wordWidth = measure(word.text, size, word.bold ?? false);
    const spaceWidth = line.length ? measure(" ", size, false) : 0;
    if (line.length && lineWidth + spaceWidth + wordWidth > width) {
      lines.push(line);
      line = [word];
      lineWidth = wordWidth;
    } else {
      line.push(word);
      lineWidth += spaceWidth + wordWidth;
    }
  });
  if (line.length) lines.push(line);
  return lines;
}

function drawRunLine(commands: string[], x: number, y: number, line: Run[], size: number) {
  let cursor = x;
  line.forEach((run, index) => {
    if (index) cursor += measure(" ", size, false);
    drawText(commands, cursor, y, run.text, size, run.bold ? "F2" : "F1", run.color);
    cursor += measure(run.text, size, run.bold ?? false);
  });
}

/** Truncates a single line to fit `width`, adding an ellipsis when it has to cut. */
function fit(value: string, size: number, bold: boolean, width: number) {
  if (measure(value, size, bold) <= width) return value;
  let cut = value;
  while (cut.length > 1 && measure(`${cut}...`, size, bold) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}...`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pdfY(top: number) {
  return PAGE_H - top;
}

function rgb(color: PdfColor) {
  return color.map((value) => formatNumber(clamp(value, 0, 255) / 255)).join(" ");
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function escapePdfText(value: string) {
  return value
    .replace(/[·•]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/* --------------------------------------------------------- glyph widths */

// Standard Helvetica AFM advance widths (per 1000 em units), so wrapping and
// right-alignment match what the viewer actually renders.
const HELVETICA_WIDTHS: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556,
  M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222,
  m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  "{": 334, "|": 260, "}": 334, "~": 584
};

const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
  ...HELVETICA_WIDTHS,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, J: 556, K: 722, L: 611,
  N: 722, P: 667, Q: 778, R: 722, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278,
  m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500
};

function measure(value: string, size: number, bold: boolean) {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let units = 0;
  for (const char of value) units += table[char] ?? 556;
  return (units / 1000) * size;
}
