import type { Category, ChatResponse } from "../types/healthcare.ts";

/**
 * Safety module. Runs BEFORE dataset matching and has no dependency on it.
 *
 * Important limits: this is a keyword/phrase detector. It can miss emergencies described in
 * unusual words, and it can trigger on non-emergencies (for example "stroke" in other senses).
 * It must never be presented as a reliable way to rule an emergency in or out.
 */

export const EMERGENCY_NUMBER = "112";
export const CRISIS_LINE = "Tele-MANAS (14416)";

export const DISCLAIMER =
  "MediBot provides general healthcare information for educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. If you think you are experiencing a medical emergency, contact emergency services immediately.";

const DETECTOR_NOTE =
  "MediBot uses simple keyword rules that can miss emergencies or trigger when there is none. If you are worried about anyone's safety, call 112 now rather than relying on this chat.";

export type SafetyKind = "emergency" | "self-harm" | "medication" | "diagnosis";

export interface SafetyResult {
  triggered: boolean;
  /** Blocking results replace dataset matching entirely. */
  blocking: boolean;
  kind?: SafetyKind;
  ruleId?: string;
  response?: Omit<ChatResponse, "id">;
  /** Non-blocking note to prepend to a normal dataset answer. */
  notice?: string;
}

interface Rule {
  id: string;
  kind: "emergency" | "self-harm" | "medication";
  patterns: RegExp[];
  body: string;
  category: Category;
}

const lines = (...l: string[]) => l.join("\n");

