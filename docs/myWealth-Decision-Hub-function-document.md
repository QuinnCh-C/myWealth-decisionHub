# myWealth Decision Hub Function Document

Generated: 15 Jun 2026

## 1. Purpose

myWealth Decision Hub is an enterprise decision-management prototype for governed wealth advisory decisions. It demonstrates how business users can author, review, simulate, approve, release, and trace advisory rule functions that would traditionally be maintained in an ODM-heavy rules platform.

The application is implemented as a Vite React single-page app. Most product behavior, domain data, mock simulation logic, and screen workflows are currently contained in `src/app/App.tsx`.

## 2. Product Scope

The prototype supports two first-class business decision areas, with testing evidence embedded in Decision Studio:

| Area | Purpose | Current implementation status |
| --- | --- | --- |
| Portfolio Strength | Calculates a 1-5 portfolio strength rating from weighted rule families. | Detailed rule function, rules, test cases, ad hoc run, review, release, and trace samples are implemented. |
| Investment Idea | Determines investment idea suitability and recommendation rank. | Rule function, sequential decision flow, ad hoc run, and test cases are implemented. |
| Testing Evidence | Runs draft rule versions against saved test cases, historical cases, boundary cases, prior-incident cases, and checker samples. | Test and historical case runs are embedded in Decision Studio instead of a separate testing module. |

## 3. User Roles

| Role | Function in the application |
| --- | --- |
| Maker | Creates and edits rule functions, uses AI assistance, validates drafts, runs test cases or ad hoc cases, and submits reviewed drafts. The sample maker is Jennifer Wong. |
| Checker | Reviews submitted drafts, examines rule diffs, test evidence, run impact, and approves or rejects changes. The sample checker is David Lim. |
| Administrator | Manages separate Development, UAT, and Production instances, release scheduling, activation, rollback, and platform settings. |
| Auditor | Reviews traceability, rule versions, approval evidence, execution history, and masked runtime outcomes. |
| Advisor operations user | Consumes portfolio ratings, investment idea recommendations, test evidence, and decision traces. |

## 4. Core Navigation

The left navigation exposes these modules:

| Module | Function |
| --- | --- |
| Decision Studio | Main authoring workspace for rules and rule functions. |
| Create Rule | AI-assisted single-rule creation and structured JSON conversion workspace. |
| My Drafts | Draft work queue placeholder. |
| Review Queue | Checker review workbench. |
| Release Center | Per-environment maker-checker release control with immediate or effective-date activation. |
| Decision Trace | Runtime decision explanation and audit trace. |
| Platform Settings | Environment, access, maker-checker, AI, regression, release, audit, and reference-data settings. |

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

### 7.1 Decision Studio

Functions:

- Provides a rule library and rule function library.
- Uses a Decision Studio sub-navigation tab bar with `Rule Functions` first and `Rule Library` second.
- Provides cross-studio search across rule functions and rules, grouped by result type.
- Supports `Add New Rule with AI`: maker pastes rule logic text, AI infers rule type, inputs, outputs, and generates AI Structured JSON before adding the draft rule to the local Rule Library.
- Opens individual rule editor views.
- Opens full rule function workspaces.
- Allows local in-memory changes to rule function composition:
  - Add rule from library.
  - Remove rule.
  - Move rule up or down.
- Maintains local test cases in React state during the session.
- Is the default first screen of the simplified prototype.
- Contains test case execution, historical regression case execution, and ad hoc simulation evidence inside the rule function workspace.

Rule editor functions:

- Shows rule metadata, version, status, category, inputs, and outputs.
- Displays rule logic based on rule type.
- Provides a quick test panel that returns sample output values.

Rule function workspace tabs:

| Tab | Function |
| --- | --- |
| Rule Flow | Shows parallel Portfolio Strength flow or condition-based Investment Idea decision-tree flow, supports adding rules and function-level conditions, supports editing flow-step weights, condition labels, branch flow IDs, branch outcomes, and maker notes, and exposes backend Java execution JSON. |
| Decision Tree | Visualizes condition results as explicit TRUE/FALSE branches that can continue to different downstream flows or terminal outcomes, and exposes the same backend Java execution JSON. |
| I/O Contract | Auto-derives function inputs and outputs from member rules. |
| Test Cases | Lists saved regression, boundary, historical, prior-incident, and checker sample cases; supports running individual cases and regression runs. |
| Simulation | Runs an ad hoc case from input values, displays rule execution trace, and can save the result as a test case for future historical/regression runs. |
| Change History | Shows function version history, changed rule families, maker/checker events, evidence snapshot, and release context. |

Testing functions:

- Run a saved test case from the Test Cases tab.
- Run a regression suite from the Test Cases tab.
- Treat historical cases as saved test cases with expected outputs and trace evidence.
- Save ad hoc simulation output as a reusable test case.
- Use test case pass/fail evidence in maker submission and checker review.
- Add Rule Flow conditions from the flow view; condition nodes include expression text, TRUE/FALSE flow IDs, branch outcomes, and maker notes.
- Edit Rule Flow steps from the flow view; edits create/update a maker-review draft and are reflected in the backend execution JSON metadata.

Backend execution model shown in the UI:

- Rule functions generate a structured execution JSON artifact.
- Portfolio Strength uses `executionType = PARALLEL_RULE_FLOW` and is handled by `RuleFunctionExecutionEngine.executeRuleFlow`.
- Investment Idea uses `executionType = DECISION_TREE` and is handled by `RuleFunctionExecutionEngine.executeDecisionTree`.
- Decision-tree nodes use condition results to choose `onTrue` or `onFalse` transitions, including named `flowId` routing, next-node routing, warning flow, exception flow, or terminal outcome.
- Java backend execution uses the structured JSON only; the visual flow and decision tree are review surfaces for the same executable artifact.

