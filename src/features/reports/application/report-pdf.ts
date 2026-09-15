import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ReportPdfCompetency = {
  label: string;
  score: number;
  level: "strong" | "developing" | "missing";
  evidence?: string;
  nextAction?: string;
};

export type ReportPdfFamily = {
  label: string;
  aggregateScore: number | null;
  rounds: number;
};

export type ReportPdfBriefing = {
  overallFamilies: ReportPdfFamily[];
  roundScore: number | null;
  scoreExplanation: string;
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
  candidateName: string;
  candidateDiscipline: string;
};

type PdfColor = readonly [number, number, number];

const PAGE = { width: 595.28, height: 841.89, margin: 56, footer: 44 };
const palette = {
  graphite: [255, 255, 255] as PdfColor,
  cream: [17, 24, 39] as PdfColor,
  body: [71, 85, 105] as PdfColor,
  muted: [100, 116, 139] as PdfColor,
  rule: [226, 232, 240] as PdfColor
};

const RALEWAY_REGULAR_URL = "https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaooCP.ttf";
const RALEWAY_SEMIBOLD_URL = "https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVsEpYCP.ttf";
let ralewayRegularBytes: Promise<ArrayBuffer> | undefined;
let ralewaySemiboldBytes: Promise<ArrayBuffer> | undefined;

/** Embeds the same Raleway family used by the workspace in every export. */
function loadFont(url: string) {
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error("Unable to load the Trailgrad report font.");
    return response.arrayBuffer();
  });
}

async function loadRaleway() {
  ralewayRegularBytes ??= loadFont(RALEWAY_REGULAR_URL);
  ralewaySemiboldBytes ??= loadFont(RALEWAY_SEMIBOLD_URL);
  return Promise.all([ralewayRegularBytes, ralewaySemiboldBytes]);
}

export async function createThemedReportPdf(briefing: ReportPdfBriefing) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);

  const [ralewayRegular, ralewaySemibold] = await loadRaleway();
  const regular = await document.embedFont(ralewayRegular, { subset: true });
  const bold = await document.embedFont(ralewaySemibold, { subset: true });
  document.setTitle("Trailgrad interview performance report");
  document.setAuthor("Trailgrad");
  document.setSubject("Interview performance feedback prepared by Maya");

  const writer = new ReportWriter(document, regular, bold);
  writer.startPage();
  drawReport(writer, briefing);
  writer.finish();
  return document.save();
}

class ReportWriter {
  private page!: PDFPage;
  private y = 0;
  private pages: PDFPage[] = [];

  constructor(
    private readonly document: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont
  ) {}