const RULES: Rule[] = [
  {
    id: "self-harm", kind: "self-harm", category: "Mental wellness information",
    patterns: [
      /\bsuicid/, /\b(kill|end|take) (myself|my own life|my life)\b/, /\bwant(ed)? to die\b/,
      /\b(dont|do not) want to (live|be alive|exist)\b/, /\bself ?harm/, /\b(hurt|harm|cut) (myself|my self)\b/,
      /\bbetter off (dead|without me)\b/,
    ],
    body: lines(
      "I'm really sorry you're going through this. You don't have to handle it alone, and help is available right now.",
      "• If you might act on these thoughts or are in danger, call 112 now.",
      `• In India you can also call ${CRISIS_LINE}, a mental-health helpline.`,
      "• Please tell someone you trust how you are feeling and ask them to stay with you.",
      "• If you can, move away from anything you could use to hurt yourself.",
    ),
  },
  {
    id: "heart", kind: "emergency", category: "Emergency guidance",
    patterns: [/\bchest (pain|pressure|tightness|discomfort|heaviness)\b/, /\bheart attack\b/, /\b(crushing|squeezing) (pain|feeling)\b/],
    body: lines(
      "Chest pain, pressure or tightness can be a sign of a heart attack, especially with breathlessness, sweating, nausea or pain spreading to the arm, jaw or back. It needs urgent medical help.",
      "• Call 112 now (India) or your local emergency number.",
      "• Stop what you are doing and sit or lie down.",
      "• Do not drive yourself to hospital.",
      "• Ask someone nearby to stay with you.",
    ),
  },
  {
    id: "breathing", kind: "emergency", category: "Emergency guidance",
    patterns: [
      /\b(cant|cannot|unable to|struggling to|hard to|difficult to|gasping for) (breath|breathe|breathing)\b/,
      /\b(trouble|difficulty|problems?) (breathing|with breathing)\b/, /\bshort(ness)? of breath\b/,
      /\b(not|stopped|stops) breathing\b/, /\bbreathless\b/,
    ],
    body: lines(
      "Difficulty breathing can be an emergency.",
      "• Call 112 now (India) or your local emergency number.",
      "• Sit upright and try to stay calm; loosen tight clothing.",
      "• If someone is not breathing normally, shout for help and, if you are trained, start CPR while the emergency operator guides you.",
    ),
  },
  {
    id: "choking", kind: "emergency", category: "Emergency guidance",
    patterns: [/\bchoking\b/, /\bchoked on\b/],
    body: lines(
      "If a person cannot cough, speak or breathe, this is an emergency.",
      "• Call 112, or ask someone else to.",
      "• For an adult: give up to 5 firm back blows between the shoulder blades, then up to 5 abdominal thrusts, and repeat.",
      "• Babies and young children need a different technique, so get urgent help and follow the operator's instructions.",
    ),
  },
  {
    id: "stroke", kind: "emergency", category: "Emergency guidance",
    patterns: [
      /\bstroke\b/, /\bface (is )?(drooping|droop|dropping|drooped)\b/, /\bdrooping face\b/, /\bslurred (speech|words)\b/,
      /\bsudden(ly)?\b.{0,40}\b(numb|numbness|weak|weakness|confus\w*|vision|speech|speak|balance)\b/,
    ],
    body: lines(
      "These can be signs of a stroke. Remember FAST: Face drooping, Arm or leg weakness, Speech difficulty, Time to call 112.",
      "• Call 112 now. Every minute matters.",
      "• Note the time the symptoms started.",
      "• Do not give food, drink or medicines.",
    ),
  },
  {
    id: "bleeding", kind: "emergency", category: "Emergency guidance",
    patterns: [
      /\b(severe|heavy|uncontrolled|profuse|serious) bleeding\b/, /\bbleeding (heavily|badly|a lot|profusely)\b/,
      /\bbleeding\b.{0,30}\b(wont|will not|not) (stop|stopping)\b/, /\blosing (a lot of )?blood\b/,
    ],
    body: lines(
      "Severe bleeding is an emergency.",
      "• Call 112 now.",
      "• Press firmly on the wound with a clean cloth or clothing and keep pressing.",
      "• If blood soaks through, add more material on top instead of removing it.",
      "• Lay the person down and raise the injured limb if possible.",
    ),
  },
  {
    id: "unresponsive", kind: "emergency", category: "Emergency guidance",
    patterns: [/\bunconscious\b/, /\bunresponsive\b/, /\bnot responding\b/, /\b(wont|will not) wake up\b/, /\bpassed out\b/, /\bcollaps(ed|e)\b/],
    body: lines(
      "A person who has collapsed or is not responding needs urgent help.",
      "• Call 112 now.",
      "• Check whether they are breathing normally. If not and you are trained, start CPR; the operator can guide you.",
      "• If they are breathing, lay them on their side and stay with them.",
    ),
  },
  {
    id: "seizure", kind: "emergency", category: "Emergency guidance",
    patterns: [/\bseizures?\b/, /\bconvuls/, /\bhaving a fit\b/, /\bfitting\b/],
    body: lines(
      "A seizure can be an emergency. Call 112 if it lasts more than 5 minutes, it is the person's first, they are injured, or they have trouble breathing or do not wake up.",
      "• Clear the area and cushion the head.",
      "• Do not hold the person down or put anything in their mouth.",
      "• When the shaking stops, turn them onto their side and stay until they are fully alert.",
    ),
  },
  {
    id: "allergic", kind: "emergency", category: "Emergency guidance",
    patterns: [/\banaphyla/, /\b(throat|tongue|lips|face) (is |are |feels? )?(swelling|swollen|closing)\b/, /\bswelling (of|in) (the |my )?(throat|tongue|face)\b/],
    body: lines(
      "Swelling of the face, lips, tongue or throat, especially with breathing trouble, can be a severe allergic reaction.",
      "• Call 112 now.",
      "• If the person has been prescribed an adrenaline auto-injector, use it as they were taught.",
      "• Keep them lying down with legs raised unless breathing is easier sitting up.",
    ),
  },
  {
    id: "poisoning", kind: "emergency", category: "Emergency guidance",
    patterns: [/\boverdos/, /\bpoison/, /\bswallowed (bleach|pesticide|kerosene|acid|many (pills|tablets)|something toxic)\b/, /\btook too many (pills|tablets)\b/],
    body: lines(
      "Possible poisoning or overdose needs urgent professional help.",
      "• Call 112 now.",
      "• Keep the container or substance so responders can see it.",
      "• Do not try to make the person vomit unless a medical professional tells you to.",
    ),
  },
  {
    id: "severe-headache", kind: "emergency", category: "Emergency guidance",
    patterns: [/\bworst headache\b/, /\bthunderclap\b/, /\bsudden(ly)? (severe|intense|terrible|excruciating) headache\b/],
    body: lines(
      "A sudden, very severe headache can signal a serious problem and should be assessed urgently.",
      "• Call 112 or go to the nearest emergency department now.",
      "• Do not drive yourself.",
    ),
  },
  {
    id: "blood-loss-signs", kind: "emergency", category: "Emergency guidance",
    patterns: [/\b(vomit(ing)?|coughing( up)?|cough(ed)? up|spitting( up)?) blood\b/, /\bblood in (my )?(vomit|stool|stools)\b/, /\bblack (tarry )?stools?\b/],
    body: lines(
      "Blood in vomit, coughed-up blood, or black tarry stools needs urgent medical assessment.",
      "• Call 112 or go to the nearest emergency department now.",
      "• Do not eat or drink while waiting for help.",
    ),
  },
  {
    id: "medication-request", kind: "medication", category: "Medication information and precautions",
    patterns: [
      /\b(dose|dosage|dosing)\b/,
      /\bhow (much|many)\b.{0,40}\b(tablets?|pills?|capsules?|mg|ml|drops?|syrup|paracetamol|acetaminophen|ibuprofen|aspirin|medicine|medication|antibiotic)/,
      /\bhow (often|long)\b.{0,30}\b(take|give)\b.{0,30}\b(tablet|pill|medicine|paracetamol|ibuprofen|antibiotic|syrup)/,
      /\bprescribe\b/, /\bprescription for\b/,
      /\b(what|which) (medicine|medication|tablet|pill|drug|antibiotic)s?\b.{0,25}\b(should|can|do|to|for)\b/,
      /\bwhat (should|can|could) i take for\b/,
    ],
    body: lines(
      "I can't recommend specific medicines, doses or treatment plans, and I can't tell you how much of a medicine is safe for you or your child. That depends on age, weight, other medicines and health conditions.",
      "• Check the product label or leaflet.",
      "• Ask a pharmacist or your doctor, who can consider your full situation.",
      "• For children, always confirm doses with a pharmacist or doctor.",
      "If you are asking because of a severe reaction, an overdose or a poisoning, call 112 now.",
    ),
  },
];