### 7.2 Create Rule

Functions:

- Lets a maker enter rule logic text in plain language or policy-style prose.
- Simulates AI-assisted conversion through a step timeline.
- Infers rule type, inputs, outputs, reason-code pattern, and draft rule metadata.
- Converts the maker-entered rule logic into AI Structured JSON.
- Allows the generated draft rule to be added to the local Rule Library and opened in Decision Studio.
- Emphasizes that AI creates maker-owned draft rules only.

Governance constraints shown in the UI:

- Create Rule cannot approve, activate, or deploy.
- Production rules remain unchanged.
- Drafts require maker review and checker approval.

### 7.3 Maker Submission

Functions:

- Summarizes the draft being submitted.
- Shows proposed changes, AI action record, validation evidence, regression evidence, and ad hoc run evidence.
- Requires maker attestations before submission.
- Routes completed submissions to the checker review queue.

### 7.4 Checker Review

Functions:

- Lists submitted items in a review queue.
- Shows Portfolio Strength draft `v4.8` versus active `v4.7`.
- Displays rule-family diffs, governance evidence, test evidence, and impact metrics.
- Requires checker comment before approval.
- Supports request changes, reject, and approve for release actions.
- Approval creates an approved release candidate, not a deployment.

### 7.5 Release Center

Functions:

- Shows release candidates and active versions within the selected environment instance.
- Supports environment selection between separate Development, UAT, and Production instances.
- Displays approved release candidate metadata:
  - Decision
  - Version
  - Status
  - Environment
  - Activation time
  - Maker
  - Checker
- Shows release lifecycle: Draft, Maker Submitted, Checker Approved, Effective Date Set, Active.
- Provides actions for release immediately, setting an effective date, previewing release notes, same-instance rollback, and viewing decision trace.
- `Set Effective Date` opens a scheduling dialog for the selected release candidate, captures date, time, and release-operator note, updates activation timing, and moves the candidate to `Approved - Effective Date Set`.

Governance constraint:

- myWealth Decision Assistant cannot activate or release decisions.
- Development, UAT, and Production each follow maker -> checker -> release.
- Production release can activate immediately after checker approval or activate on an effective date supplied by the authorized release user.
- UAT approval does not deploy to Production directly; Production requires its own release action and approval evidence.
- Rollback applies only within the selected environment instance.

### 7.6 Decision Trace

Functions:

- Explains a production Portfolio Strength rating.
- Shows client, portfolio, decision version, execution timestamp, trace ID, and evidence metadata.
- Masks sensitive client inputs by default.
- Lists rule-family results, rating, weight, state, reason code, and note.
- Shows skipped rules such as Tenor with skip reason.
- Provides final weighted score and rating explanation.

### 7.7 Platform Settings

Functions:

- Configures separate Development, UAT, and Production environment instances.
- Manages user access, maker, checker, and release-operator roles.
- Defines maker-checker policy by decision tier and environment.
- Configures AI workspace controls, including backend AI conversion and disabled AI approval/release capabilities.
- Manages the regression test library, boundary suites, prior-incident suites, and expected-result re-baseline approvals.
- Defines release governance for immediate release, effective-date release, and same-instance rollback.
- Configures audit retention, trace masking defaults, and exportable evidence packs.
- Maintains reference data controls such as CIP bands, house view mappings, reason-code registry, and rule contract registry.

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
- Release activation is an environment-specific maker-checker action.
- UAT approval does not directly deploy or promote to Production.
- Runtime traces should identify decision version, rule outputs, reason codes, reference data, approval evidence, and execution trace.
- Sensitive client inputs are masked by default.

## 10. Technical Architecture

| Area | Current implementation |
| --- | --- |
| Framework | React 18 with Vite. |
| Entry point | `src/main.tsx` renders `src/app/App.tsx`. |
| Styling | CSS files under `src/styles`, with Tailwind-style utility classes in JSX. |
| Icons | `lucide-react`. |
| Charts | None exposed in the simplified prototype. |
| UI primitives | Local components under `src/app/components/ui`, though most app UI is implemented directly in `App.tsx`. |
| Data source | In-memory constants in `App.tsx`. |
| Persistence | None. State resets on page reload. |
| Backend APIs | None. API calls such as Draft Function API are represented as UI copy only. |

## 11. Current Prototype Limitations

- No backend service or database is connected.
- Rule definitions and rule functions are static constants.
- Test/ad hoc run engine is a mock implementation, not a production rule engine.
- Add, remove, move rule operations are local to React state.
- Test case creation is local to React state.
- Search and filters are mostly visual; some rule search is functional.
- Create Rule conversion is simulated with timers and frontend-only generated JSON.
- Review, approval, release, and deployment actions are screen transitions only.
- My Drafts remains a placeholder.
- Platform Settings now shows the expected configuration areas, but configuration actions remain prototype-only.

## 12. Recommended Next Enhancements

1. Split `App.tsx` into domain data, test execution services, screen components, and shared UI components.
2. Define persistent rule/function schemas and store them in an API-backed repository.
3. Replace mock test/ad hoc runs with a deterministic rule execution service.
4. Add real maker-checker workflow state, comments, approval evidence, and immutable audit log.
5. Add test execution assertions that compare actual outputs to expected outputs.
6. Implement real search, filters, environment selection, role permissions, and release authorization.
7. Add exportable evidence packs for checker review and audit.
8. Add automated UI and rule-engine tests for Portfolio Strength and Investment Idea flows.