  startPage() {
    this.page = this.document.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: color(palette.graphite) });
    this.y = PAGE.height - PAGE.margin;
    this.drawHeader();
  }

  ensure(height: number) {
    if (this.y - height < PAGE.footer + 18) this.startPage();
  }

  get remaining() {
    return this.y - PAGE.footer;
  }

  gap(height: number) {
    this.y -= height;
  }

  rule() {
    this.ensure(18);
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 0.75,
      color: color(palette.rule)
    });
    this.gap(18);
  }

  label(value: string, accent = palette.muted) {
    this.ensure(16);
    this.draw(value.toUpperCase(), PAGE.margin, this.y, 8.5, this.bold, accent);
    this.gap(17);
  }

  heading(value: string) {
    this.ensure(31);
    this.draw(value, PAGE.margin, this.y, 20, this.bold, palette.cream);
    this.gap(31);
  }

  title(value: string) {
    const lines = wrap(value, this.bold, 34, contentWidth());
    this.ensure(lines.length * 38 + 14);
    this.lines(lines, 34, 38, this.bold, palette.cream);
    this.gap(5);
  }

  paragraph(value: string, options?: { size?: number; color?: PdfColor; leading?: number; font?: PDFFont; after?: number }) {
    const size = options?.size ?? 11.5;
    const leading = options?.leading ?? size * 1.5;
    const lines = wrap(value, options?.font ?? this.regular, size, contentWidth());
    this.lines(lines, size, leading, options?.font ?? this.regular, options?.color ?? palette.body);
    this.gap(options?.after ?? 10);
  }

  scoreRow(scores: ReportPdfCompetency[]) {
    const items = scores.length ? scores.slice(0, 6) : fallbackScores();
    const width = contentWidth() / 2;
    const rows = Math.ceil(items.length / 2);
    this.ensure(rows * 44 + 8);
    items.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = PAGE.margin + column * width;
      const y = this.y - row * 44;
      this.draw(String(Math.round(item.score)), x, y, 21, this.bold, palette.cream);
      this.draw(item.label.toUpperCase(), x + 38, y - 3, 8.25, this.bold, palette.muted);
    });
    this.gap(rows * 44 + 2);
  }

  familyScoreRow(families: ReportPdfFamily[]) {
    const width = contentWidth() / 2;
    const rows = Math.ceil(families.length / 2);
    this.ensure(rows * 54 + 8);
    families.forEach((family, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = PAGE.margin + column * width;
      const y = this.y - row * 54;
      const score = family.aggregateScore === null ? "Not yet" : `${family.aggregateScore}/100`;
      this.draw(family.label.toUpperCase(), x, y, 8.25, this.bold, palette.muted);
      this.draw(score, x, y - 17, family.aggregateScore === null ? 12 : 19, this.bold, palette.cream);
      if (family.rounds > 0) {
        this.draw(
          `${family.rounds} scored ${family.rounds === 1 ? "interview" : "interviews"} aggregated`,
          x + 76,
          y - 20,
          8.25,
          this.regular,
          palette.muted
        );
      }
    });
    this.gap(rows * 54 + 2);
  }

  bigScore(score: number | null, explanation: string) {
    this.ensure(78);
    const scoreText = score === null ? "Not attempted yet" : String(score);
    this.draw(scoreText, PAGE.margin, this.y, score === null ? 22 : 38, this.bold, palette.cream);
    if (score !== null) {
      const scoreWidth = this.bold.widthOfTextAtSize(scoreText, 38);
      this.draw("/ 100", PAGE.margin + scoreWidth + 10, this.y - 15, 11, this.bold, palette.muted);
    }
    this.gap(49);
    this.paragraph(explanation, { size: 9.5, leading: 14, color: palette.muted, after: 12 });
  }

  finding(index: number, label: string, title: string, body: string, accent: PdfColor) {
    const titleLines = wrap(title, this.bold, 15.5, contentWidth());
    const bodyLines = wrap(body, this.regular, 11.25, contentWidth());
    this.ensure(20 + titleLines.length * 21 + bodyLines.length * 16 + 13);
    this.draw(`${String(index).padStart(2, "0")} · ${label.toUpperCase()}`, PAGE.margin, this.y, 8.5, this.bold, accent);
    this.gap(18);
    this.lines(titleLines, 15.5, 21, this.bold, palette.cream);
    this.gap(3);
    this.lines(bodyLines, 11.25, 16, this.regular, palette.body);
    this.gap(13);
  }

  draw(value: string, x: number, y: number, size: number, font: PDFFont, tone: PdfColor) {
    this.page.drawText(value, {
      x,
      y: y - size,
      size,
      font,
      color: color(tone)
    });
  }

  drawRight(value: string, y: number, size: number, font: PDFFont, tone: PdfColor) {
    const width = font.widthOfTextAtSize(value, size);
    this.draw(value, PAGE.width - PAGE.margin - width, y, size, font, tone);
  }

  lines(values: string[], size: number, leading: number, font: PDFFont, tone: PdfColor) {
    values.forEach((value) => {
      this.ensure(leading);
      this.draw(value, PAGE.margin, this.y, size, font, tone);
      this.gap(leading);
    });
  }

  finish() {
    this.pages.forEach((page, index) => {
      const footerY = PAGE.footer;
      page.drawLine({
        start: { x: PAGE.margin, y: footerY + 14 },
        end: { x: PAGE.width - PAGE.margin, y: footerY + 14 },
        thickness: 0.75,
        color: color(palette.rule)
      });
      page.drawText("Trailgrad · Interview Intelligence", {
        x: PAGE.margin, y: footerY, size: 8.5, font: this.regular, color: color(palette.muted)
      });
      const pageCount = `${index + 1} / ${this.pages.length}`;
      page.drawText(pageCount, {
        x: PAGE.width - PAGE.margin - this.regular.widthOfTextAtSize(pageCount, 8.5),
        y: footerY, size: 8.5, font: this.regular, color: color(palette.muted)
      });
    });
  }

  private drawHeader() {
    this.draw("TRAILGRAD", PAGE.margin, this.y, 9.5, this.bold, palette.cream);
    this.drawRight("INTERVIEW PERFORMANCE REPORT", this.y, 8.5, this.bold, palette.muted);
    this.gap(20);
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 0.75,
      color: color(palette.rule)
    });
    this.gap(40);
  }
}

