# myWealth Decision Hub Function Document

Generated: 15 Jun 2026

## 1. Purpose

myWealth Decision Hub is an enterprise decision-management prototype for governed wealth advisory decisions. It demonstrates how business users can author, review, simulate, approve, release, and trace advisory rule functions that would traditionally be maintained in an ODM-heavy rules platform.

The application is implemented as a Vite React single-page app. Most product behavior, domain data, mock simulation logic, and screen workflows are currently contained in `src/app/App.tsx`.

## 2. Product Scope

The prototype supports three first-class business areas:

| Area | Purpose | Current implementation status |
| --- | --- | --- |
| Portfolio Strength | Calculates a 1-5 portfolio strength rating from weighted rule families. | Detailed rule function, rules, test cases, simulation, review, release, and trace samples are implemented. |
| Investment Idea | Determines investment idea suitability and recommendation rank. | Rule function, sequential decision flow, simulation, and test cases are implemented. |
| Simulation | Compares draft and active rule versions across portfolio cohorts and regression scenarios. | Simulation Lab view is implemented with static impact metrics and charts. |

## 3. User Roles

| Role | Function in the application |
| --- | --- |
| Maker | Creates and edits rule functions, uses AI assistance, validates drafts, runs simulations, and submits reviewed drafts. The sample maker is Jennifer Wong. |
| Checker | Reviews submitted drafts, examines rule diffs, test evidence, simulation impact, and approves or rejects changes. The sample checker is David Lim. |
| Administrator | Manages environments, release scheduling, activation, rollback, and platform settings. |
| Auditor | Reviews traceability, rule versions, approval evidence, execution history, and masked runtime outcomes. |
| Advisor operations user | Consumes portfolio ratings, investment idea recommendations, simulation results, and decision traces. |

## 4. Core Navigation

The left navigation exposes these modules:

| Module | Function |
| --- | --- |
| Decision Catalog | Dashboard for governed decisions, active versions, draft statuses, metrics, and user tasks. |
| Decision Studio | Main authoring workspace for rules and rule functions. |
| AI Works | AI-assisted draft generation workspace. |
| Simulation Lab | Draft-versus-active impact analysis for Portfolio Strength. |
| My Drafts | Draft work queue placeholder. |
| Review Queue | Checker review workbench. |
| Release Center | Approved release scheduling, activation governance, and rollback entry point. |
| Decision Trace | Runtime decision explanation and audit trace. |
| Platform Settings | Settings placeholder. |

## 5. Domain Model

### 5.1 Rule

A rule represents an individual decision asset. Current rule fields include:

| Field | Meaning |
| --- | --- |
| `id` | Stable rule identifier, for example `R-CIP-001`. |
| `name` / `shortName` | Display name and compact display name. |
| `type` | Rule implementation pattern such as `ScoringMatrix`, `ThresholdMatrix`, `DecisionTable`, `ExclusionList`, `WeightedAggregation`, `LookupTable`, or `RankingMatrix`. |
| `category` | Functional category: scoring, eligibility, ranking, routing, or aggregation. |
| `desc` | Business description. |
| `inputs` | Input contract fields consumed by the rule. |
| `outputs` | Output contract fields produced by the rule. |
| `version` / `lastModified` | Version metadata shown in the UI. |
| `usedBy` | Rule functions that consume the rule. |
| `modified` | Indicates draft change highlighting. |

### 5.2 I/O Field

Rule and function contracts use `IOField` definitions:

| Field | Meaning |
| --- | --- |
| `name` | Field name used in simulation input/output maps. |
| `type` | One of `string`, `number`, `boolean`, `enum`, `array`, or `object`. |
| `required` | Whether the field is mandatory. |
| `desc` | Human-readable description. |
| `sample` | Sample value shown in editors and forms. |
| `consumedBy` | Derived list of consuming rules in generated function contracts. |

### 5.3 Rule Function

A rule function composes rules into an executable decision function:

| Field | Meaning |
| --- | --- |
| `key` | Function key, currently `PS` and `II`. |
| `name` | Business function name. |
| `domain` | Business domain. |
| `tier` | Governance or risk tier. |
| `owner` | Owning business team. |
| `activeRelease` | Current production or active release. |
| `draftRelease` | Draft version, if present. |
| `status` | Lifecycle status. |
| `ruleIds` | Ordered or grouped rule membership. |
| `weights` | Optional weight configuration, used by Portfolio Strength. |

