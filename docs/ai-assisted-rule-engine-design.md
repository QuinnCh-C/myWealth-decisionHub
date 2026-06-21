# AI-Assisted Rule Engine Design

Generated: 21 Jun 2026

## 1. Purpose

This document defines the target design for an AI-assisted rule engine for myWealth Decision Hub.

The design follows Option 2:

```text
Maker logic text
  -> backend-owned AI conversion
  -> structured rule JSON
  -> backend validation
  -> maker review and simulation
  -> checker review and simulation
  -> approval or change request
```

The key principle is simple:

> AI assists rule authoring. Java executes only validated structured JSON.

The system must not execute free-form maker text, AI text, JavaScript, SQL, Java snippets, expression-language fragments, or arbitrary scripts from the `Edit Logic` box. The `Edit Logic` box is an authoring surface. The executable artifact is a validated `ruleLogicSpec` JSON document.

## 2. Scope

### 2.1 In Scope

- Maker enters or edits business-readable rule logic text.
- Java backend sends the logic text to AI for conversion.
- AI returns structured JSON using a constrained schema.
- Backend validates the JSON against rule type, schema, input/output contract, operator allowlist, reason-code rules, and governance requirements.
- Backend stores:
  - original maker logic text
  - AI converted structured JSON
  - validation result
  - maker simulation evidence
  - checker simulation evidence
  - approval decision
- Java backend executes structured JSON for simulations.
- Checker reviews maker-submitted logic and can run additional simulations.

### 2.2 Out of Scope For V1

- Cross-environment deployment automation.
- Real-time high-volume runtime deployment.
- Arbitrary code execution.
- User-authored Java, JavaScript, SQL, MVEL, SpEL, or Groovy.
- Frontend direct calls to AI providers.
- Automatic approval by AI.
- Promotion from UAT to Production. Production uses its own maker-checker release action.

## 3. High-Level Architecture

```text
Decision Studio UI
  |
  | maker edits business logic text
  v
Spring Boot API
  |
  | builds governed prompt
  v
AI Model
  |
  | returns ruleLogicSpec JSON + warnings
  v
Spring Boot API
  |
  | schema + semantic validation
  v
PostgreSQL
  |
  | stores text, JSON, validation, simulations, review state
  v
Java Rule Execution Engine
  |
  | deterministic simulation execution
  v
Maker / Checker Review UI
```

## 4. Roles And Lifecycle

### 4.1 Maker Flow

1. Maker opens a rule in Decision Studio.
2. Maker enters or edits business logic text.
3. Maker clicks `Convert with AI`.
4. Backend sends rule metadata, rule type, input/output contract, existing logic, and maker text to AI.
5. AI returns structured `ruleLogicSpec` JSON plus warnings.
6. Backend validates the returned JSON.
7. Maker reviews:
   - original logic text
   - AI converted JSON
   - validation messages
   - generated trace labels and reason codes
8. Maker can edit the logic text and reconvert, or directly edit structured JSON if the UI allows advanced mode.
9. Maker runs simulation.
10. Backend stores simulation inputs, outputs, trace, and comparison evidence.
11. Maker submits the draft for checker review.

### 4.2 Checker Flow

1. Checker opens submitted draft.
2. Checker reviews:
   - maker logic text
   - AI converted structured JSON
   - validation result
   - maker simulation evidence
   - changed outputs and trace details
3. Checker can run additional simulations using custom inputs or saved scenario sets.
4. Checker approves, rejects, or requests changes.
5. Approval requires:
   - latest structured JSON is valid
   - maker has run simulation after the latest validated JSON
   - checker review decision references the reviewed logic version
   - required historical regression cases have passed or have an approved expected-result re-baseline

### 4.3 Historical Regression Flow

The initial product phase uses Simulation Lab as a regression evidence workbench, not as a broad portfolio-impact analytics lab.

1. Maker or checker selects a saved test suite for the draft rule or rule function.
2. Backend runs the latest validated structured JSON against historical cases, boundary cases, prior incident cases, and checker samples.
3. Backend compares actual outputs with expected outputs and stores pass/fail evidence.
4. Failed cases block submission unless the maker fixes the logic or starts a governed expected-result re-baseline.
5. Checker can rerun the same suites before approval.

### 4.4 Environment Release Flow

Development, UAT, and Production are separate instances. Each instance has its own draft, review, release candidate, active version, and rollback target.

1. Maker submits a release candidate within the selected environment.
2. Checker approves or requests changes within the same environment.
3. After checker approval, an authorized release user can:
   - release immediately; or
   - provide an effective date/time for activation.
4. UAT approval does not deploy to Production directly.
5. Production follows the same maker -> checker -> release flow and requires its own approval evidence.

### 4.5 Draft States

| State | Meaning |
| --- | --- |
| `DRAFT_EDITING` | Maker is editing logic text or structured JSON. |
| `AI_CONVERTED` | AI conversion completed, but validation may still be pending. |
| `VALIDATION_FAILED` | Structured JSON failed validation. |
| `VALIDATED` | Structured JSON passed validation. |
| `SIMULATED` | Maker ran at least one simulation against the current logic version. |
| `REGRESSION_PASSED` | Required historical regression suite passed for the current logic version. |
| `REGRESSION_FAILED` | One or more required historical cases failed. |
| `SUBMITTED` | Maker submitted draft for checker review. |
| `CHANGES_REQUESTED` | Checker returned draft to maker. |
| `APPROVED` | Checker approved the draft. |
| `REJECTED` | Checker rejected the draft. |

## 5. Backend API Design

### 5.1 Maker APIs

| API | Purpose |
| --- | --- |
| `POST /api/rule-drafts` | Create a maker-owned draft for a rule. |
| `GET /api/rule-drafts/{draftId}` | Load draft details, logic text, structured JSON, validation, and simulations. |
| `PUT /api/rule-drafts/{draftId}/logic-text` | Save maker logic text without conversion. |
| `POST /api/rule-drafts/{draftId}/convert-logic` | Convert latest maker logic text to structured JSON using backend-owned AI. |
| `PUT /api/rule-drafts/{draftId}/structured-json` | Save maker-edited structured JSON. |
| `POST /api/rule-drafts/{draftId}/validate-logic` | Validate structured JSON. |
| `POST /api/rule-drafts/{draftId}/simulate` | Run maker simulation against validated structured JSON. |
| `POST /api/rule-drafts/{draftId}/submit` | Submit draft and simulation evidence to checker. |

### 5.2 Checker APIs

| API | Purpose |
| --- | --- |
| `GET /api/checker-reviews/{reviewId}` | Load submitted draft, evidence, and review state. |
| `POST /api/checker-reviews/{reviewId}/simulate` | Run checker simulation against submitted structured JSON. |
| `POST /api/checker-reviews/{reviewId}/decision` | Approve, reject, or request changes. |