function drawReport(writer: ReportWriter, briefing: ReportPdfBriefing) {
  const readiness = briefing.readinessScore == null ? "still forming" : `${briefing.readinessScore}`;
  const strongest = safeLabel(briefing.strongestLabel, "ownership");
  const focus = safeLabel(briefing.gapLabel, "clearer answer endings");
  const findings = buildFindings(briefing);

  writer.label("Trailgrad interview intelligence");
  writer.title("Interview performance report");
  writer.paragraph(
    `A detailed review of how effectively your interview answers communicate reasoning, ownership, and measurable value for ${displayName(briefing.candidateName)}${briefing.candidateDiscipline ? ` in ${briefing.candidateDiscipline}` : ""}.`,
    { size: 12, leading: 18, after: 28 }
  );
  writer.heading("Overall performance");
  writer.label("Aggregated score in each interview family");
  writer.familyScoreRow(briefing.overallFamilies);
  writer.rule();

  writer.heading("Detailed latest report");
  writer.label("Latest round score");
  writer.bigScore(briefing.roundScore, briefing.scoreExplanation);
  writer.label("Six evaluation parameters");
  writer.scoreRow(briefing.competencyBars);
  writer.rule();

  writer.heading("Executive assessment");
  writer.paragraph(`${briefing.summaryText} The strongest signal in this round was ${strongest}: ${briefing.strongestText}`, { after: 8 });
  writer.paragraph(`The clearest opportunity is ${focus}. ${briefing.gapText} ${briefing.pressureText}`, { after: 16 });
  writer.rule();

  writer.heading("Key findings");
  findings.forEach((finding, index) => writer.finding(index + 1, finding.label, finding.title, finding.body, finding.accent));
  writer.rule();

  writer.heading("Parameter evidence");
  briefing.competencyBars.forEach((parameter, index) =>
    writer.finding(
      index + 1,
      `${parameter.label} · ${Math.round(parameter.score)}/100`,
      `${parameter.label}: ${signalLabel(parameter.score)}.`,
      [parameter.evidence, parameter.nextAction ? `Next: ${parameter.nextAction}` : ""]
        .filter(Boolean)
        .join(" ") || "No grounded explanation was recorded for this parameter.",
      palette.muted
    )
  );
  writer.rule();

  // Keep both closing sections together when they need a second page.
  if (writer.remaining < 182) writer.startPage();
  writer.heading("Overall interpretation");
  writer.paragraph(
    `Your current readiness signal is ${readiness}. The experience behind your answers is likely stronger than the way it is landing today. Keep ${strongest.toLowerCase()} as the foundation, then make ${focus.toLowerCase()} more explicit so your outcomes are easier to understand and remember.`,
    { after: 18 }
  );
  writer.rule();

  writer.heading("Recommended practice focus");
  writer.paragraph(
    `${briefing.nextAction} For the next 5–10 answers, make the outcome sentence non-negotiable: say what changed, why it mattered, and what you learned. ${briefing.latestText ? `Latest round: ${briefing.latestText}` : "Your first scored round will establish the baseline."}`,
    { after: 8 }
  );

  if (briefing.history.length) {
    writer.gap(5);
    writer.label("Recent round history");
    briefing.history.slice(0, 4).forEach((item) => writer.paragraph(item, { size: 9.5, leading: 13, color: palette.muted, after: 2 }));
  }
}

function buildFindings(briefing: ReportPdfBriefing) {
  const lowerScoring = briefing.competencyBars.slice().sort((left, right) => left.score - right.score)
    .filter((item) => item.label.toLowerCase() !== briefing.gapLabel.toLowerCase());
  const second = lowerScoring[0];

  return [
    {
      label: briefing.gapLabel,
      title: findingTitle(briefing.gapLabel),
      body: briefing.gapText || "Make the key point and the result unmistakable before moving to background detail.",
      accent: palette.muted
    },
    {
      label: second?.label ?? "Clarity",
      title: second ? findingTitle(second.label) : "State the point before the background.",
      body: second
        ? practiceCopy(second.label, second.score)
        : "Lead with your conclusion, decision, or position. Then give the minimum context that proves it.",
      accent: palette.muted
    },
    {
      label: briefing.strongestLabel,
      title: `Keep ${safeLabel(briefing.strongestLabel, "your strongest signal").toLowerCase()} visible.`,
      body: briefing.strongestText || "Your role and decision-making were easy to identify. Keep anchoring answers in the choices you personally made.",
      accent: palette.muted
    }
  ];
}

function findingTitle(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("impact")) return "Make the result impossible to miss.";
  if (normalized.includes("clarity")) return "State the point before the background.";
  if (normalized.includes("structure")) return "Use one consistent narrative path.";
  if (normalized.includes("ownership")) return "Make your personal contribution explicit.";
  return `Strengthen your ${label.toLowerCase()} signal.`;
}

function practiceCopy(label: string, score: number) {
  const level = score >= 75 ? "already shows up consistently" : score >= 50 ? "is starting to develop" : "needs a more deliberate practice loop";
  return `Your ${label.toLowerCase()} signal ${level}. Use one concise example and end by naming the result, trade-off, or learning that mattered.`;
}

function signalLabel(score: number) {
  if (score >= 75) return "strong evidence";
  if (score >= 45) return "developing evidence";
  return "limited evidence";
}

function fallbackScores(): ReportPdfCompetency[] {
  return [
    { label: "Clarity", score: 0, level: "missing" },
    { label: "Structure", score: 0, level: "missing" },
    { label: "Impact", score: 0, level: "missing" },
    { label: "Ownership", score: 0, level: "missing" }
  ];
}

function safeLabel(value: string, fallback: string) {
  return value.trim() || fallback;
}

function displayName(value: string) {
  return value.trim() || "you";
}

function contentWidth() {
  return PAGE.width - PAGE.margin * 2;
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  return value.trim().split(/\n+/).filter(Boolean).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/);
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  });
}

function color([red, green, blue]: PdfColor) {
  return rgb(red / 255, green / 255, blue / 255);
}