## 6. Rule Functions

### 6.1 Portfolio Strength Rating

| Attribute | Value |
| --- | --- |
| Key | `PS` |
| Name | Portfolio Strength Rating |
| Domain | Wealth Advisory Portfolio Health |
| Tier | Tier 1 |
| Owner | Advisory Solutions |
| Active release | `v4.7` |
| Draft release | `v4.8` |
| Status | Draft - Maker Review Required |

Purpose: calculate a 1-5 portfolio strength rating from weighted rule families covering client profile alignment, cash, returns, tenor, strategic asset allocation, house view, thematic exposure, sustainable investment, exception handling, and final aggregation.

Portfolio Strength rules:

| Rule ID | Rule | Type | Weight | Notes |
| --- | --- | --- | ---: | --- |
| `R-CIP-001` | CIP / Portfolio Risk Alignment | ScoringMatrix | 15% | Scores alignment between declared CIP and measured portfolio risk. |
| `R-CASH-001` | Cash | ScoringMatrix | 8% | Scores cash ratio against policy bands. |
| `R-INCOME-001` | Income Return | ScoringMatrix | 10% | Scores trailing 12-month income return. |
| `R-GROWTH-001` | Growth Return | ScoringMatrix | 10% | Scores trailing 12-month growth return. |
| `R-TENOR-001` | Tenor | ScoringMatrix | 5% | Optional; may be skipped and weights renormalised. |
| `R-SAANUM-001` | SAA Number | ScoringMatrix | 7% | Scores number of represented SAA asset classes. |
| `R-SAAALLOC-001` | SAA Allocation | ThresholdMatrix | 18% | Modified in draft `v4.8`; Moderate CIP thresholds are reduced. |
| `R-HV-001` | House View | ThresholdMatrix | 12% | Modified in draft `v4.8`; underweight threshold is updated. |
| `R-THEME-001` | Thematic | ScoringMatrix | 5% | Scores thematic exposure flags. |
| `R-ESG-001` | Sustainable Investment | ScoringMatrix | 5% | Scores ESG/sustainable investment score. |
| `R-NTW-001` | Exceptions / NTW Treatment | ExclusionList | 5% | Handles exception portfolios and NTW treatment. |
| `R-OVERALL-001` | Overall Weighted Rating | WeightedAggregation | N/A | Aggregates computed ratings. |

Execution pattern:

1. Portfolio inputs are evaluated independently by rule families.
2. Each scoring rule returns a rating from 1 to 5 plus a reason code.
3. Optional rules such as Tenor can return `Skipped`.
4. Computed rule weights are normalised over active computed rules.
5. Weighted score is calculated as `sum(rating * normalisedWeight) / sum(activeWeight)`.
6. Final rating is `ceil(weightedScore)`.

Current mock scoring examples:

| Input | Logic |
| --- | --- |
| `cashRatio` | <=5 gives rating 1, <=10 gives 2, <=20 gives 3, <=30 gives 4, otherwise 5. |
| `incomeReturn` | >=5 gives rating 1, >=3.5 gives 2, >=2 gives 3, >=1 gives 4, otherwise 5. |
| `growthReturn` | >=8 gives rating 1, >=5 gives 2, >=3 gives 3, >=1 gives 4, otherwise 5. |
| `saaAllocationGap` | Uses CIP-specific thresholds; Moderate draft threshold is 12. |
| `houseViewAlignment` | Absolute deviation <=2 gives rating 1, <=4 gives 2, <=8 gives 3, <=10 gives 4, otherwise 5. |
| `saaNumber` | >=9 gives rating 1, >=7 gives 2, >=5 gives 3, >=3 gives 4, otherwise 5. |
| `esgScore` | >=80 gives rating 1, >=60 gives 2, >=40 gives 3, >=20 gives 4, otherwise 5. |

### 6.2 Investment Idea Suitability and Recommendation

| Attribute | Value |
| --- | --- |
| Key | `II` |
| Name | Investment Idea Suitability and Recommendation |
| Domain | Advisory Recommendations |
| Tier | Tier 1 |
| Owner | Investment Advisory |
| Active release | `v2.9` |
| Draft release | None |
| Status | Active |

Purpose: determine whether an investment idea is suitable for a client and assign a recommendation rank.

Investment Idea rules:

| Rule ID | Rule | Type | Function |
| --- | --- | --- | --- |
| `R-PRESTR-001` | Product Restrictions | ExclusionList | Applies product and client restrictions before suitability evaluation. |
| `R-HELIG-001` | Hard Eligibility | DecisionTable | Performs binary eligibility checks; failure blocks recommendation. |
| `R-SSUIT-001` | Soft Suitability | DecisionTable | Produces warnings for concentration, liquidity, or risk issues. |
| `R-HVII-001` | House View Integration | LookupTable | Applies house view rank adjustment. |
| `R-RANK-001` | Recommendation Ranking | RankingMatrix | Assigns final recommendation rank and advisor message. |

Execution pattern:

1. Product restrictions are checked first.
2. Hard eligibility evaluates pass/fail rules.
3. Soft suitability evaluates warnings without necessarily blocking the recommendation.
4. House view adjusts rank: overweight improves rank, underweight reduces rank.
5. Ranking matrix returns recommendation rank and advisor-facing explanation.

Current mock logic:

| Input | Logic |
| --- | --- |
| `productRiskRating` | Values greater than 4 make the idea ineligible. |
| `houseView` | `OW` gives +1 adjustment, `UW` gives -1 adjustment, `N` gives 0. |
| `cip` | Balanced starts at rank 2, Moderate starts at rank 3, other profiles start at rank 2. |
| `holdingConcentration` | Values greater than 25 create `IDEA-CONCENTRATION-WARN`. |

## 7. Key Screens and Functions

### 7.1 Decision Catalog

Functions:

- Shows enterprise metrics: active decisions, portfolio rule families, maker drafts, checker approvals, simulation runs, and validation issues.
- Lists decision assets such as Portfolio Strength Rating, Investment Idea Suitability, and Portfolio Impact Simulation Policy.
- Displays active release, draft status, owner, and modified date.
- Provides task shortcuts for draft review, simulation inspection, and validation evidence.
- Routes users into Decision Studio or Simulation Lab.

### 7.2 Decision Studio

Functions:

- Provides a rule library and rule function library.
- Opens individual rule editor views.
- Opens full rule function workspaces.
- Allows local in-memory changes to rule function composition:
  - Add rule from library.
  - Remove rule.
  - Move rule up or down.
- Maintains local test cases in React state during the session.

Rule editor functions:

- Shows rule metadata, version, status, category, inputs, and outputs.
- Displays rule logic based on rule type.
- Provides a quick test panel that returns sample output values.

Rule function workspace tabs:

| Tab | Function |
| --- | --- |
| Rule Flow | Shows parallel Portfolio Strength flow or sequential Investment Idea flow. |
| Decision Tree | Visualizes function execution as a decision tree. |
| I/O Contract | Auto-derives function inputs and outputs from member rules. |
| Test Cases | Lists saved regression and boundary test cases. |
| Simulation | Runs mock function simulation and displays rule execution trace. |
| Change History | Placeholder. |

### 7.3 AI Works

Functions:

- Lets a maker describe a rule function in plain language.
- Simulates AI-assisted draft creation through a step timeline.
- Creates a sample Sustainability Suitability Check draft preview.
- Shows generated rule families, I/O contract, validation count, and test case count.
- Emphasizes that AI creates maker-owned drafts only.

Governance constraints shown in the UI:

- AI Works cannot approve, activate, or deploy.
- Production rules remain unchanged.
- Drafts require maker review and checker approval.

### 7.4 Simulation Lab

Functions:

- Compares Portfolio Strength draft `v4.8` against active `v4.7`.
- Shows validation status, regression scenarios, boundary scenarios, changed outcomes, and warnings.
- Presents portfolio cohort impact metrics:
  - Total: 18,240
  - Unchanged: 17,887
  - Stronger: 41
  - Weaker: 312
  - Advisor Review: 41
  - Exceptions: 0
- Charts rating distribution and primary change drivers.
- Identifies SAA Allocation and House View as main change drivers.
- Routes maker toward submission workflow.

### 7.5 Maker Submission

Functions:

- Summarizes the draft being submitted.
- Shows proposed changes, AI action record, validation evidence, regression evidence, and simulation evidence.
- Requires maker attestations before submission.
- Routes completed submissions to the checker review queue.

### 7.6 Checker Review

Functions:

- Lists submitted items in a review queue.
- Shows Portfolio Strength draft `v4.8` versus active `v4.7`.
- Displays rule-family diffs, governance evidence, test evidence, and impact metrics.
- Requires checker comment before approval.
- Supports request changes, reject, and approve for release actions.
- Approval creates an approved release candidate, not a deployment.

