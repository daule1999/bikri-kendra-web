/** Colour tones available to any toned component. Backed by --theme-tone-* tokens. */
export const TONES = ['indigo', 'violet', 'emerald', 'amber', 'pink', 'orange', 'cyan', 'red', 'slate'] as const;
export type Tone = (typeof TONES)[number];

/** Class that sets --tone; pair with text-tone / bg-tone-soft / border-tone-line utilities. */
export const toneClass = (tone: Tone) => `tone-${tone}`;
