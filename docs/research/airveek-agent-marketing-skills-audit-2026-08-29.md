# Airveek Agent Marketing Skills Audit

Date: 2026-08-29  
Scope: SEO, scaled content production, marketing strategy, and writing workflows for the Airveek repository.

## Executive decision

| Repository | Decision | Reason |
|---|---|---|
| `coreyhaines31/marketingskills` | Install project-locally | Native Agent Skills layout, explicitly supports OpenAI Codex, pure Markdown skills, broad marketing coverage, and no required runtime or credential setup. |
| `AgriciDaniel/claude-seo` | Do not install unchanged | Excellent SEO methodology, but its orchestrator, agents, commands, installer, and runtime paths are Claude Code-specific. The repository itself directs Codex users to `AgriciDaniel/codex-seo`. |
| `AgriciDaniel/claude-blog` | Do not install unchanged | Strong editorial system, but its five-agent dispatch, `/blog` command routing, Python gates, browser automation, and `~/.claude` paths require Claude Code. A skill-only copy would silently lose important quality gates. |
| `AgriciDaniel/codex-seo` (linked by `claude-seo`) | Keep as a separate future install decision | It is the correct runtime family for Codex, but it is a global suite with agents, a Python virtual environment, optional browsers/APIs, and an older upstream SEO corpus than the audited `claude-seo` commit. It should not be smuggled into a project-local skill install. |

## Audit method

- Cloned each supplied repository at its current default-branch head and recorded the exact commit.
- Inventoried all primary skill directories, reference files, scripts, tests, agents, hooks, manifests, licenses, and installation instructions.
- Parsed every primary `SKILL.md` for name/frontmatter validity, size, runtime-specific paths, script coupling, network/API references, credential handling, and destructive-operation language.
- Scanned every Python, shell, and JavaScript file for syntax validity without running third-party installers or live API operations.
- Checked relative Markdown links across the cross-agent library.
- Compared overlap against Airveek's existing `content-writer` and Airveek-specific content production skills.

## Repository findings

### 1. Marketing Skills

Audited commit: `e55de886fe7580ec75cdb7ded5092b33f7d4ed58` (2026-08-28).

Inventory:

- 50 Agent Skills.
- 226 Markdown files in the skill tree.
- MIT license.
- No Python runtime, package install, browser automation, or required credentials for the skills themselves.
- The repository's own Agent Skills validator passed all 50 skills.
- Python, shell, and JavaScript syntax scans passed for the wider repository.

Strengths:

- Best fit of the three for project-local Codex discovery.
- Strong foundational context pattern through `product-marketing`, which writes `.agents/product-marketing.md` for reuse by the other skills.
- Direct coverage of the Airveek growth system: `programmatic-seo`, `site-architecture`, `seo-audit`, `ai-seo`, `schema`, `content-strategy`, `copywriting`, `copy-editing`, `customer-research`, `analytics`, `attribution`, and CRO.
- Broad go-to-market coverage beyond SEO, including launch, pricing, offers, ads, email, social, video, referral, retention, RevOps, and sales enablement.
- Progressive disclosure: detailed references are loaded only when a matching task activates a skill.

Limitations found:

- The repository has no automated behavior tests for skill outputs; validation is structural.
- Two genuine internal reference defects existed: an incorrect `ad-creative` path and two links to a nonexistent `positioning` skill. They were repaired locally after installation.
- Two `[link](link)` entries in the SMS compliance reference are intentional copy placeholders, not documentation targets.
- 109 optional links point to the repository's separate `tools/` registry. The standard skill-only install does not include that registry. Core marketing guidance remains usable, but those optional CLI integration guides are not installed.
- Fast-changing claims, platform rules, benchmark numbers, and legal/compliance guidance must still be verified against current primary sources when used.

Verdict: strong and appropriate for Airveek, with the agent still required to verify current facts and not treat frameworks as evidence.

### 2. Claude SEO

Audited commit: `a1480c7e590b16001bd9dc1627eacdcd44d580f9` (2026-08-26).

