# myWealth Decision Hub Figma Make Prompt Pack

## Product Definition

**Product name:** myWealth Decision Hub  
**Product descriptor:** AI-Native Governed Decision Management  
**Supporting line:** Govern, test, simulate and explain wealth advisory decisions with human accountability.

myWealth Decision Hub is an enterprise decision-management application for replacing ODM-heavy business rules in wealth advisory. It combines:

- Structured rule and decision-table authoring.
- AI-assisted rule interpretation, draft creation and test generation.
- Maker-checker governance with immutable approval evidence.
- Simulation, impact analysis and regression comparison.
- Versioned release, runtime execution and decision traceability.

The design should not look like a marketing site or a generic AI chat product. It should look like a daily operations platform used by product, advisory, compliance, risk and technology teams.

## ODM-Heavy Business Cases

Use these three business cases throughout the design.

| Business case | What the rules decide | Why it matters |
|---|---|---|
| Portfolio Strength | Calculates a 1-5 portfolio-strength rating from cash, CIP/risk alignment, income return, growth return, tenor, SAA coverage, SAA allocation, house view, thematic exposure, sustainable investment and exception handling. | High-complexity calculation and scoring logic currently suited to ODM rule families, matrices and weighted final rating. |
| Investment Idea | Determines which investment ideas are suitable or recommended for a client based on profile, restrictions, risk, product attributes, house view, eligibility and advisory controls. | Converts policy, product and client context into explainable advisory recommendations. |
| Simulation | Compares draft versus active rule versions across cohorts, scenario libraries and historical/reference datasets to quantify outcome changes before approval or release. | Critical replacement capability for ODM testing, simulation and impact assessment. |

Portfolio Strength is the detailed sample scenario. Investment Idea and Simulation must be visible as first-class product areas, not footnotes.

## Non-Negotiable UX Principles

Include these principles in every generated experience:

- myWealth Decision Assistant may interpret rule logic, draft changes, generate tests, run validations, prepare simulations and call controlled draft APIs.
- AI-generated work is always saved as a maker-owned draft and visibly identified as `AI-Assisted Draft`.
- A maker must review, edit if needed, attest and submit the draft for checker review.
- A checker must approve controlled changes before release.
- myWealth Decision Assistant cannot approve, activate or deploy rules.
- Runtime outcomes must be traceable to decision version, rule-family outputs, reason codes, reference-data versions, approval evidence and execution trace.
- Sensitive client inputs are masked by default in traces and simulations.

## Shared Sample Scenario

Use this realistic Portfolio Strength example across screens.

| Field | Sample Value |
|---|---|
| Decision | Portfolio Strength Rating |
| Decision key | PORTFOLIO-STRENGTH-001 |
| Domain | Wealth Advisory Portfolio Health |
| Owner | Advisory Solutions |
| Risk tier | Tier 1 - Client Outcome |
| Active release | v4.7 |
| New draft | v4.8 |
| Maker | Jennifer Wong |
| Checker | David Lim, Advisory Compliance Reviewer |
| Proposed change | Adjust SAA Allocation and House View rating thresholds for Moderate CIP portfolios; keep weighting and NTW treatment unchanged. |
| Detailed sample client | Client C-10482, Moderate CIP, total AUM USD 1.85M, portfolio rating changes from 3 to 4 in draft simulation. |
| Simulation result | 312 of 18,240 sampled portfolios move to a weaker rating; 41 require advisor review. |

## Prompt 1 - Application Foundation

