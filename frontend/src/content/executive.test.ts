// The executive view of CareerTwin (CAOS_MANAGE conventions/problem-context-first.md): an executive frame of the labour market's
// matching of professionals to roles, general, never a client and never a pitch, valid against the shell's schema 2.0.0. The three
// illustrations are drawn by a later unit; this test checks their paths and captions, and the SVG checks join it when they exist.
import { EXECUTIVE_SCHEMA_VERSION, FLIP_LIMITS, FOUR_CS, validateExecutive } from '@fasl-work/caos-app-shell';
import { describe, expect, it } from 'vitest';
import executive from '../../../content/executive.json';
import pkg from '../../package.json';

const NAMES = ['pain', 'situation', 'proposal'] as const;

const words = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
type Bi = { en: string; es: string };
/** The labels the shell prints on the back of a card (ExecutiveView.tsx UI table), so a back is counted as the gate counts it. */
const LABELS = {
  cost: { en: 'Cost', es: 'Costo' },
  measure: { en: 'Measured by', es: 'Se mide por' },
  decides: { en: 'Decides', es: 'Decide' },
  needs: { en: 'Needs', es: 'Necesita' },
  achieves: { en: 'Achieves', es: 'Logra' },
  fallsShort: { en: 'Falls short', es: 'Se queda corto' },
} satisfies Record<string, Bi>;
/** The four flip groups: the title field and the fields (with their label) that make the back. A source mark adds one more token. */
const FLIP_GROUPS: Record<string, { rows: any[]; title: (r: any) => Bi; back: (r: any) => Array<[Bi | null, Bi]>; extra: number }> = {
  'pain.bearers': { rows: executive.pain.bearers, title: (r) => r.who, back: (r) => [[LABELS.cost, r.cost], [LABELS.measure, r.measure]], extra: 0 },
  'situation.roles': { rows: executive.situation.roles, title: (r) => r.role, back: (r) => [[LABELS.decides, r.decides], [LABELS.needs, r.needs]], extra: 0 },
  'situation.state_of_the_art': {
    rows: executive.situation.state_of_the_art,
    title: (r) => r.approach,
    back: (r) => [[LABELS.achieves, r.achieves], [LABELS.fallsShort, r.falls_short]],
    extra: 1,
  },
  'proposal.four_cs': { rows: executive.proposal.four_cs, title: (r) => r.c, back: (r) => [[null, r.applies]], extra: 0 },
};

/** The cards of the flip groups that break the shell's limits, one line each (the gate's G16 reads the rendered cards; this reads the data). */
function flipProblems(groups: typeof FLIP_GROUPS): string[] {
  const out: string[] = [];
  for (const lang of ['en', 'es'] as const) {
    for (const [path, g] of Object.entries(groups)) {
      for (const [i, row] of g.rows.entries()) {
        const title = words(g.title(row)[lang]);
        if (title > FLIP_LIMITS.title[lang]) out.push(`${path}[${i}] title ${lang}: ${title} words, the limit is ${FLIP_LIMITS.title[lang]}`);
        const back = g.back(row).reduce((n, [label, text]) => n + (label ? words(label[lang]) : 0) + words(text[lang]), 0) + g.extra;
        if (back > FLIP_LIMITS.back[lang]) out.push(`${path}[${i}] back ${lang}: ${back} words, the limit is ${FLIP_LIMITS.back[lang]}`);
      }
    }
  }
  return out;
}

const clone = () => JSON.parse(JSON.stringify(executive));

/** The floors of the standard (problem-context-first.md) as [min, max] counts of rows; the shell's schema holds the same numbers. */
const FLOORS: Record<string, [number, number]> = {
  headline_figures: [2, 3],
  'pain.paragraphs': [2, 3],
  'pain.bearers': [3, 5],
  'pain.figures': [2, 4],
  'pain.causes': [3, 5],
  'context.paragraphs': [1, 2],
  'context.forces': [3, 4],
  'context.evidence': [1, 4],
  'situation.roles': [3, 5],
  'situation.state_of_the_art': [3, 5],
  'trends.items': [3, 5],
  'proposal.paragraphs': [1, 2],
  'proposal.four_cs': [4, 4],
  'proposal.actions': [3, 6],
  'proposal.risks': [1, 4],
  'proposal.unknowns': [1, 4],
};

