# NIMS Design Direction: Operational Precision

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

## Design Read
Reading this as: Network Operations and Infrastructure Inventory System (NIMS) for NOC operators, network engineers, supervisors, and administrators, in an Operational Precision Light + Dark style, dial ENERGY 2 / RHYTHM 2 / MOTION 2.

## Levers & Identity
1. **One focal point per screen:**
   - Dashboard: Data Completeness Ring Gauge paired with active infrastructure counts.
   - Devices Hierarchy: The three-step POP to Customer Site to Device drill-down stage.
   - Topology: Interactive graph canvas with level-aware breadcrumb and node/edge inspector.
   - Login: Clean dual-panel architectural entry frame anchored to the sign-in card.
2. **Hierarchical contrast & typography:**
   - `Plus Jakarta Sans` (`--font-jakarta`) for Indonesian operational copy and clear headings.
   - `IBM Plex Mono` (`--font-plex-mono`) with `tabular-nums` for asset tags, hostnames, CIDR blocks, IPv4 addresses, serial numbers, and timestamps.
3. **One deliberate accent:** Deep Teal (`#0F6E6E` in light mode, `#2DD4BF` in dark mode), reserved for primary actions, active route rail, drill-down focus, and physical fiber backbone links.
4. **Identity motif:** A clean geometric 3-node fiber crest (`NimsBrandMark`) paired with sharp-cornered structural panels (`rounded-xl` for surfaces, `rounded-lg` for controls) and a left active indicator rail on navigation items.
5. **Custom technical iconography:** All emoji placeholders are replaced with a unified geometric SVG icon set (`src/components/Icons.tsx`, stroke width 1.75) representing routers, switches, OLTs, POP facilities, customer sites, subnets, and physical links.

## Verified Palette (WCAG 2.2 AA Compliant)

### Light Mode (`:root`)
- `--bg-canvas`: `#F5F7F6` (warm stone neutral ground, keeps long NOC shifts glare-free)
- `--bg-surface`: `#FFFFFF` (solid elevated cards and data tables)
- `--bg-subtle`: `#EDF1F0` (secondary wells, table headers, canvas backdrop)
- `--bg-elevated`: `#FFFFFF` (modals and floating inspectors)
- `--text-primary`: `#14181F` (17.79:1 on `#FFFFFF`, 16.54:1 on `#F5F7F6`)
- `--text-secondary`: `#4B5563` (7.56:1 on `#FFFFFF`, 7.02:1 on `#F5F7F6`)
- `--text-muted`: `#546170` (5.55:1 on `#EDF1F0`)
- `--border-default`: `#DCE2E0` | `--border-strong`: `#C2CBC8`
- `--accent`: `#0F6E6E` (6.04:1 with `#FFFFFF`) | `--accent-hover`: `#0C5959` (8.11:1)
- `--accent-soft`: `#E6F4F3` | `--accent-ink`: `#0B5252` (7.94:1 on `#E6F4F3`)

### Dark Mode (`.dark`)
- `--bg-canvas`: `#0F1419` (graphite slate ground, avoids harsh pure-black neon look)
- `--bg-surface`: `#171D24` (elevated surface cards and tables)
- `--bg-subtle`: `#1D252E` (secondary wells, table headers, canvas backdrop)
- `--bg-elevated`: `#1F2933` (modals and floating inspectors)
- `--text-primary`: `#EDF2F7` (15.06:1 on `#171D24`, 16.44:1 on `#0F1419`)
- `--text-secondary`: `#9AA7B4` (6.92:1 on `#171D24`, 7.55:1 on `#0F1419`)
- `--text-muted`: `#95A4B3` (6.07:1 on `#1D252E`)
- `--border-default`: `#27323F` | `--border-strong`: `#374657`
- `--accent`: `#2DD4BF` (9.88:1 with `#081415`) | `--accent-hover`: `#14B8A6` (7.52:1)
- `--accent-soft`: `#132C2E` | `--accent-ink`: `#5EEAD4` (9.95:1 on `#132C2E`)

## Purposeful Motion Rules (MOTION 2)
- Every motion serves orientation or tactile feedback, never endless decorative loops:
  1. `nims-enter`: Staggered one-shot card/section entrance (320ms cubic-bezier) so primary operational views settle cleanly.
  2. `nims-drill-forward` / `nims-drill-back`: Directional horizontal slide during POP -> Customer -> Devices hierarchy navigation to reinforce spatial depth.
  3. `nims-modal-in` & `nims-backdrop-in` & `nims-drawer-in`: Crisp 150-240ms layer entry/exit choreography for dialogs and the mobile sidebar drawer.
  4. `nims-bar-grow` & `AnimatedNumber`: Progressive fill on data completeness gauges and KPI counters to call attention to verified metrics on page load.
- Every keyframe animation and transition collapses immediately under `@media (prefers-reduced-motion: reduce)`.