```text
Design a high-fidelity enterprise web application called "myWealth Decision Hub" with the descriptor "AI-Native Governed Decision Management."

myWealth Decision Hub replaces ODM-heavy rules in a wealth advisory organization. The platform supports three major business cases:
1. Portfolio Strength: weighted rule-family scoring for portfolio health ratings.
2. Investment Idea: suitability and recommendation logic for investment ideas.
3. Simulation: draft-versus-active comparison across test scenarios and portfolio/client cohorts.

Core product concept:
myWealth Decision Hub blends structured rule maintenance with AI-assisted authoring. "myWealth Decision Assistant" helps makers understand existing rule logic, identify impacted rule families, draft controlled changes, generate scenario tests, run validation and create maker-owned drafts through APIs. The assistant cannot approve, activate or deploy decisions.

User roles:
- Maker: authors and edits decisions, uses AI assistance, validates logic and submits reviewed drafts.
- Checker: reviews diffs, evidence, simulation impact and approval attestations.
- Administrator: manages environments, releases, access and operations.
- Auditor: reviews lineage, production explanations and immutable evidence.
- Advisor operations user: consumes portfolio strength, investment idea and simulation results.

Navigation:
- Decision Catalog
- AI Workspace
- Decision Studio
- Portfolio Strength
- Investment Ideas
- Simulation Lab
- My Drafts
- Review Queue
- Release Center
- Decision Trace
- Platform Settings

Create connected desktop application screens for:
1. Decision Catalog dashboard with Portfolio Strength, Investment Idea and Simulation assets.
2. Portfolio Strength rule-family workspace.
3. AI Workspace for interpreting and updating rule logic.
4. Decision Studio showing an AI-created maker draft.
5. Simulation Lab comparing draft v4.8 against active v4.7.
6. Maker submission workflow.
7. Checker Review Workbench.
8. Release Center deployment governance.
9. Decision Trace explaining a production portfolio rating.

Visual design:
- Professional financial-services operations application.
- White and light neutral surfaces with restrained navy and teal accents.
- Use amber for drafts/pending human action, green for approved/active, red for validation or compliance risk, blue for informational trace/evidence.
- Compact, information-dense layout with persistent left navigation, top bar, tables, tabs, filters, version labels and evidence metadata.
- Maximum 8px corner radius.
- Use recognizable icons for search, assistant, edit, test, simulate, compare, submit, approve, reject, deploy, history and audit.
- Avoid hero sections, decorative illustrations, gradients, floating marketing cards and excessive whitespace.

Make the governance principle visible throughout:
"AI-assisted drafts require maker review and checker approval before release."
```

## Prompt 2 - Decision Catalog

```text
Design the "Decision Catalog" home screen for myWealth Decision Hub.

Purpose:
Help users locate active rule assets, see draft and approval work, and start AI-assisted or manual authoring.

Layout:
- Persistent left navigation with Decision Catalog selected.
- Top bar with global search, environment selector set to "Development", notifications and Jennifer Wong profile.
- Page title "Decision Catalog" with subtitle "Governed advisory decisions, simulations and runtime rule assets."
- Primary button "Create with AI"; secondary button "Create Manually".

Metric row:
- Active Decisions: 126
- Portfolio Rule Families: 10
- My Drafts Requiring Review: 7
- Pending Checker Approval: 12
- Simulation Runs This Week: 38
- Validation Issues: 2

Filter bar:
- Search name or decision key
- Business Case: Portfolio Strength, Investment Idea, Simulation
- Domain
- Risk Tier
- Lifecycle Status
- Source: Manual, AI-Assisted, Imported
- Modified Date

Main table columns:
- Decision Name
- Decision Key
- Business Case
- Domain
- Risk Tier
- Active Release
- Draft Status
- Owner
- Last Modified
- Actions

Include rows:
- Portfolio Strength Rating | PORTFOLIO-STRENGTH-001 | Portfolio Strength | Wealth Advisory Portfolio Health | Tier 1 | v4.7 | AI Draft Pending Maker Review | Advisory Solutions
- Investment Idea Suitability and Recommendation | INVESTMENT-IDEA-002 | Investment Idea | Advisory Recommendations | Tier 1 | v2.9 | No Active Draft | Investment Advisory
- Portfolio Impact Simulation Policy | SIMULATION-PORTFOLIO-003 | Simulation | Testing and Impact Analysis | Tier 2 | v1.6 | Checker Review Required | Advisory Technology
- Restricted Security Purchase Control
- Fee Discount Eligibility
- Enhanced Approval Routing for Complex Products

Highlight "AI Draft Pending Maker Review" in amber. Include compact row actions: open, edit, ask myWealth Decision Assistant, simulate, compare, history and more.

Add a right-side "My Tasks" panel:
- Review AI-assisted draft for Portfolio Strength Rating v4.8
- Inspect Simulation Lab result for 312 weakened portfolios
- Submit validation evidence for Investment Idea suitability update
- Checker requested changes on Restricted Security Purchase Control
```