### 5.3 Regression Test APIs

| API | Purpose |
| --- | --- |
| `GET /api/regression-suites?ruleFunctionKey={key}` | List saved historical, boundary, prior-incident, and checker sample suites. |
| `POST /api/rule-drafts/{draftId}/regression-runs` | Run selected regression suites against latest validated structured JSON. |
| `GET /api/regression-runs/{runId}` | Load pass/fail result, expected-versus-actual output, trace, and evidence pack metadata. |
| `POST /api/regression-runs/{runId}/rebaseline-request` | Request governed expected-result re-baseline for failed historical cases. |

### 5.4 Release APIs

| API | Purpose |
| --- | --- |
| `GET /api/environments` | List Development, UAT, and Production instances. |
| `GET /api/environments/{env}/release-candidates` | List release candidates and active versions for one environment instance. |
| `POST /api/environments/{env}/release-candidates/{candidateId}/release-now` | Activate an approved candidate immediately in the selected environment. |
| `POST /api/environments/{env}/release-candidates/{candidateId}/schedule` | Activate an approved candidate on a supplied effective date/time. |
| `POST /api/environments/{env}/rollback` | Roll back within the selected environment instance only. |

### 5.5 Platform Settings APIs

| API | Purpose |
| --- | --- |
| `GET /api/platform-settings` | Load environment, role, maker-checker, AI, regression, release, audit, and reference-data configuration. |
| `PUT /api/platform-settings/maker-checker-policy` | Update approval policy by tier and environment. |
| `PUT /api/platform-settings/regression-library` | Update suite ownership, required suites, and re-baseline policy. |
| `PUT /api/platform-settings/release-governance` | Update immediate release, effective-date release, and rollback policy. |

### 5.6 AI Conversion Request

```json
{
  "draftId": "DRAFT-10042",
  "ruleId": "R-CASH-001",
  "ruleType": "ScoringMatrix",
  "logicText": "If cash ratio is less than or equal to 5%, cash rating is 1...",
  "inputContract": [
    { "name": "cashRatio", "type": "number", "required": true }
  ],
  "outputContract": [
    { "name": "cashRating", "type": "number", "required": true },
    { "name": "cashReasonCode", "type": "string", "required": true }
  ],
  "existingSpec": null
}
```

### 5.7 AI Conversion Response

```json
{
  "conversionRunId": "AICR-90081",
  "status": "CONVERTED",
  "ruleLogicSpec": {
    "schemaVersion": "1.0",
    "ruleId": "R-CASH-001",
    "ruleType": "ScoringMatrix",
    "name": "Cash",
    "inputContract": [
      { "name": "cashRatio", "type": "number", "required": true }
    ],
    "outputContract": [
      { "name": "cashRating", "type": "number", "required": true },
      { "name": "cashReasonCode", "type": "string", "required": true }
    ],
    "logic": {
      "evaluation": "firstMatch",
      "bands": [
        {
          "id": "CASH-BAND-001",
          "when": { "field": "cashRatio", "operator": "<=", "value": 5 },
          "set": { "cashRating": 1, "cashReasonCode": "PS-CASH-001" },
          "trace": "Cash ratio <= 5%"
        },
        {
          "id": "CASH-BAND-002",
          "when": { "field": "cashRatio", "operator": "<=", "value": 10 },
          "set": { "cashRating": 2, "cashReasonCode": "PS-CASH-002" },
          "trace": "Cash ratio <= 10%"
        },
        {
          "id": "CASH-BAND-003",
          "when": { "field": "cashRatio", "operator": "<=", "value": 20 },
          "set": { "cashRating": 3, "cashReasonCode": "PS-CASH-003" },
          "trace": "Cash ratio <= 20%"
        }
      ],
      "default": {
        "set": { "cashRating": 5, "cashReasonCode": "PS-CASH-005" },
        "trace": "Cash ratio above configured bands"
      }
    },
    "metadata": {
      "generatedBy": "AI",
      "source": "maker_logic_text",
      "requiresMakerReview": true
    }
  },
  "warnings": [
    {
      "code": "MISSING_DEFAULT_IN_TEXT",
      "message": "The maker text did not explicitly define an otherwise condition. A default band was inferred."
    }
  ]
}
```

## 6. Structured JSON Design

### 6.1 Common Envelope

