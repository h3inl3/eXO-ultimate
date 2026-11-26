/** Design tokens from docs/design/README.md. One set for Web, iOS and Android. */
export const THEMES = {
  light: {
    bg: '#F3F7FB',
    surface: '#FFFFFF',
    surface2: '#E8F0F7',
    line: '#D3E0EB',
    text: '#0B1F33',
    muted: '#4A5D70',
    link: '#0B5FA5',
    blue: '#0B5FA5',
    onBlue: '#FFFFFF',
    green: '#0B7A55',
    onGreen: '#FFFFFF',
    teal: '#0E7C86',
    orange: '#F07A1A',
    chipBlue: '#DCEBF8',
    chipGreen: '#D9F2E7',
    hero: ['#0B5FA5', '#0B7A55'],
  },
  dark: {
    bg: '#07141F',
    surface: '#0F2233',
    surface2: '#163049',
    line: '#23415C',
    text: '#EAF3FA',
    muted: '#9DB3C6',
    link: '#7CC0F7',
    blue: '#4EA8F2',
    onBlue: '#04111C',
    green: '#34C98B',
    onGreen: '#04150E',
    teal: '#2BB3B1',
    orange: '#FF8A2A',
    chipBlue: '#123A5C',
    chipGreen: '#0F3B2E',
    hero: ['#0B4F8A', '#0B6B5A'],
  },
} as const;
export type Theme = (typeof THEMES)[keyof typeof THEMES];

/** Text on any orange fill; orange is never used as a text colour (fails contrast). */
export const ON_ORANGE = '#1A0D00';
/** The hero card keeps the dark-mode orange in both modes. */
export const HERO_ORANGE = '#FF8A2A';

export const NAV = ['Home', 'Roster', 'Games', 'Playbook', 'Stats'] as const;

/** Sample data from the design artboards, until sign-in and the API are wired up. */
export const SAMPLE = {
  team: { name: 'Night Owls', meta: 'Mixed · Coach' },
  live: {
    label: 'Spring League · Game 4',
    us: 7,
    them: 5,
    opp: 'Riptide',
    point: 13,
    side: 'Offense',
    meta: 'Field 3 · to 15',
  },
  schedule: [
    {
      day: 'SAT',
      date: '14',
      opp: 'Riptide',
      meta: '10:00 · Field 3 · to 15',
      result: 'LIVE',
      kind: 'live',
    },
    {
      day: 'SAT',
      date: '7',
      opp: 'Polar Bears',
      meta: 'Final · to 15',
      result: 'W 15–11',
      kind: 'win',
    },
    {
      day: 'SUN',
      date: '1',
      opp: 'Sky Hawks',
      meta: 'Final · capped',
      result: 'L 12–13',
      kind: 'loss',
    },
  ],
  leaders: [
    {
      title: 'Goals',
      rows: [
        ['22', 'Kai Ito', 9, false],
        ['3', 'Mei Chen', 7, true],
        ['11', 'Sam Ruiz', 5, false],
      ],
    },
    {
      title: 'Assists',
      rows: [
        ['7', 'Jo Park', 11, true],
        ['42', 'Alex Moe', 8, false],
        ['3', 'Mei Chen', 6, true],
      ],
    },
    {
      title: 'Ds',
      rows: [
        ['18', 'Ria Das', 6, true],
        ['9', 'Dev Rao', 4, false],
        ['22', 'Kai Ito', 3, false],
      ],
    },
  ] as Array<{
    title: string;
    rows: Array<[num: string, name: string, val: number, fmp: boolean]>;
  }>,
} as const;

export type GameKind = (typeof SAMPLE.schedule)[number]['kind'];
/** Result chip colours for a schedule row. */
export const resultChip = (t: Theme, kind: GameKind) =>
  kind === 'live'
    ? { bg: t.orange, fg: ON_ORANGE }
    : kind === 'win'
      ? { bg: t.chipGreen, fg: t.text }
      : { bg: t.surface2, fg: t.text };