## Prompt 3 - Portfolio Strength Workspace

```text
Design the "Portfolio Strength" workspace in myWealth Decision Hub for maintaining complex weighted scoring logic.

Header:
- Decision: Portfolio Strength Rating
- Decision key: PORTFOLIO-STRENGTH-001
- Active release: v4.7
- Draft: v4.8
- Domain: Wealth Advisory Portfolio Health
- Risk tier: Tier 1 - Client Outcome
- Owner: Advisory Solutions
- Status: Draft - Maker Review Required

Top toolbar:
- Edit Rule Family
- Ask Assistant
- Validate
- Run Tests
- Run Simulation
- Compare with Active
- Save Draft
- Submit for Checker Review

Main layout:
- Left: rule-family score cards with current status and weight.
- Center: selected rule-family details.
- Right: scoring explanation and maker checklist.

Rule-family cards:
- Cash
- CIP / Portfolio Risk Alignment
- Income Return
- Growth Return
- Tenor
- SAA Number
- SAA Allocation
- House View
- Thematic
- Sustainable Investment
- Exceptions and NTW Treatment
- Overall Weighted Rating

For each card show:
- Rule weight
- Computed/skipped state
- Current rating 1-5
- Directional flag where relevant: OW or UW
- Validation status

Selected detail: SAA Allocation
- Show formula summary for client/model allocation gap.
- Show active threshold matrix and draft threshold matrix side by side.
- Highlight the changed Moderate CIP rows.
- Show where custom model portfolios use the separate calculation path.
- Show related evidence: test cases, impacted client segments, reference-data version and reason-code mapping.

Right scoring explanation:
- Active v4.7 result for sample client: rating 3.
- Draft v4.8 result for sample client: rating 4.
- Overall weighted score recalculated because active computed rule weight is 92%.
- Tenor rule skipped because CIP tenor is missing; active weights re-normalized.
- NTW treatment unchanged.

Design this as an expert rule-operations screen that can handle dense ODM-style logic without becoming visually chaotic.
```

## Prompt 4 - AI Workspace: Rule Interpretation And Draft Update

```text
Design the "AI Workspace" screen where Jennifer Wong asks myWealth Decision Assistant to analyze Portfolio Strength logic and prepare a controlled draft change.

Layout:
- Left navigation with AI Workspace selected.
- Top breadcrumb: "AI Workspace / Portfolio Strength Rating / Draft v4.8".
- Two-panel workspace:
  - Left 62%: conversation and visible assistant actions.
  - Right 38%: live structured draft preview and rule-family impact.

Conversation:
Maker:
"Review the Portfolio Strength rule logic. We need to adjust SAA Allocation and House View thresholds for Moderate CIP portfolios after the latest portfolio-strength rule clarification. Keep the existing weights and NTW treatment unchanged."

myWealth Decision Assistant:
"I found active release v4.7 and identified two impacted rule families: SAA Allocation and House View. Cash, CIP, Income Return, Growth Return, Tenor, SAA Number, Thematic and Sustainable Investment are unchanged. I prepared draft v4.8 and generated regression and boundary scenarios for Moderate CIP portfolios."

Visible action timeline:
1. Read action - Retrieved active release v4.7 - Completed
2. Read action - Loaded rules-control matrices and rule weights - Completed
3. Analysis action - Mapped impacted rule families - Completed
4. Draft action - Proposed SAA Allocation threshold changes - Completed
5. Draft action - Proposed House View threshold changes - Completed
6. Validation action - Ran rule-family validation - Passed
7. Test action - Generated Moderate CIP boundary scenarios - Completed
8. Write action - Called Draft Decision API - Draft v4.8 created

Right preview:
- Status: AI-Assisted Draft - Maker Review Required
- Active release: v4.7
- Draft: v4.8
- Impacted rule families: SAA Allocation, House View
- Unchanged: rule weights, overall rating matrix, exception handling, NTW treatment
- Generated tests: 34
- Validation errors: 0
- Simulation ready: Yes

Actions:
- Open Draft in Decision Studio
- Run Simulation
- Continue Refining with AI
- Discard Draft

Make the write action visually prominent and explicit that production rules were not modified.
```