Every executable rule JSON must use the same envelope.

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-CASH-001",
  "ruleType": "ScoringMatrix",
  "name": "Cash",
  "description": "Evaluates portfolio cash ratio against configured bands.",
  "inputContract": [
    { "name": "cashRatio", "type": "number", "required": true }
  ],
  "outputContract": [
    { "name": "cashRating", "type": "number", "required": true },
    { "name": "cashReasonCode", "type": "string", "required": true }
  ],
  "logic": {},
  "metadata": {
    "generatedBy": "AI",
    "generatedAt": "2026-06-21T10:30:00Z",
    "source": "maker_logic_text",
    "requiresMakerReview": true
  }
}
```

### 6.2 Supported Rule Types

| Rule Type | Purpose | Clear Example |
| --- | --- | --- |
| `ScoringMatrix` | Converts a numeric or categorical input into a score by checking ordered bands. | Cash rule: if `cashRatio = 12.4`, the engine checks cash bands in order. The `<= 20` band matches, so outputs are `cashRating = 3` and `cashReasonCode = PS-CASH-003`. |
| `ThresholdMatrix` | Applies threshold bands that can vary by segment, such as CIP tier or jurisdiction. | SAA Allocation rule: if `cip = Moderate` and `saaAllocationGap = 10`, the engine first selects the Moderate threshold group, then matches the `<= 12%` threshold, so outputs are `saaAllocRating = 4` and `saaAllocReasonCode = PS-SAA-GAP-004`. |
| `DecisionTable` | Evaluates ordered business decision rows, often returning pass, fail, warning, or eligibility outputs. | Hard Eligibility rule: if `productRiskRating = 5`, the row `productRiskRating > 4` matches before later rows, so outputs are `eligible = false` and `eligReasonCode = IDEA-CIP-BLOCK`. |
| `ExclusionList` | Checks blocking conditions before normal rule processing continues. | Product Restrictions rule: if `restrictedFlags` contains `PRODUCT_BLOCKED`, the exclusion matches immediately, so outputs are `restricted = true` and `restrictionCode = IDEA-RESTRICTED`. |
| `LookupTable` | Looks up an exact key and returns mapped values. | House View Integration rule: if `houseView = OW`, the lookup entry for `OW` returns `hvAdjustment = 1` and `hvReasonCode = IDEA-HOUSEVIEW-OW`. |
| `RankingMatrix` | Applies ordered ranking rules to produce a recommendation rank and message. | Recommendation Ranking rule: if `cip = Balanced`, `houseView = OW`, and `investmentObjective = Income`, the matching ranking row returns `recommendationRank = 2` and `advisorMessage = Suitable with house-view support`. |
| `WeightedAggregation` | Aggregates outputs from prior rules using configured weights and rounding rules. | Overall Rating rule: if child rule ratings produce `weightedScore = 3.72`, the engine applies ceiling rounding, so outputs are `overallRating = 4`, `weightedScore = 3.72`, and `activeWeight = 100`. |

### 6.3 Safe Condition AST

AST means Abstract Syntax Tree. In this design, a condition AST is a structured JSON representation of rule conditions. It lets the backend represent business logic such as "CIP is Moderate and SAA gap is less than or equal to 12" as data that Java can safely evaluate.

Conditions are represented as data, not executable code. This is important because the system can validate every field, operator, and value before execution.

```json
{
  "all": [
    { "field": "cip", "operator": "=", "value": "Moderate" },
    { "field": "saaAllocationGap", "operator": "<=", "value": 12 }
  ]
}
```

Supported condition forms:

```json
{ "field": "cashRatio", "operator": "<=", "value": 20 }
```

```json
{
  "all": [
    { "field": "cip", "operator": "=", "value": "Moderate" },
    { "field": "portfolioRisk", "operator": ">", "value": 3 }
  ]
}
```

```json
{
  "any": [
    { "field": "jurisdiction", "operator": "=", "value": "SG" },
    { "field": "jurisdiction", "operator": "=", "value": "HK" }
  ]
}
```

Supported operators:

| Operator | Meaning |
| --- | --- |
| `=` | Equal. |
| `!=` | Not equal. |
| `<` | Less than. |
| `<=` | Less than or equal. |
| `>` | Greater than. |
| `>=` | Greater than or equal. |
| `in` | Field value is in list. |
| `notIn` | Field value is not in list. |
| `contains` | Array or string contains value. |
| `isNull` | Field is null or absent. |
| `isNotNull` | Field is present and non-null. |

### 6.4 Output Assignment

Outputs are explicit field assignments.

```json
{
  "set": {
    "cashRating": 3,
    "cashReasonCode": "PS-CASH-003"
  },
  "trace": "Cash ratio within 10-20% band"
}
```

Only fields declared in `outputContract` may appear in `set`.

## 7. Rule Type JSON Examples

### 7.1 ScoringMatrix

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-CASH-001",
  "ruleType": "ScoringMatrix",
  "name": "Cash",
  "inputContract": [
    { "name": "cashRatio", "type": "number", "required": true }
  ],
  "outputContract": [
    { "name": "cashRating", "type": "number", "required": true },
    { "name": "cashReasonCode", "type": "string", "required": true }
  ],
  "logic": {
    "evaluation": "firstMatch",
    "bands": [
      {
        "id": "CASH-BAND-001",
        "when": { "field": "cashRatio", "operator": "<=", "value": 5 },
        "set": { "cashRating": 1, "cashReasonCode": "PS-CASH-001" },
        "trace": "Cash ratio <= 5%"
      },
      {
        "id": "CASH-BAND-002",
        "when": { "field": "cashRatio", "operator": "<=", "value": 10 },
        "set": { "cashRating": 2, "cashReasonCode": "PS-CASH-002" },
        "trace": "Cash ratio <= 10%"
      },
      {
        "id": "CASH-BAND-003",
        "when": { "field": "cashRatio", "operator": "<=", "value": 20 },
        "set": { "cashRating": 3, "cashReasonCode": "PS-CASH-003" },
        "trace": "Cash ratio <= 20%"
      }
    ],
    "default": {
      "set": { "cashRating": 5, "cashReasonCode": "PS-CASH-005" },
      "trace": "Cash ratio above configured bands"
    }
  }
}
```

### 7.2 ThresholdMatrix

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-SAAALLOC-001",
  "ruleType": "ThresholdMatrix",
  "name": "SAA Allocation",
  "inputContract": [
    { "name": "cip", "type": "enum", "required": true },
    { "name": "saaAllocationGap", "type": "number", "required": true }
  ],
  "outputContract": [
    { "name": "saaAllocRating", "type": "number", "required": true },
    { "name": "saaAllocGap", "type": "number", "required": true },
    { "name": "saaAllocReasonCode", "type": "string", "required": true }
  ],
  "logic": {
    "groupBy": "cip",
    "valueField": "saaAllocationGap",
    "absoluteValue": true,
    "groups": [
      {
        "groupValue": "Moderate",
        "thresholds": [
          {
            "id": "SAA-MOD-001",
            "operator": "<=",
            "value": 2,
            "set": {
              "saaAllocRating": 1,
              "saaAllocGap": "$input.saaAllocationGap",
              "saaAllocReasonCode": "PS-SAA-GAP-001"
            },
            "trace": "Moderate CIP allocation gap <= 2%"
          },
          {
            "id": "SAA-MOD-004",
            "operator": "<=",
            "value": 12,
            "set": {
              "saaAllocRating": 4,
              "saaAllocGap": "$input.saaAllocationGap",
              "saaAllocReasonCode": "PS-SAA-GAP-004"
            },
            "trace": "Moderate CIP allocation gap <= 12%"
          }
        ],
        "default": {
          "set": {
            "saaAllocRating": 5,
            "saaAllocGap": "$input.saaAllocationGap",
            "saaAllocReasonCode": "PS-SAA-GAP-005"
          },
          "trace": "Moderate CIP allocation gap exceeds threshold"
        }
      }
    ]
  }
}
```

### 7.3 DecisionTable

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-HELIG-001",
  "ruleType": "DecisionTable",
  "name": "Hard Eligibility",
  "inputContract": [
    { "name": "cip", "type": "enum", "required": true },
    { "name": "productRiskRating", "type": "number", "required": true },
    { "name": "jurisdiction", "type": "enum", "required": true }
  ],
  "outputContract": [
    { "name": "eligible", "type": "boolean", "required": true },
    { "name": "eligReasonCode", "type": "string", "required": true }
  ],
  "logic": {
    "evaluation": "firstMatch",
    "rows": [
      {
        "id": "ELIG-001",
        "when": { "field": "productRiskRating", "operator": ">", "value": 4 },
        "set": { "eligible": false, "eligReasonCode": "IDEA-CIP-BLOCK" },
        "trace": "Product risk exceeds hard eligibility tolerance"
      },
      {
        "id": "ELIG-002",
        "when": { "field": "jurisdiction", "operator": "notIn", "value": ["SG", "HK", "MY", "TH"] },
        "set": { "eligible": false, "eligReasonCode": "IDEA-JURIS-BLOCK" },
        "trace": "Jurisdiction is not supported"
      }
    ],
    "default": {
      "set": { "eligible": true, "eligReasonCode": "IDEA-CIP-OK" },
      "trace": "All hard eligibility checks passed"
    }
  }
}
```