### 7.7 Release Center

Functions:

- Shows release candidates and deployed versions across environments.
- Supports environment selection between Development, UAT, and Production.
- Displays approved release candidate metadata:
  - Decision
  - Version
  - Status
  - Environment
  - Activation time
  - Approver
  - Source
- Shows release lifecycle: Draft, Pending Approval, Approved, Scheduled, Active, Retired.
- Provides actions for scheduling activation, previewing release notes, rollback, and viewing decision trace.

Governance constraint:

- myWealth Decision Assistant cannot activate or deploy decisions.
- Release actions require authorized operational users and approved evidence.

### 7.8 Decision Trace

Functions:

- Explains a production Portfolio Strength rating.
- Shows client, portfolio, decision version, execution timestamp, trace ID, and evidence metadata.
- Masks sensitive client inputs by default.
- Lists rule-family results, rating, weight, state, reason code, and note.
- Shows skipped rules such as Tenor with skip reason.
- Provides final weighted score and rating explanation.

## 8. Test Case Coverage

Seed test cases are included in `INITIAL_TEST_CASES`.

Portfolio Strength cases:

| Test Case | Scenario | Expected output | Status |
| --- | --- | --- | --- |
| `TC-PS-001` | Moderate CIP baseline | overallRating 3, weightedScore 2.91 | pass |
| `TC-PS-002` | Moderate CIP draft `v4.8` impact | overallRating 4, weightedScore 3.72 | not-run |
| `TC-PS-003` | Conservative CIP strong portfolio | overallRating 2, weightedScore 1.85 | pass |
| `TC-PS-004` | Aggressive CIP overweight cash | overallRating 4, weightedScore 3.58 | fail |

Investment Idea cases:

| Test Case | Scenario | Expected output | Status |
| --- | --- | --- | --- |
| `TC-II-001` | Balanced client, overweight house view, Asia Income Fund | eligible true, recommendationRank 2 | pass |
| `TC-II-002` | Conservative client, restricted/high-risk product | eligible false, recommendationRank N/A | pass |

Simulation-created test cases are stored only in component state for the current browser session.

## 9. Governance and Control Principles

The prototype repeatedly enforces these principles in screen copy and workflow structure:

- AI-assisted work is draft-only.
- AI cannot approve, activate, or deploy decisions.
- Maker review is required before checker review.
- Checker approval is required before release.
- Release activation is a separate operational action.
- Runtime traces should identify decision version, rule outputs, reason codes, reference data, approval evidence, and execution trace.
- Sensitive client inputs are masked by default.

## 10. Technical Architecture

| Area | Current implementation |
| --- | --- |
| Framework | React 18 with Vite. |
| Entry point | `src/main.tsx` renders `src/app/App.tsx`. |
| Styling | CSS files under `src/styles`, with Tailwind-style utility classes in JSX. |
| Icons | `lucide-react`. |
| Charts | `recharts`. |
| UI primitives | Local components under `src/app/components/ui`, though most app UI is implemented directly in `App.tsx`. |
| Data source | In-memory constants in `App.tsx`. |
| Persistence | None. State resets on page reload. |
| Backend APIs | None. API calls such as Draft Function API are represented as UI copy only. |

## 11. Current Prototype Limitations

- No backend service or database is connected.
- Rule definitions and rule functions are static constants.
- Simulation engine is a mock implementation, not a production rule engine.
- Add, remove, move rule operations are local to React state.
- Test case creation is local to React state.
- Search and filters are mostly visual; some rule search is functional.
- AI Works timeline is simulated with timers and static draft content.
- Review, approval, release, and deployment actions are screen transitions only.
- Platform Settings, My Drafts, and parts of Change History are placeholders.

## 12. Recommended Next Enhancements

1. Split `App.tsx` into domain data, simulation services, screen components, and shared UI components.
2. Define persistent rule/function schemas and store them in an API-backed repository.
3. Replace mock simulation with a deterministic rule execution service.
4. Add real maker-checker workflow state, comments, approval evidence, and immutable audit log.
5. Add test execution assertions that compare actual outputs to expected outputs.
6. Implement real search, filters, environment selection, role permissions, and release authorization.
7. Add exportable evidence packs for checker review and audit.
8. Add automated UI and rule-engine tests for Portfolio Strength and Investment Idea flows.