## Prompt 5 - Investment Idea Workspace

```text
Design the "Investment Ideas" workspace for maintaining suitability and recommendation rules.

Scenario:
Active decision: Investment Idea Suitability and Recommendation, release v2.9.

Purpose:
Show that myWealth Decision Hub also supports ODM-heavy investment idea logic, not only Portfolio Strength.

Header:
- Decision: Investment Idea Suitability and Recommendation
- Decision key: INVESTMENT-IDEA-002
- Domain: Advisory Recommendations
- Active release: v2.9
- Status: Active

Tabs:
- Eligibility Rules
- Suitability Matrix
- Recommendation Ranking
- Product Restrictions
- House View Inputs
- Test Cases
- Simulation
- Trace

Main content:
- Input contract: client CIP, risk tolerance, investment objective, liquidity need, jurisdiction, product type, product risk rating, restricted-product flags, holding concentration, house view, thematic flag and sustainable investment preference.
- Rule sections: hard eligibility, soft suitability, recommendation ranking, exception routing and reason codes.
- Show a decision-table grid with conditions, outcome, reason code and advisor message.
- Show a right explanation panel for a sample investment idea: "Asia Income Fund - Balanced Share Class".

Sample outcome:
- Eligible: Yes
- Recommendation rank: 2
- Reason codes: IDEA-CIP-OK, IDEA-HOUSEVIEW-OW, IDEA-CONCENTRATION-WARN
- Advisor message: "Suitable with concentration warning; review existing fixed-income exposure."

Include an "Ask Assistant to Adjust Rule" action, but keep structured rule tables as the primary work surface.
```

## Prompt 6 - Simulation Lab

```text
Design the "Simulation Lab" screen for comparing rule versions across scenarios and data cohorts.

Scenario:
Compare Portfolio Strength Rating draft v4.8 against active v4.7.

Header:
- Decision: Portfolio Strength Rating
- Comparison: Draft v4.8 vs Active v4.7
- Status: Draft - Maker Review Required
- Source: AI-Assisted
- Dataset: Q2 Advisory Portfolio Cohort
- Actions: Run Tests, Run Simulation, Export Evidence, Return to Decision Studio

Validation and test strip:
- Model Validation: Passed
- Regression Scenarios: 118 Passed / 0 Failed
- Boundary Scenarios Generated: 34
- Expected Changed Outcomes: 27
- Warnings: 1

Simulation summary:
- Cohort: 18,240 anonymized portfolios
- Rating unchanged: 17,887
- Stronger rating: 41
- Weaker rating: 312
- Advisor review required: 41
- Failed due to data exceptions: 0

Main content:
- Outcome-delta bar chart showing rating 1-5 movement between v4.7 and v4.8.
- Rule-family contribution chart showing SAA Allocation and House View as primary drivers.
- Filter toolbar: CIP, AUM band, portfolio model, jurisdiction, rating delta, rule family, exception state.
- Changed-scenario table columns: Segment, CIP, AUM Band, Active Rating, Draft Rating, Driving Rule Family, Reason Code, Review Status.

Right generated summary panel:
"The draft primarily weakens Moderate CIP portfolios with allocation gaps above the revised SAA threshold or underweight exposure to current house-view overweight asset classes. Rule weights, NTW treatment and exception handling are unchanged."

Badge the summary as "AI-generated analysis - human review required."
```

## Prompt 7 - Decision Studio: AI-Assisted Draft Review