### 7.4 ExclusionList

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-PRESTR-001",
  "ruleType": "ExclusionList",
  "name": "Product Restrictions",
  "inputContract": [
    { "name": "restrictedFlags", "type": "array", "required": true },
    { "name": "clientRestrictions", "type": "array", "required": false }
  ],
  "outputContract": [
    { "name": "restricted", "type": "boolean", "required": true },
    { "name": "restrictionCode", "type": "string", "required": false }
  ],
  "logic": {
    "evaluation": "firstMatch",
    "exclusions": [
      {
        "id": "RESTR-001",
        "when": { "field": "restrictedFlags", "operator": "contains", "value": "PRODUCT_BLOCKED" },
        "set": { "restricted": true, "restrictionCode": "IDEA-RESTRICTED" },
        "trace": "Product restriction flag blocks recommendation"
      }
    ],
    "default": {
      "set": { "restricted": false, "restrictionCode": "" },
      "trace": "No product or client restriction matched"
    }
  }
}
```

### 7.5 LookupTable

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-HVII-001",
  "ruleType": "LookupTable",
  "name": "House View Integration",
  "inputContract": [
    { "name": "houseView", "type": "enum", "required": true }
  ],
  "outputContract": [
    { "name": "hvAdjustment", "type": "number", "required": true },
    { "name": "hvReasonCode", "type": "string", "required": true }
  ],
  "logic": {
    "keyField": "houseView",
    "entries": [
      {
        "key": "OW",
        "set": { "hvAdjustment": 1, "hvReasonCode": "IDEA-HOUSEVIEW-OW" },
        "trace": "House view overweight improves ranking"
      },
      {
        "key": "N",
        "set": { "hvAdjustment": 0, "hvReasonCode": "IDEA-HOUSEVIEW-N" },
        "trace": "Neutral house view keeps rank unchanged"
      },
      {
        "key": "UW",
        "set": { "hvAdjustment": -1, "hvReasonCode": "IDEA-HOUSEVIEW-UW" },
        "trace": "House view underweight reduces ranking"
      }
    ],
    "default": {
      "set": { "hvAdjustment": 0, "hvReasonCode": "IDEA-HOUSEVIEW-UNKNOWN" },
      "trace": "Unknown house view defaults to no adjustment"
    }
  }
}
```

### 7.6 WeightedAggregation

```json
{
  "schemaVersion": "1.0",
  "ruleId": "R-OVERALL-001",
  "ruleType": "WeightedAggregation",
  "name": "Overall Weighted Rating",
  "inputContract": [
    { "name": "ruleResults", "type": "object", "required": true }
  ],
  "outputContract": [
    { "name": "overallRating", "type": "number", "required": true },
    { "name": "weightedScore", "type": "number", "required": true },
    { "name": "activeWeight", "type": "number", "required": true }
  ],
  "logic": {
    "ratingField": "rating",
    "skipStatuses": ["SKIPPED"],
    "rounding": "ceiling",
    "weights": [
      { "ruleId": "R-CIP-001", "weight": 15 },
      { "ruleId": "R-CASH-001", "weight": 8 },
      { "ruleId": "R-INCOME-001", "weight": 10 },
      { "ruleId": "R-GROWTH-001", "weight": 10 },
      { "ruleId": "R-SAAALLOC-001", "weight": 18 },
      { "ruleId": "R-HV-001", "weight": 12 }
    ],
    "set": {
      "overallRating": "$computed.ceilingWeightedScore",
      "weightedScore": "$computed.weightedScore",
      "activeWeight": "$computed.activeWeight"
    },
    "trace": "Weighted score calculated from computed rule ratings; skipped rules excluded"
  }
}
```

## 8. Validation Design

Validation has two layers:

1. JSON schema validation.
2. Semantic validation against rule metadata and governance rules.

### 8.1 JSON Schema Validation

Checks:

- `schemaVersion` is supported.
- `ruleId` is present.
- `ruleType` is supported.
- `logic` shape matches `ruleType`.
- Required arrays are non-empty where applicable.
- Condition nodes match allowed AST shape.

### 8.2 Semantic Validation

Checks:

- `ruleId` exists.
- `ruleType` matches the rule asset.
- All condition fields exist in input contract or allowed execution context.
- All output assignments exist in output contract.
- Assigned output values match expected output types.
- Operators are in the allowlist.
- Required outputs are assigned for every terminal path.
- `firstMatch` rule types include a default or explicitly allow no match.
- Reason codes follow configured pattern.
- Weighted aggregation references valid child rule IDs.
- No executable code strings are present.

### 8.3 Validation Result JSON

```json
{
  "status": "FAILED",
  "errors": [
    {
      "code": "UNKNOWN_OUTPUT_FIELD",
      "path": "$.logic.bands[0].set.cash_score",
      "message": "Output field cash_score is not declared in the rule output contract."
    }
  ],
  "warnings": [
    {
      "code": "INFERRED_DEFAULT",
      "path": "$.logic.default",
      "message": "Default behavior was inferred by AI and requires maker review."
    }
  ]
}
```

## 9. AI Prompt Design

The backend owns the AI prompt. The frontend never sends prompts directly to an AI provider.

### 9.1 System Prompt

```text
You are myWealth Decision Hub Rule Compiler.

Your job is to convert business-readable rule logic into ruleLogicSpec JSON.

Critical rules:
- Return valid JSON only.
- Do not include Markdown.
- Do not include explanatory prose outside JSON.
- Do not generate executable code.
- Do not invent input fields.
- Do not invent output fields.
- Use only the provided inputContract and outputContract.
- Use only supported ruleType values.
- Use only supported operators.
- Preserve reason codes when the maker text provides them.
- If a reason code is missing, generate a reason code using the provided reasonCodePrefix.
- If the logic is ambiguous, include a warning in warnings.
- If conversion is impossible, return status CONVERSION_FAILED with errors.
- The structured JSON must be deterministic and ordered.
- The JSON must be suitable for Java backend validation and deterministic execution.
```

### 9.2 User Prompt Template

```text
Convert the following maker-authored rule logic into ruleLogicSpec JSON.

Rule metadata:
- ruleId: {{ruleId}}
- ruleName: {{ruleName}}
- ruleType: {{ruleType}}
- reasonCodePrefix: {{reasonCodePrefix}}

Input contract:
{{inputContractJson}}

Output contract:
{{outputContractJson}}

Supported operators:
=, !=, <, <=, >, >=, in, notIn, contains, isNull, isNotNull

Existing structured JSON, if any:
{{existingStructuredJson}}

Maker logic text:
{{logicText}}

Return JSON in this response shape:
{
  "status": "CONVERTED" | "CONVERSION_FAILED",
  "ruleLogicSpec": { ... },
  "warnings": [
    { "code": "string", "message": "string", "path": "optional json path" }
  ],
  "errors": [
    { "code": "string", "message": "string", "path": "optional json path" }
  ]
}
```