Inventory:

- 25 primary SEO skills plus optional extensions.
- 18 Claude agent profiles.
- 117 Python/runtime scripts and 74 test files.
- MIT license.
- Python 3.10+, optional Playwright/browser dependencies, and optional Google/DataForSEO/Firecrawl/image-provider credentials.

Strengths:

- Deepest technical SEO coverage in the supplied set: crawling, rendering, indexability, schema, GSC/GA4/CrUX, content quality, GEO, clusters, programmatic SEO, e-commerce, local, hreflang, backlinks, SXO, drift, and reporting.
- Strong evidence discipline: no fabricated live data, primary-source Google guidance, structured failure checks, and explicit setup-required states.
- Mature security posture compared with most public agent repositories: documented trust boundaries, credential permissions, SSRF and path controls, dependency bounds, prompt-injection mitigations, and extensive regression tests.
- Syntax checks passed across Python, shell, and JavaScript files.

Why it was not installed:

- The README explicitly tells Codex users to use `AgriciDaniel/codex-seo`.
- The main workflow assumes Claude Code's Task/subagent model, `/seo` command routing, `~/.claude/skills`, Claude agent files, and its own Python launcher.
- Installing only its `skills/` folders would make many instructions appear available while their agents, scripts, runtime, and credential paths were missing. That is worse than a clear non-install decision.

Verdict: excellent source methodology, wrong runtime package for this project.

### 3. Claude Blog

Audited commit: `84f7abf05036bef48e114a710ff52586643fe239` (2026-08-26).

Inventory:

- 32 primary skill directories, including one orchestrator and 31 supporting skills; 30 commands are user-facing.
- Five Claude agent profiles.
- 128 Python/runtime scripts and 70 test files.
- MIT license for the repository, with separately attributed reference material where applicable.
- Python 3.11+ for full quality scoring and delivery gates; optional Google, browser, rendering, NLP, and NotebookLM capabilities.

Strengths:

- Strongest supplied editorial production design: brief, outline, research, writing, fact-checking, review, schema, GEO, style, brand voice, cannibalization, decay, taxonomy, localization, repurposing, and publishing checks.
- Its five-gate delivery contract is the most valuable concept for Airveek's planned 200-page/day operation. It treats QA as blocking, not advisory.
- Good security documentation around untrusted web content, untrusted brand files, browser sessions, credentials, dependency pinning, and upstream prompt synchronization.
- Syntax checks passed across Python, shell, and JavaScript files.

Why it was not installed:

- The complete quality promise depends on Claude Code agent dispatch, root scripts, Python dependencies, browser/runtime setup, and Claude-specific paths.
- A project-local skill-only copy would bypass or break the very gates that make this repository valuable.
- NotebookLM and image integrations enlarge the credential and browser-session trust surface without being necessary for Airveek's initial SEO publishing system.

Verdict: excellent architecture to learn from; not a reliable Codex drop-in as published.

## Installed result

All 50 `marketingskills` skills are installed under `.agents/skills/`, pinned to the audited commit. Installation provenance is recorded in `.agents/skills/.marketingskills-source.json`.

The most important Airveek activation chain is:

1. `product-marketing` to create the shared ICP, positioning, proof, and voice context.
2. `customer-research` and `competitor-profiling` to build evidence.
3. `site-architecture`, `content-strategy`, and `programmatic-seo` to select page families and prevent cannibalization.
4. The existing `content-writer` skill for evidence-bounded SEO article drafts.
5. `copy-editing`, `seo-audit`, `schema`, and `ai-seo` as pre-publish review layers.
6. `analytics`, `attribution`, and `cro` to connect rankings to activation and paid conversion.

## Important operating rule

Skills improve the agent's process; they do not create SEO evidence by themselves. For Airveek's high-volume program, each page still needs a real intent assignment, source packet, original Airveek artifact or demonstration, template-family uniqueness checks, cannibalization checks, and an enforceable publish gate. No skill should authorize publishing a page merely because the draft is grammatically clean.