```text
Design the "Decision Studio" screen showing Portfolio Strength draft v4.8 as a maker-owned editable draft.

Header:
- Portfolio Strength Rating
- Decision key: PORTFOLIO-STRENGTH-001
- Draft release: v4.8
- Source badge: AI-Assisted Draft
- Maker: Jennifer Wong
- Active production release: v4.7
- Lifecycle status: Draft - Maker Review Required

Top toolbar:
- Edit
- Ask Assistant
- Validate
- Run Tests
- Run Simulation
- Compare with Active
- Save Draft
- Submit for Checker Review

Tabbed workspace:
- Rule Families, selected
- Rating Matrices
- Input / Output Contract
- Test Cases
- Simulation Results
- Change History
- Comments
- Audit Evidence

Show an inline diff:
- Changed families: SAA Allocation, House View
- Unchanged: Cash, CIP, Income Return, Growth Return, Tenor, SAA Number, Thematic, Sustainable Investment, Exception Handling, NTW, Overall Rating Matrix
- Sample impact: Client C-10482 changes from rating 3 to rating 4
- Simulation impact: 312 of 18,240 portfolios move to weaker rating

Right maker checklist:
- Policy intent confirmed
- Rule-family diffs reviewed
- Rating matrix thresholds reviewed
- Reason codes reviewed
- Regression tests executed
- Simulation impact reviewed
- Evidence attached
- Ready for submission

Assistant summary:
"myWealth Decision Assistant changed two rule-family matrices and generated Moderate CIP boundary tests. No production release was modified."
```

## Prompt 8 - Maker Submit For Checker Review

```text
Design the "Submit for Checker Review" workflow for Portfolio Strength draft v4.8.

Use a wide slide-over or focused review-preparation page.

Context:
- Decision: Portfolio Strength Rating
- Draft: v4.8
- Active comparison baseline: v4.7
- Created with: myWealth Decision Assistant
- Maker: Jennifer Wong
- Required checker: David Lim
- Risk tier: Tier 1 - Client Outcome

Sections:
1. Change Summary
- SAA Allocation and House View threshold matrices updated for Moderate CIP portfolios.
- Rule weights, NTW treatment and exception handling unchanged.
- Sample client rating moves from 3 to 4 under draft v4.8.

2. AI Contribution Record
- Retrieved active rule release.
- Identified impacted rule families.
- Proposed matrix changes.
- Generated boundary and regression scenarios.
- Ran validation and simulation.
- Created maker-owned draft through API.
- Label this as assistance evidence, not approval evidence.

3. Review Evidence
- Validation: Passed
- Regression scenarios: 118 / 118 passed
- Simulation cohort: 18,240 portfolios
- Weaker rating movement: 312
- Advisor review required: 41
- Attachment: Portfolio Strength Rule Clarification - June 2026.pdf

4. Maker Attestation
Checkboxes:
- I reviewed the proposed rule-family logic and confirm it reflects the intended policy.
- I reviewed changed outcomes, reason codes and simulation impact.
- I confirm supporting documentation is attached or referenced.
- I understand submission creates a checker-review snapshot and does not activate production.

Actions:
- Back to Decision Studio
- Ask Assistant to Revise
- Save Without Submitting
- Primary disabled until attestations selected: Submit to Checker
```

## Prompt 9 - Checker Review Workbench

```text
Design the "Checker Review Workbench" for David Lim reviewing Portfolio Strength draft v4.8.

Layout:
- Left work queue with pending reviews.
- Main detail pane for selected submission.

Selected submission header:
- Portfolio Strength Rating
- Draft v4.8 against active v4.7
- Status: Pending Checker Approval
- Risk tier: Tier 1 - Client Outcome
- Submitted by: Jennifer Wong
- Checker: David Lim
- Source: AI-Assisted Draft
- Review SLA: Due in 1 business day

Tabs:
- Summary
- Rule-Family Diff
- Tests
- Simulation
- Conversation & Actions
- Audit Trail
- Attachments

Summary panels:
1. Change Diff
- Side-by-side SAA Allocation and House View matrices.
- Highlight Moderate CIP threshold changes.
- State that weights, NTW and exceptions are unchanged.

2. Impact and Test Evidence
- Validation passed
- 118 / 118 regression scenarios passed
- 34 generated boundary scenarios
- Simulation cohort: 18,240
- Weaker rating movement: 312
- Advisor review required: 41

3. Governance Evidence
- Maker attestations complete
- AI action record attached
- Policy clarification attached
- Segregation-of-duties check passed
- Deployment not yet authorized

Persistent bottom action bar:
- Request Changes
- Reject
- Approve for Release

Require an approval/rejection comment field before final action. Approval creates an approved release candidate, not a deployment.
```