### 9.3 Prompt Guardrails

The backend should additionally enforce:

- Temperature should be low.
- Response format should require JSON object where provider support exists.
- The backend must parse and validate AI output before saving as converted logic.
- The backend stores prompt version, model name, prompt input hash, raw response, parsed response, and validation result.
- AI warnings do not block conversion by themselves, but validation errors block execution.

## 10. PostgreSQL Data Model

The design assumes Spring Boot with PostgreSQL. JSON artifacts use `jsonb`.

### 10.1 `rule_asset`

Stores stable rule identity and contract.

```sql
create table rule_asset (
  rule_id varchar(64) primary key,
  rule_name varchar(255) not null,
  rule_type varchar(64) not null,
  category varchar(64) not null,
  owner_team varchar(128) not null,
  input_contract jsonb not null,
  output_contract jsonb not null,
  active_logic_version_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 10.2 `rule_draft`

Stores maker draft lifecycle.

```sql
create table rule_draft (
  draft_id uuid primary key,
  rule_id varchar(64) not null references rule_asset(rule_id),
  draft_status varchar(64) not null,
  maker_user_id varchar(128) not null,
  checker_user_id varchar(128) null,
  base_logic_version_id uuid null,
  current_logic_version_id uuid null,
  submitted_at timestamptz null,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 10.3 `rule_logic_version`

Stores maker text and converted structured JSON.

```sql
create table rule_logic_version (
  logic_version_id uuid primary key,
  draft_id uuid not null references rule_draft(draft_id),
  rule_id varchar(64) not null references rule_asset(rule_id),
  version_no integer not null,
  source_type varchar(64) not null,
  logic_text text not null,
  structured_json jsonb null,
  structured_json_hash varchar(128) null,
  validation_status varchar(64) not null,
  created_by varchar(128) not null,
  created_at timestamptz not null default now(),
  unique (draft_id, version_no)
);
```

### 10.4 `ai_conversion_run`

Stores AI conversion audit trail.

```sql
create table ai_conversion_run (
  conversion_run_id uuid primary key,
  logic_version_id uuid not null references rule_logic_version(logic_version_id),
  prompt_version varchar(64) not null,
  model_name varchar(128) not null,
  request_payload jsonb not null,
  response_payload jsonb not null,
  status varchar(64) not null,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz null
);
```

### 10.5 `logic_validation_result`

Stores validation evidence.

```sql
create table logic_validation_result (
  validation_result_id uuid primary key,
  logic_version_id uuid not null references rule_logic_version(logic_version_id),
  status varchar(64) not null,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  validator_version varchar(64) not null,
  created_at timestamptz not null default now()
);
```

### 10.6 `simulation_run`

Stores maker and checker simulation runs.

```sql
create table simulation_run (
  simulation_run_id uuid primary key,
  draft_id uuid not null references rule_draft(draft_id),
  logic_version_id uuid not null references rule_logic_version(logic_version_id),
  run_by varchar(128) not null,
  run_role varchar(32) not null,
  scenario_name varchar(255) null,
  input_payload jsonb not null,
  output_payload jsonb not null,
  status varchar(64) not null,
  started_at timestamptz not null,
  completed_at timestamptz null
);
```

### 10.7 `simulation_rule_trace`

Stores per-rule execution trace.

```sql
create table simulation_rule_trace (
  trace_id uuid primary key,
  simulation_run_id uuid not null references simulation_run(simulation_run_id),
  rule_id varchar(64) not null,
  rule_type varchar(64) not null,
  status varchar(64) not null,
  matched_item_id varchar(128) null,
  input_snapshot jsonb not null,
  output_snapshot jsonb not null,
  trace_message text null,
  trace_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### 10.8 `checker_review`

Stores checker decision.

```sql
create table checker_review (
  review_id uuid primary key,
  draft_id uuid not null references rule_draft(draft_id),
  submitted_logic_version_id uuid not null references rule_logic_version(logic_version_id),
  status varchar(64) not null,
  checker_user_id varchar(128) not null,
  decision varchar(64) null,
  decision_comment text null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 11. Java Backend Design

### 11.1 Core Components

```text
AiLogicConversionService
  Builds prompt, calls AI provider, parses response, stores conversion run.

RuleLogicValidator
  Validates schema and semantic consistency against rule asset contract.

RuleExecutionEngine
  Dispatches a validated RuleLogicSpec to the correct evaluator.

SimulationService
  Runs maker/checker simulations and stores output plus trace.

CheckerReviewService
  Controls submit, approve, reject, and request-change lifecycle.
```

### 11.2 Java Model Sketch

```java
public sealed interface RuleLogicSpec permits
    ScoringMatrixSpec,
    ThresholdMatrixSpec,
    DecisionTableSpec,
    ExclusionListSpec,
    LookupTableSpec,
    RankingMatrixSpec,
    WeightedAggregationSpec {

    String schemaVersion();
    String ruleId();
    RuleType ruleType();
    List<IoField> inputContract();
    List<IoField> outputContract();
}
```

```java
public record ConditionNode(
    String field,
    Operator operator,
    Object value,
    List<ConditionNode> all,
    List<ConditionNode> any
) {}
```

```java
public record RuleExecutionRequest(
    RuleLogicSpec spec,
    Map<String, Object> inputs,
    Map<String, RuleExecutionResult> priorRuleResults
) {}
```

```java
public record RuleExecutionResult(
    String ruleId,
    RuleType ruleType,
    ExecutionStatus status,
    Map<String, Object> outputs,
    String matchedItemId,
    String reasonCode,
    List<RuleTraceEntry> trace
) {}
```

### 11.3 Evaluator Interface

```java
public interface RuleEvaluator<T extends RuleLogicSpec> {
    RuleType supports();
    RuleExecutionResult evaluate(T spec, RuleExecutionContext context);
}
```

### 11.4 Execution Engine Pseudocode

```java
public RuleExecutionResult execute(RuleLogicSpec spec, Map<String, Object> inputs) {
    ValidationResult validation = validator.validate(spec);
    if (!validation.isValid()) {
        throw new InvalidRuleLogicException(validation);
    }

    RuleEvaluator evaluator = evaluatorRegistry.get(spec.ruleType());
    if (evaluator == null) {
        throw new UnsupportedRuleTypeException(spec.ruleType());
    }

    RuleExecutionContext context = new RuleExecutionContext(inputs);
    return evaluator.evaluate(spec, context);
}
```

### 11.5 ScoringMatrix Evaluator Pseudocode

```java
public RuleExecutionResult evaluate(ScoringMatrixSpec spec, RuleExecutionContext context) {
    for (Band band : spec.logic().bands()) {
        if (conditionEvaluator.matches(band.when(), context.inputs())) {
            return resultBuilder
                .computed(spec)
                .matchedItemId(band.id())
                .outputs(resolveOutputs(band.set(), context))
                .trace(band.trace())
                .build();
        }
    }

    DefaultAction defaultAction = spec.logic().defaultAction();
    return resultBuilder
        .computed(spec)
        .matchedItemId("DEFAULT")
        .outputs(resolveOutputs(defaultAction.set(), context))
        .trace(defaultAction.trace())
        .build();
}
```

### 11.6 DecisionTable Evaluator Pseudocode

```java
public RuleExecutionResult evaluate(DecisionTableSpec spec, RuleExecutionContext context) {
    for (DecisionRow row : spec.logic().rows()) {
        if (conditionEvaluator.matches(row.when(), context.inputs())) {
            return resultBuilder
                .computed(spec)
                .matchedItemId(row.id())
                .outputs(resolveOutputs(row.set(), context))
                .trace(row.trace())
                .build();
        }
    }

    return applyDefault(spec, context);
}
```

### 11.7 WeightedAggregation Evaluator Pseudocode

```java
public RuleExecutionResult evaluate(WeightedAggregationSpec spec, RuleExecutionContext context) {
    BigDecimal activeWeight = BigDecimal.ZERO;
    BigDecimal weightedTotal = BigDecimal.ZERO;

    for (WeightConfig weightConfig : spec.logic().weights()) {
        RuleExecutionResult child = context.priorRuleResult(weightConfig.ruleId());
        if (child == null || child.status() == ExecutionStatus.SKIPPED) {
            continue;
        }

        BigDecimal rating = extractRating(child);
        BigDecimal weight = weightConfig.weight();
        activeWeight = activeWeight.add(weight);
        weightedTotal = weightedTotal.add(rating.multiply(weight));
    }

    BigDecimal weightedScore = weightedTotal.divide(activeWeight, MathContext.DECIMAL64);
    int finalRating = ceiling(weightedScore);

    return resultBuilder
        .computed(spec)
        .outputs(Map.of(
            "overallRating", finalRating,
            "weightedScore", weightedScore,
            "activeWeight", activeWeight
        ))
        .trace("Weighted score calculated from active computed rule ratings")
        .build();
}
```

## 12. Standard Java Engine Design

The Java backend engine should be standardized by rule type. It should not require Java code changes for normal business scenario changes such as adding a threshold row, changing a rating value, changing a reason code, or adding a decision table row.

The design separates engine capability from business variation:

```text
Business variation lives in structured JSON.
Engine capability lives in reusable Java evaluators.
```

### 12.1 Standard Interpretation Flow

Every rule execution follows the same flow:

```text
Load structured JSON
  -> parse into RuleLogicSpec
  -> validate against schema and rule contract
  -> find evaluator by ruleType
  -> evaluate condition AST against input payload
  -> resolve configured output assignments
  -> return outputs and trace
```

### 12.2 Evaluator Registry

The backend registers one evaluator per supported rule type.

```java
@Component
public class RuleEvaluatorRegistry {
    private final Map<RuleType, RuleEvaluator<? extends RuleLogicSpec>> evaluators;

    public RuleEvaluatorRegistry(List<RuleEvaluator<? extends RuleLogicSpec>> evaluatorList) {
        this.evaluators = evaluatorList.stream()
            .collect(Collectors.toUnmodifiableMap(
                RuleEvaluator::supports,
                Function.identity()
            ));
    }

    public RuleEvaluator<? extends RuleLogicSpec> get(RuleType ruleType) {
        RuleEvaluator<? extends RuleLogicSpec> evaluator = evaluators.get(ruleType);
        if (evaluator == null) {
            throw new UnsupportedRuleTypeException(ruleType);
        }
        return evaluator;
    }
}
```

### 12.3 Standard Execution Engine

The execution engine is generic. It does not know about Cash, SAA Allocation, House View, or Investment Idea rules. It only knows how to validate a rule spec and dispatch to the evaluator for the declared `ruleType`.

```java
@Service
public class StandardRuleExecutionEngine {
    private final RuleLogicParser parser;
    private final RuleLogicValidator validator;
    private final RuleEvaluatorRegistry evaluatorRegistry;

    public RuleExecutionResult execute(
        JsonNode structuredJson,
        Map<String, Object> inputPayload,
        Map<String, RuleExecutionResult> priorRuleResults
    ) {
        RuleLogicSpec spec = parser.parse(structuredJson);

        ValidationResult validation = validator.validate(spec);
        if (!validation.isValid()) {
            throw new InvalidRuleLogicException(validation);
        }

        RuleEvaluator evaluator = evaluatorRegistry.get(spec.ruleType());
        RuleExecutionContext context = new RuleExecutionContext(
            inputPayload,
            priorRuleResults
        );

        return evaluator.evaluate(spec, context);
    }
}
```

### 12.4 Rule Function Execution Engine

Individual rule JSON is executed by `StandardRuleExecutionEngine`. Rule functions use a higher-level structured JSON artifact that tells Java how to orchestrate multiple rules.

Supported function execution types:

| Execution type | Java handler | Purpose |
| --- | --- | --- |
| `PARALLEL_RULE_FLOW` | `RuleFunctionExecutionEngine.executeRuleFlow` | Runs multiple rule families independently, then applies an aggregation node such as `WeightedAggregation`. |
| `DECISION_TREE` | `RuleFunctionExecutionEngine.executeDecisionTree` | Evaluates configured condition nodes with `onTrue`, `onFalse`, named `flowId`, warning, terminal, and next-node branches. |

Example function execution envelope:

```json
{
  "schemaVersion": "1.0",
  "functionKey": "II",
  "functionName": "Investment Idea Suitability and Recommendation",
  "executionType": "DECISION_TREE",
  "javaHandler": "RuleFunctionExecutionEngine.executeDecisionTree",
  "rootNodeId": "NODE-R-PRESTR-001",
  "flows": [
    {
      "flowId": "RESTRICTION_BLOCK_FLOW",
      "type": "TERMINAL",
      "terminal": "NOT_RECOMMENDED"
    },
    {
      "flowId": "HARD_ELIGIBILITY_FLOW",
      "type": "CONTINUE",
      "startsAt": "NODE-R-HELIG-001"
    }
  ],
  "nodes": [
    {
      "nodeId": "NODE-R-PRESTR-001",
      "ruleId": "R-PRESTR-001",
      "condition": {
        "field": "restrictedFlags",
        "operator": "contains",
        "value": "PRODUCT_BLOCKED"
      },
      "onTrue": {
        "flowId": "RESTRICTION_BLOCK_FLOW",
        "terminal": "NOT_RECOMMENDED",
        "reasonCode": "IDEA-RESTRICTED"
      },
      "onFalse": {
        "flowId": "HARD_ELIGIBILITY_FLOW",
        "nextNodeId": "NODE-R-HELIG-001"
      }
    }
  ],
  "governance": {
    "requiresMakerReview": true,
    "requiresCheckerApproval": true,
    "executableBy": "JAVA_BACKEND_ONLY"
  }
}
```

Pseudocode:

```java
public RuleFunctionExecutionResult executeDecisionTree(
    RuleFunctionSpec functionSpec,
    Map<String, Object> inputPayload
) {
    validator.validate(functionSpec);

    RuleFunctionContext context = new RuleFunctionContext(inputPayload);
    FunctionNode current = functionSpec.node(functionSpec.rootNodeId());

    while (current != null) {
        RuleExecutionResult ruleResult = standardRuleExecutionEngine.execute(
            ruleRepository.loadStructuredJson(current.ruleId()),
            context.inputPayload(),
            context.priorRuleResults()
        );
        context.record(ruleResult);

        boolean matched = conditionEvaluator.matches(current.condition(), context.combinedFacts());
        NodeTransition transition = matched ? current.onTrue() : current.onFalse();
        context.enterFlow(transition.flowId());

        if (transition.warning() != null) {
            context.addWarning(transition.warning());
        }
        if (transition.terminal() != null) {
            return resultBuilder.terminal(functionSpec, transition, context);
        }

        current = functionSpec.node(transition.nextNodeId());
    }

    return resultBuilder.completed(functionSpec, context);
}
```

### 12.5 Standard Condition Evaluator

The condition evaluator is shared by `ScoringMatrix`, `ThresholdMatrix`, `DecisionTable`, `ExclusionList`, and `RankingMatrix`. It evaluates JSON condition nodes using an allowlist of operators.

```java
@Component
public class ConditionEvaluator {
    public boolean matches(ConditionNode condition, Map<String, Object> inputs) {
        if (condition.all() != null) {
            return condition.all().stream().allMatch(child -> matches(child, inputs));
        }

        if (condition.any() != null) {
            return condition.any().stream().anyMatch(child -> matches(child, inputs));
        }

        Object actualValue = inputs.get(condition.field());
        Object expectedValue = condition.value();

        return switch (condition.operator()) {
            case EQ -> Objects.equals(actualValue, expectedValue);
            case NE -> !Objects.equals(actualValue, expectedValue);
            case LT -> compare(actualValue, expectedValue) < 0;
            case LTE -> compare(actualValue, expectedValue) <= 0;
            case GT -> compare(actualValue, expectedValue) > 0;
            case GTE -> compare(actualValue, expectedValue) >= 0;
            case IN -> asCollection(expectedValue).contains(actualValue);
            case NOT_IN -> !asCollection(expectedValue).contains(actualValue);
            case CONTAINS -> contains(actualValue, expectedValue);
            case IS_NULL -> actualValue == null;
            case IS_NOT_NULL -> actualValue != null;
        };
    }
}
```

### 12.6 Standard Output Resolver

Output assignment is also generic. A rule evaluator returns the `set` block from the matched JSON row, and the resolver turns it into output values.

```java
@Component
public class OutputResolver {
    public Map<String, Object> resolve(
        Map<String, Object> configuredOutputs,
        RuleExecutionContext context
    ) {
        Map<String, Object> resolved = new LinkedHashMap<>();

        for (Map.Entry<String, Object> entry : configuredOutputs.entrySet()) {
            String outputField = entry.getKey();
            Object configuredValue = entry.getValue();

            if (configuredValue instanceof String value && value.startsWith("$input.")) {
                String inputField = value.substring("$input.".length());
                resolved.put(outputField, context.inputs().get(inputField));
            } else if (configuredValue instanceof String value && value.startsWith("$computed.")) {
                resolved.put(outputField, context.computedValue(value));
            } else {
                resolved.put(outputField, configuredValue);
            }
        }

        return resolved;
    }
}
```

### 12.7 Example: Same Java Code, Different Business Scenarios

The same `ScoringMatrixEvaluator` can execute Cash, Income Return, Growth Return, ESG, or SAA Number rules because the differences are stored in JSON.

Cash example:

```json
{
  "ruleType": "ScoringMatrix",
  "logic": {
    "bands": [
      {
        "when": { "field": "cashRatio", "operator": "<=", "value": 20 },
        "set": { "cashRating": 3, "cashReasonCode": "PS-CASH-003" }
      }
    ],
    "default": {
      "set": { "cashRating": 5, "cashReasonCode": "PS-CASH-005" }
    }
  }
}
```

ESG example using the same evaluator:

```json
{
  "ruleType": "ScoringMatrix",
  "logic": {
    "bands": [
      {
        "when": { "field": "esgScore", "operator": ">=", "value": 80 },
        "set": { "esgRating": 1, "esgReasonCode": "PS-ESG-001" }
      }
    ],
    "default": {
      "set": { "esgRating": 5, "esgReasonCode": "PS-ESG-005" }
    }
  }
}
```

No Java code changes are needed between these two examples.

### 12.8 When Java Code Changes Are Required

| Change | Java Code Change Required? | Reason |
| --- | --- | --- |
| Change threshold value from `20` to `25` | No | Data-only change in JSON. |
| Add a new `ScoringMatrix` band | No | Evaluator already handles ordered bands. |
| Add a new `DecisionTable` row | No | Evaluator already handles ordered rows. |
| Add a new reason code | No | Output assignment is data-driven. |
| Add a new supported operator such as `betweenDates` | Yes | Condition evaluator must safely implement and validate it. |
| Add a new rule type such as `OptimizationRule` | Yes | New JSON schema and evaluator are needed. |
| Add external reference data lookup | Likely yes | Engine needs a controlled data-access capability. |
| Add side effects such as creating alerts or tasks | Yes | Current engine is simulation/output only and side effects need governance. |

## 13. Simulation Result Design

### 13.1 Single Rule Simulation Output

```json
{
  "simulationRunId": "SIM-10001",
  "logicVersionId": "LV-20001",
  "status": "COMPLETED",
  "input": {
    "cashRatio": 12.4
  },
  "output": {
    "cashRating": 3,
    "cashReasonCode": "PS-CASH-003"
  },
  "trace": [
    {
      "ruleId": "R-CASH-001",
      "ruleType": "ScoringMatrix",
      "status": "COMPUTED",
      "matchedItemId": "CASH-BAND-003",
      "trace": "Cash ratio <= 20%",
      "inputSnapshot": {
        "cashRatio": 12.4
      },
      "outputSnapshot": {
        "cashRating": 3,
        "cashReasonCode": "PS-CASH-003"
      }
    }
  ]
}
```

### 13.2 Rule Function Simulation Output

```json
{
  "simulationRunId": "SIM-20001",
  "functionKey": "PS",
  "status": "COMPLETED",
  "finalOutput": {
    "overallRating": 4,
    "weightedScore": 3.72,
    "activeWeight": 100
  },
  "ruleResults": [
    {
      "ruleId": "R-CASH-001",
      "status": "COMPUTED",
      "outputs": {
        "cashRating": 3,
        "cashReasonCode": "PS-CASH-003"
      }
    },
    {
      "ruleId": "R-OVERALL-001",
      "status": "COMPUTED",
      "outputs": {
        "overallRating": 4,
        "weightedScore": 3.72,
        "activeWeight": 100
      }
    }
  ]
}
```

## 14. Governance Rules

- AI cannot approve, activate, or deploy rules.
- Maker must review AI converted JSON before simulation.
- Simulation can run only against valid structured JSON.
- Maker submission requires a simulation run against the latest logic version.
- Checker approval requires review of the same logic version that was submitted.
- Any change to logic text or structured JSON after simulation invalidates prior simulation evidence for submission.
- All AI conversion runs must be auditable.
- All simulation runs must be reproducible from stored structured JSON and input payload.

## 15. Implementation Sequence

### Phase 1: Structured JSON And Validation

- Define Java model for `RuleLogicSpec`.
- Implement JSON schema validation.
- Implement semantic validation.
- Store maker text and structured JSON in PostgreSQL.

### Phase 2: AI Conversion

- Implement backend-owned prompt template.
- Call AI provider from Spring Boot.
- Store conversion request/response.
- Parse and validate AI output.

### Phase 3: Execution Engine

- Implement condition evaluator.
- Implement evaluators for:
  - `ScoringMatrix`
  - `ThresholdMatrix`
  - `DecisionTable`
  - `ExclusionList`
  - `LookupTable`
  - `WeightedAggregation`
- Implement `RuleFunctionExecutionEngine.executeRuleFlow` for parallel rule-flow orchestration and aggregation.
- Implement `RuleFunctionExecutionEngine.executeDecisionTree` for condition-based node traversal and terminal outcomes.
- Validate function execution JSON before running any child rule.
- Return output and trace.

### Phase 4: Historical Regression And Review

- Implement maker simulation API.
- Store simulation output and per-rule trace.
- Implement historical regression suite execution.
- Store expected-versus-actual results and evidence packs.
- Block submission on unresolved required regression failures.
- Implement checker review API.
- Allow checker to rerun required regression suites.

### Phase 5: Per-Environment Release Control

- Model Development, UAT, and Production as separate instances.
- Implement maker-checker release candidate state per environment.
- Support immediate activation after checker approval.
- Support effective-date activation after checker approval.
- Ensure UAT approval cannot directly deploy or promote to Production.
- Support same-instance rollback.

### Phase 6: Platform Settings

- Implement environment instance settings.
- Implement access and role settings.
- Implement maker-checker policy settings.
- Implement AI workspace guardrail settings.
- Implement regression library and re-baseline settings.
- Implement release governance, audit, trace masking, and reference-data settings.

## 16. Acceptance Criteria

- Maker can save logic text.
- Maker can trigger AI conversion.
- Backend stores AI conversion run.
- Backend validates structured JSON.
- Invalid JSON cannot be simulated.
- Maker can run simulation against latest valid logic version.
- Regression result includes expected output, actual output, pass/fail status, and trace.
- Maker can submit only after latest valid regression evidence has no unresolved required failures.
- Checker can view maker logic text, structured JSON, validation result, and regression result.
- Checker can rerun required regression suites.
- Checker can approve, reject, or request changes.
- Approved candidates can be released only inside the selected environment instance.
- Production release supports immediate activation or effective-date activation.
- UAT approval does not directly deploy to Production.
- Platform Settings exposes environment, access, maker-checker, AI, regression, release, audit, and reference-data configuration areas.

## 17. Key Design Decisions

| Decision | Choice |
| --- | --- |
| AI ownership | Java backend owns AI conversion. |
| Execution model | Deterministic Java execution of structured JSON. |
| Storage | PostgreSQL with JSONB for rule specs and traces. |
| Rule authoring | Maker text is source input; structured JSON is executable artifact. |
| Safety | No arbitrary executable code from maker or AI output. |
| Regression evidence | Historical regression suites are the primary initial-phase proof mechanism. |
| Governance | Maker and checker regression runs are stored as evidence. |
| Release model | Development, UAT, and Production are separate release lanes with maker-checker approval in each. |
| Production activation | Production can activate immediately after checker approval or on a supplied effective date. |

## 18. Abbreviations

| Abbreviation | Meaning |
| --- | --- |
| AI | Artificial Intelligence. In this design, AI converts maker-authored logic text into structured JSON but does not approve or execute rules. |
| API | Application Programming Interface. Backend endpoints used by the frontend and services. |
| AST | Abstract Syntax Tree. A structured representation of logic. In this design, it is represented as JSON condition nodes such as `all`, `any`, `field`, `operator`, and `value`. |
| CIP | Client Investment Profile. A client risk/profile classification such as Conservative, Moderate, Balanced, or Aggressive. |
| DB | Database. In this design, PostgreSQL is the target database. |
| ESG | Environmental, Social, and Governance. Used for sustainable investment scoring. |
| I/O | Input/Output. The contract defining fields consumed and produced by a rule. |
| JSON | JavaScript Object Notation. The structured data format used for rule logic specifications. |
| JSONB | PostgreSQL binary JSON storage type. Used to store structured rule JSON, validation details, simulation inputs, outputs, and traces. |
| LLM | Large Language Model. The AI model used for logic-text-to-JSON conversion. |
| ODM | Operational Decision Manager. Refers to IBM ODM-style enterprise rule management and execution. |
| OW | Overweight. A positive house view signal used in investment idea ranking. |
| SAA | Strategic Asset Allocation. Used in portfolio allocation rules and gap checks. |
| SG / HK / MY / TH | Singapore, Hong Kong, Malaysia, and Thailand jurisdiction codes. |
| SQL | Structured Query Language. Used for database schema and queries. |
| UI | User Interface. The Decision Hub frontend experience. |
| UW | Underweight. A negative house view signal used in investment idea ranking. |
| UUID | Universally Unique Identifier. Used as a stable identifier for drafts, logic versions, simulations, and reviews. |
