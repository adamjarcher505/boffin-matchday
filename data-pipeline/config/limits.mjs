// Length limits so a question, its subtitle and four answer buttons fit a phone screen without scrolling.
// Checked in the game at 375x667, 390x844 and 375x400 (tests/browser/qa.js). Longer ones are rejected, not cut.
export const LIMITS = { q: 70, sub: 40, opt: 22 };