/** The source ids cited in each part of the file: 0 is the landing, 1 to 4 the sub-tabs that cite (the proposal cites none). */
function citations(): Array<{ source: string; tab: number }> {
  const out: Array<{ source: string; tab: number }> = [];
  const walk = (node: unknown, tab: number) => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, tab));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'source' && typeof v === 'string') out.push({ source: v, tab });
        else walk(v, tab);
      }
    }
  };
  walk(executive.headline_figures, 0);
  walk(executive.pain, 1);
  walk(executive.context, 2);
  walk(executive.situation, 3);
  walk(executive.trends, 4);
  return out;
}

describe('the CareerTwin executive view', () => {
  it('the shell is pinned exactly at 0.16.0 and the schema is 2.0.0', () => {
    expect(pkg.dependencies['@fasl-work/caos-app-shell']).toBe('0.16.0');
    expect(EXECUTIVE_SCHEMA_VERSION).toBe('2.0.0');
  });

  it('the executive data is valid against schema 2.0.0, with the 4 C\'s in order', () => {
    expect(validateExecutive(executive)).toEqual([]);
    expect(FOUR_CS).toHaveLength(4);
    expect(executive.proposal.four_cs.map((r) => r.c.en)).toEqual(['Choice', 'Context', 'Cost', 'Control']);
    expect(executive.proposal.four_cs.map((r) => r.c.es)).toEqual(['Elección', 'Contexto', 'Costo', 'Control']);
  });

  it('meets every floor of the standard, in the sub-tabs and the landing', () => {
    const at = (path: string): unknown[] => path.split('.').reduce((node: any, key) => node[key], executive);
    for (const [path, [min, max]] of Object.entries(FLOORS)) {
      const n = at(path).length;
      expect(n, path).toBeGreaterThanOrEqual(min);
      expect(n, path).toBeLessThanOrEqual(max);
    }
    expect(executive.pain.figures.length + executive.context.evidence.length + executive.situation.state_of_the_art.length).toBeGreaterThanOrEqual(7);
  });

  it('the cause weights add to at most 100, and say they are an estimate in the unknowns', () => {
    const total = executive.pain.causes.reduce((n, c) => n + c.weight, 0);
    expect(total).toBeLessThanOrEqual(100);
    expect(executive.proposal.unknowns.some((u) => /weights|estimate/i.test(u.en))).toBe(true);
    expect(executive.proposal.unknowns.some((u) => /pesos|estimaci/i.test(u.es))).toBe(true);
  });

  it('every action has an owner that is one of the roles, written the same in both languages', () => {
    const roles = executive.situation.roles.map((r) => `${r.role.en}|${r.role.es}`);
    for (const a of executive.proposal.actions) expect(roles, a.owner.en).toContain(`${a.owner.en}|${a.owner.es}`);
  });

  it('the English and the Spanish carry the same counts', () => {
    const lists = [
      executive.pain.paragraphs, executive.pain.bearers, executive.pain.figures, executive.pain.causes, executive.context.forces,
      executive.context.evidence, executive.situation.roles, executive.situation.state_of_the_art, executive.trends.items,
      executive.proposal.actions, executive.proposal.risks, executive.proposal.unknowns,
    ];
    for (const l of lists) expect(l.length).toBeGreaterThan(0);
    // Both languages live in the same rows: a row cannot hold one language only.
    const empty = JSON.stringify(executive).match(/"(en|es)":""/g);
    expect(empty).toBeNull();
  });

  it('every source is a titled https link that some figure or claim cites, and no sub-tab names more than six', () => {
    const cited = new Set(citations().map((c) => c.source));
    const ids = executive.sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of citations()) expect(ids, c.source).toContain(c.source);
    expect(executive.sources.length).toBeGreaterThanOrEqual(8);
    for (const s of executive.sources) {
      expect(s.url, s.id).toMatch(/^https:\/\/[^\s]+$/);
      expect(s.title.en.length, s.id).toBeGreaterThan(10);
      expect(s.title.es.length, s.id).toBeGreaterThan(10);
      expect(cited.has(s.id), s.id).toBe(true);
    }
    for (const tab of [1, 2, 3, 4]) {
      const set = new Set(citations().filter((c) => c.tab === tab).map((c) => c.source));
      expect(set.size, `sub-tab ${tab}`).toBeLessThanOrEqual(6);
    }
  });

  it('frames a problem space: no company, platform, vendor or person, no client, no product, no call to act on a product', () => {
    // Source ids (such as the publisher's short name in an id) are links, not prose: they are left out with the sources list.
    const text = JSON.stringify({ ...executive, sources: undefined }, (k, v) => (k === 'source' ? undefined : v));
    // The names the dossier's sources print and the consultancy that wrote one of them with a university project.
    expect(text).not.toMatch(/\b(Accenture|LinkedIn|Indeed|Glassdoor|Workday|Oracle|SAP|Taleo|Greenhouse|Lever|HireVue|Eightfold|Upwork|ODesk|Burning Glass|CIPD|Harvard)\b/i);
    expect(text).not.toMatch(/\b(Inc\.|Ltd|GmbH|S\.A\.)/);
    expect(text).not.toMatch(/\b(our client|nuestro cliente|workbench|banco de trabajo|this product|este producto|the app|la app|CareerTwin)\b/i);
  });

  it('writes no em-dash, no arrow and no emoji', () => {
    expect(JSON.stringify(executive)).not.toMatch(/[\u2014\u2192\u2190\u2194\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
  });

  it('keeps every date value from breaking across lines (shell check G19): headline and status values hold no space', () => {
    for (const f of [...executive.headline_figures, executive.situation.status]) {
      for (const lang of ['en', 'es'] as const) {
        const v = f.value[lang];
        if (/\d{4}-\d{2}-\d{2}/.test(v)) expect(v, f.heading.en).not.toMatch(/\s/);
      }
    }
  });

  it('the three illustrations are named pain, situation and proposal, with a path under frontend/public/ and a one-sentence caption', () => {
    for (const name of NAMES) {
      const file = executive.illustrations[name].file;
      expect(file, name).toBe(`executive/${name}.svg`);
      expect(file as string, name).not.toMatch(/^\/|\.\./);
      for (const lang of ['en', 'es'] as const) expect(words(executive.illustrations[name].caption[lang]), `${name} caption ${lang}`).toBeGreaterThan(8);
    }
  });

  it('every flip card of the four flip groups is small: a title and a back within the limits of the shell, in both languages', () => {
    expect(flipProblems(FLIP_GROUPS)).toEqual([]);
  });

  it('adversarial: a flip card over the limits is named, a long sentence, an uncited source, a foreign owner and heavy weights are refused', () => {
    const bearers = clone().pain.bearers;
    bearers[1].who.en = 'Patients on planned care lists who wait for a bed that is never free';
    bearers[2].cost.es = Array.from({ length: 60 }, () => 'palabra').join(' ');
    const planted = { ...FLIP_GROUPS, 'pain.bearers': { ...FLIP_GROUPS['pain.bearers']!, rows: bearers } };
    const found = flipProblems(planted).join(' | ');
    expect(found).toContain('pain.bearers[1] title en');
    expect(found).toContain('pain.bearers[2] back es');

    const long = clone();
    long.pain.key_message.en = Array.from({ length: 31 }, () => 'word').join(' ') + '.';
    expect(validateExecutive(long).map((p) => p.path)).toContain('pain.key_message.en');

    const uncited = clone();
    uncited.sources.push({ id: 'extra', title: { en: 'An extra source', es: 'Una fuente extra' }, url: 'https://example.org/x' });
    expect(validateExecutive(uncited).map((p) => p.message).join()).toMatch(/cited by no figure/);

    const owner = clone();
    owner.proposal.actions[0].owner.en = 'A role nobody has';
    expect(validateExecutive(owner).map((p) => p.path)).toContain('proposal.actions[0].owner');

    const weights = clone();
    weights.pain.causes.forEach((c: { weight: number }) => (c.weight = 60));
    expect(validateExecutive(weights).map((p) => p.path)).toContain('pain.causes');

    const fourcs = clone();
    fourcs.proposal.four_cs.reverse();
    expect(validateExecutive(fourcs).map((p) => p.path).join()).toMatch(/four_cs/);
  });
});