const DIAGNOSIS_PATTERNS = [
  /\bdo i have\b/, /\bam i (having|suffering)\b/, /\bdiagnos(e|is|ed)\b/, /\bwhat (disease|illness|condition|infection) do i have\b/,
  /\bis it (cancer|serious|a tumou?r)\b/,
];

const DIAGNOSIS_NOTICE =
  "I can't diagnose conditions. What follows is general information that may not apply to you; a doctor can assess your symptoms properly.";

function normalizeForSafety(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/'/g, "").replace(/[^\p{L}\p{N}\s/-]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Checks a message against the safety rules. Order: self-harm, emergencies, medication, diagnosis. */
export function checkSafety(message: string): SafetyResult {
  const text = normalizeForSafety(message);
  for (const rule of RULES) {
    if (!rule.patterns.some((p) => p.test(text))) continue;
    const emergency = rule.kind !== "medication";
    const answer = emergency
      ? `${rule.kind === "self-harm" ? "" : "This could be a medical emergency.\n\n"}${rule.body}\n\n${DETECTOR_NOTE}`
      : rule.body;
    return {
      triggered: true,
      blocking: true,
      kind: rule.kind === "medication" ? "medication" : rule.kind === "self-harm" ? "self-harm" : "emergency",
      ruleId: rule.id,
      response: {
        answer,
        category: rule.category,
        source: null,
        confidence: 1,
        urgency: emergency ? "emergency" : "see-doctor",
        needsProfessionalCare: true,
        matchType: "safety",
        reviewStatus: null,
        recordId: null,
        related: [],
      },
    };
  }
  if (DIAGNOSIS_PATTERNS.some((p) => p.test(text))) {
    return { triggered: true, blocking: false, kind: "diagnosis", ruleId: "diagnosis-request", notice: DIAGNOSIS_NOTICE };
  }
  return { triggered: false, blocking: false };
}
