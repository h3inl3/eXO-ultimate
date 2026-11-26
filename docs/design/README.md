# UI design — first cut

The design lives on a Claude design canvas: https://claude.ai/artifact/NyQe2mcgDrRncURMKSBCce (private to the owner until shared).
The `.dc.html` files here are a snapshot of its artboards, and `canvas.json` is its layout. The canvas is the source of truth: re-export after changing it.

## Principles

- **One experience on Web, iOS and Android.** Same navigation (Home, Roster, Games, Playbook, Stats), same components and same tokens. Mobile uses a bottom tab bar, web a side menu that stacks at phone width.
- **Light and dark modes** from one token set. Every artboard has a Dark mode switch in the canvas's Tweaks panel.
- **Orange is a highlight, used only as a fill** (LIVE, Start game, Resume scoring, the disc holder) with dark text on top. Orange text on white fails contrast.
- Touch targets ≥ 44px everywhere, ≥ 64px on the scoring screen.

## Tokens

| Token       | Light               | Dark                | Use                                                      |
| ----------- | ------------------- | ------------------- | -------------------------------------------------------- |
| `bg`        | `#F3F7FB`           | `#07141F`           | Page background                                          |
| `surface`   | `#FFFFFF`           | `#0F2233`           | Cards, bars                                              |
| `surface2`  | `#E8F0F7`           | `#163049`           | Subtle fills, segmented controls                         |
| `line`      | `#D3E0EB`           | `#23415C`           | Borders, dividers                                        |
| `text`      | `#0B1F33`           | `#EAF3FA`           | Body text                                                |
| `muted`     | `#4A5D70`           | `#9DB3C6`           | Secondary text                                           |
| `blue`      | `#0B5FA5`           | `#4EA8F2`           | Primary actions, links (`onBlue` `#FFFFFF` / `#04111C`)  |
| `green`     | `#0B7A55`           | `#34C98B`           | Success, Goal, confirm (`onGreen` `#FFFFFF` / `#04150E`) |
| `teal`      | `#0E7C86`           | `#2BB3B1`           | Accent                                                   |
| `orange`    | `#F07A1A`           | `#FF8A2A`           | Highlight fill; text on it is `#1A0D00`                  |
| `chipBlue`  | `#DCEBF8`           | `#123A5C`           | MMP / Mixed chips, avatars                               |
| `chipGreen` | `#D9F2E7`           | `#0F3B2E`           | FMP / Women chips, avatars                               |
| `hero`      | `#0B5FA5 → #0B7A55` | `#0B4F8A → #0B6B5A` | Live game card gradient, white text                      |

Type: **Space Grotesk** (500–700) for headings, scores and numbers; **Inter** (400–700) for UI and body. Radii: 8 / 12–16 / 20 for cards / round.

## Screens

| File                     | Screen                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `Main.dc.html`           | Foundations: palettes, type, components                           |
| `MobileHome.dc.html`     | Team home: team switcher, live game card, quick actions, schedule |
| `MobileRoster.dc.html`   | Roster: search, Active / Inactive / Invited, gender-match tags    |
| `MobilePlaybook.dc.html` | Play editor: field, tokens, cuts and throws, frames, tools        |
| `MobileScore.dc.html`    | Live scoring (landscape), interactive on the canvas               |
| `WebDashboard.dc.html`   | Web team home: side nav, live card, schedule, leaders             |

### Live scoring

Follows [PLAN.md §5](../PLAN.md#5-stat-keeper-ui), with these changes from the first design review:

- Players sit in evenly spaced columns (alternating rows) so positions stay fixed and the ring never covers a neighbour.
- The disc holder gets a ring of **four arc segments** hugging the token: Throwaway (top), Goal (right, green), Drop (bottom), Stall (left).
- **Timeout** is a global button in the top bar next to Undo, not a ring option.
- The right panel shows the **event stream** (newest first, last 10) on offense, and Opp turnover / Opp scores on defense.

Not designed yet: web scoring, Stats, sign-in and onboarding, line builder.