## Prompt 10 - Release Center

```text
Design the "Release Center" where approved rule versions are scheduled, activated, monitored and rolled back.

Header:
- Page title: Release Center
- Environment selector: Development, UAT, Production
- Selected environment: Production
- Primary action: Schedule Approved Release

Release table columns:
- Decision Name
- Release Version
- Approval Status
- Environment
- Activation Time
- Effective Date
- Deployment Status
- Approved By
- Source
- Actions

Selected release:
- Portfolio Strength Rating
- Approved candidate: v4.8
- Status: Approved - Awaiting Scheduled Activation
- Approved by: David Lim
- Origin: AI-Assisted Draft, Human Approved

Detail panel:
- Artifact checksum and immutable version badge
- Maker/checker timestamps
- Test and simulation evidence links
- Activation strategy: Scheduled activation
- Rollback target: v4.7
- Runtime health requirements

Lifecycle:
Draft -> Pending Approval -> Approved -> Scheduled -> Active -> Retired

Governance notice:
"myWealth Decision Assistant cannot activate or deploy decisions. Release actions require authorized operational users and approved evidence."
```

## Prompt 11 - Decision Trace

```text
Design the "Decision Trace" screen explaining a production Portfolio Strength outcome.

Scenario:
Client C-10482 receives Portfolio Strength rating 4 after release v4.8 becomes active.

Header:
- Trace ID: DTR-20260703-009281
- Decision: Portfolio Strength Rating
- Production release: v4.8
- Evaluated: July 3, 2026, 10:42:18 SGT
- Outcome: Rating 4 - High Misalignment
- Access classification: Client-Sensitive Trace

Outcome explanation:
- Final rating: 4
- Weighted score: 3.72
- Active computed rule weight: 92%, re-normalized to 100%
- Primary drivers: SAA Allocation rating 5, House View rating 4, CIP Alignment rating 3
- Skipped rule: Tenor, because CIP tenor is missing
- Reason codes: PS-SAA-GAP-004, PS-HV-UW-002, PS-TENOR-SKIP-001

Rule-family breakdown table:
- Cash
- CIP / Portfolio Risk Alignment
- Income Return
- Growth Return
- Tenor
- SAA Number
- SAA Allocation
- House View
- Thematic
- Sustainable Investment
- Overall Rating

For each row show computed value, rating, rule weight, computed/skipped state, reason code and explanation.

Lineage panel:
- Reference-data versions
- Rule matrix versions
- Bundle checksum
- Maker: Jennifer Wong
- Checker: David Lim
- Origin: Draft created with myWealth Decision Assistant; approved by human maker-checker workflow

Protect privacy:
- Mask sensitive client values by default.
- Show authorized-access indicator and retrieval audit notice.
- Do not expose unnecessary personally identifying data.
```

## Prompt 12 - myWealth Decision Hub Design System

