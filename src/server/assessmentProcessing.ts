import { prisma } from "./prisma";

export function markExtractedAnswers(assessment: any, script: any) {
  const text = String(script.editableText ?? script.extractedText ?? "");
  const answers = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s*[.):-]\s*(.+)$/);
    if (match) answers.set(match[1], match[2].trim());
  }
  const normalize = (value: unknown) => String(value).trim().toLowerCase().replace(/\s+/g, " ");
  script.results = (assessment.questions || []).map((question: any) => {
    const detectedAnswer = answers.get(String(question.questionNumber)) || "";
    const expected = question.expectedAnswers || [];
    const objective = ["NUMERICAL", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"].includes(question.questionType);
    const matched = objective && !!detectedAnswer && expected.some((answer: unknown) => normalize(answer) === normalize(detectedAnswer));
    return { id: crypto.randomUUID(), questionNumber: question.questionNumber, expectedAnswer: expected, detectedAnswer, matchingRule: matched ? "Exact answer match; teacher confirmation required" : "Teacher review required", suggestedMarks: matched ? Number(question.marks || 0) : 0, finalMarks: matched ? Number(question.marks || 0) : 0, maximumMarks: Number(question.marks || 0) };
  });
  script.suggestedTotal = script.results.reduce((sum: number, result: any) => sum + result.suggestedMarks, 0);
  script.finalTotal = script.suggestedTotal;
  script.status = text ? "READY_FOR_REVIEW" : "NEEDS_REVIEW";
  script.markingConfidence = null;
}

export async function processQueuedScripts(data: any) {
  const assessment = data.teacherAssistant?.assessments?.find((item: any) => item.scripts?.some((script: any) => script.status === "QUEUED"));
  if (!assessment) return;
  const script = assessment.scripts.find((item: any) => item.status === "QUEUED");
  try {
    if (!process.env.OCR_URL || !process.env.JOBS_SECRET) throw new Error("OCR service is not configured. Enter the script text manually.");
    const texts: string[] = []; const confidences: number[] = [];
    for (const file of (script.originalFiles || []).slice(0, 3)) {
      const document = await prisma.document.findUnique({ where: { id: file.id } });
      if (!document) throw new Error("Original document is missing.");
      const response = await fetch(process.env.OCR_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.JOBS_SECRET}` }, body: JSON.stringify({ mimeType: document.mimeType, contentBase64: Buffer.from(document.content).toString("base64") }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("OCR failed. Enter the script text manually.");
      const result = await response.json(); texts.push(result.text || "");
      if (typeof result.confidence === "number") confidences.push(result.confidence);
    }
    script.extractedText = texts.join("\n");
    script.ocrConfidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null;
    script.flags = ["Review extracted text and marks against the original. PDF extraction covers up to five pages per file."];
    markExtractedAnswers(assessment, script);
  } catch (error) { script.status = "NEEDS_REVIEW"; script.flags = [(error as Error).message]; }
  assessment.counts = { total: assessment.scripts.length, ready: assessment.scripts.filter((s: any) => s.status === "READY_FOR_REVIEW").length, needsReview: assessment.scripts.filter((s: any) => s.status === "NEEDS_REVIEW").length };
}