```text
Create a compact enterprise design system for myWealth Decision Hub.

Brand:
- Name: myWealth Decision Hub
- Descriptor: AI-Native Governed Decision Management
- Character: trustworthy, calm, precise, intelligent and accountable.
- Industry context: wealth advisory rule operations, compliance and advisory decisioning.

Design direction:
- Desktop-first operational application for a 1440px workspace.
- White/light neutral surfaces with restrained navy and teal actions.
- Amber means pending human review or AI draft.
- Green means approved or active.
- Red means validation failure, rejection or high risk.
- Blue means evidence, trace or informational state.
- Maximum corner radius 8px.
- Avoid gradients, decorative art, oversized cards and marketing layouts.

Define components:
- Application shell, left navigation, top bar, breadcrumbs and environment selector.
- Buttons: primary, secondary, ghost/icon, destructive, disabled and loading.
- Status chips: Draft, AI-Assisted Draft, Maker Review Required, Pending Checker Approval, Approved, Scheduled, Active, Rejected, Retired.
- Rule authoring: decision table, rating matrix, rule-family card, changed-cell marker, before/after diff, formula summary and validation message.
- AI Workspace: maker message, assistant response, visible tool/API action row, validation result, draft-created confirmation and governance notice.
- Simulation: KPI strip, rating movement chart, rule-family contribution chart, changed-scenario table and generated-summary panel.
- Governance: attestation checkbox, evidence item, approval signoff, immutable snapshot badge and event timeline.
- Trace: explanation block, masked data field, rule lineage, release version and access classification.

Include states:
- Default, hover, focused, selected, disabled, loading, empty, validation error, permission denied, submitted successfully, approved successfully and deployment scheduled.

AI components must consistently signal that human review and approval are required.
```

## Prompt 13 - Clickable Prototype Flow

```text
Build a clickable end-to-end prototype journey for myWealth Decision Hub using consistent application shell, data and styling.

Journey:
1. Jennifer Wong opens Decision Catalog and sees Portfolio Strength Rating with active release v4.7 and an AI draft v4.8 requiring maker review.
2. She opens Portfolio Strength and sees rule-family cards for cash, CIP, income, growth, tenor, SAA number, SAA allocation, house view, thematic, sustainable investment and overall rating.
3. She asks myWealth Decision Assistant to apply the updated Portfolio Strength clarification for Moderate CIP portfolios.
4. The assistant retrieves v4.7, identifies SAA Allocation and House View as impacted, generates tests, runs validation and creates draft v4.8.
5. Decision Studio shows draft v4.8 with the changed matrices highlighted and an AI-Assisted Draft badge.
6. Jennifer runs Simulation Lab against the Q2 Advisory Portfolio Cohort.
7. Simulation Lab shows 312 of 18,240 portfolios move to a weaker rating and 41 require advisor review.
8. Jennifer marks the simulation as reviewed and submits the immutable draft snapshot for checker review.
9. David Lim reviews the rule-family diff, tests, simulation evidence, AI action record and maker attestations.
10. David approves for release. Release Center shows v4.8 approved but not deployed.
11. An authorized release manager schedules activation.
12. Decision Trace explains a production rating 4 outcome using active v4.8 with rule-family breakdown and human-approved lineage.

Include secondary paths:
- Investment Idea workspace showing suitability and recommendation rules.
- Simulation asset showing draft-versus-active comparison as its own business case.
- Validation failure blocks submission until corrected.
- Checker requests changes and returns the draft to the maker.

Consistency checks:
- AI creates drafts only.
- Approval and release are distinct actions.
- Portfolio Strength v4.8 changes SAA Allocation and House View thresholds only.
- Investment Idea and Simulation are visible as first-class ODM replacement cases.
- Client-sensitive values are masked by default.
```

## Naming And Label Reference

| Function | myWealth Decision Hub Label |
|---|---|
| Application | myWealth Decision Hub |
| Product descriptor | AI-Native Governed Decision Management |
| AI chatbot / agent | myWealth Decision Assistant |
| AI-first authoring area | AI Workspace |
| Traditional structured maintenance | Decision Studio |
| Portfolio scoring case | Portfolio Strength |
| Investment recommendation case | Investment Ideas |
| Testing and impact case | Simulation Lab |
| Maker work queue | My Drafts |
| Checker workflow | Review Queue |
| Deployment and release governance | Release Center |
| Runtime explainability and audit | Decision Trace |
| Administration | Platform Settings |

## Core Status Labels

| Type | Statuses |
|---|---|
| Lifecycle | Draft, Pending Checker Approval, Approved, Scheduled, Active, Rejected, Retired |
| Provenance | AI-Assisted Draft, Manually Authored, Imported |
| Human task | Maker Review Required, Checker Review Required, Changes Requested |
| Validation | Not Run, Passed, Warnings, Failed |
