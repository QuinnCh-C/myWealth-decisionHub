import { useState, useEffect, useRef } from "react";
import {
  Search, Bell, ChevronDown, Sparkles, PenLine,
  FlaskConical, FolderOpen, ClipboardCheck, Rocket,
  Settings, CheckCircle2, Clock, AlertTriangle,
  Play, GitCompare, History, Eye, MessageSquare,
  Shield, Check, X, FileText, AlertCircle, Info, Lock,
  ChevronRight, MoreHorizontal, Bot, Send, Database,
  Plus, Layers, Code2, ArrowDown, Trash2, Edit3,
  Hash, Type, List, ToggleLeft, Package, ChevronUp,
  RefreshCw, Save, TestTube, Zap, ArrowRight, Copy,
  GitBranch, Wand2, CornerDownRight, Minus
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "studio"|"ai-works"|"drafts"|"review-queue"|"release"|"trace"|"settings"|"maker-submit";
type StudioView = "rule"|"function"|"none";

interface IOField {
  name: string;
  type: "string"|"number"|"boolean"|"enum"|"array"|"object";
  required: boolean;
  desc: string;
  sample: string;
  consumedBy?: string[];  // ruleIds that use this input
}

interface Rule {
  id: string; name: string; shortName: string;
  type: "ScoringMatrix"|"ThresholdMatrix"|"DecisionTable"|"ExclusionList"|"WeightedAggregation"|"LookupTable"|"RankingMatrix";
  category: "scoring"|"eligibility"|"ranking"|"routing"|"aggregation";
  desc: string;
  inputs: IOField[];
  outputs: IOField[];
  version: string; lastModified: string;
  usedBy: string[];
  modified?: boolean;
}

interface RuleFunctionDef {
  key: string; name: string; desc: string;
  domain: string; tier: string; owner: string;
  activeRelease: string; draftRelease: string|null; status: string;
  ruleIds: string[];
  weights?: Record<string, number>;
  conditionSteps?: Array<{
    id: string;
    name: string;
    condition: string;
    trueFlowId: string;
    trueLabel: string;
    falseFlowId: string;
    falseLabel: string;
    note?: string;
  }>;
  flowOverrides?: Record<string, {
    condition?: string;
    trueFlowId?: string;
    trueLabel?: string;
    falseFlowId?: string;
    falseLabel?: string;
    note?: string;
  }>;
}

interface TestCase {
  id: string; name: string; fnKey: string;
  inputs: Record<string, string>;
  expectedOutput: Record<string, string>;
  status: "pass"|"fail"|"not-run";
  createdAt: string;
}

interface RuleSimResult {
  ruleId: string; ruleName: string;
  rating: number|null; state: "Computed"|"Skipped";
  weight: number; reasonCode: string; output: string;
}

interface SimResult {
  ruleResults: RuleSimResult[];
  weightedScore: number;
  finalRating: number|null;
  finalOutput: Record<string, string>;
}

interface ValidationCheck {
  label: string;
  detail: string;
  severity: "pass"|"warning"|"error";
}

interface AssistantContext {
  source: "rule"|"function";
  ruleId: string;
  ruleName: string;
  ruleType: string;
  prompt: string;
}

// ─── Individual Rules data ────────────────────────────────────────────────────

const RULES: Rule[] = [
  { id:"R-CIP-001", name:"CIP / Portfolio Risk Alignment", shortName:"CIP Alignment", type:"ScoringMatrix", category:"scoring", version:"v2.1", lastModified:"10 Jun 2026", usedBy:["PS"], modified:false,
    desc:"Evaluates alignment between declared Client Investment Profile and measured portfolio risk. Produces a misalignment rating 1–5.",
    inputs:[ {name:"cip",type:"enum",required:true,desc:"Client Investment Profile",sample:"Moderate"}, {name:"portfolioRisk",type:"number",required:true,desc:"Measured portfolio risk score (1–5)",sample:"3.2"} ],
    outputs:[ {name:"cipRating",type:"number",required:true,desc:"CIP alignment rating (1–5)",sample:"3"}, {name:"cipReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-CIP-003"} ] },

  { id:"R-CASH-001", name:"Cash", shortName:"Cash", type:"ScoringMatrix", category:"scoring", version:"v1.3", lastModified:"05 Jun 2026", usedBy:["PS"], modified:false,
    desc:"Evaluates the portfolio cash ratio against CIP-specific policy bands.",
    inputs:[ {name:"cashRatio",type:"number",required:true,desc:"Cash as % of portfolio",sample:"12.4"} ],
    outputs:[ {name:"cashRating",type:"number",required:true,desc:"Cash rating (1–5)",sample:"2"}, {name:"cashReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-CASH-002"} ] },

  { id:"R-INCOME-001", name:"Income Return", shortName:"Income Return", type:"ScoringMatrix", category:"scoring", version:"v1.2", lastModified:"03 Jun 2026", usedBy:["PS"], modified:false,
    desc:"Scores trailing 12-month income return % against CIP-specific target bands.",
    inputs:[ {name:"incomeReturn",type:"number",required:true,desc:"Income return % (trailing 12m)",sample:"3.2"}, {name:"cip",type:"enum",required:true,desc:"Client Investment Profile",sample:"Moderate"} ],
    outputs:[ {name:"incomeRating",type:"number",required:true,desc:"Income return rating (1–5)",sample:"3"}, {name:"incomeReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-INCOME-003"} ] },

  { id:"R-GROWTH-001", name:"Growth Return", shortName:"Growth Return", type:"ScoringMatrix", category:"scoring", version:"v1.2", lastModified:"03 Jun 2026", usedBy:["PS"], modified:false,
    desc:"Scores trailing 12-month growth return % against CIP-specific target bands.",
    inputs:[ {name:"growthReturn",type:"number",required:true,desc:"Growth return % (trailing 12m)",sample:"5.1"}, {name:"cip",type:"enum",required:true,desc:"Client Investment Profile",sample:"Moderate"} ],
    outputs:[ {name:"growthRating",type:"number",required:true,desc:"Growth return rating (1–5)",sample:"3"}, {name:"growthReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-GROWTH-003"} ] },

  { id:"R-TENOR-001", name:"Tenor", shortName:"Tenor", type:"ScoringMatrix", category:"scoring", version:"v1.1", lastModified:"01 Jun 2026", usedBy:["PS"], modified:false,
    desc:"Evaluates portfolio average tenor. Skipped if tenor data is absent; weights are renormalised.",
    inputs:[ {name:"tenor",type:"number",required:false,desc:"Portfolio average tenor (years) — optional",sample:"null"} ],
    outputs:[ {name:"tenorRating",type:"number",required:false,desc:"Tenor rating (1–5) or null if skipped",sample:"null"}, {name:"tenorSkip",type:"string",required:false,desc:"Skip reason code if skipped",sample:"PS-TENOR-SKIP-001"} ] },

  { id:"R-SAANUM-001", name:"SAA Number", shortName:"SAA Number", type:"ScoringMatrix", category:"scoring", version:"v1.0", lastModified:"28 May 2026", usedBy:["PS"], modified:false,
    desc:"Counts the number of distinct SAA asset classes represented in the portfolio.",
    inputs:[ {name:"saaNumber",type:"number",required:true,desc:"Number of SAA asset classes held",sample:"7"} ],
    outputs:[ {name:"saaNumRating",type:"number",required:true,desc:"SAA number rating (1–5)",sample:"3"}, {name:"saaNumReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-SAANUM-003"} ] },

  { id:"R-SAAALLOC-001", name:"SAA Allocation", shortName:"SAA Allocation", type:"ThresholdMatrix", category:"scoring", version:"v4.8-draft", lastModified:"13 Jun 2026", usedBy:["PS"], modified:true,
    desc:"Evaluates client-to-model allocation gap by CIP tier against a configurable threshold matrix. MODIFIED in draft v4.8 — Moderate CIP thresholds reduced.",
    inputs:[ {name:"saaAllocationGap",type:"number",required:true,desc:"Max allocation gap % vs model",sample:"14.2"}, {name:"cip",type:"enum",required:true,desc:"Client Investment Profile",sample:"Moderate"} ],
    outputs:[ {name:"saaAllocRating",type:"number",required:true,desc:"SAA allocation rating (1–5)",sample:"5"}, {name:"saaAllocGap",type:"number",required:true,desc:"Allocation gap % used",sample:"14.2"}, {name:"saaAllocReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-SAA-GAP-004"} ] },

  { id:"R-HV-001", name:"House View", shortName:"House View", type:"ThresholdMatrix", category:"scoring", version:"v4.8-draft", lastModified:"13 Jun 2026", usedBy:["PS"], modified:true,
    desc:"Evaluates deviation from house view overweight/underweight positions. MODIFIED in draft v4.8 — UW threshold updated.",
    inputs:[ {name:"houseViewAlignment",type:"number",required:true,desc:"Deviation from house view positions (%)",sample:"-9.1"} ],
    outputs:[ {name:"hvRating",type:"number",required:true,desc:"House view rating (1–5)",sample:"4"}, {name:"hvReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-HV-UW-002"} ] },

  { id:"R-THEME-001", name:"Thematic", shortName:"Thematic", type:"ScoringMatrix", category:"scoring", version:"v1.1", lastModified:"20 May 2026", usedBy:["PS"], modified:false,
    desc:"Scores thematic exposure flags against policy guidelines.",
    inputs:[ {name:"thematicFlags",type:"array",required:false,desc:"Active thematic exposure flags",sample:"[TECH,CLIMATE]"} ],
    outputs:[ {name:"thematicRating",type:"number",required:true,desc:"Thematic rating (1–5)",sample:"3"}, {name:"thematicReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-THEME-003"} ] },

  { id:"R-ESG-001", name:"Sustainable Investment", shortName:"ESG", type:"ScoringMatrix", category:"scoring", version:"v1.0", lastModified:"15 May 2026", usedBy:["PS"], modified:false,
    desc:"Evaluates ESG/sustainable investment score against policy thresholds.",
    inputs:[ {name:"esgScore",type:"number",required:false,desc:"ESG / sustainable investment score (0–100)",sample:"68"} ],
    outputs:[ {name:"esgRating",type:"number",required:true,desc:"ESG rating (1–5)",sample:"2"}, {name:"esgReasonCode",type:"string",required:true,desc:"Reason code",sample:"PS-ESG-002"} ] },

  { id:"R-NTW-001", name:"Exceptions / NTW Treatment", shortName:"NTW / Exceptions", type:"ExclusionList", category:"routing", version:"v2.0", lastModified:"01 May 2026", usedBy:["PS"], modified:false,
    desc:"Handles exception portfolios and non-traditional wealth (NTW) treatment. Unchanged in draft v4.8.",
    inputs:[ {name:"exceptions",type:"array",required:false,desc:"Active exception or NTW records",sample:"[]"} ],
    outputs:[ {name:"exceptionApplied",type:"boolean",required:true,desc:"Whether exception treatment was applied",sample:"false"}, {name:"exceptionReasonCode",type:"string",required:false,desc:"Exception reason code",sample:""} ] },

  { id:"R-OVERALL-001", name:"Overall Weighted Rating", shortName:"Overall Rating", type:"WeightedAggregation", category:"aggregation", version:"v1.4", lastModified:"01 May 2026", usedBy:["PS"], modified:false,
    desc:"Aggregates per-rule ratings using configurable weights. Skipped rules are excluded and remaining weights renormalised to 100%.",
    inputs:[ {name:"ruleRatings",type:"object",required:true,desc:"Per-rule rating map",sample:"{cipRating:3,cashRating:2,...}"}, {name:"ruleWeights",type:"object",required:true,desc:"Per-rule weight config (must sum to 100)",sample:"{R-CIP-001:15,...}"} ],
    outputs:[ {name:"overallRating",type:"number",required:true,desc:"Portfolio strength rating (1–5)",sample:"4"}, {name:"weightedScore",type:"number",required:true,desc:"Raw weighted score before ceiling",sample:"3.72"}, {name:"activeWeight",type:"number",required:true,desc:"Sum of computed rule weights",sample:"92"} ] },

  // Investment Idea rules
  { id:"R-PRESTR-001", name:"Product Restrictions", shortName:"Product Restrictions", type:"ExclusionList", category:"eligibility", version:"v1.1", lastModified:"02 Jun 2026", usedBy:["II"], modified:false,
    desc:"Applies product-level and client-level restriction flags before any suitability evaluation.",
    inputs:[ {name:"restrictedFlags",type:"array",required:true,desc:"Product restriction flags",sample:"[]"}, {name:"clientRestrictions",type:"array",required:false,desc:"Client-specific restrictions",sample:"[]"} ],
    outputs:[ {name:"restricted",type:"boolean",required:true,desc:"Whether restriction applies",sample:"false"}, {name:"restrictionCode",type:"string",required:false,desc:"Restriction code if applied",sample:""} ] },

  { id:"R-HELIG-001", name:"Hard Eligibility", shortName:"Hard Eligibility", type:"DecisionTable", category:"eligibility", version:"v1.5", lastModified:"08 Jun 2026", usedBy:["II"], modified:false,
    desc:"Binary pass/fail rules evaluated in order. Any FAIL immediately blocks the recommendation.",
    inputs:[ {name:"cip",type:"enum",required:true,desc:"Client Investment Profile",sample:"Balanced"}, {name:"productRiskRating",type:"number",required:true,desc:"Product risk rating (1–5)",sample:"3"}, {name:"jurisdiction",type:"enum",required:true,desc:"Client booking jurisdiction",sample:"SG"} ],
    outputs:[ {name:"eligible",type:"boolean",required:true,desc:"Hard eligibility determination",sample:"true"}, {name:"eligReasonCode",type:"string",required:true,desc:"Reason code",sample:"IDEA-CIP-OK"} ] },

  { id:"R-SSUIT-001", name:"Soft Suitability", shortName:"Soft Suitability", type:"DecisionTable", category:"eligibility", version:"v1.3", lastModified:"08 Jun 2026", usedBy:["II"], modified:false,
    desc:"Evaluates soft suitability factors — produces warnings rather than hard blocks.",
    inputs:[ {name:"holdingConcentration",type:"number",required:true,desc:"Existing holding as % of AUM",sample:"22"}, {name:"liquidityNeed",type:"enum",required:true,desc:"Liquidity requirement",sample:"LOW"}, {name:"riskTolerance",type:"enum",required:true,desc:"Declared risk tolerance",sample:"Medium"} ],
    outputs:[ {name:"suitabilityWarnings",type:"array",required:true,desc:"Suitability warning codes",sample:"[IDEA-CONCENTRATION-WARN]"}, {name:"suitReasonCode",type:"string",required:true,desc:"Primary reason code",sample:"IDEA-SUIT-003"} ] },

  { id:"R-HVII-001", name:"House View Integration", shortName:"House View (II)", type:"LookupTable", category:"scoring", version:"v1.0", lastModified:"01 Jun 2026", usedBy:["II"], modified:false,
    desc:"Looks up house view overweight/underweight position for the product and adjusts the recommendation rank.",
    inputs:[ {name:"houseView",type:"enum",required:true,desc:"House view on product (OW/N/UW)",sample:"OW"}, {name:"thematicFlag",type:"boolean",required:false,desc:"Thematic exposure indicator",sample:"false"} ],
    outputs:[ {name:"hvAdjustment",type:"number",required:true,desc:"Rank adjustment (+1/0/−1)",sample:"+1"}, {name:"hvReasonCode",type:"string",required:true,desc:"Reason code",sample:"IDEA-HOUSEVIEW-OW"} ] },

  { id:"R-RANK-001", name:"Recommendation Ranking", shortName:"Rec. Ranking", type:"RankingMatrix", category:"ranking", version:"v1.2", lastModified:"05 Jun 2026", usedBy:["II"], modified:false,
    desc:"Assigns a recommendation rank 1–5 based on CIP-product profile alignment adjusted by house view.",
    inputs:[ {name:"cip",type:"enum",required:true,desc:"Client Investment Profile",sample:"Balanced"}, {name:"houseView",type:"enum",required:true,desc:"House view (OW/N/UW)",sample:"OW"}, {name:"investmentObjective",type:"string",required:true,desc:"Primary investment objective",sample:"Income"} ],
    outputs:[ {name:"recommendationRank",type:"number",required:true,desc:"Recommendation rank (1=highest)",sample:"2"}, {name:"advisorMessage",type:"string",required:true,desc:"Advisor-facing explanation",sample:"Suitable with concentration warning"}, {name:"rankReasonCode",type:"string",required:true,desc:"Reason code",sample:"IDEA-HOUSEVIEW-OW"} ] },
];

// ─── Rule Functions ───────────────────────────────────────────────────────────

const RULE_FUNCTIONS: RuleFunctionDef[] = [
  {
    key:"PS", name:"Portfolio Strength Rating", domain:"Wealth Advisory Portfolio Health",
    desc:"Calculates a 1–5 portfolio-strength rating from 11 weighted rule families. Weighted scoring of cash, CIP alignment, returns, SAA, house view, thematic, ESG and exception handling.",
    tier:"Tier 1", owner:"Advisory Solutions", activeRelease:"v4.7", draftRelease:"v4.8", status:"Draft - Maker Review Required",
    ruleIds:["R-CIP-001","R-CASH-001","R-INCOME-001","R-GROWTH-001","R-TENOR-001","R-SAANUM-001","R-SAAALLOC-001","R-HV-001","R-THEME-001","R-ESG-001","R-NTW-001","R-OVERALL-001"],
    weights:{ "R-CIP-001":15,"R-CASH-001":8,"R-INCOME-001":10,"R-GROWTH-001":10,"R-TENOR-001":5,"R-SAANUM-001":7,"R-SAAALLOC-001":18,"R-HV-001":12,"R-THEME-001":5,"R-ESG-001":5,"R-NTW-001":5 },
  },
  {
    key:"II", name:"Investment Idea Suitability and Recommendation", domain:"Advisory Recommendations",
    desc:"Determines suitability and recommendation rank for an investment idea based on client profile, restrictions, house view, product attributes and advisory controls.",
    tier:"Tier 1", owner:"Investment Advisory", activeRelease:"v2.9", draftRelease:null, status:"Active",
    ruleIds:["R-PRESTR-001","R-HELIG-001","R-SSUIT-001","R-HVII-001","R-RANK-001"],
  },
];

// ─── Initial test cases ───────────────────────────────────────────────────────

const INITIAL_TEST_CASES: TestCase[] = [
  { id:"TC-PS-001", name:"Moderate CIP — v4.7 baseline", fnKey:"PS",
    inputs:{ cip:"Moderate",cashRatio:"12.4",incomeReturn:"3.2",growthReturn:"5.1",saaAllocationGap:"8.0",houseViewAlignment:"-4.0",esgScore:"68",saaNumber:"7" },
    expectedOutput:{ overallRating:"3",weightedScore:"2.91" }, status:"pass", createdAt:"10 Jun 2026" },
  { id:"TC-PS-002", name:"Moderate CIP — draft v4.8 impact (C-10482)", fnKey:"PS",
    inputs:{ cip:"Moderate",cashRatio:"12.4",incomeReturn:"3.2",growthReturn:"5.1",saaAllocationGap:"14.2",houseViewAlignment:"-9.1",esgScore:"68",saaNumber:"7" },
    expectedOutput:{ overallRating:"4",weightedScore:"3.72" }, status:"not-run", createdAt:"13 Jun 2026" },
  { id:"TC-PS-003", name:"Conservative CIP — strong portfolio", fnKey:"PS",
    inputs:{ cip:"Conservative",cashRatio:"5.0",incomeReturn:"4.5",growthReturn:"7.2",saaAllocationGap:"2.0",houseViewAlignment:"1.5",esgScore:"82",saaNumber:"9" },
    expectedOutput:{ overallRating:"2",weightedScore:"1.85" }, status:"pass", createdAt:"08 Jun 2026" },
  { id:"TC-PS-004", name:"Aggressive CIP — overweight cash", fnKey:"PS",
    inputs:{ cip:"Aggressive",cashRatio:"32.0",incomeReturn:"1.5",growthReturn:"2.0",saaAllocationGap:"5.0",houseViewAlignment:"-3.0",esgScore:"45",saaNumber:"5" },
    expectedOutput:{ overallRating:"4",weightedScore:"3.58" }, status:"fail", createdAt:"07 Jun 2026" },
  { id:"TC-II-001", name:"Balanced client — OW house view (Asia Income Fund)", fnKey:"II",
    inputs:{ cip:"Balanced",productRiskRating:"3",jurisdiction:"SG",holdingConcentration:"22",houseView:"OW",investmentObjective:"Income",liquidityNeed:"LOW",riskTolerance:"Medium" },
    expectedOutput:{ eligible:"true",recommendationRank:"2",advisorMessage:"Suitable with concentration warning" }, status:"pass", createdAt:"08 Jun 2026" },
  { id:"TC-II-002", name:"Conservative client — restricted product", fnKey:"II",
    inputs:{ cip:"Conservative",productRiskRating:"5",jurisdiction:"SG",holdingConcentration:"5",houseView:"N",investmentObjective:"Capital Preservation",liquidityNeed:"HIGH",riskTolerance:"Low" },
    expectedOutput:{ eligible:"false",recommendationRank:"N/A",advisorMessage:"Ineligible — product risk exceeds client tolerance" }, status:"pass", createdAt:"07 Jun 2026" },
];

// ─── Simulation engine (mock) ─────────────────────────────────────────────────

function runSimulation(fnKey: string, inputs: Record<string, string>): SimResult {
  if (fnKey === "PS") {
    const cip = inputs.cip || "Moderate";
    const cash = parseFloat(inputs.cashRatio || "12") || 12;
    const income = parseFloat(inputs.incomeReturn || "3") || 3;
    const growth = parseFloat(inputs.growthReturn || "5") || 5;
    const saaGap = parseFloat(inputs.saaAllocationGap || "8") || 8;
    const hvDev = parseFloat(inputs.houseViewAlignment || "-5") || -5;
    const esg = parseFloat(inputs.esgScore || "60") || 60;
    const saaNum = parseInt(inputs.saaNumber || "7") || 7;
    const tenorStr = inputs.tenor;
    const hasTenor = tenorStr && tenorStr !== "" && tenorStr !== "null";

    const cipRating = Math.min(5, Math.max(1, cip==="Conservative"?2:cip==="Moderate"?3:cip==="Balanced"?2:cip==="Aggressive"?3:3));
    const cashR = cash<=5?1:cash<=10?2:cash<=20?3:cash<=30?4:5;
    const incomeR = income>=5?1:income>=3.5?2:income>=2?3:income>=1?4:5;
    const growthR = growth>=8?1:growth>=5?2:growth>=3?3:growth>=1?4:5;
    // SAA Allocation — draft thresholds for Moderate
    const saaThresh = (cip==="Moderate") ? 12 : (cip==="Conservative") ? 8 : 18;
    const absGap = Math.abs(saaGap);
    const saaR = absGap<=2?1:absGap<=5?2:absGap<=saaThresh*0.65?3:absGap<=saaThresh?4:5;
    // House View — draft thresholds
    const hvAbs = Math.abs(hvDev);
    const hvR = hvAbs<=2?1:hvAbs<=4?2:hvAbs<=8?3:hvAbs<=10?4:5;
    const saaNumR = saaNum>=9?1:saaNum>=7?2:saaNum>=5?3:saaNum>=3?4:5;
    const esgR = esg>=80?1:esg>=60?2:esg>=40?3:esg>=20?4:5;

    const baseWeights: Record<string, number> = {
      "R-CIP-001":15,"R-CASH-001":8,"R-INCOME-001":10,"R-GROWTH-001":10,
      "R-SAANUM-001":7,"R-SAAALLOC-001":18,"R-HV-001":12,"R-THEME-001":5,"R-ESG-001":5,"R-NTW-001":5,
    };
    if (hasTenor) baseWeights["R-TENOR-001"] = 5;
    const totalW = Object.values(baseWeights).reduce((a,b)=>a+b, 0);
    const norm = (w: number) => (w / totalW) * 100;

    const ruleResults: RuleSimResult[] = [
      { ruleId:"R-CIP-001",    ruleName:"CIP Alignment",    rating:cipRating,          state:"Computed",            weight:norm(15), reasonCode:`PS-CIP-00${cipRating}`,     output:`Rating ${cipRating}` },
      { ruleId:"R-CASH-001",   ruleName:"Cash",              rating:cashR,              state:"Computed",            weight:norm(8),  reasonCode:`PS-CASH-00${cashR}`,        output:`Rating ${cashR}` },
      { ruleId:"R-INCOME-001", ruleName:"Income Return",     rating:incomeR,            state:"Computed",            weight:norm(10), reasonCode:`PS-INCOME-00${incomeR}`,    output:`Rating ${incomeR}` },
      { ruleId:"R-GROWTH-001", ruleName:"Growth Return",     rating:growthR,            state:"Computed",            weight:norm(10), reasonCode:`PS-GROWTH-00${growthR}`,    output:`Rating ${growthR}` },
      { ruleId:"R-TENOR-001",  ruleName:"Tenor",             rating:hasTenor?3:null,    state:hasTenor?"Computed":"Skipped", weight:hasTenor?norm(5):0, reasonCode:hasTenor?"PS-TENOR-003":"PS-TENOR-SKIP-001", output:hasTenor?"Rating 3":"Skipped — weight renormalised" },
      { ruleId:"R-SAANUM-001", ruleName:"SAA Number",        rating:saaNumR,            state:"Computed",            weight:norm(7),  reasonCode:`PS-SAANUM-00${saaNumR}`,    output:`Rating ${saaNumR}` },
      { ruleId:"R-SAAALLOC-001",ruleName:"SAA Allocation",   rating:saaR,               state:"Computed",            weight:norm(18), reasonCode:`PS-SAA-GAP-00${saaR}`,      output:`Gap ${absGap.toFixed(1)}% → Rating ${saaR}` },
      { ruleId:"R-HV-001",     ruleName:"House View",        rating:hvR,                state:"Computed",            weight:norm(12), reasonCode:`PS-HV-UW-00${hvR}`,         output:`Dev ${hvDev.toFixed(1)}% → Rating ${hvR}` },
      { ruleId:"R-THEME-001",  ruleName:"Thematic",          rating:3,                  state:"Computed",            weight:norm(5),  reasonCode:"PS-THEME-003",              output:"Rating 3" },
      { ruleId:"R-ESG-001",    ruleName:"ESG",               rating:esgR,               state:"Computed",            weight:norm(5),  reasonCode:`PS-ESG-00${esgR}`,          output:`Score ${esg} → Rating ${esgR}` },
      { ruleId:"R-NTW-001",    ruleName:"NTW / Exceptions",  rating:3,                  state:"Computed",            weight:norm(5),  reasonCode:"PS-NTW-003",                output:"No exceptions applied" },
    ];

    const computed = ruleResults.filter(r => r.state==="Computed" && r.rating !== null);
    const tw = computed.reduce((s,r) => s+r.weight, 0);
    const ws = computed.reduce((s,r) => s+(r.rating!*r.weight/tw), 0);
    const finalRating = Math.ceil(ws);

    return { ruleResults, weightedScore: ws, finalRating, finalOutput:{ overallRating: String(finalRating), weightedScore: ws.toFixed(2), activeWeight: tw.toFixed(0)+"%" } };
  }

  // Investment Idea
  const eligible = inputs.productRiskRating && parseFloat(inputs.productRiskRating) > 4 ? false : true;
  const hvAdj = inputs.houseView === "OW" ? 1 : inputs.houseView === "UW" ? -1 : 0;
  const baseRank = inputs.cip === "Balanced" ? 2 : inputs.cip === "Moderate" ? 3 : 2;
  const rank = Math.min(5, Math.max(1, baseRank - hvAdj));
  const conc = parseFloat(inputs.holdingConcentration || "0");
  const warns = conc > 25 ? ["IDEA-CONCENTRATION-WARN"] : [];

  const ruleResults: RuleSimResult[] = [
    { ruleId:"R-PRESTR-001", ruleName:"Product Restrictions", rating:null, state:"Computed", weight:0, reasonCode:eligible?"IDEA-NO-RESTRICTION":"IDEA-RESTRICTED", output:eligible?"No restrictions":"RESTRICTED — blocked" },
    { ruleId:"R-HELIG-001",  ruleName:"Hard Eligibility",     rating:null, state:"Computed", weight:0, reasonCode:eligible?"IDEA-CIP-OK":"IDEA-CIP-BLOCK", output:eligible?"ELIGIBLE":"INELIGIBLE" },
    { ruleId:"R-SSUIT-001",  ruleName:"Soft Suitability",     rating:null, state:"Computed", weight:0, reasonCode:warns.length?"IDEA-CONCENTRATION-WARN":"IDEA-SUIT-OK", output:warns.length?`Warnings: ${warns.join(", ")}`:"Suitable — no warnings" },
    { ruleId:"R-HVII-001",   ruleName:"House View (II)",      rating:null, state:"Computed", weight:0, reasonCode:inputs.houseView==="OW"?"IDEA-HOUSEVIEW-OW":"IDEA-HOUSEVIEW-N", output:`HV=${inputs.houseView||"N"} → Rank adj ${hvAdj>0?"+":""}${hvAdj}` },
    { ruleId:"R-RANK-001",   ruleName:"Recommendation Ranking",rating:null,state:"Computed", weight:0, reasonCode:`IDEA-RANK-${rank}`, output:eligible?`Rank ${rank}`:"N/A — ineligible" },
  ];

  const msg = eligible
    ? (warns.length ? "Suitable with concentration warning; review existing exposure." : "Suitable — no restrictions or warnings.")
    : "Ineligible — product risk or restriction blocks this recommendation.";

  return { ruleResults, weightedScore: 0, finalRating: eligible ? rank : null, finalOutput:{ eligible: String(eligible), recommendationRank: eligible ? String(rank) : "N/A", advisorMessage: msg, warnings: warns.join(", ")||"none" } };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ status, size="sm" }: { status: string; size?: "xs"|"sm" }) {
  const map: Record<string,string> = {
    "AI-Assisted Draft":"bg-amber-50 text-amber-700 border border-amber-200",
    "Draft - Maker Review Required":"bg-amber-50 text-amber-700 border border-amber-200",
    "AI-Assisted":"bg-amber-50 text-amber-700 border border-amber-200",
    "Pending Checker Approval":"bg-blue-50 text-blue-700 border border-blue-200",
    "Changes Requested":"bg-orange-50 text-orange-700 border border-orange-200",
    "Approved":"bg-green-50 text-green-700 border border-green-200",
    "Approved - Awaiting Scheduled Activation":"bg-green-50 text-green-700 border border-green-200",
    "Active":"bg-green-50 text-green-700 border border-green-200",
    "Deployed":"bg-green-50 text-green-700 border border-green-200",
    "Scheduled":"bg-purple-50 text-purple-700 border border-purple-200",
    "No Active Draft":"bg-gray-100 text-gray-500 border border-gray-200",
    "Rejected":"bg-red-50 text-red-700 border border-red-200",
    "Passed":"bg-green-50 text-green-700 border border-green-200",
    "Failed":"bg-red-50 text-red-700 border border-red-200",
    "Tier 1 - Client Outcome":"bg-red-50 text-red-700 border border-red-200",
    "Tier 1":"bg-red-50 text-red-600 border border-red-200",
    "Tier 2":"bg-orange-50 text-orange-600 border border-orange-200",
  };
  const cls = map[status]??"bg-gray-50 text-gray-500 border border-gray-200";
  const sz = size==="xs"?"text-[10px] px-1.5 py-px":"text-xs px-2 py-0.5";
  return <span className={`inline-flex items-center rounded font-medium leading-none ${cls} ${sz}`}>{status}</span>;
}

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t:string)=>void }) {
  return (
    <div className="flex border-b border-gray-200 bg-white overflow-x-auto flex-shrink-0">
      {tabs.map(t=>(
        <button key={t} onClick={()=>onChange(t)}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${active===t?"border-[#1E3A6B] text-[#1E3A6B]":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>{t}</button>
      ))}
    </div>
  );
}

function Btn({ icon:Icon, label, primary, danger, disabled, small, onClick }:{icon?:React.ElementType;label:string;primary?:boolean;danger?:boolean;disabled?:boolean;small?:boolean;onClick?:()=>void}) {
  const base = `inline-flex items-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${small?"px-2.5 py-1 text-xs":"px-3 py-1.5 text-xs"}`;
  if (primary) return <button onClick={onClick} disabled={disabled} className={`${base} bg-[#1E3A6B] text-white hover:bg-[#163059]`}>{Icon&&<Icon size={12}/>}{label}</button>;
  if (danger)  return <button onClick={onClick} disabled={disabled} className={`${base} bg-white border border-red-300 text-red-600 hover:bg-red-50`}>{Icon&&<Icon size={12}/>}{label}</button>;
  return <button onClick={onClick} disabled={disabled} className={`${base} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`}>{Icon&&<Icon size={12}/>}{label}</button>;
}

function GovernanceBanner({ text }:{ text?:string }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5">
      <Shield size={13} className="text-amber-600 flex-shrink-0 mt-px"/>
      <p className="text-xs text-amber-700 leading-relaxed">{text??"AI-assisted drafts require maker review and checker approval before release."}</p>
    </div>
  );
}

const typeIconMap:Record<string,React.ElementType> = { string:Type,number:Hash,boolean:ToggleLeft,enum:List,array:Package,object:Layers };
const typeClsMap:Record<string,string> = { string:"text-blue-600 bg-blue-50",number:"text-purple-600 bg-purple-50",boolean:"text-amber-600 bg-amber-50",enum:"text-teal-600 bg-teal-50",array:"text-orange-600 bg-orange-50",object:"text-gray-600 bg-gray-100" };

function TypeChip({ type }:{ type:string }) {
  const Icon = typeIconMap[type]??Type;
  return <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${typeClsMap[type]??"text-gray-600 bg-gray-100"}`}><Icon size={9}/>{type}</span>;
}

const ruleTypeCls: Record<string,string> = {
  ScoringMatrix:"bg-blue-50 text-blue-700 border border-blue-200",
  ThresholdMatrix:"bg-amber-50 text-amber-700 border border-amber-200",
  DecisionTable:"bg-purple-50 text-purple-700 border border-purple-200",
  ExclusionList:"bg-red-50 text-red-700 border border-red-200",
  WeightedAggregation:"bg-green-50 text-green-700 border border-green-200",
  LookupTable:"bg-teal-50 text-teal-700 border border-teal-200",
  RankingMatrix:"bg-indigo-50 text-indigo-700 border border-indigo-200",
};

function RuleTypeBadge({ type }:{ type:string }) {
  return <span className={`text-[10px] px-1.5 py-px rounded font-medium border ${ruleTypeCls[type]??"bg-gray-50 text-gray-600 border-gray-200"}`}>{type}</span>;
}

function getRuleLogicDraftText(rule: Rule) {
  if (rule.type === "ThresholdMatrix") {
    return [
      `${rule.name} (${rule.id})`,
      `Type: ${rule.type}`,
      "",
      "Draft logic notes:",
      "- Evaluate the submitted input value against CIP-specific threshold bands.",
      "- Return the configured rating, reason code and supporting measured value.",
      rule.modified ? "- Draft v4.8 highlights changed threshold bands for maker review." : "- No draft threshold change is currently flagged.",
      "",
      "Outputs:",
      ...rule.outputs.map(o => `- ${o.name}: ${o.desc}`),
    ].join("\n");
  }

  if (rule.type === "DecisionTable") {
    return [
      `${rule.name} (${rule.id})`,
      `Type: ${rule.type}`,
      "",
      "Draft logic notes:",
      "- Evaluate rows in order using the configured conditions.",
      "- Stop at the first blocking or warning outcome when the table requires it.",
      "- Return the mapped decision output and reason code for traceability.",
      "",
      "Outputs:",
      ...rule.outputs.map(o => `- ${o.name}: ${o.desc}`),
    ].join("\n");
  }

  if (rule.type === "WeightedAggregation") {
    const fn = RULE_FUNCTIONS.find(f => f.ruleIds.includes(rule.id));
    const weights = fn?.weights ?? {};
    return [
      `${rule.name} (${rule.id})`,
      `Type: ${rule.type}`,
      "",
      "Draft logic notes:",
      "- Aggregate computed rule ratings using configured weights.",
      "- Exclude skipped rules and renormalise active weights to 100%.",
      "- Apply ceiling to the weighted score to produce the final portfolio-strength rating.",
      "",
      "Current weights:",
      ...Object.entries(weights).map(([ruleId, weight]) => {
        const weightedRule = RULES.find(r => r.id === ruleId);
        return `- ${weightedRule?.shortName ?? ruleId}: ${weight}%`;
      }),
    ].join("\n");
  }

  const logicText: Record<string, string> = {
    ScoringMatrix: "Input value -> band lookup -> rating. Bands may vary by CIP tier where applicable.",
    ExclusionList: "Evaluate exclusion conditions in order. The first match determines the output.",
    LookupTable: "Perform a key-value lookup against a reference table and return the mapped output value.",
    RankingMatrix: "Evaluate ranking conditions in order and return the first matching recommendation rank.",
  };

  return [
    `${rule.name} (${rule.id})`,
    `Type: ${rule.type}`,
    "",
    "Draft logic notes:",
    `- ${logicText[rule.type] ?? "Configurable rule logic."}`,
    "- Preserve input and output contract compatibility unless a draft explicitly changes it.",
    "",
    "Outputs:",
    ...rule.outputs.map(o => `- ${o.name}: ${o.desc}`),
  ].join("\n");
}

function buildRuleQuickTestOutput(rule: Rule, inputs: Record<string, string>) {
  const num = (key: string, fallback: number) => {
    const parsed = parseFloat(inputs[key] ?? "");
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (key: string, fallback: string) => inputs[key] || fallback;
  const ratingCode = (prefix: string, rating: number) => `${prefix}-00${rating}`;

  switch (rule.id) {
    case "R-CIP-001": {
      const cip = text("cip", "Moderate");
      const risk = num("portfolioRisk", 3.2);
      const target = cip === "Conservative" ? 2 : cip === "Aggressive" ? 4 : 3;
      const rating = Math.min(5, Math.max(1, Math.round(Math.abs(risk - target)) + 2));
      return { cipRating: String(rating), cipReasonCode: ratingCode("PS-CIP", rating) };
    }
    case "R-CASH-001": {
      const cash = num("cashRatio", 12.4);
      const rating = cash <= 5 ? 1 : cash <= 10 ? 2 : cash <= 20 ? 3 : cash <= 30 ? 4 : 5;
      return { cashRating: String(rating), cashReasonCode: ratingCode("PS-CASH", rating) };
    }
    case "R-INCOME-001": {
      const income = num("incomeReturn", 3.2);
      const rating = income >= 5 ? 1 : income >= 3.5 ? 2 : income >= 2 ? 3 : income >= 1 ? 4 : 5;
      return { incomeRating: String(rating), incomeReasonCode: ratingCode("PS-INCOME", rating) };
    }
    case "R-GROWTH-001": {
      const growth = num("growthReturn", 5.1);
      const rating = growth >= 8 ? 1 : growth >= 5 ? 2 : growth >= 3 ? 3 : growth >= 1 ? 4 : 5;
      return { growthRating: String(rating), growthReasonCode: ratingCode("PS-GROWTH", rating) };
    }
    case "R-TENOR-001": {
      const tenor = inputs.tenor;
      if (!tenor || tenor === "null") return { tenorRating: "null", tenorSkip: "PS-TENOR-SKIP-001" };
      return { tenorRating: "3", tenorSkip: "" };
    }
    case "R-SAANUM-001": {
      const saaNumber = num("saaNumber", 7);
      const rating = saaNumber >= 9 ? 1 : saaNumber >= 7 ? 2 : saaNumber >= 5 ? 3 : saaNumber >= 3 ? 4 : 5;
      return { saaNumRating: String(rating), saaNumReasonCode: ratingCode("PS-SAANUM", rating) };
    }
    case "R-SAAALLOC-001": {
      const cip = text("cip", "Moderate");
      const gap = Math.abs(num("saaAllocationGap", 14.2));
      const threshold = cip === "Conservative" ? 8 : cip === "Aggressive" ? 18 : 12;
      const rating = gap <= 2 ? 1 : gap <= 5 ? 2 : gap <= threshold * 0.65 ? 3 : gap <= threshold ? 4 : 5;
      return { saaAllocRating: String(rating), saaAllocGap: gap.toFixed(1), saaAllocReasonCode: ratingCode("PS-SAA-GAP", rating) };
    }
    case "R-HV-001": {
      const deviation = Math.abs(num("houseViewAlignment", -9.1));
      const rating = deviation <= 2 ? 1 : deviation <= 4 ? 2 : deviation <= 8 ? 3 : deviation <= 10 ? 4 : 5;
      return { hvRating: String(rating), hvReasonCode: ratingCode("PS-HV-UW", rating) };
    }
    case "R-THEME-001":
      return { thematicRating: "3", thematicReasonCode: "PS-THEME-003" };
    case "R-ESG-001": {
      const esg = num("esgScore", 68);
      const rating = esg >= 80 ? 1 : esg >= 60 ? 2 : esg >= 40 ? 3 : esg >= 20 ? 4 : 5;
      return { esgRating: String(rating), esgReasonCode: ratingCode("PS-ESG", rating) };
    }
    case "R-NTW-001":
      return { exceptionApplied: "false", exceptionReasonCode: "" };
    case "R-OVERALL-001":
      return { overallRating: "4", weightedScore: "3.72", activeWeight: "100%" };
    case "R-PRESTR-001": {
      const restricted = text("restrictedFlags", "[]") !== "[]";
      return { restricted: String(restricted), restrictionCode: restricted ? "IDEA-RESTRICTED" : "" };
    }
    case "R-HELIG-001": {
      const productRisk = num("productRiskRating", 3);
      const eligible = productRisk <= 4;
      return { eligible: String(eligible), eligReasonCode: eligible ? "IDEA-CIP-OK" : "IDEA-CIP-BLOCK" };
    }
    case "R-SSUIT-001": {
      const concentration = num("holdingConcentration", 22);
      const hasWarning = concentration > 25;
      return { suitabilityWarnings: hasWarning ? "[IDEA-CONCENTRATION-WARN]" : "[]", suitReasonCode: hasWarning ? "IDEA-SUIT-003" : "IDEA-SUIT-OK" };
    }
    case "R-HVII-001": {
      const houseView = text("houseView", "OW");
      const adjustment = houseView === "OW" ? "+1" : houseView === "UW" ? "-1" : "0";
      return { hvAdjustment: adjustment, hvReasonCode: houseView === "OW" ? "IDEA-HOUSEVIEW-OW" : houseView === "UW" ? "IDEA-HOUSEVIEW-UW" : "IDEA-HOUSEVIEW-N" };
    }
    case "R-RANK-001": {
      const houseView = text("houseView", "OW");
      const rank = houseView === "OW" ? 2 : houseView === "UW" ? 4 : 3;
      return { recommendationRank: String(rank), advisorMessage: rank <= 2 ? "Suitable with house-view support" : "Suitable with advisory review", rankReasonCode: `IDEA-RANK-${rank}` };
    }
    default:
      return rule.outputs.reduce<Record<string, string>>((out, field) => {
        out[field.name] = field.sample;
        return out;
      }, {});
  }
}

function buildRuleFunctionExecutionSpec(fn: RuleFunctionDef, allRules: Rule[]) {
  const fnRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];
  const flowOverride = (ruleId: string) => fn.flowOverrides?.[ruleId] ?? {};

  if (fn.key === "PS") {
    const exceptionRule = fnRules.find(r=>r.id==="R-NTW-001");
    const scoringRules = fnRules.filter(r=>r.type!=="WeightedAggregation" && r.id!=="R-NTW-001");
    const exceptionOverride = exceptionRule ? flowOverride(exceptionRule.id) : {};
    return {
      schemaVersion: "1.0",
      functionKey: fn.key,
      functionName: fn.name,
      executionType: "PARALLEL_RULE_FLOW",
      javaHandler: "RuleFunctionExecutionEngine.executeRuleFlow",
      inputContract: Array.from(new Map(fnRules.flatMap(r=>r.inputs).map(f=>[f.name, {
        name:f.name, type:f.type, required:f.required, description:f.desc,
      }])).values()),
      preFlowDecision: exceptionRule ? {
        nodeId: "NODE-R-NTW-001",
        ruleId: exceptionRule.id,
        condition: { field:"exceptionFlags", operator:"isNotNull", displayLabel: exceptionOverride.condition ?? "exceptionFlags present or NTW treatment required" },
        onTrue: {
          flowId: exceptionOverride.trueFlowId ?? "EXCEPTION_TREATMENT_FLOW",
          action: "APPLY_EXCEPTION_TREATMENT",
          terminalWhen: "exceptionApplied=true",
          reasonCode: "PS-NTW-EXCEPTION",
          displayLabel: exceptionOverride.trueLabel ?? "Apply NTW/exception handling",
        },
        onFalse: {
          flowId: exceptionOverride.falseFlowId ?? "PARALLEL_SCORING_FLOW",
          nextNodeGroup: "scoringNodes",
          displayLabel: exceptionOverride.falseLabel ?? "Continue to rating rule families",
        },
      } : null,
      flows: exceptionRule ? [
        {
          flowId: "EXCEPTION_TREATMENT_FLOW",
          type: "CONDITIONAL_EXCEPTION",
          startsAt: "NODE-R-NTW-001",
          outcome: "Apply NTW or exception treatment before final output",
        },
        {
          flowId: "PARALLEL_SCORING_FLOW",
          type: "PARALLEL_SCORING",
          nodeGroup: "scoringNodes",
          aggregationNodeId: "NODE-R-OVERALL-001",
        },
      ] : [
        {
          flowId: "PARALLEL_SCORING_FLOW",
          type: "PARALLEL_SCORING",
          nodeGroup: "scoringNodes",
          aggregationNodeId: "NODE-R-OVERALL-001",
        },
      ],
      customConditionNodes: (fn.conditionSteps ?? []).map(step=>({
        nodeId: step.id,
        nodeType: "CUSTOM_CONDITION",
        name: step.name,
        condition: { expression: step.condition },
        onTrue: { flowId: step.trueFlowId, displayLabel: step.trueLabel },
        onFalse: { flowId: step.falseFlowId, displayLabel: step.falseLabel },
        makerNote: step.note ?? null,
      })),
      nodes: scoringRules.map(rule=>({
        nodeId: `NODE-${rule.id}`,
        ruleId: rule.id,
        ruleType: rule.type,
        execution: "PARALLEL",
        weight: fn.weights?.[rule.id] ?? null,
        editNote: flowOverride(rule.id).note ?? null,
        skipWhen: rule.id==="R-TENOR-001" ? { field:"tenor", operator:"isNull" } : null,
        outputMap: rule.outputs.map(o=>o.name),
      })),
      aggregation: {
        nodeId: "NODE-R-OVERALL-001",
        ruleId: "R-OVERALL-001",
        strategy: "WEIGHTED_AGGREGATION",
        skipStatuses: ["SKIPPED"],
        rounding: "ceiling",
        weights: Object.entries(fn.weights ?? {}).map(([ruleId, weight])=>({ ruleId, weight })),
      },
      terminalOutput: ["overallRating","weightedScore","activeWeight","reasonCodes"],
      governance: {
        requiresMakerReview: Boolean(fn.draftRelease),
        requiresCheckerApproval: true,
        executableBy: "JAVA_BACKEND_ONLY",
      },
    };
  }

  return {
    schemaVersion: "1.0",
    functionKey: fn.key,
    functionName: fn.name,
    executionType: "DECISION_TREE",
    javaHandler: "RuleFunctionExecutionEngine.executeDecisionTree",
    inputContract: Array.from(new Map(fnRules.flatMap(r=>r.inputs).map(f=>[f.name, {
      name:f.name, type:f.type, required:f.required, description:f.desc,
    }])).values()),
    rootNodeId: "NODE-R-PRESTR-001",
    customConditionNodes: (fn.conditionSteps ?? []).map(step=>({
      nodeId: step.id,
      nodeType: "CUSTOM_CONDITION",
      name: step.name,
      condition: { expression: step.condition },
      onTrue: { flowId: step.trueFlowId, displayLabel: step.trueLabel },
      onFalse: { flowId: step.falseFlowId, displayLabel: step.falseLabel },
      makerNote: step.note ?? null,
    })),
    flows: [
      { flowId:"RESTRICTION_BLOCK_FLOW", type:"TERMINAL", terminal:"NOT_RECOMMENDED" },
      { flowId:"HARD_ELIGIBILITY_FLOW", type:"CONTINUE", startsAt:"NODE-R-HELIG-001" },
      { flowId:"ELIGIBILITY_BLOCK_FLOW", type:"TERMINAL", terminal:"INELIGIBLE" },
      { flowId:"SOFT_SUITABILITY_FLOW", type:"CONTINUE", startsAt:"NODE-R-SSUIT-001" },
      { flowId:"WARNING_FLOW", type:"CONTINUE_WITH_WARNING", startsAt:"NODE-R-HVII-001" },
      { flowId:"CLEAN_SUITABILITY_FLOW", type:"CONTINUE", startsAt:"NODE-R-HVII-001" },
      { flowId:"ADJUSTED_RANKING_FLOW", type:"CONTINUE_WITH_OUTPUT", startsAt:"NODE-R-RANK-001" },
      { flowId:"NEUTRAL_RANKING_FLOW", type:"CONTINUE_WITH_OUTPUT", startsAt:"NODE-R-RANK-001" },
      { flowId:"ELIGIBLE_RECOMMENDATION_FLOW", type:"TERMINAL", terminal:"ELIGIBLE_WITH_RANK" },
      { flowId:"MANUAL_REVIEW_FLOW", type:"TERMINAL", terminal:"MANUAL_REVIEW" },
    ],
    nodes: [
      {
        nodeId:"NODE-R-PRESTR-001",
        ruleId:"R-PRESTR-001",
        condition:{ field:"restrictedFlags", operator:"contains", value:"PRODUCT_BLOCKED", displayLabel:flowOverride("R-PRESTR-001").condition ?? "restrictedFlags contains PRODUCT_BLOCKED" },
        onTrue:{ flowId:flowOverride("R-PRESTR-001").trueFlowId ?? "RESTRICTION_BLOCK_FLOW", terminal:"NOT_RECOMMENDED", reasonCode:"IDEA-RESTRICTED", displayLabel:flowOverride("R-PRESTR-001").trueLabel ?? "Not Recommended" },
        onFalse:{ flowId:flowOverride("R-PRESTR-001").falseFlowId ?? "HARD_ELIGIBILITY_FLOW", nextNodeId:"NODE-R-HELIG-001", displayLabel:flowOverride("R-PRESTR-001").falseLabel ?? "Hard Eligibility Flow" },
      },
      {
        nodeId:"NODE-R-HELIG-001",
        ruleId:"R-HELIG-001",
        condition:{ any:[
          { field:"productRiskRating", operator:">", value:4 },
          { field:"jurisdiction", operator:"notIn", value:["SG","HK","MY","TH"] },
        ], displayLabel:flowOverride("R-HELIG-001").condition ?? "productRiskRating > tolerance OR jurisdiction unsupported" },
        onTrue:{ flowId:flowOverride("R-HELIG-001").trueFlowId ?? "ELIGIBILITY_BLOCK_FLOW", terminal:"INELIGIBLE", reasonCode:"IDEA-CIP-BLOCK", displayLabel:flowOverride("R-HELIG-001").trueLabel ?? "Ineligible" },
        onFalse:{ flowId:flowOverride("R-HELIG-001").falseFlowId ?? "SOFT_SUITABILITY_FLOW", nextNodeId:"NODE-R-SSUIT-001", displayLabel:flowOverride("R-HELIG-001").falseLabel ?? "Soft Suitability Flow" },
      },
      {
        nodeId:"NODE-R-SSUIT-001",
        ruleId:"R-SSUIT-001",
        condition:{ field:"holdingConcentration", operator:">", value:25, displayLabel:flowOverride("R-SSUIT-001").condition ?? "holdingConcentration > 25" },
        onTrue:{ flowId:flowOverride("R-SSUIT-001").trueFlowId ?? "WARNING_FLOW", nextNodeId:"NODE-R-HVII-001", addWarning:"IDEA-CONCENTRATION-WARN", displayLabel:flowOverride("R-SSUIT-001").trueLabel ?? "Warning Flow" },
        onFalse:{ flowId:flowOverride("R-SSUIT-001").falseFlowId ?? "CLEAN_SUITABILITY_FLOW", nextNodeId:"NODE-R-HVII-001", displayLabel:flowOverride("R-SSUIT-001").falseLabel ?? "Clean Suitability Flow" },
      },
      {
        nodeId:"NODE-R-HVII-001",
        ruleId:"R-HVII-001",
        condition:{ field:"houseView", operator:"in", value:["OW","N","UW"], displayLabel:flowOverride("R-HVII-001").condition ?? "houseView is OW, N, or UW" },
        onTrue:{ flowId:flowOverride("R-HVII-001").trueFlowId ?? "ADJUSTED_RANKING_FLOW", nextNodeId:"NODE-R-RANK-001", output:"hvAdjustment", displayLabel:flowOverride("R-HVII-001").trueLabel ?? "Adjusted Ranking Flow" },
        onFalse:{ flowId:flowOverride("R-HVII-001").falseFlowId ?? "NEUTRAL_RANKING_FLOW", nextNodeId:"NODE-R-RANK-001", output:"hvAdjustment=0", displayLabel:flowOverride("R-HVII-001").falseLabel ?? "Neutral Ranking Flow" },
      },
      {
        nodeId:"NODE-R-RANK-001",
        ruleId:"R-RANK-001",
        condition:{ field:"eligible", operator:"=", value:true, displayLabel:flowOverride("R-RANK-001").condition ?? "eligible = true" },
        onTrue:{ flowId:flowOverride("R-RANK-001").trueFlowId ?? "ELIGIBLE_RECOMMENDATION_FLOW", terminal:"ELIGIBLE_WITH_RANK", outputs:["recommendationRank","advisorMessage","rankReasonCode"], displayLabel:flowOverride("R-RANK-001").trueLabel ?? "Eligible Recommendation Flow" },
        onFalse:{ flowId:flowOverride("R-RANK-001").falseFlowId ?? "MANUAL_REVIEW_FLOW", terminal:"MANUAL_REVIEW", reasonCode:"IDEA-MANUAL-REVIEW", displayLabel:flowOverride("R-RANK-001").falseLabel ?? "Manual Review Flow" },
      },
    ],
    terminalOutput: ["eligible","recommendationRank","advisorMessage","reasonCodes","warnings"],
    governance: {
      requiresMakerReview: Boolean(fn.draftRelease),
      requiresCheckerApproval: true,
      executableBy: "JAVA_BACKEND_ONLY",
    },
  };
}

// ─── Left Navigation ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id:"studio",       label:"Decision Studio",    icon:Layers,        badge:null,                badgeCls:"" },
  { id:"ai-works",     label:"AI Works",           icon:Wand2,         badge:null,                badgeCls:"" },
  { id:"drafts",       label:"My Drafts",          icon:FolderOpen,    badge:"4",                 badgeCls:"bg-amber-500" },
  { id:"review-queue", label:"Review Queue",       icon:ClipboardCheck,badge:"12",                badgeCls:"bg-blue-600" },
  { id:"release",      label:"Release Center",     icon:Rocket,        badge:null,                badgeCls:"" },
  { id:"trace",        label:"Decision Trace",     icon:Eye,           badge:null,                badgeCls:"" },
  { id:"settings",     label:"Platform Settings",  icon:Settings,      badge:null,                badgeCls:"" },
] as const;

function LeftNav({ current, go, studioFn, setStudioFn }:{ current:Screen; go:(s:Screen)=>void; studioFn:string; setStudioFn:(k:string)=>void }) {
  const goFn = (key:string) => { setStudioFn(key); go("studio"); };
  return (
    <div className="flex flex-col w-[216px] flex-shrink-0 h-full" style={{backgroundColor:"#0D1B3E"}}>
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-[#0D7A8A] flex items-center justify-center flex-shrink-0"><Sparkles size={13} className="text-white"/></div>
        <div><div className="text-white text-sm font-semibold leading-none">myWealth</div><div className="text-[#5EC8D8] text-[10px] mt-0.5">Decision Hub</div></div>
      </div>
      <nav className="py-2 flex-shrink-0">
        {NAV_ITEMS.map(item=>{
          const Icon=item.icon; const active=current===item.id;
          return (
            <button key={item.id} onClick={()=>go(item.id as Screen)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors text-left ${active?"bg-[#1E3A6B] text-white":"text-blue-200/80 hover:bg-white/5 hover:text-white"}`}>
              <Icon size={14} className="flex-shrink-0"/><span className="flex-1">{item.label}</span>
              {item.badge&&<span className={`text-[10px] px-1.5 py-px rounded-full font-semibold text-white ${item.badgeCls}`}>{item.badge}</span>}
            </button>
          );
        })}
      </nav>
      {current==="studio" && (
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-white/10">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 px-1">Rule Functions</div>
          {RULE_FUNCTIONS.map(fn=>(
            <button key={fn.key} onClick={()=>goFn(fn.key)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-left transition-colors mb-0.5 ${studioFn===fn.key?"bg-white/10 text-white":"text-blue-200/60 hover:text-blue-100 hover:bg-white/5"}`}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fn.draftRelease?"bg-amber-400":"bg-green-400"}`}/>
              <span className="truncate">{fn.name}</span>
            </button>
          ))}
        </div>
      )}
      {current!=="studio"&&<div className="flex-1"/>}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#0D7A8A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">JW</div>
          <div className="flex-1 min-w-0"><div className="text-white text-xs font-medium truncate">Jennifer Wong</div><div className="text-blue-300/70 text-[10px] truncate">Maker · Advisory Solutions</div></div>
        </div>
      </div>
    </div>
  );
}

const ENVIRONMENT_OPTIONS = [
  { name:"Development", dot:"bg-amber-400", desc:"Isolated authoring and local draft testing" },
  { name:"UAT", dot:"bg-blue-500", desc:"User acceptance testing with separate approval evidence" },
  { name:"Production", dot:"bg-green-500", desc:"Live release lane with maker-checker controls" },
] as const;

type EnvironmentName = typeof ENVIRONMENT_OPTIONS[number]["name"];

function TopBar() {
  const [envOpen, setEnvOpen] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentName>("Development");
  const selectedEnv = ENVIRONMENT_OPTIONS.find(e=>e.name===environment) ?? ENVIRONMENT_OPTIONS[0];

  return (
    <div className="h-11 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
      <div className="flex items-center gap-2 flex-1 max-w-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
        <Search size={12} className="text-gray-400"/>
        <input className="flex-1 text-xs bg-transparent outline-none placeholder-gray-400" placeholder="Search rules, functions, decisions…"/>
      </div>
      <div className="relative">
        <button
          onClick={()=>setEnvOpen(open=>!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-xs text-gray-700 cursor-pointer select-none hover:bg-gray-50"
          aria-haspopup="menu"
          aria-expanded={envOpen}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${selectedEnv.dot}`}/>
          <span>{selectedEnv.name}</span>
          <ChevronDown size={11} className={`text-gray-400 transition-transform ${envOpen?"rotate-180":""}`}/>
        </button>
        {envOpen && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-50 py-1">
            {ENVIRONMENT_OPTIONS.map(env=>(
              <button
                key={env.name}
                onClick={()=>{setEnvironment(env.name);setEnvOpen(false);}}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${environment===env.name?"bg-blue-50/60":""}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${env.dot}`}/>
                  <span className="text-xs font-medium text-gray-900">{env.name}</span>
                  {environment===env.name && <Check size={11} className="ml-auto text-[#1E3A6B]"/>}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 ml-3.5 leading-snug">{env.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button className="relative p-1.5 rounded hover:bg-gray-100 text-gray-500"><Bell size={15}/><span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"/></button>
        <div className="w-7 h-7 rounded-full bg-[#0D7A8A] flex items-center justify-center text-white text-xs font-bold">JW</div>
      </div>
    </div>
  );
}

// ─── Rule Logic Display ───────────────────────────────────────────────────────

function RuleLogicDisplay({ rule }: { rule: Rule }) {
  if (rule.type === "ThresholdMatrix") {
    return (
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Threshold Matrix (Active v4.7 vs Draft v4.8)</div>
        <div className="grid grid-cols-2 gap-3">
          {(["Active v4.7","Draft v4.8"] as const).map((ver,vi)=>(
            <div key={ver}>
              <div className={`text-xs font-semibold mb-1.5 ${vi===0?"text-gray-600":"text-amber-700"}`}>{ver}</div>
              <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                  <th className="px-2 py-1 text-left font-medium">CIP</th>
                  {["R1","R2","R3","R4","R5"].map(h=><th key={h} className="px-2 py-1 text-center font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[{cip:"Conservative",v47:["≤2%","≤5%","≤8%","≤12%",">12%"],v48:["≤2%","≤5%","≤8%","≤12%",">12%"]},
                    {cip:"Moderate",    v47:["≤3%","≤6%","≤10%","≤15%",">15%"],v48:["≤2%","≤5%","≤8%","≤12%",">12%"]},
                    {cip:"Aggressive",  v47:["≤4%","≤8%","≤12%","≤18%",">18%"],v48:["≤4%","≤8%","≤12%","≤18%",">18%"]}].map((row,ri)=>{
                      const vals=vi===0?row.v47:row.v48; const changed=ri===1&&vi===1;
                      return <tr key={row.cip} className={changed?"bg-amber-50":""}>
                        <td className={`px-2 py-1.5 border-b border-gray-100 font-medium ${ri===1?"text-amber-700":"text-gray-700"}`}>{row.cip}</td>
                        {vals.map((v,ci)=><td key={ci} className={`px-2 py-1.5 text-center border-b border-gray-100 ${changed?"text-amber-700 font-semibold":"text-gray-600"}`}>{v}</td>)}
                      </tr>;
                    })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {rule.modified && <div className="mt-2 text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle size={10}/>Moderate CIP thresholds reduced in draft v4.8</div>}
      </div>
    );
  }

  if (rule.type === "DecisionTable") {
    const rows = rule.id==="R-HELIG-001" ? [
      { cond:"Client CIP",op:"IN",val:"Conservative, Moderate, Balanced",outcome:"ELIGIBLE",rc:"IDEA-CIP-OK" },
      { cond:"Product Risk Rating",op:"≤",val:"Client Risk Tolerance + 1",outcome:"ELIGIBLE",rc:"IDEA-RISK-OK" },
      { cond:"Jurisdiction",op:"IN",val:"SG, HK, MY, TH",outcome:"CHECK",rc:"IDEA-JURIS-OK" },
      { cond:"Restricted Product Flag",op:"=",val:"true",outcome:"INELIGIBLE",rc:"IDEA-RESTRICTED" },
    ] : [
      { cond:"Holding Concentration",op:">",val:"25% of AUM",outcome:"WARN",rc:"IDEA-CONCENTRATION-WARN" },
      { cond:"Liquidity Need",op:"=",val:"HIGH",outcome:"WARN",rc:"IDEA-LIQUIDITY-WARN" },
      { cond:"Risk Tolerance",op:"<",val:"Product Risk Rating",outcome:"WARN",rc:"IDEA-RISK-WARN" },
    ];
    return (
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Decision Table</div>
        <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {["Condition","Operator","Value","Outcome","Reason Code"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r,i)=>(
              <tr key={i} className={`hover:bg-gray-50 ${r.outcome==="INELIGIBLE"?"bg-red-50/30":r.outcome==="WARN"?"bg-amber-50/30":""}`}>
                <td className="px-3 py-2 font-medium text-gray-800">{r.cond}</td>
                <td className="px-3 py-2 text-center font-mono text-gray-600">{r.op}</td>
                <td className="px-3 py-2 text-gray-600">{r.val}</td>
                <td className="px-3 py-2 font-bold font-mono"><span className={r.outcome==="INELIGIBLE"?"text-red-700":r.outcome==="WARN"?"text-amber-700":"text-green-700"}>{r.outcome}</span></td>
                <td className="px-3 py-2 font-mono text-gray-500">{r.rc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rule.type === "WeightedAggregation") {
    const fn = RULE_FUNCTIONS.find(f=>f.ruleIds.includes(rule.id));
    const weights = fn?.weights ?? {};
    return (
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Weight Configuration (Portfolio Strength Rating)</div>
        <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {["Rule Family","Weight %","Status"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(weights).map(([ruleId,w])=>{
              const r = RULES.find(x=>x.id===ruleId);
              return <tr key={ruleId} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-800">{r?.shortName??ruleId}</td>
                <td className="px-3 py-2 font-mono font-semibold text-[#1E3A6B]">{w}%</td>
                <td className="px-3 py-2">{r?.modified?<span className="text-[10px] text-amber-600 font-medium">Modified in draft</span>:<span className="text-[10px] text-gray-400">Unchanged</span>}</td>
              </tr>;
            })}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-3 py-2 text-gray-900">Total</td>
              <td className="px-3 py-2 font-mono text-[#1E3A6B]">{Object.values(weights).reduce((a,b)=>a+b,0)}%</td>
              <td className="px-3 py-2 text-xs text-green-600">✓ Sums to 100%</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] text-gray-400 mt-1.5">Skipped rules are excluded and remaining weights are renormalised to 100% at runtime.</p>
      </div>
    );
  }

  // Generic ScoringMatrix / ExclusionList / LookupTable / RankingMatrix
  const logicText: Record<string, string> = {
    ScoringMatrix: "Input value → Band lookup → Rating (1–5). Bands are defined per-CIP tier where applicable.",
    ExclusionList: "Evaluates a list of exclusion conditions in order. First match determines the output.",
    LookupTable:   "Performs a key-value lookup against a reference table. Returns the mapped output value.",
    RankingMatrix: "Evaluates ranking conditions in order and returns the first matching rank.",
  };
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-2">Logic Description</div>
      <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700">{logicText[rule.type]??"Configurable rule logic."}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rule.outputs.map(o=>(
          <div key={o.name} className="bg-white border border-gray-200 rounded p-2">
            <div className="text-[10px] text-gray-500 mb-0.5">Output: <code className="font-mono text-gray-700">{o.name}</code></div>
            <div className="text-xs text-gray-600">{o.desc}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Sample: <code>{o.sample}</code></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildAiStructuredRuleSpec(rule: Rule, sourceText: string) {
  const parsedSample = (value: string) => {
    if (value === "true") return true;
    if (value === "false") return false;
    const n = Number(value);
    return Number.isFinite(n) && value.trim() !== "" ? n : value;
  };

  const firstOutput = rule.outputs[0]?.name ?? "result";
  const reasonOutput = rule.outputs.find(o=>o.name.toLowerCase().includes("reason"))?.name;
  const reasonCode = rule.outputs.find(o=>o.name.toLowerCase().includes("reason"))?.sample ?? `${rule.id}-REASON`;
  const common = {
    schemaVersion: "1.0",
    ruleId: rule.id,
    ruleType: rule.type,
    name: rule.name,
    description: rule.desc,
    inputContract: rule.inputs.map(({ name, type, required, desc })=>({ name, type, required, description: desc })),
    outputContract: rule.outputs.map(({ name, type, required, desc })=>({ name, type, required, description: desc })),
    metadata: {
      generatedBy: "AI",
      source: sourceText ? "maker_logic_text" : "current_rule_asset",
      requiresMakerReview: true,
      promptVersion: "prototype-rule-compiler-v1",
    },
  };

  if (rule.type === "ThresholdMatrix") {
    return {
      ...common,
      logic: {
        groupBy: rule.inputs[0]?.name ?? "segment",
        valueField: rule.inputs[1]?.name ?? "value",
        absoluteValue: true,
        groups: [
          {
            groupValue: "Moderate",
            thresholds: [
              { id:`${rule.id}-BAND-001`, operator:"<=", value:2, set:{ [firstOutput]:1, ...(reasonOutput ? { [reasonOutput]:reasonCode.replace(/\d+$/, "001") } : {}) }, trace:"Moderate threshold band 1" },
              { id:`${rule.id}-BAND-002`, operator:"<=", value:5, set:{ [firstOutput]:2, ...(reasonOutput ? { [reasonOutput]:reasonCode.replace(/\d+$/, "002") } : {}) }, trace:"Moderate threshold band 2" },
              { id:`${rule.id}-BAND-003`, operator:"<=", value:8, set:{ [firstOutput]:3, ...(reasonOutput ? { [reasonOutput]:reasonCode.replace(/\d+$/, "003") } : {}) }, trace:"Moderate threshold band 3" },
              { id:`${rule.id}-BAND-004`, operator:"<=", value:12, set:{ [firstOutput]:4, ...(reasonOutput ? { [reasonOutput]:reasonCode.replace(/\d+$/, "004") } : {}) }, trace:"Moderate threshold band 4" },
            ],
            default: { set:{ [firstOutput]:5, ...(reasonOutput ? { [reasonOutput]:reasonCode.replace(/\d+$/, "005") } : {}) }, trace:"Value exceeds configured threshold" },
          },
        ],
      },
    };
  }

  if (rule.type === "DecisionTable") {
    return {
      ...common,
      logic: {
        evaluation: "firstMatch",
        rows: [
          {
            id: `${rule.id}-ROW-001`,
            when: { field: rule.inputs[0]?.name ?? "input", operator:"isNotNull" },
            set: Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])),
            trace: "First governed decision row generated from maker logic text",
          },
        ],
        default: {
          set: Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])),
          trace: "Default outcome preserves current rule behavior",
        },
      },
    };
  }

  if (rule.type === "WeightedAggregation") {
    const fn = RULE_FUNCTIONS.find(f=>f.ruleIds.includes(rule.id));
    const weights = fn?.weights ?? {};
    return {
      ...common,
      logic: {
        ratingField: "rating",
        skipStatuses: ["SKIPPED"],
        rounding: "ceiling",
        weights: Object.entries(weights).map(([ruleId, weight])=>({ ruleId, weight })),
        set: {
          overallRating: "$computed.ceilingWeightedScore",
          weightedScore: "$computed.weightedScore",
          activeWeight: "$computed.activeWeight",
        },
        trace: "Weighted score calculated from computed rule ratings; skipped rules excluded",
      },
    };
  }

  if (rule.type === "ExclusionList") {
    return {
      ...common,
      logic: {
        evaluation: "firstMatch",
        exclusions: [
          {
            id: `${rule.id}-EXCLUSION-001`,
            when: { field: rule.inputs[0]?.name ?? "flags", operator:"contains", value:"BLOCKED" },
            set: Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])),
            trace: "Exclusion condition generated from maker logic text",
          },
        ],
        default: {
          set: Object.fromEntries(rule.outputs.map(o=>[o.name, o.type === "boolean" ? false : ""])),
          trace: "No exclusion matched",
        },
      },
    };
  }

  if (rule.type === "LookupTable") {
    return {
      ...common,
      logic: {
        keyField: rule.inputs[0]?.name ?? "key",
        entries: [
          { key:"OW", set:Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])), trace:"Lookup entry generated from current reference data" },
        ],
        default: {
          set: Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])),
          trace: "Default lookup outcome",
        },
      },
    };
  }

  return {
    ...common,
    logic: {
      evaluation: "firstMatch",
      bands: [
        {
          id: `${rule.id}-BAND-001`,
          when: { field: rule.inputs[0]?.name ?? "input", operator:"isNotNull" },
          set: Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])),
          trace: "Generated band preserves current sample output behavior",
        },
      ],
      default: {
        set: Object.fromEntries(rule.outputs.map(o=>[o.name, parsedSample(o.sample)])),
        trace: "Default outcome generated by AI conversion",
      },
    },
  };
}

function buildRuleFromLogicText(logicText: string, sequence: number): Rule {
  const clean = logicText.trim();
  const titleMatch = clean.match(/(?:rule|name)\s*[:=-]\s*([^\n.]+)/i);
  const name = (titleMatch?.[1]?.trim() || clean.split(/[.\n]/)[0]?.trim() || "AI Generated Rule").slice(0, 64);
  const upper = clean.toUpperCase();
  const type: Rule["type"] =
    upper.includes("EXCLUDE") || upper.includes("BLOCK") || upper.includes("RESTRICT") ? "ExclusionList" :
    upper.includes("LOOKUP") || upper.includes("REFERENCE") ? "LookupTable" :
    upper.includes("RANK") ? "RankingMatrix" :
    upper.includes("THRESHOLD") || upper.includes(">") || upper.includes("<") ? "ThresholdMatrix" :
    upper.includes("ELIGIBLE") || upper.includes("IF ") || upper.includes(" WHEN ") ? "DecisionTable" :
    "ScoringMatrix";
  const category: Rule["category"] =
    type === "RankingMatrix" ? "ranking" :
    type === "DecisionTable" || type === "ExclusionList" ? "eligibility" :
    "scoring";
  const fieldCandidates = Array.from(new Set(
    Array.from(clean.matchAll(/\b([a-z][a-zA-Z0-9_]{2,})\b/g))
      .map(m=>m[1])
      .filter(w=>!["rule","when","then","else","score","rating","output","reason","client","product","should","return","true","false","and","or","not","with","from","into","than"].includes(w.toLowerCase()))
      .slice(0, 4)
  ));
  const inputs = (fieldCandidates.length ? fieldCandidates : ["inputValue"]).map((name, i)=>({
    name,
    type: (/(flag|list|codes|tags)$/i.test(name) ? "array" : /(is|has|eligible|blocked)/i.test(name) ? "boolean" : /(score|amount|ratio|pct|percent|value|age|aum|risk|rank|rating)/i.test(name) ? "number" : "string") as IOField["type"],
    required: i === 0,
    desc: `AI-detected input from maker logic text: ${name}`,
    sample: /(flag|list|codes|tags)$/i.test(name) ? "[]" : /(is|has|eligible|blocked)/i.test(name) ? "false" : /(score|amount|ratio|pct|percent|value|age|aum|risk|rank|rating)/i.test(name) ? "1" : "Sample",
  }));
  const outputBase = name.replace(/[^a-zA-Z0-9]+(.)/g, (_, c)=>String(c).toUpperCase()).replace(/^[A-Z]/, c=>c.toLowerCase()).slice(0, 32) || "aiRule";
  const id = `R-AI-${String(sequence).padStart(3, "0")}`;
  return {
    id,
    name,
    shortName: name.length > 18 ? `${name.slice(0, 18)}...` : name,
    type,
    category,
    version: "v0.1-draft",
    lastModified: "21 Jun 2026",
    usedBy: [],
    modified: true,
    desc: `AI-generated maker draft from pasted business logic. ${clean.slice(0, 160)}${clean.length > 160 ? "..." : ""}`,
    inputs,
    outputs: [
      { name:`${outputBase}Result`, type:type === "ExclusionList" || type === "DecisionTable" ? "boolean" : "number", required:true, desc:"Primary AI-generated rule output", sample:type === "ExclusionList" || type === "DecisionTable" ? "false" : "3" },
      { name:`${outputBase}ReasonCode`, type:"string", required:true, desc:"Reason code for trace and audit", sample:`${id}-001` },
    ],
  };
}

function RuleLogicTabs({ rule, savedDraft, defaultDraft }: { rule: Rule; savedDraft?: string; defaultDraft: string }) {
  const tabs = savedDraft
    ? ["Business Logic","AI Structured JSON","Validation","Local Draft"]
    : ["Business Logic","AI Structured JSON","Validation"];
  const [active, setActive] = useState(tabs[0]);
  const sourceText = savedDraft ?? defaultDraft;
  const structuredJson = JSON.stringify(buildAiStructuredRuleSpec(rule, sourceText), null, 2);
  const checks = [
    { label:"Schema", detail:"ruleLogicSpec envelope uses schemaVersion 1.0.", ok:true },
    { label:"Contracts", detail:`${rule.inputs.length} inputs and ${rule.outputs.length} outputs are declared.`, ok:true },
    { label:"Execution safety", detail:"Structured JSON contains data-only conditions and assignments.", ok:true },
    { label:"Maker review", detail:"AI conversion requires maker review before checker submission.", ok:true },
    { label:"Warnings", detail:rule.modified ? "Draft threshold changes require focused review." : "No conversion warnings in prototype sample.", ok:!rule.modified },
  ];

  useEffect(() => {
    setActive(tabs[0]);
  }, [rule.id, Boolean(savedDraft)]);

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Rule Logic</div>
          <div className="text-xs text-gray-500 mt-0.5">Business-readable logic and AI-converted structured JSON for maker review.</div>
        </div>
        <StatusBadge status="AI-Assisted" size="xs"/>
      </div>
      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
        {tabs.map(tab=>(
          <button key={tab} onClick={()=>setActive(tab)}
            className={`px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${active===tab?"border-[#1E3A6B] text-[#1E3A6B] bg-white":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="p-4">
        {active==="Business Logic" && <RuleLogicDisplay rule={rule}/>}
        {active==="AI Structured JSON" && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Code2 size={12} className="text-[#1E3A6B]"/>
              <span className="text-xs font-semibold text-gray-900">AI-converted ruleLogicSpec JSON</span>
              <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Maker review required</span>
            </div>
            <pre className="max-h-[420px] overflow-auto bg-slate-950 text-slate-100 rounded p-3 text-[11px] leading-relaxed font-mono">{structuredJson}</pre>
          </div>
        )}
        {active==="Validation" && (
          <div className="space-y-2">
            {checks.map(check=>(
              <div key={check.label} className={`flex items-start gap-2 border rounded px-3 py-2 ${check.ok?"bg-green-50 border-green-200":"bg-amber-50 border-amber-200"}`}>
                {check.ok ? <CheckCircle2 size={12} className="text-green-700 flex-shrink-0 mt-0.5"/> : <AlertCircle size={12} className="text-amber-700 flex-shrink-0 mt-0.5"/>}
                <div className="text-xs"><span className={`font-semibold ${check.ok?"text-green-800":"text-amber-800"}`}>{check.label}</span><span className="text-gray-700"> · {check.detail}</span></div>
              </div>
            ))}
          </div>
        )}
        {active==="Local Draft" && savedDraft && (
          <div className="border border-green-200 bg-green-50/50 rounded overflow-hidden">
            <div className="px-3 py-2 border-b border-green-200 flex items-center gap-2 bg-green-50">
              <CheckCircle2 size={12} className="text-green-700"/>
              <span className="text-xs font-semibold text-green-900">Local Draft Logic</span>
              <span className="ml-auto text-[10px] text-green-700 font-medium">Draft saved locally</span>
            </div>
            <pre className="p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{savedDraft}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rule Quick-Test Panel ────────────────────────────────────────────────────

function RuleQuickTest({ rule }: { rule: Rule }) {
  const [vals, setVals] = useState<Record<string,string>>({});
  const [result, setResult] = useState<Record<string,string>|null>(null);

  useEffect(() => {
    setVals({});
    setResult(null);
  }, [rule.id]);

  const handleRun = () => {
    setResult(buildRuleQuickTestOutput(rule, vals));
  };

  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <TestTube size={12} className="text-gray-500"/>
        <span className="text-xs font-semibold text-gray-700">Quick Test</span>
        <span className="text-[10px] text-gray-400 ml-auto">Enter inputs and run to see rule output</span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {rule.inputs.filter(f=>f.required).map(f=>(
            <div key={f.name}>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{f.name} <TypeChip type={f.type}/></label>
              <input value={vals[f.name]??""} onChange={e=>setVals(p=>({...p,[f.name]:e.target.value}))}
                placeholder={f.sample}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#1E3A6B]"/>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRun} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059]">
            <Play size={11}/>Run Rule
          </button>
          {result && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {Object.entries(result).map(([k,v])=>(
                <div key={k} className="text-xs bg-blue-50/60 border border-blue-100 rounded px-2 py-1">
                  <span className="text-gray-500">{k}:</span> <span className="font-mono font-semibold text-[#1E3A6B]">{v || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rule Editor View ─────────────────────────────────────────────────────────

function RuleLogicDraftEditor({
  rule, value, isDirty, onChange, onSave, onCancel,
}: {
  rule: Rule;
  value: string;
  isDirty: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border border-amber-200 bg-amber-50/40 rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2 bg-amber-50">
        <PenLine size={12} className="text-amber-700"/>
        <span className="text-xs font-semibold text-amber-900">Editable Logic Draft</span>
        <span className="ml-auto text-[10px] font-medium text-amber-700">
          {isDirty ? "Unsaved draft" : "Ready to save"}
        </span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
          <div className="bg-white border border-amber-100 rounded px-2 py-1">
            <span className="text-gray-400">Rule</span>
            <div className="font-mono font-semibold text-gray-800 mt-0.5">{rule.id}</div>
          </div>
          <div className="bg-white border border-amber-100 rounded px-2 py-1">
            <span className="text-gray-400">Type</span>
            <div className="font-semibold text-gray-800 mt-0.5">{rule.type}</div>
          </div>
          <div className="bg-white border border-amber-100 rounded px-2 py-1">
            <span className="text-gray-400">Mode</span>
            <div className="font-semibold text-gray-800 mt-0.5">Prototype local draft</div>
          </div>
        </div>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={10}
          className="w-full border border-amber-200 bg-white rounded px-3 py-2 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:border-[#1E3A6B]"
        />
        <div className="flex items-center gap-2 mt-3">
          <button onClick={onSave} disabled={!value.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] disabled:opacity-40">
            <Save size={11}/>Save Draft
          </button>
          <button onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-50">
            <X size={11}/>Cancel
          </button>
          <span className="text-[10px] text-amber-700 ml-auto">No backend write. This draft stays in the current prototype session.</span>
        </div>
      </div>
    </div>
  );
}

function RuleEditorView({
  rule, savedDraft, onSaveDraft, onAskAssistant,
}: {
  rule: Rule;
  savedDraft?: string;
  onSaveDraft: (ruleId: string, draftText: string) => void;
  onAskAssistant: (rule: Rule) => void;
}) {
  const defaultDraft = getRuleLogicDraftText(rule);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(savedDraft ?? defaultDraft);

  useEffect(() => {
    setEditing(false);
    setDraftText(savedDraft ?? getRuleLogicDraftText(rule));
  }, [rule.id, savedDraft]);

  const baseline = savedDraft ?? defaultDraft;
  const isDirty = draftText !== baseline;
  const hasSavedDraft = Boolean(savedDraft);
  const cancelEdit = () => {
    setDraftText(baseline);
    setEditing(false);
  };
  const saveDraft = () => {
    onSaveDraft(rule.id, draftText);
    setEditing(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F1F4F8]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <RuleTypeBadge type={rule.type}/>
              {rule.modified && <StatusBadge status="AI-Assisted Draft" size="xs"/>}
              <span className="text-[10px] text-gray-400">·</span>
              <code className="font-mono text-[10px] text-gray-500">{rule.id}</code>
              <span className="text-[10px] text-gray-400">·</span>
              <span className="text-[10px] text-gray-500">{rule.version}</span>
            </div>
            <h1 className="text-base font-semibold text-gray-900">{rule.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed max-w-2xl">{rule.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Btn icon={PenLine}  label={editing ? "Editing Logic" : "Edit Logic"} onClick={()=>setEditing(true)}/>
            <Btn icon={Sparkles} label="Ask Assistant" onClick={()=>onAskAssistant(rule)}/>
            <Btn icon={Copy}     label="Clone Rule"/>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
          <span>Last modified: {rule.lastModified}</span>
          <span>·</span>
          <span>Used by: {rule.usedBy.map(k=>RULE_FUNCTIONS.find(f=>f.key===k)?.name??k).join(", ")||"—"}</span>
          <span>·</span>
          <span className="text-gray-400">Category: {rule.category}</span>
          <span>·</span>
          <span className={editing && isDirty ? "text-amber-600 font-medium" : hasSavedDraft ? "text-green-700 font-medium" : "text-gray-400"}>
            {editing && isDirty ? "Unsaved draft" : hasSavedDraft ? "Draft saved locally" : "No local draft"}
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* I/O Contract */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50/50 border-b border-gray-200 flex items-center gap-2">
              <Code2 size={12} className="text-blue-600"/><span className="text-xs font-semibold text-gray-900">Inputs</span>
              <span className="ml-auto text-[10px] text-gray-400">{rule.inputs.length} fields</span>
            </div>
            {rule.inputs.map(f=>(
              <div key={f.name} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 last:border-0 text-xs">
                <code className="font-mono font-medium text-gray-900 flex-1 truncate">{f.name}</code>
                <TypeChip type={f.type}/>
                {f.required?<span className="text-red-400 text-[10px] flex-shrink-0">req</span>:<span className="text-gray-300 text-[10px] flex-shrink-0">opt</span>}
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-2.5 bg-green-50/50 border-b border-gray-200 flex items-center gap-2">
              <Code2 size={12} className="text-green-600"/><span className="text-xs font-semibold text-gray-900">Outputs</span>
              <span className="ml-auto text-[10px] text-gray-400">{rule.outputs.length} fields</span>
            </div>
            {rule.outputs.map(f=>(
              <div key={f.name} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 last:border-0 text-xs">
                <code className="font-mono font-medium text-gray-900 flex-1 truncate">{f.name}</code>
                <TypeChip type={f.type}/>
                <code className="font-mono text-[10px] text-gray-400">{f.sample}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Logic */}
        {editing ? (
          <div className="bg-white border border-gray-200 rounded p-4">
            <RuleLogicDraftEditor
              rule={rule}
              value={draftText}
              isDirty={isDirty}
              onChange={setDraftText}
              onSave={saveDraft}
              onCancel={cancelEdit}
            />
          </div>
        ) : (
          <RuleLogicTabs rule={rule} savedDraft={savedDraft} defaultDraft={defaultDraft}/>
        )}

        {/* Quick Test */}
        <RuleQuickTest rule={rule}/>
      </div>
    </div>
  );
}

// ─── Decision Tree Views ──────────────────────────────────────────────────────

/** Connector arrow between tree nodes */
function TreeConnector({ label, width = "narrow" }: { label?: string; width?: "narrow" | "wide" }) {
  return (
    <div className={`flex flex-col items-center ${width === "wide" ? "w-full" : ""}`}>
      <div className="w-px h-4 bg-gray-300" />
      {label && (
        <span className="text-[10px] font-medium text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5 my-0.5 whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="w-px h-4 bg-gray-300" />
    </div>
  );
}

/** Rounded tree node box */
function TreeBox({
  label, sublabel, variant = "default", tag, weight, small,
}: {
  label: string; sublabel?: string; tag?: string; weight?: string;
  variant?: "root" | "output" | "default" | "modified" | "skip" | "warn" | "fail" | "pass";
  small?: boolean;
}) {
  const variantCls: Record<string, string> = {
    root:     "bg-[#1E3A6B] text-white border-[#1E3A6B]",
    output:   "bg-green-700 text-white border-green-700",
    default:  "bg-white text-gray-800 border-gray-200",
    modified: "bg-amber-50 text-amber-900 border-amber-300",
    skip:     "bg-orange-50 text-orange-700 border-orange-200",
    warn:     "bg-amber-50 text-amber-800 border-amber-200",
    fail:     "bg-red-50 text-red-800 border-red-200",
    pass:     "bg-green-50 text-green-800 border-green-200",
  };
  const padCls = small ? "px-3 py-2" : "px-5 py-3";
  return (
    <div className={`border rounded-lg shadow-sm text-center ${padCls} ${variantCls[variant]}`}>
      {tag && (
        <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${variant === "root" || variant === "output" ? "opacity-60" : "text-gray-400"}`}>{tag}</div>
      )}
      <div className={`font-semibold leading-tight ${small ? "text-xs" : "text-sm"}`}>{label}</div>
      {sublabel && (
        <div className={`text-[10px] mt-0.5 leading-tight ${variant === "root" || variant === "output" ? "opacity-60" : "text-gray-400"}`}>{sublabel}</div>
      )}
      {weight && (
        <div className="mt-1.5 inline-block text-xs font-bold text-[#1E3A6B] bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">{weight}</div>
      )}
    </div>
  );
}

function BranchOutcome({
  label, title, detail, variant = "pass",
}: {
  label: string;
  title: string;
  detail: string;
  variant?: "pass"|"warn"|"fail"|"default";
}) {
  const cls: Record<string, string> = {
    pass: "bg-green-50 border-green-200 text-green-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    fail: "bg-red-50 border-red-200 text-red-800",
    default: "bg-gray-50 border-gray-200 text-gray-800",
  };
  const labelCls: Record<string, string> = {
    pass: "text-green-600",
    warn: "text-amber-600",
    fail: "text-red-600",
    default: "text-gray-500",
  };
  return (
    <div className={`border rounded-lg px-3 py-2 text-center shadow-sm ${cls[variant]}`}>
      <div className={`text-[9px] font-bold uppercase tracking-wide ${labelCls[variant]}`}>{label}</div>
      <div className="text-xs font-semibold mt-0.5">{title}</div>
      <div className="text-[10px] mt-0.5 opacity-80 leading-tight">{detail}</div>
    </div>
  );
}

/** Portfolio Strength — parallel scoring tree */
function PSDecisionTree({ fn, rules }: { fn: RuleFunctionDef; rules: Rule[] }) {
  const exceptionRule = rules.find(r => r.id === "R-NTW-001");
  const scoring = rules.filter(r => r.type !== "WeightedAggregation" && r.id !== "R-NTW-001");

  return (
    <div className="p-6">
      <div className="min-w-[700px] max-w-5xl mx-auto flex flex-col items-center">

        {/* Input */}
        <TreeBox variant="root" tag="Input" label="Client Portfolio Data"
          sublabel="cip · totalAUM · saaAllocation · houseViewAlignment · esgScore…" />

        {exceptionRule && (
          <>
            <TreeConnector label="Evaluate exception condition" />
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg px-5 py-3 text-center shadow-sm w-72">
              <div className="mb-1">
                <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${ruleTypeCls[exceptionRule.type] ?? ""}`}>{exceptionRule.type}</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">{exceptionRule.shortName}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Condition: exceptionFlags present or NTW treatment required</div>
              {fn.weights?.[exceptionRule.id] !== undefined && (
                <div className="mt-1.5 text-xs font-bold text-[#1E3A6B]">{fn.weights[exceptionRule.id]}%</div>
              )}
            </div>

            <div className="w-full max-w-2xl mt-3">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-px h-4 bg-gray-300"/>
                  <BranchOutcome
                    label="TRUE"
                    title="Exception Treatment Flow"
                    detail="Apply NTW/exception handling; may terminate or flag output."
                    variant="warn"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-4 bg-gray-300"/>
                  <BranchOutcome
                    label="FALSE"
                    title="Parallel Scoring Flow"
                    detail="Continue to rating rule families and weighted aggregation."
                    variant="pass"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <TreeConnector label="FALSE branch continues to parallel scoring families" width="wide" />

        {/* Top horizontal bar */}
        <div className="w-full border-t-2 border-gray-300 relative">
          <div className="flex justify-around pt-0">
            {scoring.map(rule => {
              const w = fn.weights?.[rule.id];
              return (
                <div key={rule.id} className="flex flex-col items-center" style={{ flex: "1 1 0" }}>
                  <div className="w-px h-5 bg-gray-300" />
                  <div className={`border rounded-lg p-2.5 text-center mx-1 w-full max-w-[112px] shadow-sm ${
                    rule.modified       ? "bg-amber-50 border-amber-300" :
                    rule.type === "ExclusionList" ? "bg-gray-50 border-gray-300" :
                    "bg-white border-gray-200"
                  }`}>
                    {rule.modified && (
                      <div className="text-[9px] font-bold text-amber-600 uppercase mb-1 flex items-center justify-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Modified
                      </div>
                    )}
                    <div className={`text-[11px] font-semibold leading-tight ${rule.modified ? "text-amber-900" : "text-gray-800"}`}>
                      {rule.shortName}
                    </div>
                    <div className="mt-1.5">
                      <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${ruleTypeCls[rule.type] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {rule.type}
                      </span>
                    </div>
                    <div className={`text-[10px] mt-1.5 font-medium ${rule.id === "R-TENOR-001" ? "text-orange-500" : "text-gray-400"}`}>
                      {rule.id === "R-TENOR-001" ? "1–5 or SKIP" : rule.type === "ExclusionList" ? "Pass / Flag" : "Rating 1–5"}
                    </div>
                    {w !== undefined && (
                      <div className="mt-1.5 text-xs font-bold text-[#1E3A6B]">{w}%</div>
                    )}
                  </div>
                  <div className="w-px h-5 bg-gray-300" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom horizontal bar */}
        <div className="w-full border-t-2 border-gray-300 mb-0" />

        <TreeConnector label="Weighted average · skipped rules excluded · weights renormalised" width="wide" />

        {/* Aggregation node */}
        <div className="bg-white border-2 border-[#1E3A6B] rounded-lg px-6 py-3 text-center shadow-sm w-80">
          <div className="text-[10px] font-bold text-[#1E3A6B] uppercase tracking-wide mb-1">Overall Weighted Rating</div>
          <div className="text-sm font-semibold text-gray-900">WeightedAggregation</div>
          <div className="text-[10px] text-gray-500 mt-1 font-mono">Rating = ⌈ Σ(wᵢ × Rᵢ) / Σ(active wᵢ) ⌉</div>
        </div>

        <TreeConnector />

        {/* Output */}
        <TreeBox variant="output" tag="Output" label="Portfolio Strength Rating  ·  1–5"
          sublabel="rating · weightedScore · reasonCodes · skippedRules · traceId" />
      </div>
    </div>
  );
}

/** Investment Idea — sequential decision tree */
function IIDecisionTree({ rules }: { rules: Rule[] }) {
  const steps = [
    {
      ruleId:"R-PRESTR-001",
      condition:"restrictedFlags contains PRODUCT_BLOCKED",
      trueTitle:"Not Recommended",
      trueDetail:"Terminal flow · IDEA-RESTRICTED",
      trueVariant:"fail" as const,
      falseTitle:"Hard Eligibility Flow",
      falseDetail:"No restriction found; continue to eligibility checks.",
      falseVariant:"pass" as const,
      continueLabel:"FALSE branch enters Hard Eligibility Flow",
    },
    {
      ruleId:"R-HELIG-001",
      condition:"productRiskRating > tolerance OR jurisdiction unsupported",
      trueTitle:"Ineligible",
      trueDetail:"Terminal flow · IDEA-CIP-BLOCK",
      trueVariant:"fail" as const,
      falseTitle:"Soft Suitability Flow",
      falseDetail:"Eligibility passed; continue to warning checks.",
      falseVariant:"pass" as const,
      continueLabel:"FALSE branch enters Soft Suitability Flow",
    },
    {
      ruleId:"R-SSUIT-001",
      condition:"concentration, liquidity, or risk warning exists",
      trueTitle:"Warning Flow",
      trueDetail:"Add warning code, then continue to house view.",
      trueVariant:"warn" as const,
      falseTitle:"Clean Suitability Flow",
      falseDetail:"No warning; continue to house view.",
      falseVariant:"pass" as const,
      continueLabel:"Both branches continue to House View flow",
    },
    {
      ruleId:"R-HVII-001",
      condition:"houseView is OW or UW",
      trueTitle:"Adjusted Ranking Flow",
      trueDetail:"Apply house-view adjustment before ranking.",
      trueVariant:"warn" as const,
      falseTitle:"Neutral Ranking Flow",
      falseDetail:"No adjustment; continue to ranking.",
      falseVariant:"pass" as const,
      continueLabel:"Both branches continue to Ranking flow",
    },
  ];
  const rankRule = rules.find(r => r.id === "R-RANK-001");

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        <TreeBox variant="root" tag="Input" label="Client Profile + Product Attributes"
          sublabel="cip · productRiskRating · holdingConcentration · houseView…" />

        {steps.map(step => {
          const rule = rules.find(r => r.id === step.ruleId);
          if (!rule) return null;
          return (
            <div key={step.ruleId} className="w-full flex flex-col items-center">
              <TreeConnector label={step.condition} width="wide" />
              <div className={`border-2 rounded-lg p-3 text-center shadow-sm w-80 ${rule.type === "ExclusionList" ? "border-red-300 bg-red-50/50" : "border-gray-200 bg-white"}`}>
                <div className="mb-1">
                  <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${ruleTypeCls[rule.type] ?? ""}`}>{rule.type}</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">{rule.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{rule.inputs.map(f => f.name).slice(0, 3).join(" · ")}</div>
              </div>

              <div className="w-full mt-3">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-gray-300"/>
                    <BranchOutcome label="TRUE" title={step.trueTitle} detail={step.trueDetail} variant={step.trueVariant}/>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-gray-300"/>
                    <BranchOutcome label="FALSE" title={step.falseTitle} detail={step.falseDetail} variant={step.falseVariant}/>
                  </div>
                </div>
              </div>

              <TreeConnector label={step.continueLabel} />
            </div>
          );
        })}

        {/* Ranking */}
        <TreeConnector label="eligible = true" width="wide" />
        <div className="bg-white border-2 border-indigo-300 rounded-lg px-5 py-3 text-center shadow-sm w-72">
          <div className="mb-1">
            <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${ruleTypeCls["RankingMatrix"]}`}>RankingMatrix</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">{rankRule?.name}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">CIP + houseView + objective → Rank 1–5</div>
        </div>

        <div className="w-full max-w-2xl mt-3">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-gray-300"/>
              <BranchOutcome
                label="TRUE"
                title="Eligible Recommendation Flow"
                detail="Terminal output includes rank, advisor message, and reason codes."
                variant="pass"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-gray-300"/>
              <BranchOutcome
                label="FALSE"
                title="Manual Review Flow"
                detail="Terminal output flags manual review with reason code."
                variant="warn"
              />
            </div>
          </div>
        </div>

        <TreeConnector label="Terminal output" />
        <TreeBox variant="output" tag="Output" label="Eligible · Rank · Advisor Message"
          sublabel="eligible · recommendationRank · reasonCodes · advisorMessage" />
      </div>
    </div>
  );
}

/** Dispatcher: picks the right tree view for the function */
function DecisionTreeView({ fn, allRules }: { fn: RuleFunctionDef; allRules: Rule[] }) {
  const fnRules = fn.ruleIds.map(id => allRules.find(r => r.id === id)).filter(Boolean) as Rule[];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto bg-[#F1F4F8]">
        {fn.key === "PS" ? <PSDecisionTree fn={fn} rules={fnRules} /> : <IIDecisionTree rules={fnRules} />}
      </div>
      <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0">
        <FunctionExecutionJsonPanel fn={fn} allRules={allRules} compact/>
      </div>
    </div>
  );
}

function FunctionExecutionJsonPanel({ fn, allRules, compact=false }: { fn: RuleFunctionDef; allRules: Rule[]; compact?: boolean }) {
  const spec = buildRuleFunctionExecutionSpec(fn, allRules);
  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
        <Code2 size={12} className="text-[#1E3A6B]"/>
        <div>
          <div className="text-xs font-semibold text-gray-900">Backend Java Execution JSON</div>
          <div className="text-[10px] text-gray-500">Embedded by the Java rule engine through <code className="font-mono">{spec.javaHandler}</code>.</div>
        </div>
        <span className="ml-auto text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{spec.executionType}</span>
      </div>
      <pre className={`${compact?"max-h-40":"max-h-[360px]"} overflow-auto bg-slate-950 text-slate-100 p-3 text-[11px] leading-relaxed font-mono`}>
        {JSON.stringify(spec, null, 2)}
      </pre>
    </div>
  );
}

// ─── Function Flow Builder ────────────────────────────────────────────────────

function FlowBuilderTab({ fn, allRules, onAddRule, onRemoveRule, onMoveRule, onAddCondition, onRemoveCondition, onUpdateRuleFlow }:{
  fn: RuleFunctionDef; allRules: Rule[];
  onAddRule:(ruleId:string)=>void; onRemoveRule:(ruleId:string)=>void; onMoveRule:(ruleId:string,dir:"up"|"down")=>void;
  onAddCondition:(condition:NonNullable<RuleFunctionDef["conditionSteps"]>[number])=>void;
  onRemoveCondition:(conditionId:string)=>void;
  onUpdateRuleFlow:(ruleId:string, patch:NonNullable<RuleFunctionDef["flowOverrides"]>[string], weight?:number|null)=>void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showConditionBuilder, setShowConditionBuilder] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [conditionForm, setConditionForm] = useState({
    name: "New Condition",
    condition: "field operator value",
    trueFlowId: "TRUE_FLOW",
    trueLabel: "Continue on TRUE",
    falseFlowId: "FALSE_FLOW",
    falseLabel: "Continue on FALSE",
    note: "",
  });
  const [editingRuleId, setEditingRuleId] = useState<string|null>(null);
  const [editForm, setEditForm] = useState({
    condition: "",
    trueFlowId: "",
    trueLabel: "",
    falseFlowId: "",
    falseLabel: "",
    note: "",
    weight: "",
  });
  const fnRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];
  const available = allRules.filter(r=>!fn.ruleIds.includes(r.id)&&r.id!=="R-OVERALL-001");
  const filtered = available.filter(r=>r.name.toLowerCase().includes(pickerSearch.toLowerCase()));

  const isPS = fn.key === "PS";
  const iiConditions: Record<string, { condition:string; trueFlowId:string; trueLabel:string; falseFlowId:string; falseLabel:string; trueTone:"fail"|"warn"; falseTone:"pass"|"warn" }> = {
    "R-PRESTR-001": { condition:"restrictedFlags contains PRODUCT_BLOCKED", trueFlowId:"RESTRICTION_BLOCK_FLOW", trueLabel:"Terminal: NOT_RECOMMENDED", falseFlowId:"HARD_ELIGIBILITY_FLOW", falseLabel:"Continue to hard eligibility", trueTone:"fail", falseTone:"pass" },
    "R-HELIG-001": { condition:"productRiskRating > 4 OR jurisdiction not supported", trueFlowId:"ELIGIBILITY_BLOCK_FLOW", trueLabel:"Terminal: INELIGIBLE", falseFlowId:"SOFT_SUITABILITY_FLOW", falseLabel:"Continue to soft suitability", trueTone:"fail", falseTone:"pass" },
    "R-SSUIT-001": { condition:"holdingConcentration > 25 OR liquidity/risk warning", trueFlowId:"WARNING_FLOW", trueLabel:"Add warning, then continue", falseFlowId:"CLEAN_SUITABILITY_FLOW", falseLabel:"Continue without warning", trueTone:"warn", falseTone:"pass" },
    "R-HVII-001": { condition:"houseView in OW/N/UW", trueFlowId:"ADJUSTED_RANKING_FLOW", trueLabel:"Apply house-view rank adjustment", falseFlowId:"NEUTRAL_RANKING_FLOW", falseLabel:"Default to neutral ranking", trueTone:"warn", falseTone:"pass" },
    "R-RANK-001": { condition:"eligible = true", trueFlowId:"ELIGIBLE_RECOMMENDATION_FLOW", trueLabel:"Terminal: ELIGIBLE_WITH_RANK", falseFlowId:"MANUAL_REVIEW_FLOW", falseLabel:"Terminal: MANUAL_REVIEW", trueTone:"pass", falseTone:"warn" },
  };
  const editingRule = editingRuleId ? fnRules.find(r=>r.id===editingRuleId) : null;
  const flowDisplay = (ruleId:string) => {
    const base = iiConditions[ruleId];
    const override = fn.flowOverrides?.[ruleId];
    return {
      condition: override?.condition ?? base?.condition ?? "Execute rule",
      trueFlowId: override?.trueFlowId ?? base?.trueFlowId ?? "TRUE_FLOW",
      trueLabel: override?.trueLabel ?? base?.trueLabel ?? "TRUE branch",
      falseFlowId: override?.falseFlowId ?? base?.falseFlowId ?? "FALSE_FLOW",
      falseLabel: override?.falseLabel ?? base?.falseLabel ?? "FALSE branch",
      trueTone: base?.trueTone ?? "warn",
      falseTone: base?.falseTone ?? "pass",
      note: override?.note ?? "",
    };
  };
  const openEdit = (rule: Rule) => {
    const flow = flowDisplay(rule.id);
    setEditingRuleId(rule.id);
    setEditForm({
      condition: flow.condition,
      trueFlowId: flow.trueFlowId,
      trueLabel: flow.trueLabel,
      falseFlowId: flow.falseFlowId,
      falseLabel: flow.falseLabel,
      note: flow.note,
      weight: fn.weights?.[rule.id] !== undefined ? String(fn.weights[rule.id]) : "",
    });
  };
  const saveEdit = () => {
    if (!editingRule) return;
    const weightValue = editForm.weight.trim()==="" ? null : Number(editForm.weight);
    onUpdateRuleFlow(editingRule.id, {
      condition: editForm.condition.trim(),
      trueFlowId: editForm.trueFlowId.trim(),
      trueLabel: editForm.trueLabel.trim(),
      falseFlowId: editForm.falseFlowId.trim(),
      falseLabel: editForm.falseLabel.trim(),
      note: editForm.note.trim(),
    }, Number.isFinite(weightValue) ? weightValue : null);
    setEditingRuleId(null);
  };
  const resetConditionForm = () => setConditionForm({
    name: "New Condition",
    condition: "field operator value",
    trueFlowId: "TRUE_FLOW",
    trueLabel: "Continue on TRUE",
    falseFlowId: "FALSE_FLOW",
    falseLabel: "Continue on FALSE",
    note: "",
  });
  const saveCondition = () => {
    const id = `COND-${Date.now().toString(36).toUpperCase()}`;
    onAddCondition({
      id,
      name: conditionForm.name.trim() || "New Condition",
      condition: conditionForm.condition.trim() || "field operator value",
      trueFlowId: conditionForm.trueFlowId.trim() || "TRUE_FLOW",
      trueLabel: conditionForm.trueLabel.trim() || "Continue on TRUE",
      falseFlowId: conditionForm.falseFlowId.trim() || "FALSE_FLOW",
      falseLabel: conditionForm.falseLabel.trim() || "Continue on FALSE",
      note: conditionForm.note.trim(),
    });
    setShowConditionBuilder(false);
    resetConditionForm();
  };
  const conditionStepCards = (
    <div className="space-y-2 mb-3">
      {(fn.conditionSteps ?? []).map(step=>(
        <div key={step.id} className="bg-white border border-blue-200 rounded p-3 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            <GitBranch size={12}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">{step.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 font-medium">Condition</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
              <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Expression</div>
                <div className="text-gray-700 font-mono">{step.condition}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded px-2 py-1.5">
                <div className="font-semibold text-green-700 uppercase tracking-wide mb-0.5">TRUE → {step.trueFlowId}</div>
                <div className="text-green-800">{step.trueLabel}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                <div className="font-semibold text-amber-700 uppercase tracking-wide mb-0.5">FALSE → {step.falseFlowId}</div>
                <div className="text-amber-800">{step.falseLabel}</div>
              </div>
            </div>
            {step.note && <div className="mt-2 text-[10px] text-gray-500 bg-blue-50 border border-blue-100 rounded px-2 py-1">{step.note}</div>}
          </div>
          <button onClick={()=>onRemoveCondition(step.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12}/></button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-4 bg-[#F1F4F8]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Rule Flow</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isPS ? "Rules execute in parallel, then the Java engine aggregates weighted results." : "Rules execute as a condition-based decision tree with pass, warning and terminal branches."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowConditionBuilder(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1E3A6B]/30 text-[#1E3A6B] bg-white rounded text-xs font-medium hover:bg-blue-50">
            <GitBranch size={12}/>Add Condition
          </button>
          <button onClick={()=>setShowPicker(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059]">
            <Plus size={12}/>Add Rule from Library
          </button>
        </div>
      </div>

      {/* Flow visualization */}
      {isPS ? (
        <div className="flex gap-4">
          {/* Parallel rules */}
          <div className="flex-1 space-y-2">
            {conditionStepCards}
            {fnRules.filter(r=>r.id!=="R-OVERALL-001").map((rule,i,arr)=>(
              <div key={rule.id} className={`bg-white border rounded p-3 flex items-center gap-3 ${rule.modified?"border-amber-300":"border-gray-200"}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.modified?"bg-amber-500":"bg-gray-300"}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">{rule.name}</span>
                    {rule.modified&&<StatusBadge status="AI-Assisted Draft" size="xs"/>}
                    <RuleTypeBadge type={rule.type}/>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Inputs: {rule.inputs.map(f=>f.name).join(", ")} → Output: {rule.outputs[0]?.name}
                    {fn.weights?.[rule.id]!==undefined&&<span className="ml-2 font-semibold text-[#1E3A6B]">Weight: {fn.weights[rule.id]}%</span>}
                  </div>
                  {fn.flowOverrides?.[rule.id]?.note && (
                    <div className="mt-2 text-[10px] text-gray-500 bg-blue-50 border border-blue-100 rounded px-2 py-1">{fn.flowOverrides[rule.id].note}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={()=>openEdit(rule)} className="p-1 text-gray-400 hover:text-[#1E3A6B]" title="Edit flow step"><Edit3 size={12}/></button>
                  <button disabled={i===0} onClick={()=>onMoveRule(rule.id,"up")} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={12}/></button>
                  <button disabled={i===arr.length-1} onClick={()=>onMoveRule(rule.id,"down")} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={12}/></button>
                  <button onClick={()=>onRemoveRule(rule.id)} className="p-1 text-gray-300 hover:text-red-500 ml-1"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
          {/* Arrow + aggregation */}
          <div className="flex flex-col items-center justify-center gap-1 px-2">
            <ArrowRight size={20} className="text-gray-400"/>
          </div>
          <div className="w-52 flex-shrink-0">
            <div className="bg-green-50 border border-green-200 rounded p-3 h-full flex flex-col items-center justify-center text-center">
              <CheckCircle2 size={20} className="text-green-600 mb-2"/>
              <div className="text-xs font-semibold text-green-800">Overall Weighted Rating</div>
              <div className="text-[10px] text-green-600 mt-1">Weighted aggregation of all computed rule ratings</div>
              <div className="mt-2 text-[10px] text-green-700 font-mono">→ Rating 1–5</div>
            </div>
          </div>
        </div>
      ) : (
        /* Condition-based decision tree flow for Investment Ideas */
        <div className="max-w-3xl space-y-2">
          {conditionStepCards}
          {fnRules.map((rule,i)=>{
            const flow = flowDisplay(rule.id);
            return (
            <div key={rule.id} className="flex flex-col items-stretch">
              <div className={`bg-white border rounded p-3 flex items-start gap-3 ${rule.modified?"border-amber-300":"border-gray-200"}`}>
                <div className="w-6 h-6 rounded-full bg-[#1E3A6B]/10 text-[#1E3A6B] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">{rule.name}</span>
                    <RuleTypeBadge type={rule.type}/>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                      <div className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Condition</div>
                      <div className="text-gray-700 font-mono">{flow.condition}</div>
                    </div>
                    <div className={`${flow.trueTone==="fail"?"bg-red-50 border-red-200":flow.trueTone==="warn"?"bg-amber-50 border-amber-200":"bg-green-50 border-green-200"} border rounded px-2 py-1.5`}>
                      <div className={`font-semibold uppercase tracking-wide mb-0.5 ${flow.trueTone==="fail"?"text-red-700":flow.trueTone==="warn"?"text-amber-700":"text-green-700"}`}>TRUE → {flow.trueFlowId}</div>
                      <div className={flow.trueTone==="fail"?"text-red-800":flow.trueTone==="warn"?"text-amber-800":"text-green-800"}>{flow.trueLabel}</div>
                    </div>
                    <div className={`${flow.falseTone==="warn"?"bg-amber-50 border-amber-200":"bg-green-50 border-green-200"} border rounded px-2 py-1.5`}>
                      <div className={`font-semibold uppercase tracking-wide mb-0.5 ${flow.falseTone==="warn"?"text-amber-700":"text-green-700"}`}>FALSE → {flow.falseFlowId}</div>
                      <div className={flow.falseTone==="warn"?"text-amber-800":"text-green-800"}>{flow.falseLabel}</div>
                    </div>
                  </div>
                  {flow.note && <div className="mt-2 text-[10px] text-gray-500 bg-blue-50 border border-blue-100 rounded px-2 py-1">{flow.note}</div>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={()=>openEdit(rule)} className="p-1 text-gray-400 hover:text-[#1E3A6B]" title="Edit flow step"><Edit3 size={12}/></button>
                  <button disabled={i===0} onClick={()=>onMoveRule(rule.id,"up")} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={12}/></button>
                  <button disabled={i===fnRules.length-1} onClick={()=>onMoveRule(rule.id,"down")} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={12}/></button>
                  <button onClick={()=>onRemoveRule(rule.id)} className="p-1 text-gray-300 hover:text-red-500 ml-1"><Trash2 size={12}/></button>
                </div>
              </div>
              {i<fnRules.length-1&&<div className="flex flex-col items-center my-0.5"><div className="w-px h-3 bg-gray-300"/><ArrowDown size={11} className="text-gray-400"/></div>}
            </div>
          );})}
        </div>
      )}

      <div className="mt-4">
        <FunctionExecutionJsonPanel fn={fn} allRules={allRules}/>
      </div>

      {/* Add condition modal */}
      {showConditionBuilder&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(13,27,62,0.5)"}}>
          <div className="bg-white rounded-lg shadow-2xl w-[620px] max-h-[78vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Add Condition</div>
                <div className="text-xs text-gray-500 mt-0.5">Create a function-level branch condition for this rule flow</div>
              </div>
              <button onClick={()=>setShowConditionBuilder(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Condition Name</label>
                <input
                  value={conditionForm.name}
                  onChange={e=>setConditionForm({...conditionForm, name:e.target.value})}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Condition Expression</label>
                <input
                  value={conditionForm.condition}
                  onChange={e=>setConditionForm({...conditionForm, condition:e.target.value})}
                  placeholder="Example: clientSegment = HNW AND riskScore > 4"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B] font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">TRUE Branch</div>
                  <input
                    value={conditionForm.trueFlowId}
                    onChange={e=>setConditionForm({...conditionForm, trueFlowId:e.target.value})}
                    placeholder="Flow ID"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] font-mono"
                  />
                  <textarea
                    value={conditionForm.trueLabel}
                    onChange={e=>setConditionForm({...conditionForm, trueLabel:e.target.value})}
                    rows={3}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] resize-none"
                  />
                </div>
                <div className="space-y-2 bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">FALSE Branch</div>
                  <input
                    value={conditionForm.falseFlowId}
                    onChange={e=>setConditionForm({...conditionForm, falseFlowId:e.target.value})}
                    placeholder="Flow ID"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] font-mono"
                  />
                  <textarea
                    value={conditionForm.falseLabel}
                    onChange={e=>setConditionForm({...conditionForm, falseLabel:e.target.value})}
                    rows={3}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] resize-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Maker Note</label>
                <textarea
                  value={conditionForm.note}
                  onChange={e=>setConditionForm({...conditionForm, note:e.target.value})}
                  rows={3}
                  placeholder="Optional rationale for this condition"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B] resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={()=>setShowConditionBuilder(false)} className="px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveCondition} className="px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] flex items-center gap-1.5">
                <GitBranch size={12}/>Add Condition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flow step edit modal */}
      {editingRule&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(13,27,62,0.5)"}}>
          <div className="bg-white rounded-lg shadow-2xl w-[620px] max-h-[78vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Edit Rule Flow Step</div>
                <div className="text-xs text-gray-500 mt-0.5">{editingRule.name} · {editingRule.id}</div>
              </div>
              <button onClick={()=>setEditingRuleId(null)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              {isPS ? (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Weight %</label>
                  <input
                    value={editForm.weight}
                    onChange={e=>setEditForm({...editForm, weight:e.target.value})}
                    inputMode="decimal"
                    placeholder="Example: 15"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B]"
                  />
                  <div className="text-[10px] text-gray-400 mt-1">Weight is stored on the rule function draft and reflected in the backend execution JSON.</div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Condition Label</label>
                    <input
                      value={editForm.condition}
                      onChange={e=>setEditForm({...editForm, condition:e.target.value})}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B] font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2 bg-gray-50 border border-gray-200 rounded p-3">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">TRUE Branch</div>
                      <input
                        value={editForm.trueFlowId}
                        onChange={e=>setEditForm({...editForm, trueFlowId:e.target.value})}
                        placeholder="Flow ID"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] font-mono"
                      />
                      <textarea
                        value={editForm.trueLabel}
                        onChange={e=>setEditForm({...editForm, trueLabel:e.target.value})}
                        placeholder="Branch outcome"
                        rows={3}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] resize-none"
                      />
                    </div>
                    <div className="space-y-2 bg-gray-50 border border-gray-200 rounded p-3">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">FALSE Branch</div>
                      <input
                        value={editForm.falseFlowId}
                        onChange={e=>setEditForm({...editForm, falseFlowId:e.target.value})}
                        placeholder="Flow ID"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] font-mono"
                      />
                      <textarea
                        value={editForm.falseLabel}
                        onChange={e=>setEditForm({...editForm, falseLabel:e.target.value})}
                        placeholder="Branch outcome"
                        rows={3}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-[#1E3A6B] resize-none"
                      />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Maker Note</label>
                <textarea
                  value={editForm.note}
                  onChange={e=>setEditForm({...editForm, note:e.target.value})}
                  rows={3}
                  placeholder="Optional rationale for this flow-step edit"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B] resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={()=>setEditingRuleId(null)} className="px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} className="px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] flex items-center gap-1.5">
                <Save size={12}/>Save Flow Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule picker modal */}
      {showPicker&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(13,27,62,0.5)"}}>
          <div className="bg-white rounded-lg shadow-2xl w-[560px] max-h-[70vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div><div className="text-sm font-semibold text-gray-900">Add Rule from Library</div><div className="text-xs text-gray-500 mt-0.5">Select a rule to add to the function flow</div></div>
              <button onClick={()=>setShowPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                <Search size={12} className="text-gray-400"/>
                <input value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder="Search rules…" className="flex-1 text-xs bg-transparent outline-none"/>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {filtered.length===0?<div className="py-8 text-center text-gray-400 text-sm">No available rules</div>:
               filtered.map(r=>(
                <div key={r.id} className="flex items-start gap-3 px-5 py-3 border-b border-gray-100 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-medium text-gray-900">{r.name}</span><RuleTypeBadge type={r.type}/></div>
                    <div className="text-[10px] text-gray-500 truncate">{r.desc}</div>
                  </div>
                  <button onClick={()=>{onAddRule(r.id);setShowPicker(false);}} className="px-3 py-1 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] flex-shrink-0">Add</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auto I/O Contract ────────────────────────────────────────────────────────

function IOContractTab({ fn, allRules }: { fn: RuleFunctionDef; allRules: Rule[] }) {
  const fnRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];

  // Auto-derive unique inputs (dedup by name)
  const inputMap = new Map<string, IOField & { consumedBy: string[] }>();
  fnRules.forEach(rule=>{
    rule.inputs.forEach(inp=>{
      if (inputMap.has(inp.name)) {
        inputMap.get(inp.name)!.consumedBy.push(rule.shortName);
      } else {
        inputMap.set(inp.name, { ...inp, consumedBy:[rule.shortName] });
      }
    });
  });
  const derivedInputs = Array.from(inputMap.values());

  // Outputs from the last non-aggregation rules (or the aggregation if present)
  const aggRule = fnRules.find(r=>r.type==="WeightedAggregation");
  const outputRules = aggRule ? [aggRule] : fnRules.slice(-1);
  const derivedOutputs = outputRules.flatMap(r=>r.outputs);

  return (
    <div className="flex-1 overflow-auto p-4 bg-[#F1F4F8]">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Auto-generated I/O Contract</div>
          <div className="text-xs text-gray-500 mt-0.5">Derived from the union of all {fnRules.length} rules in this function. Regenerates when rules are added or removed.</div>
        </div>
        <Btn icon={RefreshCw} label="Regenerate"/>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-50/50 border-b border-gray-200 flex items-center gap-2">
            <Code2 size={12} className="text-blue-600"/>
            <span className="text-xs font-semibold text-gray-900">Input Contract</span>
            <span className="ml-auto text-[10px] text-gray-400">{derivedInputs.length} fields</span>
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-px rounded">Auto-generated</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0"><tr>
              {["Field","Type","Req","Consumed By","Sample"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {derivedInputs.map(f=>(
                <tr key={f.name} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono font-medium text-gray-900">{f.name}</td>
                  <td className="px-3 py-2"><TypeChip type={f.type}/></td>
                  <td className="px-3 py-2 text-center">{f.required?<span className="text-red-500 font-bold">*</span>:<span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-[10px] text-gray-500">{f.consumedBy.slice(0,2).join(", ")}{f.consumedBy.length>2?` +${f.consumedBy.length-2}`:""}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-400">{f.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Outputs */}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="px-4 py-2.5 bg-green-50/50 border-b border-gray-200 flex items-center gap-2">
            <Code2 size={12} className="text-green-600"/>
            <span className="text-xs font-semibold text-gray-900">Output Contract</span>
            <span className="ml-auto text-[10px] text-gray-400">{derivedOutputs.length} fields</span>
            <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-1.5 py-px rounded">Auto-generated</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0"><tr>
              {["Field","Type","Description","Sample"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {derivedOutputs.map(f=>(
                <tr key={f.name} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono font-medium text-gray-900">{f.name}</td>
                  <td className="px-3 py-2"><TypeChip type={f.type}/></td>
                  <td className="px-3 py-2 text-gray-600">{f.desc}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-400">{f.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Test Cases Tab ───────────────────────────────────────────────────────────

function TestCasesTab({ fnKey, testCases, onRun, onDelete }:{
  fnKey:string; testCases:TestCase[]; onRun:(id:string)=>void; onDelete:(id:string)=>void;
}) {
  const cases = testCases.filter(tc=>tc.fnKey===fnKey);
  const [expanded, setExpanded] = useState<string|null>(null);

  const statusCls = { pass:"bg-green-50 text-green-700 border border-green-200", fail:"bg-red-50 text-red-700 border border-red-200", "not-run":"bg-gray-100 text-gray-500 border border-gray-200" };
  const statusIcon = { pass:<CheckCircle2 size={10}/>, fail:<X size={10}/>, "not-run":<Clock size={10}/> };

  const passCount = cases.filter(c=>c.status==="pass").length;
  const failCount = cases.filter(c=>c.status==="fail").length;
  const notRunCount = cases.filter(c=>c.status==="not-run").length;

  return (
    <div className="flex-1 overflow-auto p-4 bg-[#F1F4F8]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Test Cases</div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="text-green-700 font-medium">{passCount} Passed</span>
            <span className="text-red-600 font-medium">{failCount} Failed</span>
            <span className="text-gray-400">{notRunCount} Not run</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{cases.length} total</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Btn icon={Play} label="Run All"/>
          <Btn icon={RefreshCw} label="Run Regression" primary/>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-8 text-center">
          <TestTube size={32} className="mx-auto mb-3 text-gray-300"/>
          <div className="text-sm font-medium text-gray-700">No test cases yet</div>
          <div className="text-xs text-gray-400 mt-1">Run a simulation and save it as a test case to build your regression suite.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map(tc=>(
            <div key={tc.id} className="bg-white border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={()=>setExpanded(expanded===tc.id?null:tc.id)}>
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${statusCls[tc.status]}`}>
                  {statusIcon[tc.status]}{tc.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900">{tc.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Created: {tc.createdAt} · Expected: {Object.entries(tc.expectedOutput).map(([k,v])=>`${k}=${v}`).join(", ")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e=>{e.stopPropagation();onRun(tc.id);}} className="flex items-center gap-1 px-2.5 py-1 bg-[#1E3A6B] text-white rounded text-[10px] font-medium hover:bg-[#163059]"><Play size={9}/>Run</button>
                  <button onClick={e=>{e.stopPropagation();onDelete(tc.id);}} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12}/></button>
                  <ChevronDown size={13} className={`text-gray-400 transition-transform ${expanded===tc.id?"-rotate-180":""}`}/>
                </div>
              </div>
              {expanded===tc.id&&(
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Inputs</div>
                      {Object.entries(tc.inputs).map(([k,v])=>(
                        <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                          <code className="font-mono text-gray-600">{k}</code><span className="font-medium text-gray-900">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Expected Output</div>
                      {Object.entries(tc.expectedOutput).map(([k,v])=>(
                        <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                          <code className="font-mono text-gray-600">{k}</code><span className="font-mono font-semibold text-[#1E3A6B]">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Simulation Tab ───────────────────────────────────────────────────────────

function SimulationTab({ fn, allRules, onSaveTestCase }:{
  fn:RuleFunctionDef; allRules:Rule[]; onSaveTestCase:(tc:TestCase)=>void;
}) {
  const fnRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];
  const inputMap = new Map<string, IOField>();
  fnRules.forEach(r=>r.inputs.forEach(inp=>{ if(!inputMap.has(inp.name)) inputMap.set(inp.name, inp); }));
  const allInputs = Array.from(inputMap.values());

  const [vals, setVals] = useState<Record<string,string>>({});
  const [result, setResult] = useState<SimResult|null>(null);
  const [running, setRunning] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(()=>{ setResult(runSimulation(fn.key, vals)); setRunning(false); setSaved(false); }, 600);
  };

  const handleSave = () => {
    if (!saveName || !result) return;
    onSaveTestCase({
      id: "TC-"+Date.now(), name: saveName, fnKey: fn.key,
      inputs: { ...vals },
      expectedOutput: result.finalOutput,
      status: "not-run", createdAt: "14 Jun 2026",
    });
    setSaved(true); setSaveName("");
  };

  const ratingCls = (r:number|null) => !r?"text-gray-400":r<=2?"text-green-600":r===3?"text-amber-600":"text-red-600";

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Input form */}
      <div className="w-[280px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-900">Simulation Inputs</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Provide values for all required fields</div>
        </div>
        <div className="p-4 space-y-3">
          {allInputs.map(f=>(
            <div key={f.name}>
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 mb-0.5">
                <code className="font-mono">{f.name}</code>
                <TypeChip type={f.type}/>
                {f.required&&<span className="text-red-400">*</span>}
              </label>
              {f.type==="enum" ? (
                <select value={vals[f.name]??""}
                  onChange={e=>setVals(p=>({...p,[f.name]:e.target.value}))}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#1E3A6B]">
                  <option value="">— select —</option>
                  {f.name==="cip"&&["Conservative","Moderate","Balanced","Aggressive"].map(v=><option key={v}>{v}</option>)}
                  {f.name==="houseView"&&["OW","N","UW"].map(v=><option key={v}>{v}</option>)}
                  {f.name==="jurisdiction"&&["SG","HK","MY","TH"].map(v=><option key={v}>{v}</option>)}
                  {f.name==="liquidityNeed"&&["LOW","MEDIUM","HIGH"].map(v=><option key={v}>{v}</option>)}
                  {f.name==="riskTolerance"&&["Low","Medium","High"].map(v=><option key={v}>{v}</option>)}
                  {!["cip","houseView","jurisdiction","liquidityNeed","riskTolerance"].includes(f.name)&&<option>{f.sample}</option>}
                </select>
              ) : (
                <input value={vals[f.name]??""}
                  onChange={e=>setVals(p=>({...p,[f.name]:e.target.value}))}
                  placeholder={f.sample}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#1E3A6B]"/>
              )}
            </div>
          ))}
          <button onClick={handleRun} disabled={running}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1E3A6B] text-white rounded text-xs font-semibold hover:bg-[#163059] disabled:opacity-60 mt-2">
            {running?<RefreshCw size={12} className="animate-spin"/>:<Zap size={12}/>}
            {running?"Running…":"Run Simulation"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto bg-[#F1F4F8] p-4">
        {!result ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FlaskConical size={40} className="mx-auto mb-3 text-gray-300"/>
              <div className="text-sm font-medium text-gray-600">Enter inputs and run the simulation</div>
              <div className="text-xs text-gray-400 mt-1">Results will show a per-rule execution trace and final output.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Final output */}
            <div className="bg-white border border-gray-200 rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-900">Final Output</div>
                <StatusBadge status="AI-Assisted" size="xs"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(result.finalOutput).map(([k,v])=>(
                  <div key={k} className="bg-gray-50 border border-gray-200 rounded p-2.5">
                    <div className="text-[10px] text-gray-500 mb-0.5"><code className="font-mono">{k}</code></div>
                    <div className={`text-xl font-bold ${k==="overallRating"||k==="finalRating"?ratingCls(parseFloat(v)||null):"text-gray-900"}`}>{v}</div>
                  </div>
                ))}
                {fn.key==="PS"&&result.finalRating&&(
                  <div className="col-span-2 text-xs text-gray-500">
                    Weighted score: <strong>{result.weightedScore.toFixed(2)}</strong> → ceiling → Rating <strong className={ratingCls(result.finalRating)}>{result.finalRating}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Per-rule trace */}
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Rule Execution Trace</span>
                <span className="text-xs text-gray-400 ml-auto">{result.ruleResults.length} rules evaluated</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50"><tr>
                  {["Rule","State","Output","Weight","Reason Code"].map(h=>(
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {result.ruleResults.map(r=>(
                    <tr key={r.ruleId} className={`${r.state==="Skipped"?"bg-orange-50/30":"hover:bg-gray-50"}`}>
                      <td className="px-3 py-2 font-medium text-gray-800">{r.ruleName}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${r.state==="Skipped"?"text-orange-600":"text-green-700"}`}>{r.state}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.output}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{r.weight>0?`${r.weight.toFixed(1)}%`:"—"}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{r.reasonCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save as test case */}
            <div className="bg-white border border-gray-200 rounded p-4">
              <div className="text-xs font-semibold text-gray-900 mb-2">Save as Test Case</div>
              {saved ? (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2.5">
                  <CheckCircle2 size={12}/>Test case saved. Find it in the Test Cases tab.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Test case name e.g. Moderate CIP — gap above threshold"
                    className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#1E3A6B]"/>
                  <button onClick={handleSave} disabled={!saveName}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] disabled:opacity-40">
                    <Save size={11}/>Save
                  </button>
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1.5">Saved test cases appear in the Test Cases tab and can be re-run for regression testing.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeHistoryTab({ fn, allRules, testCases }: { fn:RuleFunctionDef; allRules:Rule[]; testCases:TestCase[] }) {
  const fnRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];
  const modifiedRules = fnRules.filter(r=>r.modified);
  const fnCases = testCases.filter(tc=>tc.fnKey===fn.key);
  const passCount = fnCases.filter(tc=>tc.status==="pass").length;
  const failCount = fnCases.filter(tc=>tc.status==="fail").length;
  const pendingCount = fnCases.length - passCount - failCount;
  const latestVersion = fn.draftRelease ?? fn.activeRelease;
  const history = fn.key === "PS" ? [
    { version:"v4.8", date:"13 Jun 2026 16:42 SGT", actor:"Jennifer Wong", event:"AI-assisted draft created", status:"Draft - Maker Review Required", summary:"SAA Allocation and House View threshold matrices updated for Moderate CIP portfolios.", evidence:"Validation passed · 118 regression cases · 34 boundary cases" },
    { version:"v4.7", date:"06 Jun 2026 02:00 SGT", actor:"David Lim", event:"Checker approved production release", status:"Active", summary:"Prior production baseline for Portfolio Strength Rating.", evidence:"Maker attestation · Checker approval · Release notes attached" },
    { version:"v4.6", date:"17 May 2026 01:30 SGT", actor:"Sarah Chen", event:"Effective-date release completed", status:"Retired", summary:"Tenor skip handling and active-weight renormalisation added.", evidence:"Regression passed · Decision trace samples exported" },
  ] : [
    { version:"v2.9", date:"08 Jun 2026 01:30 SGT", actor:"Sarah Chen", event:"Production release completed", status:"Active", summary:"House view ranking adjustment and suitability warning wording refreshed.", evidence:"Regression passed · Checker approval" },
    { version:"v2.8", date:"22 May 2026 15:10 SGT", actor:"Amir Tan", event:"Checker approved release candidate", status:"Retired", summary:"Jurisdiction eligibility table updated for advisory recommendations.", evidence:"Maker attestation · 42 test cases passed" },
  ];
  const changedItems = modifiedRules.length > 0
    ? modifiedRules.map(rule=>({ rule:rule.name, type:rule.type, change:rule.id==="R-SAAALLOC-001" ? "Moderate CIP threshold bands reduced from 15% to 12%." : "Underweight threshold handling tightened for house-view alignment.", impact:"Requires maker review and checker approval." }))
    : [{ rule:"No draft rule changes", type:"Baseline", change:"Current active function has no local draft modifications.", impact:"No pending change impact." }];

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-[#F1F4F8]">
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[
          ["Current Version", latestVersion, "text-[#1E3A6B]"],
          ["History Entries", String(history.length), "text-gray-900"],
          ["Changed Rules", String(modifiedRules.length), modifiedRules.length ? "text-amber-700" : "text-green-700"],
          ["Test Evidence", `${passCount} pass · ${failCount} fail · ${pendingCount} pending`, failCount ? "text-red-600" : "text-green-700"],
        ].map(([label,value,cls])=>(
          <div key={label} className="bg-white border border-gray-200 rounded p-3">
            <div className={`text-sm font-bold leading-tight ${cls}`}>{value}</div>
            <div className="text-[10px] text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <History size={13} className="text-[#1E3A6B]"/>
            <div>
              <div className="text-sm font-semibold text-gray-900">Version History</div>
              <div className="text-xs text-gray-500 mt-0.5">Immutable function-level change records for maker, checker and release review.</div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {history.map((item,index)=>(
              <div key={`${item.version}-${item.date}`} className="px-4 py-3 flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${index===0?"bg-[#1E3A6B] border-[#1E3A6B] text-white":"bg-white border-gray-300 text-gray-500"}`}>
                    {index===0 ? <GitBranch size={12}/> : <Clock size={12}/>}
                  </div>
                  {index<history.length-1 && <div className="w-px flex-1 bg-gray-200 mt-1"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-xs font-bold text-gray-900">{item.version}</code>
                    <StatusBadge status={item.status} size="xs"/>
                    <span className="text-xs text-gray-400">{item.date}</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">{item.event}</div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.summary}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                    <span>Actor: <strong className="text-gray-700">{item.actor}</strong></span>
                    <span>·</span>
                    <span>{item.evidence}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-900">Changed Rule Families</div>
              <div className="text-xs text-gray-500 mt-0.5">Draft-level changes in this function.</div>
            </div>
            <div className="divide-y divide-gray-100">
              {changedItems.map(item=>(
                <div key={item.rule} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900">{item.rule}</span>
                    <RuleTypeBadge type={item.type}/>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.change}</p>
                  <div className="text-[10px] text-amber-700 mt-1">{item.impact}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Evidence Snapshot</div>
            <div className="space-y-2 text-xs">
              {[
                ["Maker", fn.draftRelease ? "Jennifer Wong · Pending attestation" : "Last maker evidence retained"],
                ["Checker", fn.draftRelease ? "David Lim · Not yet approved" : "Approved in active release"],
                ["Tests", `${passCount}/${fnCases.length || 0} passed`],
                ["Release", fn.draftRelease ? "Not released" : `${fn.activeRelease} active`],
              ].map(([label,value])=>(
                <div key={label} className="flex justify-between gap-3 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Function Workspace ──────────────────────────────────────────────────

function RuleFunctionView({ fn, setFn, allRules, testCases, onSaveTestCase, onDeleteTestCase, go, onAskAssistant }:{
  fn:RuleFunctionDef; setFn:(f:RuleFunctionDef)=>void; allRules:Rule[];
  testCases:TestCase[]; onSaveTestCase:(tc:TestCase)=>void; onDeleteTestCase:(id:string)=>void;
  go:(s:Screen)=>void;
  onAskAssistant:(fn:RuleFunctionDef)=>void;
}) {
  const [tab, setTab] = useState("Rule Flow");
  const [validationChecks, setValidationChecks] = useState<ValidationCheck[]|null>(null);
  const tabs = ["Rule Flow","Decision Tree","I/O Contract","Test Cases","Simulation","Change History"];

  const addRule = (ruleId:string) => setFn({...fn, ruleIds:[...fn.ruleIds, ruleId]});
  const removeRule = (ruleId:string) => setFn({...fn, ruleIds:fn.ruleIds.filter(id=>id!==ruleId)});
  const markFunctionDraft = (patch: Partial<RuleFunctionDef>) => setFn({
    ...fn,
    ...patch,
    draftRelease: fn.draftRelease ?? `${fn.activeRelease}-draft`,
    status: "Draft - Maker Review Required",
  });
  const addCondition = (condition: NonNullable<RuleFunctionDef["conditionSteps"]>[number]) => {
    markFunctionDraft({ conditionSteps: [...(fn.conditionSteps ?? []), condition] });
  };
  const removeCondition = (conditionId:string) => {
    markFunctionDraft({ conditionSteps: (fn.conditionSteps ?? []).filter(step=>step.id!==conditionId) });
  };
  const moveRule = (ruleId:string, dir:"up"|"down") => {
    const ids = [...fn.ruleIds]; const i = ids.indexOf(ruleId); if (i<0) return;
    const j = dir==="up"?i-1:i+1; if (j<0||j>=ids.length) return;
    [ids[i],ids[j]]=[ids[j],ids[i]]; setFn({...fn, ruleIds:ids});
  };
  const updateRuleFlow = (ruleId:string, patch:NonNullable<RuleFunctionDef["flowOverrides"]>[string], weight?:number|null) => {
    const nextWeights = {...(fn.weights ?? {})};
    if (weight !== undefined) {
      if (weight === null) delete nextWeights[ruleId];
      else nextWeights[ruleId] = Math.max(0, Math.min(100, Math.round(weight * 100) / 100));
    }
    markFunctionDraft({
      weights: Object.keys(nextWeights).length ? nextWeights : undefined,
      flowOverrides: {
        ...(fn.flowOverrides ?? {}),
        [ruleId]: patch,
      },
    });
  };

  const passCount = testCases.filter(tc=>tc.fnKey===fn.key&&tc.status==="pass").length;
  const failCount = testCases.filter(tc=>tc.fnKey===fn.key&&tc.status==="fail").length;
  const totalCases = testCases.filter(tc=>tc.fnKey===fn.key).length;
  const validationErrorCount = validationChecks?.filter(c=>c.severity==="error").length ?? 0;
  const validationWarningCount = validationChecks?.filter(c=>c.severity==="warning").length ?? 0;
  const validationPassed = validationChecks !== null && validationErrorCount === 0;

  const handleValidate = () => {
    const resolvedRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];
    const unresolvedRuleIds = fn.ruleIds.filter(id=>!allRules.some(r=>r.id===id));
    const inputNames = new Set(resolvedRules.flatMap(r=>r.inputs.map(i=>i.name)));
    const outputNames = new Set(resolvedRules.flatMap(r=>r.outputs.map(o=>o.name)));
    const hasAggregation = fn.key !== "PS" || resolvedRules.some(r=>r.type==="WeightedAggregation");
    const hasRequiredContract = inputNames.size > 0 && outputNames.size > 0;
    const hasRegressionEvidence = totalCases > 0;
    const failedCases = failCount;

    setValidationChecks([
      unresolvedRuleIds.length === 0
        ? { label:"Rule references", detail:`All ${fn.ruleIds.length} rule references resolve in the library.`, severity:"pass" }
        : { label:"Rule references", detail:`Missing rule references: ${unresolvedRuleIds.join(", ")}.`, severity:"error" },
      hasRequiredContract
        ? { label:"I/O contract", detail:`Derived ${inputNames.size} input fields and ${outputNames.size} output fields from member rules.`, severity:"pass" }
        : { label:"I/O contract", detail:"Function must expose at least one input and one output field.", severity:"error" },
      hasAggregation
        ? { label:"Aggregation", detail:fn.key === "PS" ? "Portfolio Strength includes Overall Weighted Rating aggregation." : "Sequential function does not require weighted aggregation.", severity:"pass" }
        : { label:"Aggregation", detail:"Portfolio Strength requires an Overall Weighted Rating aggregation rule.", severity:"error" },
      hasRegressionEvidence
        ? { label:"Test coverage", detail:`${totalCases} saved test cases available: ${passCount} passed, ${failedCases} failed, ${totalCases - passCount - failedCases} pending.`, severity:failedCases > 0 ? "warning" : "pass" }
        : { label:"Test coverage", detail:"No saved test cases are available for regression or historical runs.", severity:"warning" },
      { label:"Release guardrail", detail:"Validation is frontend-only evidence. Maker review and checker approval are still required.", severity:"pass" },
    ]);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0 flex-shrink-0">
        {/* Top row: title + actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {/* Colour accent bar */}
            <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${fn.draftRelease ? "bg-amber-400" : "bg-green-500"}`} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{fn.domain}</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight">{fn.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
            <Btn icon={Sparkles}     label="Ask Assistant" onClick={()=>onAskAssistant(fn)}/>
            <Btn icon={AlertCircle}  label="Validate" onClick={handleValidate}/>
            <Btn icon={FlaskConical} label="Run All Tests" onClick={()=>setTab("Test Cases")}/>
            {fn.draftRelease && <Btn icon={CheckCircle2} label="Submit for Review" primary onClick={()=>go("maker-submit")}/>}
          </div>
        </div>

        {/* Stat pill row */}
        <div className="flex items-stretch gap-0 border border-gray-200 rounded-lg overflow-hidden mb-0 divide-x divide-gray-200 w-fit">
          {/* Key */}
          <div className="flex flex-col justify-center px-4 py-2.5 bg-gray-50">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Function</div>
            <code className="font-mono text-sm font-bold text-gray-800">{fn.key}</code>
          </div>

          {/* Active release */}
          <div className="flex flex-col justify-center px-4 py-2.5">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Active</div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <code className="font-mono text-sm font-bold text-green-700">{fn.activeRelease}</code>
            </div>
          </div>

          {/* Draft release (only when exists) */}
          {fn.draftRelease && (
            <div className="flex flex-col justify-center px-4 py-2.5 bg-amber-50">
              <div className="text-[10px] font-medium text-amber-500 uppercase tracking-wide mb-0.5">Draft</div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <code className="font-mono text-sm font-bold text-amber-700">{fn.draftRelease}</code>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex flex-col justify-center px-4 py-2.5">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Status</div>
            <StatusBadge status={fn.draftRelease ? "Draft - Maker Review Required" : "Active"} size="xs"/>
          </div>

          {/* Rules count */}
          <div className="flex flex-col justify-center px-4 py-2.5">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Rules</div>
            <span className="text-sm font-bold text-gray-900">{fn.ruleIds.length}</span>
          </div>

          {/* Test cases */}
          <div className="flex flex-col justify-center px-4 py-2.5">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Test Cases</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900 mr-1">{totalCases}</span>
              <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                <CheckCircle2 size={9}/>{passCount} pass
              </span>
              {failCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  <X size={9}/>{failCount} fail
                </span>
              )}
              {totalCases - passCount - failCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-400 text-[10px] font-medium px-1.5 py-0.5 rounded">
                  <Clock size={9}/>{totalCases - passCount - failCount} pending
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {validationChecks && (
        <div className={`border-b px-6 py-3 flex-shrink-0 ${validationErrorCount>0?"bg-red-50 border-red-200":validationWarningCount>0?"bg-amber-50 border-amber-200":"bg-green-50 border-green-200"}`}>
          <div className="flex items-start gap-3">
            {validationErrorCount>0
              ? <X size={15} className="text-red-600 flex-shrink-0 mt-0.5"/>
              : validationWarningCount>0
                ? <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                : <CheckCircle2 size={15} className="text-green-600 flex-shrink-0 mt-0.5"/>
            }
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${validationErrorCount>0?"text-red-700":validationWarningCount>0?"text-amber-700":"text-green-700"}`}>
                {validationPassed ? validationWarningCount>0 ? "Validation passed with warnings" : "Validation passed" : "Validation failed"}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
                {validationChecks.map(check=>(
                  <div key={check.label} className="flex items-start gap-2 text-xs">
                    {check.severity==="pass" && <CheckCircle2 size={11} className="text-green-600 flex-shrink-0 mt-0.5"/>}
                    {check.severity==="warning" && <AlertCircle size={11} className="text-amber-600 flex-shrink-0 mt-0.5"/>}
                    {check.severity==="error" && <X size={11} className="text-red-600 flex-shrink-0 mt-0.5"/>}
                    <div><span className="font-medium text-gray-800">{check.label}:</span> <span className="text-gray-600">{check.detail}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={()=>setValidationChecks(null)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
          </div>
        </div>
      )}

      <TabBar tabs={tabs} active={tab} onChange={setTab}/>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab==="Rule Flow"     && <FlowBuilderTab fn={fn} allRules={allRules} onAddRule={addRule} onRemoveRule={removeRule} onMoveRule={moveRule} onAddCondition={addCondition} onRemoveCondition={removeCondition} onUpdateRuleFlow={updateRuleFlow}/>}
        {tab==="Decision Tree" && <DecisionTreeView fn={fn} allRules={allRules}/>}
        {tab==="I/O Contract"  && <IOContractTab fn={fn} allRules={allRules}/>}
        {tab==="Test Cases"    && <TestCasesTab fnKey={fn.key} testCases={testCases} onRun={id=>{}} onDelete={onDeleteTestCase}/>}
        {tab==="Simulation"    && <SimulationTab fn={fn} allRules={allRules} onSaveTestCase={onSaveTestCase}/>}
        {tab==="Change History"&& <ChangeHistoryTab fn={fn} allRules={allRules} testCases={testCases}/>}
      </div>
    </div>
  );
}

// ─── AI Works Screen ──────────────────────────────────────────────────────────

type AIWorksStep = { type: "read"|"analyze"|"create"|"validate"|"write"; label: string; status: "pending"|"running"|"done"|"write-done" };
type AIWorksPhase = "idle"|"running"|"done";

const CREATION_STEPS: AIWorksStep[] = [
  { type:"read",     label:"Loading existing rule library and function catalog",           status:"pending" },
  { type:"analyze",  label:"Identifying required rule families from description",          status:"pending" },
  { type:"create",   label:"Generating ESG Score rule — ScoringMatrix (0–100 → Rating 1–5)", status:"pending" },
  { type:"create",   label:"Generating Green Allocation rule — ThresholdMatrix by CIP",   status:"pending" },
  { type:"create",   label:"Generating Controversial Sector rule — ExclusionList",        status:"pending" },
  { type:"validate", label:"Validating rule logic and I/O compatibility",                  status:"pending" },
  { type:"create",   label:"Auto-generating I/O contract from rule combination",           status:"pending" },
  { type:"create",   label:"Generating 6 boundary and regression test cases",              status:"pending" },
  { type:"write",    label:"Calling Draft Function API — creating SUSTAIN-CHECK-003 as maker-owned draft", status:"pending" },
];

function getRuleAssistantSteps(context: AssistantContext): AIWorksStep[] {
  if (context.source === "function") {
    return [
      { type:"read",     label:`Loading ${context.ruleId} from the Decision Studio rule function workspace`, status:"pending" },
      { type:"analyze",  label:"Reviewing rule flow, I/O contract, tests and simulation evidence", status:"pending" },
      { type:"analyze",  label:`Checking draft status, regression coverage and release readiness for ${context.ruleName}`, status:"pending" },
      { type:"create",   label:"Preparing maker-editable improvement notes for the rule function", status:"pending" },
      { type:"validate", label:"Checking recommendations against current frontend rule composition", status:"pending" },
      { type:"write",    label:"Saving assistant recommendations in the prototype workspace only", status:"pending" },
    ];
  }

  return [
    { type:"read",     label:`Loading ${context.ruleId} from the Decision Studio rule library`, status:"pending" },
    { type:"analyze",  label:`Interpreting ${context.ruleType} logic and current output contract`, status:"pending" },
    { type:"analyze",  label:`Checking inputs, outputs and reason-code traceability for ${context.ruleName}`, status:"pending" },
    { type:"create",   label:"Preparing maker-editable draft notes for the selected rule", status:"pending" },
    { type:"validate", label:"Checking draft notes against the existing frontend I/O contract", status:"pending" },
    { type:"write",    label:"Saving assistant recommendations in the prototype workspace only", status:"pending" },
  ];
}

const STEP_CLS: Record<string, string> = {
  read:     "bg-blue-50 text-blue-700 border border-blue-200",
  analyze:  "bg-purple-50 text-purple-700 border border-purple-200",
  create:   "bg-amber-50 text-amber-700 border border-amber-200",
  validate: "bg-green-50 text-green-700 border border-green-200",
  write:    "bg-orange-100 text-orange-800 border border-orange-300",
};

function AIWorksScreen({ go, assistantContext }: { go: (s: Screen) => void; assistantContext?: AssistantContext|null }) {
  const [input, setInput]     = useState("");
  const [conversationPrompt, setConversationPrompt] = useState("");
  const [phase, setPhase]     = useState<AIWorksPhase>("idle");
  const [steps, setSteps]     = useState<AIWorksStep[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SAMPLE_REQUEST = "Create a Sustainability Suitability Check function for wealth advisory. It should evaluate ESG score, green investment allocation percentage, and controversial sector exposure to determine if a portfolio meets our sustainability policy.";
  const contextPrompt = assistantContext?.prompt ?? SAMPLE_REQUEST;

  const runCreation = (userMsg: string) => {
    if (phase === "running") return;
    const request = userMsg || contextPrompt;
    setConversationPrompt(request);
    setPhase("running");
    setDraftReady(false);
    const sourceSteps = assistantContext ? getRuleAssistantSteps(assistantContext) : CREATION_STEPS;
    const fresh = sourceSteps.map(s => ({ ...s, status: "pending" as const }));
    setSteps(fresh);

    fresh.forEach((_, i) => {
      const isLast = i === fresh.length - 1;
      timerRef.current = setTimeout(() => {
        setSteps(prev => prev.map((s, j) =>
          j === i ? { ...s, status: isLast ? "write-done" : "done" } :
          j === i + 1 ? { ...s, status: "running" } : s
        ));
        if (isLast) {
          setTimeout(() => { setPhase("done"); setDraftReady(true); }, 600);
        }
      }, 700 + i * 900);
    });

    // Kick off first step immediately
    setTimeout(() => setSteps(prev => prev.map((s, j) => j === 0 ? { ...s, status: "running" } : s)), 100);
  };

  useEffect(() => {
    if (!assistantContext) return;
    setInput(assistantContext.prompt);
    setConversationPrompt(assistantContext.prompt);
    setPhase("idle");
    setSteps([]);
    setDraftReady(false);
  }, [assistantContext?.ruleId]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [steps, draftReady]);

  const hasConversation = phase !== "idle";
  const contextLabel = assistantContext?.source === "function" ? "rule function" : "rule";
  const contextTitle = assistantContext?.source === "function" ? "Rule Function Assistance Preview" : "Rule Assistance Preview";
  const selectedLabel = assistantContext?.source === "function" ? "Selected Rule Function" : "Selected Rule";
  const assistantFocus = assistantContext?.source === "function"
    ? ["Explain current rule-function flow","Review I/O contract and regression coverage","Prepare maker-editable improvement notes","Keep production unchanged"]
    : ["Explain current rule logic","Review input and output contract","Prepare maker-editable draft notes","Keep production unchanged"];
  const assistantIntro = assistantContext
    ? `Understood. I am reviewing ${assistantContext.ruleName} (${assistantContext.ruleId}) in Decision Studio. I will summarize the current ${contextLabel} setup, check its governance evidence, and prepare maker-editable notes without changing production rules.`
    : "Understood. I identified three rule families for a Sustainability Suitability Check: ESG Score evaluation, Green Allocation threshold check, and Controversial Sector screening. Creating the draft rule function now.";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: conversation */}
      <div className="flex flex-col overflow-hidden border-r border-gray-200 bg-white" style={{ flex: "0 0 62%" }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E3A6B] to-[#0D7A8A] flex items-center justify-center flex-shrink-0">
              <Wand2 size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">AI Works</h1>
              <p className="text-[10px] text-gray-400">{assistantContext ? "Contextual assistance from Decision Studio." : "Describe a rule function in plain language. AI Works creates a draft for your review."}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Governance notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5">
            <Shield size={12} className="text-amber-600 flex-shrink-0 mt-px" />
            <p className="text-xs text-amber-700 leading-relaxed">
              AI Works creates rule functions as <strong>maker-owned drafts</strong>. All rules, I/O contracts and test cases require maker review and checker approval before release. AI Works cannot approve, activate or deploy.
            </p>
          </div>

          {assistantContext && !hasConversation && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={12} className="text-[#1E3A6B]"/>
                <span className="text-xs font-semibold text-[#1E3A6B]">Decision Studio context loaded</span>
                <code className="ml-auto text-[10px] text-blue-700 bg-white/70 border border-blue-100 px-1.5 py-0.5 rounded">{assistantContext.ruleId}</code>
              </div>
              <p className="text-xs text-blue-900 leading-relaxed">
                The assistant is ready to review <strong>{assistantContext.ruleName}</strong>, explain its {contextLabel} setup, and prepare frontend-only notes for maker review.
              </p>
            </div>
          )}

          {/* If no conversation yet, show capability cards */}
          {!hasConversation && !assistantContext && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 text-center">Tell AI Works what rule function you need — describe the business objective in plain language.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { title:"Portfolio health check",  desc:"Create a scoring function that evaluates cash, returns and SAA alignment for a portfolio strength rating" },
                  { title:"Product suitability",     desc:"Build an eligibility and recommendation ranking function for investment ideas based on CIP and risk profile" },
                  { title:"Sustainability screen",   desc:"Define rules to check ESG score, green allocation and controversial sector exposure against policy" },
                  { title:"Fee discount logic",      desc:"Create an eligibility function for advisory fee discounts based on AUM, tenure and product mix" },
                ].map(c => (
                  <button key={c.title} onClick={() => setInput(c.desc)}
                    className="text-left bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-[#1E3A6B] hover:bg-blue-50 transition-colors">
                    <div className="text-xs font-semibold text-gray-800 mb-1">{c.title}</div>
                    <div className="text-[10px] text-gray-500 leading-relaxed">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* User message */}
          {hasConversation && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#1E3A6B] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">JW</div>
              <div className="flex-1 bg-[#F1F4F8] rounded-lg p-3">
                <div className="text-[10px] font-semibold text-gray-500 mb-1">Jennifer Wong · Maker</div>
                <p className="text-xs text-gray-800 leading-relaxed">{conversationPrompt || contextPrompt}</p>
              </div>
            </div>
          )}

          {/* AI Works response */}
          {hasConversation && steps.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1E3A6B] to-[#0D7A8A] flex items-center justify-center flex-shrink-0">
                <Wand2 size={13} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-[#1E3A6B] mb-1.5">AI Works</div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                    {assistantIntro}
                  </p>

                  {/* Action timeline */}
                  <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Action Record</div>
                    {steps.map((s, i) => (
                      <div key={i} className={`flex items-center gap-2.5 px-2 py-1.5 rounded transition-all ${s.status === "write-done" ? "bg-orange-50 border border-orange-200" : s.status === "done" ? "bg-gray-50" : s.status === "running" ? "bg-blue-50/60" : "opacity-40"}`}>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0 ${STEP_CLS[s.type]}`}>{s.type}</span>
                        <span className={`text-xs flex-1 ${s.type === "write" ? "text-orange-800 font-medium" : "text-gray-700"}`}>{s.label}</span>
                        <span className="flex-shrink-0 text-[10px] font-medium">
                          {s.status === "running"    && <span className="text-blue-600 flex items-center gap-1"><RefreshCw size={9} className="animate-spin"/>Running</span>}
                          {s.status === "done"       && <span className="text-green-600">Done</span>}
                          {s.status === "write-done" && <span className="text-orange-600 font-semibold">Draft Created</span>}
                          {s.status === "pending"    && <span className="text-gray-300">Pending</span>}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Write action notice */}
                  {draftReady && (
                    <div className="mt-3 bg-orange-50 border border-orange-200 rounded p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock size={11} className="text-orange-600" />
                        <span className="text-xs font-semibold text-orange-700">No production rules modified.</span>
                      </div>
                      <p className="text-xs text-orange-600 leading-relaxed">
                        {assistantContext
                          ? <>Assistant notes for <code className="font-mono">{assistantContext.ruleId}</code> are ready in this frontend prototype. Production is unchanged.</>
                          : <>Draft <code className="font-mono">SUSTAIN-CHECK-003</code> created via Draft Function API. Production is unchanged. Maker review and checker approval required before release.</>}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-start gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={assistantContext ? `Ask about this ${contextLabel} or draft a controlled change…` : "Describe the rule function you need in plain language…"}
              rows={2}
              className="flex-1 text-xs border border-gray-200 rounded px-3 py-2 resize-none focus:outline-none focus:border-[#1E3A6B] placeholder-gray-400"
            />
            <button
              onClick={() => runCreation(input || contextPrompt)}
              disabled={phase === "running"}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1E3A6B] text-white rounded text-xs font-semibold hover:bg-[#163059] disabled:opacity-50 self-end">
              {phase === "running" ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {phase === "running" ? "Creating…" : assistantContext ? "Ask" : "Generate"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 ml-1">{assistantContext ? `AI Works will prepare frontend-only guidance for the selected ${contextLabel}.` : "AI Works will create all rules, the I/O contract and test cases as a draft for your review."}</p>
        </div>
      </div>

      {/* Right: draft preview */}
      <div className="overflow-y-auto bg-[#F1F4F8] p-4" style={{ flex: "0 0 38%" }}>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900">{assistantContext ? contextTitle : "Draft Preview"}</span>
            {draftReady
              ? <StatusBadge status="AI-Assisted Draft" size="xs" />
              : <span className="text-[10px] text-gray-400">{phase === "running" ? "Building…" : "Awaiting generation"}</span>
            }
          </div>
          <div className="p-4 space-y-4">

            {assistantContext && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-2">{selectedLabel}</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Name</span><span className="font-semibold text-gray-900 text-right">{assistantContext.ruleName}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-500">{assistantContext.source === "function" ? "Function Key" : "Rule ID"}</span><code className="font-mono text-[#1E3A6B]">{assistantContext.ruleId}</code></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Type</span><span className="font-medium text-gray-900">{assistantContext.ruleType}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-900 leading-relaxed">
                  {draftReady ? "Assistant recommendations are ready for maker review in this prototype." : `Run the assistant to explain the ${contextLabel} setup and prepare draft-edit guidance.`}
                </div>
              </div>
            )}

            {assistantContext ? (
              <>
                <div className={`space-y-2 transition-opacity ${draftReady ? "opacity-100" : "opacity-40"}`}>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Assistant Focus</div>
                  {assistantFocus.map(item => (
                    <div key={item} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2 text-xs">
                      <CheckCircle2 size={12} className={draftReady ? "text-green-600" : "text-gray-300"}/>
                      <span className={draftReady ? "text-gray-800" : "text-gray-500"}>{item}</span>
                    </div>
                  ))}
                </div>
                <div className={`space-y-2 border-t border-gray-100 pt-3 transition-opacity ${draftReady ? "opacity-100" : "opacity-50"}`}>
                  <button onClick={() => go("studio")}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1E3A6B] text-white rounded text-xs font-semibold hover:bg-[#163059]">
                    <Layers size={12} />Return to Decision Studio
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Function metadata */}
                <div className={`space-y-2 transition-opacity ${draftReady ? "opacity-100" : "opacity-30"}`}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-gray-400 mb-0.5">Function Name</div><div className="font-semibold text-gray-900">Sustainability Suitability Check</div></div>
                    <div><div className="text-gray-400 mb-0.5">Function Key</div><code className="font-mono text-sm font-bold text-gray-800">SUSTAIN-CHECK-003</code></div>
                    <div><div className="text-gray-400 mb-0.5">Domain</div><div className="text-gray-700">Sustainable Wealth Advisory</div></div>
                    <div><div className="text-gray-400 mb-0.5">Owner</div><div className="text-gray-700">Advisory Solutions</div></div>
                  </div>
                </div>

                {/* Rule families created */}
                <div className={`transition-opacity ${steps.length > 2 ? "opacity-100" : "opacity-20"}`}>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Rule Families Created</div>
                  <div className="space-y-1.5">
                    {[
                      { name:"ESG Score Evaluation",           type:"ScoringMatrix",   done: steps.find(s=>s.label.includes("ESG"))?.status === "done" || draftReady },
                      { name:"Green Investment Allocation",     type:"ThresholdMatrix", done: steps.find(s=>s.label.includes("Green"))?.status === "done" || draftReady },
                      { name:"Controversial Sector Screening",  type:"ExclusionList",  done: steps.find(s=>s.label.includes("Controversial"))?.status === "done" || draftReady },
                    ].map(r => (
                      <div key={r.name} className={`flex items-center gap-2.5 p-2 rounded border transition-all ${r.done ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-40"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.done ? "bg-green-500" : "bg-gray-300"}`} />
                        <span className="text-xs font-medium text-gray-800 flex-1">{r.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${ruleTypeCls[r.type]}`}>{r.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className={`grid grid-cols-3 gap-2 transition-opacity ${draftReady ? "opacity-100" : "opacity-20"}`}>
                  {[
                    { label:"Rules Created",      value:"3",   color:"text-[#1E3A6B]" },
                    { label:"Validation Errors",  value:"0",   color:"text-green-700" },
                    { label:"Test Cases",         value:"6",   color:"text-blue-700"  },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 border border-gray-200 rounded p-2.5 text-center">
                      <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* I/O contract summary */}
                <div className={`transition-opacity ${draftReady ? "opacity-100" : "opacity-20"}`}>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Auto-generated I/O Contract</div>
                  <div className="space-y-1">
                    {[
                      { dir:"IN",  field:"esgScore",              type:"number" },
                      { dir:"IN",  field:"greenAllocationPct",    type:"number" },
                      { dir:"IN",  field:"controversialFlags",    type:"array"  },
                      { dir:"IN",  field:"cip",                   type:"enum"   },
                      { dir:"OUT", field:"sustainabilityRating",  type:"number" },
                      { dir:"OUT", field:"sustainabilityEligible",type:"boolean"},
                      { dir:"OUT", field:"reasonCodes",           type:"array"  },
                    ].map(f => (
                      <div key={f.field} className="flex items-center gap-2 text-xs">
                        <span className={`text-[9px] font-bold w-6 flex-shrink-0 ${f.dir === "IN" ? "text-blue-600" : "text-green-600"}`}>{f.dir}</span>
                        <code className="font-mono text-gray-800 flex-1">{f.field}</code>
                        <TypeChip type={f.type} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className={`space-y-2 border-t border-gray-100 pt-3 transition-opacity ${draftReady ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
                  <button onClick={() => go("studio")}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1E3A6B] text-white rounded text-xs font-semibold hover:bg-[#163059]">
                    <Layers size={12} />Open in Decision Studio
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50">
                    <GitBranch size={12} />View Decision Tree
                  </button>
                  <button onClick={() => { setPhase("idle"); setSteps([]); setDraftReady(false); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-red-200 text-red-600 rounded text-xs hover:bg-red-50">
                    <X size={12} />Discard Draft
                  </button>
                </div>

                {!draftReady && phase === "idle" && (
                  <div className="py-6 text-center">
                    <Wand2 size={28} className="mx-auto mb-2 text-gray-300" />
                    <div className="text-xs text-gray-400">Describe your rule function on the left to get started.</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Decision Studio ──────────────────────────────────────────────────────────

function DecisionStudio({
  fnKey, setFnKey, go, onAskRuleAssistant, onAskFunctionAssistant,
}: {
  fnKey:string;
  setFnKey:(k:string)=>void;
  go:(s:Screen)=>void;
  onAskRuleAssistant:(rule: Rule)=>void;
  onAskFunctionAssistant:(fn: RuleFunctionDef)=>void;
}) {
  const [view,      setView]      = useState<StudioView>("function");
  const [selRuleId, setSelRuleId] = useState<string|null>(null);
  const [studioNavTab, setStudioNavTab] = useState<"functions"|"rules">("functions");
  const [ruleSearch,setRuleSearch]= useState("");
  const [testCases, setTestCases] = useState<TestCase[]>(INITIAL_TEST_CASES);
  const [ruleDrafts, setRuleDrafts] = useState<Record<string,string>>({});
  const [localRules, setLocalRules] = useState<Rule[]>(RULES);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRuleLogic, setNewRuleLogic] = useState("");
  const [generatedRule, setGeneratedRule] = useState<Rule|null>(null);
  // Local copies of functions (so we can mutate rule lists)
  const [localFns,  setLocalFns]  = useState<RuleFunctionDef[]>(RULE_FUNCTIONS);

  const selRule = localRules.find(r=>r.id===selRuleId);
  const selFn   = localFns.find(f=>f.key===fnKey)??localFns[0];

  const trimmedSearch = ruleSearch.trim();
  const hasStudioSearch = trimmedSearch.length > 0;
  const searchTerm = trimmedSearch.toLowerCase();
  const filteredRules = localRules.filter(r=>
    r.name.toLowerCase().includes(searchTerm) ||
    r.id.toLowerCase().includes(searchTerm) ||
    r.type.toLowerCase().includes(searchTerm)
  );
  const filteredFns = localFns.filter(fn=>
    fn.name.toLowerCase().includes(searchTerm) ||
    fn.key.toLowerCase().includes(searchTerm) ||
    fn.domain.toLowerCase().includes(searchTerm)
  );

  const updateFn = (fn:RuleFunctionDef) => setLocalFns(prev=>prev.map(f=>f.key===fn.key?fn:f));
  const openNewRule = () => {
    setNewRuleLogic("");
    setGeneratedRule(null);
    setShowNewRule(true);
    setStudioNavTab("rules");
  };
  const convertNewRule = () => {
    if (!newRuleLogic.trim()) return;
    setGeneratedRule(buildRuleFromLogicText(newRuleLogic, localRules.filter(r=>r.id.startsWith("R-AI-")).length + 1));
  };
  const addGeneratedRule = () => {
    if (!generatedRule) return;
    setLocalRules(prev=>[generatedRule, ...prev]);
    setRuleDrafts(prev=>({...prev, [generatedRule.id]: newRuleLogic.trim()}));
    setSelRuleId(generatedRule.id);
    setView("rule");
    setStudioNavTab("rules");
    setShowNewRule(false);
  };

  const openFn = (key:string) => { setFnKey(key); setView("function"); setStudioNavTab("functions"); };
  const openRule = (id:string) => { setSelRuleId(id); setView("rule"); setStudioNavTab("rules"); };

  const handleSaveTestCase = (tc:TestCase) => setTestCases(p=>[...p, tc]);
  const handleDeleteTestCase = (id:string) => setTestCases(p=>p.filter(tc=>tc.id!==id));
  const handleSaveRuleDraft = (ruleId:string, draftText:string) => {
    setRuleDrafts(prev => ({ ...prev, [ruleId]: draftText }));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Studio left panel */}
      <div className="w-[228px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-900">Decision Studio</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Rules &amp; rule functions</div>
        </div>
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded p-0.5">
            {[
              { id:"functions", label:"Rule Functions", count:localFns.length },
              { id:"rules", label:"Rule Library", count:localRules.length },
            ].map(tab=>(
              <button key={tab.id} onClick={()=>setStudioNavTab(tab.id as "functions"|"rules")}
                className={`px-2 py-1.5 rounded text-[10px] font-semibold transition-colors ${studioNavTab===tab.id?"bg-white text-[#1E3A6B] shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                <span>{tab.label}</span>
                <span className="ml-1 text-[9px] opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5">
            <Search size={11} className="text-gray-400"/>
            <input value={ruleSearch} onChange={e=>setRuleSearch(e.target.value)} placeholder="Search functions and rules…" className="flex-1 text-[11px] bg-transparent outline-none"/>
            {hasStudioSearch && (
              <button onClick={()=>setRuleSearch("")} className="text-gray-300 hover:text-gray-600" aria-label="Clear search">
                <X size={11}/>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {hasStudioSearch ? (
            <div>
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Search Results</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{filteredFns.length + filteredRules.length} matches for "{trimmedSearch}"</div>
              </div>

              <div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-1">Rule Functions</span>
                  <span className="text-[10px] text-gray-400">{filteredFns.length}</span>
                </div>
                {filteredFns.map(fn=>(
                  <button key={fn.key} onClick={()=>openFn(fn.key)}
                    className={`w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-l-2 ${view==="function"&&fnKey===fn.key?"bg-blue-50 border-l-[#1E3A6B]":"border-l-transparent"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${fn.draftRelease?"bg-amber-400":"bg-green-400"}`}/>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-gray-800 leading-tight">{fn.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="font-mono text-[9px] text-gray-400">{fn.key}</code>
                        <span className="text-[9px] text-gray-400">{fn.domain}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredFns.length===0 && <div className="px-4 py-3 text-xs text-gray-400">No matching rule functions</div>}
              </div>

              <div className="border-t border-gray-100">
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-1">Rule Library</span>
                  <span className="text-[10px] text-gray-400">{filteredRules.length}</span>
                </div>
                {filteredRules.map(rule=>(
                  <button key={rule.id} onClick={()=>openRule(rule.id)}
                    className={`w-full flex items-start gap-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors border-l-2 ${view==="rule"&&selRuleId===rule.id?"bg-blue-50 border-l-[#1E3A6B]":"border-l-transparent"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${rule.modified?"bg-amber-400":"bg-gray-300"}`}/>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-gray-800 leading-tight truncate">{rule.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="font-mono text-[9px] text-gray-400">{rule.id}</code>
                        <span className="text-[9px] text-gray-400">{rule.type}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredRules.length===0 && <div className="px-4 py-3 text-xs text-gray-400">No matching rules</div>}
              </div>
            </div>
          ) : studioNavTab==="functions" ? (
            <div>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-1">Rule Functions</span>
                <button onClick={openNewRule} className="text-gray-300 hover:text-[#1E3A6B]" title="Add New Rule"><Plus size={11}/></button>
              </div>
              {filteredFns.map(fn=>(
                <button key={fn.key} onClick={()=>openFn(fn.key)}
                  className={`w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-l-2 ${view==="function"&&fnKey===fn.key?"bg-blue-50 border-l-[#1E3A6B]":"border-l-transparent"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${fn.draftRelease?"bg-amber-400":"bg-green-400"}`}/>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-gray-800 leading-tight">{fn.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="font-mono text-[9px] text-gray-400">{fn.activeRelease}</code>
                      {fn.draftRelease&&<code className="font-mono text-[9px] text-amber-500">{fn.draftRelease}</code>}
                      <span className="text-[9px] text-gray-400">{fn.ruleIds.length} rules</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredFns.length===0 && <div className="px-4 py-8 text-center text-xs text-gray-400">No rule functions found</div>}
              <button onClick={()=>{}} className="w-full flex items-center gap-2 px-4 py-2 text-[11px] text-[#1E3A6B] hover:bg-blue-50 transition-colors">
                <Plus size={11}/><span className="font-medium">Create Rule Function</span>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-1">Rule Library</span>
                <button onClick={openNewRule} className="text-gray-300 hover:text-[#1E3A6B]" title="Add New Rule"><Plus size={11}/></button>
              </div>
              {filteredRules.map(rule=>(
                <button key={rule.id} onClick={()=>openRule(rule.id)}
                  className={`w-full flex items-start gap-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors border-l-2 ${view==="rule"&&selRuleId===rule.id?"bg-blue-50 border-l-[#1E3A6B]":"border-l-transparent"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${rule.modified?"bg-amber-400":"bg-gray-300"}`}/>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-gray-800 leading-tight truncate">{rule.name}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{rule.type}</div>
                  </div>
                </button>
              ))}
              {filteredRules.length===0 && <div className="px-4 py-8 text-center text-xs text-gray-400">No rules found</div>}
              <button onClick={openNewRule} className="w-full flex items-center gap-2 px-4 py-2 text-[11px] text-[#1E3A6B] hover:bg-blue-50 transition-colors">
                <Sparkles size={11}/><span className="font-medium">Add New Rule with AI</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view==="none"&&(
          <div className="flex items-center justify-center h-full bg-[#F1F4F8]">
            <div className="text-center">
              <Layers size={40} className="mx-auto mb-3 text-gray-300"/>
              <div className="text-sm font-medium text-gray-700">Select a rule or rule function</div>
              <div className="text-xs text-gray-400 mt-1">Use the panel on the left to browse the rule library or open a rule function.</div>
            </div>
          </div>
        )}
        {view==="rule"&&selRule&&(
          <RuleEditorView
            rule={selRule}
            savedDraft={ruleDrafts[selRule.id]}
            onSaveDraft={handleSaveRuleDraft}
            onAskAssistant={onAskRuleAssistant}
          />
        )}
        {view==="function"&&selFn&&(
          <RuleFunctionView fn={selFn} setFn={updateFn} allRules={localRules}
            testCases={testCases} onSaveTestCase={handleSaveTestCase} onDeleteTestCase={handleDeleteTestCase} go={go} onAskAssistant={onAskFunctionAssistant}/>
        )}
      </div>
      {showNewRule&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(13,27,62,0.5)"}}>
          <div className="bg-white rounded-lg shadow-2xl w-[760px] max-h-[84vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Add New Rule with AI</div>
                <div className="text-xs text-gray-500 mt-0.5">Paste business logic text. AI converts it into structured JSON for maker review.</div>
              </div>
              <button onClick={()=>setShowNewRule(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <GovernanceBanner text="AI can create a maker-owned draft rule only. Checker approval and release are still required before activation."/>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Rule Logic Text</label>
                <textarea
                  value={newRuleLogic}
                  onChange={e=>{ setNewRuleLogic(e.target.value); setGeneratedRule(null); }}
                  rows={7}
                  placeholder="Example: Rule Name: High Risk Product Block. If productRiskRating > cipRiskTolerance then blocked = true and reasonCode = RISK-MISMATCH. Otherwise blocked = false."
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs leading-relaxed resize-y outline-none focus:border-[#1E3A6B]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={convertNewRule} disabled={!newRuleLogic.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] disabled:opacity-40">
                  <Wand2 size={12}/>Convert to AI Structured JSON
                </button>
                {generatedRule && (
                  <span className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12}/>Structured JSON generated for {generatedRule.id}</span>
                )}
              </div>
              {generatedRule && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">Generated Rule Summary</div>
                    <div className="p-3 space-y-2 text-xs">
                      <div><span className="text-gray-500">Name:</span> <span className="font-semibold text-gray-900">{generatedRule.name}</span></div>
                      <div className="flex items-center gap-2"><span className="text-gray-500">Type:</span> <RuleTypeBadge type={generatedRule.type}/></div>
                      <div><span className="text-gray-500">Rule ID:</span> <code className="font-mono text-[#1E3A6B]">{generatedRule.id}</code></div>
                      <div><span className="text-gray-500">Inputs:</span> <span className="text-gray-700">{generatedRule.inputs.map(i=>i.name).join(", ")}</span></div>
                      <div><span className="text-gray-500">Outputs:</span> <span className="text-gray-700">{generatedRule.outputs.map(o=>o.name).join(", ")}</span></div>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-slate-900 text-slate-100 text-xs font-semibold flex items-center gap-2"><Code2 size={12}/>AI Structured JSON Preview</div>
                    <pre className="max-h-[260px] overflow-auto bg-slate-950 text-slate-100 p-3 text-[10px] leading-relaxed font-mono">
                      {JSON.stringify(buildAiStructuredRuleSpec(generatedRule, newRuleLogic), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={()=>setShowNewRule(false)} className="px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={addGeneratedRule} disabled={!generatedRule} className="px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] disabled:opacity-40 flex items-center gap-1.5">
                <Plus size={12}/>Add to Rule Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Maker Submit ─────────────────────────────────────────────────────────────

function MakerSubmit({ go }:{ go:(s:Screen)=>void }) {
  const [attest,setAttest]=useState<Record<string,boolean>>({
    "I reviewed the proposed rule-family logic and confirm it reflects the intended policy.":false,
    "I reviewed changed outcomes, reason codes and simulation impact.":false,
    "I confirm supporting documentation is attached or referenced.":false,
    "I understand submission creates a checker-review snapshot and does not activate production.":false,
  });
  const allDone=Object.values(attest).every(Boolean);
  return (
    <div className="flex flex-col h-full bg-[#F1F4F8]">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <span>Decision Studio</span><ChevronRight size={11}/><span>Portfolio Strength Rating v4.8</span><ChevronRight size={11}/><span>Submit for Checker Review</span>
        </div>
        <h1 className="text-base font-semibold text-gray-900">Submit for Checker Review</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">Portfolio Strength Rating · Draft v4.8</span>
          <span className="text-xs text-gray-500">Checker: <strong className="text-gray-700">David Lim</strong></span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-white border border-gray-200 rounded">
            <div className="px-5 py-3.5 border-b border-gray-200 text-sm font-semibold text-gray-900">1. Change Summary</div>
            <div className="px-5 py-4 space-y-2">
              {[["amber","SAA Allocation and House View threshold matrices updated for Moderate CIP portfolios."],["green","Rule weights, NTW treatment and exception handling unchanged."],["blue","Sample client C-10482 rating moves from 3 → 4 under draft v4.8."]].map(([dot,text],i)=>(
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700"><span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot==="amber"?"bg-amber-500":dot==="green"?"bg-green-500":"bg-blue-500"}`}/>{text}</div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded">
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">2. AI Contribution Record</div>
              <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-px rounded">Assistance evidence · Not approval evidence</span>
            </div>
            <div className="px-5 py-4 space-y-1.5">
              {["Retrieved active rule release v4.7","Identified impacted rule families: SAA Allocation, House View","Proposed threshold matrix changes for Moderate CIP portfolios","Generated 34 boundary + 118 regression scenarios","Ran rule-family validation — Passed","Created maker-owned draft v4.8 through Draft Decision API"].map((item,i)=>(
                <div key={i} className="flex items-center gap-2 text-xs text-gray-700"><CheckCircle2 size={11} className="text-[#0D7A8A] flex-shrink-0"/>{item}</div>
              ))}
              <div className="flex items-start gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-orange-600"><Lock size={11} className="text-orange-500 flex-shrink-0 mt-0.5"/>myWealth Decision Assistant did not approve, activate or deploy any rule.</div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded">
            <div className="px-5 py-3.5 border-b border-gray-200 text-sm font-semibold text-gray-900">3. Review Evidence</div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {[["Validation","Passed","green"],["Regression Scenarios","118/118","green"],["Simulation Cohort","18,240","gray"],["Weaker Rating Movement","312","amber"],["Advisor Review Required","41","amber"],["Data Exceptions","0","green"]].map(([k,v,c])=>(
                  <div key={k} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-xs">
                    <span className="text-gray-500">{k}</span><span className={`font-semibold ${c==="green"?"text-green-700":c==="amber"?"text-amber-700":"text-gray-700"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded">
            <div className="px-5 py-3.5 border-b border-gray-200"><div className="text-sm font-semibold text-gray-900">4. Maker Attestation</div><div className="text-xs text-gray-500 mt-0.5">All attestations required</div></div>
            <div className="px-5 py-4 space-y-3">
              {Object.entries(attest).map(([text,done])=>(
                <label key={text} className="flex items-start gap-3 cursor-pointer group">
                  <div onClick={()=>setAttest(p=>({...p,[text]:!p[text]}))} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${done?"bg-[#1E3A6B] border-[#1E3A6B]":"border-gray-300 group-hover:border-[#1E3A6B]"}`}>
                    {done&&<Check size={9} className="text-white"/>}
                  </div>
                  <span className="text-xs text-gray-700 leading-relaxed">{text}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Btn icon={PenLine} label="Back to Decision Studio" onClick={()=>go("studio")}/>
            <Btn label="Save Without Submitting"/>
            <div className="ml-auto flex flex-col items-end gap-1">
              <button disabled={!allDone} onClick={()=>go("review-queue")} className="px-5 py-2 bg-[#1E3A6B] text-white rounded text-xs font-semibold hover:bg-[#163059] disabled:opacity-40 disabled:cursor-not-allowed">Submit to Checker →</button>
              {!allDone&&<p className="text-[10px] text-gray-400">Complete all attestations first</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Checker Review ───────────────────────────────────────────────────────────

function CheckerReview({ go }:{ go:(s:Screen)=>void }) {
  const [tab,setTab]=useState("Summary");
  const [comment,setComment]=useState("");
  const queue=[
    {name:"Portfolio Strength Rating v4.8",sla:"1 day",sel:true},
    {name:"Portfolio Impact Simulation Policy v1.7",sla:"2 days",sel:false},
  ];
  return (
    <div className="flex h-full">
      <div className="w-[232px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200"><div className="text-xs font-semibold text-gray-900">Review Queue</div><div className="text-[10px] text-gray-500 mt-0.5">David Lim · Advisory Compliance</div></div>
        <div className="flex-1 overflow-auto">
          {queue.map((q,i)=>(
            <div key={i} className={`px-4 py-3 border-b border-gray-100 cursor-pointer ${q.sel?"bg-blue-50 border-l-2 border-l-[#1E3A6B]":"hover:bg-gray-50"}`}>
              <div className="text-xs font-medium text-gray-800 leading-tight">{q.name}</div>
              <div className="flex items-center gap-2 mt-1.5"><span className="text-[10px] text-gray-400">SLA: {q.sla}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <h1 className="text-base font-semibold text-gray-900">Portfolio Strength Rating · Draft v4.8 vs Active v4.7</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status="Pending Checker Approval" size="xs"/>
            <StatusBadge status="AI-Assisted Draft" size="xs"/>
            <span className="text-xs text-gray-500">Submitted by: <strong className="text-gray-700">Jennifer Wong</strong></span>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded ml-auto">SLA: 1 business day</span>
          </div>
        </div>
        <TabBar tabs={["Summary","Rule-Family Diff","Tests","Simulation","Audit Trail"]} active={tab} onChange={setTab}/>
        <div className="flex-1 overflow-y-auto p-4 bg-[#F1F4F8]">
          {tab==="Summary"?(
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-4">
                <div className="bg-white border border-gray-200 rounded p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Change Diff — SAA Allocation</div>
                  <div className="grid grid-cols-2 gap-4">
                    {(["Active v4.7","Draft v4.8"] as const).map((ver,vi)=>(
                      <div key={ver}>
                        <div className={`text-xs font-semibold mb-1.5 ${vi===0?"text-gray-600":"text-amber-700"}`}>{ver}</div>
                        <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                          <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-500"><th className="px-2 py-1 text-left font-medium">CIP</th><th className="px-2 py-1 text-center font-medium">R3</th><th className="px-2 py-1 text-center font-medium">R4</th></tr></thead>
                          <tbody>{[["Conservative","≤8%","≤12%"],["Moderate",vi===0?"≤10%":"≤8%",vi===0?"≤15%":"≤12%"],["Aggressive","≤12%","≤18%"]].map(([c,r3,r4],ri)=>(
                            <tr key={c} className={ri===1&&vi===1?"bg-amber-50":""}>
                              <td className={`px-2 py-1.5 border-b border-gray-100 font-medium ${ri===1?"text-amber-700":"text-gray-700"}`}>{c}</td>
                              <td className={`px-2 py-1.5 text-center border-b border-gray-100 ${ri===1&&vi===1?"text-amber-700 font-bold":"text-gray-600"}`}>{r3}</td>
                              <td className={`px-2 py-1.5 text-center border-b border-gray-100 ${ri===1&&vi===1?"text-amber-700 font-bold":"text-gray-600"}`}>{r4}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-2.5 text-xs text-gray-500">Rule weights, NTW treatment and exception handling <span className="font-semibold text-green-700">unchanged</span> from v4.7.</div>
                </div>
                <div className="bg-white border border-gray-200 rounded p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Governance Evidence</div>
                  {["Maker attestations complete","AI action record attached","Policy clarification attached","Segregation-of-duties check passed","Deployment not yet authorized"].map(e=>(
                    <div key={e} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 text-xs"><CheckCircle2 size={11} className="text-green-600 flex-shrink-0"/><span className="text-gray-700">{e}</span></div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Impact &amp; Test Evidence</div>
                  {[["Validation","Passed","green"],["Regression","118/118","green"],["Boundary","34","gray"],["Cohort","18,240","gray"],["Weaker","312","amber"],["Advisor Review","41","amber"]].map(([k,v,c])=>(
                    <div key={k} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-xs">
                      <span className="text-gray-500">{k}</span><span className={`font-semibold ${c==="green"?"text-green-700":c==="amber"?"text-amber-700":"text-gray-700"}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Checker Comment <span className="text-red-500">*</span></div>
                  <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Required before approval or rejection…" className="w-full text-xs border border-gray-200 rounded p-2 resize-none h-20 placeholder-gray-400 focus:outline-none focus:border-[#1E3A6B]"/>
                </div>
              </div>
            </div>
          ):<div className="flex items-center justify-center h-48 text-gray-400 text-sm">{tab}</div>}
        </div>
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500"><Shield size={12} className="text-[#0D7A8A]"/>Approval creates an approved release candidate, not a deployment.</div>
          <div className="ml-auto flex items-center gap-2">
            <Btn icon={MessageSquare} label="Request Changes" onClick={()=>go("studio")}/>
            <Btn icon={X} label="Reject" danger/>
            <button disabled={!comment.trim()} onClick={()=>go("release")} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-700 text-white rounded text-xs font-semibold hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle2 size={12}/>Approve for Release
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Release Center ───────────────────────────────────────────────────────────

function ReleaseCenter({ go }:{ go:(s:Screen)=>void }) {
  const [env,setEnv]=useState("Production");
  type ReleaseCandidate = {name:string;ver:string;status:string;activation:string;maker:string;checker:string;sel:boolean;effectiveDate?:string;effectiveTime?:string;releaseMode?:"Immediate"|"Effective Date";scheduledBy?:string;scheduledAt?:string};
  const [showEffectiveDate,setShowEffectiveDate]=useState(false);
  const [effectiveDate,setEffectiveDate]=useState("2026-06-22");
  const [effectiveTime,setEffectiveTime]=useState("09:00");
  const [scheduleNote,setScheduleNote]=useState("");
  const [releaseMessage,setReleaseMessage]=useState<string|null>(null);
  const [releasesByEnv,setReleasesByEnv]=useState<Record<string,Array<ReleaseCandidate>>>({
    Development:[
      {name:"Portfolio Strength Rating",ver:"v4.9-dev",status:"Pending Checker Approval",activation:"Immediate after approval",maker:"Jennifer Wong",checker:"David Lim",sel:true},
      {name:"Investment Idea Suitability",ver:"v3.0-dev",status:"Active",activation:"18 Jun 2026 11:15 SGT",maker:"Amir Tan",checker:"Sarah Chen",sel:false},
    ],
    UAT:[
      {name:"Portfolio Strength Rating",ver:"v4.8-uat",status:"Approved - Awaiting Scheduled Activation",activation:"22 Jun 2026 09:00 SGT",maker:"Jennifer Wong",checker:"David Lim",sel:true},
      {name:"Investment Idea Suitability",ver:"v3.0-uat",status:"Active",activation:"10 Jun 2026 14:00 SGT",maker:"Amir Tan",checker:"Sarah Chen",sel:false},
    ],
    Production:[
      {name:"Portfolio Strength Rating",ver:"v4.8",status:"Approved - Awaiting Scheduled Activation",activation:"16 Jun 2026 02:00 SGT",maker:"Jennifer Wong",checker:"David Lim",sel:true},
      {name:"Investment Idea Suitability",ver:"v2.9",status:"Active",activation:"08 Jun 2026 01:30 SGT",maker:"Amir Tan",checker:"Sarah Chen",sel:false},
    ],
  });
  const releases=releasesByEnv[env];
  const selectedRelease=releases.find(r=>r.sel)??releases[0];
  const envCopy:Record<string,string>={
    Development:"Separate development instance. Maker-checker approval can activate immediately or on an effective date.",
    UAT:"Separate UAT instance. Releases are approved and activated here independently; there is no direct UAT-to-Production deployment.",
    Production:"Separate production instance. Production follows maker approval, checker approval, then immediate activation or effective-date activation.",
  };
  const lifecycle=[
    "Draft",
    "Maker Submitted",
    "Checker Approved",
    "Effective Date Set",
    "Active",
  ];
  const lifecycleIndex = selectedRelease.status==="Active" ? 4 : selectedRelease.status.includes("Effective") || selectedRelease.status.includes("Scheduled") ? 3 : selectedRelease.status.includes("Approved") ? 2 : selectedRelease.status.includes("Checker") ? 1 : 0;
  const selectRelease = (idx:number) => {
    setReleaseMessage(null);
    setReleasesByEnv(prev=>({
      ...prev,
      [env]: prev[env].map((r,i)=>({...r, sel:i===idx})),
    }));
  };
  const openEffectiveDate = () => {
    if (selectedRelease.effectiveDate) setEffectiveDate(selectedRelease.effectiveDate);
    if (selectedRelease.effectiveTime) setEffectiveTime(selectedRelease.effectiveTime);
    setScheduleNote("");
    setReleaseMessage(null);
    setShowEffectiveDate(true);
  };
  const applyEffectiveDate = () => {
    if (!effectiveDate || !effectiveTime) return;
    const activation = `${effectiveDate} ${effectiveTime} SGT`;
    setReleasesByEnv(prev=>({
      ...prev,
      [env]: prev[env].map(r=>r.sel ? {
        ...r,
        status: "Approved - Effective Date Set",
        activation,
        effectiveDate,
        effectiveTime,
        releaseMode: "Effective Date",
        scheduledBy: "Release Operator",
        scheduledAt: "21 Jun 2026 09:00 SGT",
      } : r),
    }));
    setReleaseMessage(`${selectedRelease.name} ${selectedRelease.ver} scheduled for ${activation} in ${env}.`);
    setShowEffectiveDate(false);
  };
  const releaseImmediately = () => {
    setReleasesByEnv(prev=>({
      ...prev,
      [env]: prev[env].map(r=>r.sel ? {
        ...r,
        status: "Active",
        activation: "Immediate activation completed",
        releaseMode: "Immediate",
        scheduledBy: "Release Operator",
        scheduledAt: "21 Jun 2026 09:00 SGT",
      } : r),
    }));
    setReleaseMessage(`${selectedRelease.name} ${selectedRelease.ver} released immediately in ${env}.`);
  };
  return (
    <div className="flex flex-col h-full bg-[#F1F4F8]">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between mb-3">
          <div><h1 className="text-lg font-semibold text-gray-900">Release Center</h1><p className="text-xs text-gray-500 mt-0.5">{envCopy[env]}</p></div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
              {["Development","UAT","Production"].map(e=><button key={e} onClick={()=>setEnv(e)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${env===e?"bg-white shadow-sm text-gray-900":"text-gray-500 hover:text-gray-700"}`}>{e}</button>)}
            </div>
            <Btn icon={Clock} label="Set Effective Date" primary onClick={openEffectiveDate}/>
          </div>
        </div>
        <GovernanceBanner text="Each environment has its own maker-checker release lane. UAT approval does not deploy to Production; Production requires its own maker and checker approval evidence."/>
        {releaseMessage && (
          <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded px-3 py-2 text-xs">
            <CheckCircle2 size={12}/>{releaseMessage}
          </div>
        )}
      </div>
      <div className="bg-white border-b border-gray-200 overflow-auto" style={{maxHeight:"160px"}}>
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-gray-50 sticky top-0"><tr>{["Decision","Version","Status","Environment","Activation","Maker","Checker",""].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {releases.map((r,i)=>(
              <tr key={i} onClick={()=>selectRelease(i)} className={`cursor-pointer ${r.sel?"bg-blue-50":"hover:bg-gray-50"}`}>
                <td className="px-3 py-2.5 font-medium text-[#1E3A6B]">{r.name}</td>
                <td className="px-3 py-2.5 font-mono">{r.ver}</td>
                <td className="px-3 py-2.5"><StatusBadge status={r.status} size="xs"/></td>
                <td className="px-3 py-2.5 text-gray-600">{env}</td><td className="px-3 py-2.5 text-gray-600">{r.activation}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.maker}</td><td className="px-3 py-2.5 text-gray-600">{r.checker}</td>
                <td className="px-3 py-2.5"><button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center justify-between mb-4">
              <div><div className="text-sm font-semibold text-gray-900">{selectedRelease.name}</div><code className="font-mono text-xs text-gray-500">{selectedRelease.name.includes("Portfolio")?"PS":"II"} · {env} release lane</code></div>
              <div className="flex items-center gap-2"><code className="font-mono text-base font-bold text-amber-700">{selectedRelease.ver}</code><StatusBadge status={selectedRelease.status} size="xs"/></div>
            </div>
            <div className="flex gap-0 mb-5">
              {lifecycle.map((stage,i)=>(
                <div key={stage} className="flex-1 flex flex-col items-center">
                  <div className={`w-full h-1.5 ${i===0?"rounded-l":""} ${i===lifecycle.length-1?"rounded-r":""} ${i<=lifecycleIndex?"bg-[#1E3A6B]":"bg-gray-200"}`}/>
                  <div className={`text-[9px] mt-1.5 font-medium text-center ${i===lifecycleIndex?"text-[#1E3A6B]":i<lifecycleIndex?"text-gray-400":"text-gray-300"}`}>{stage}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
              {[["Artifact Checksum","sha256:a4b2c1..."],["Maker",selectedRelease.maker],["Checker",`${selectedRelease.checker} · Advisory Compliance`],["Environment",env],["Activation",selectedRelease.activation],["Activation Option",selectedRelease.releaseMode ?? "Immediate or effective date"],["Rollback Target",env==="Production"?"v4.7 (currently active)":"previous active in same instance"],["Scheduled By",selectedRelease.scheduledBy ?? "Not scheduled"]].map(([k,v])=>(
                <div key={k}><div className="text-gray-500">{k}</div><div className={`font-medium text-gray-900 mt-0.5 ${k==="Artifact Checksum"?"font-mono text-[10px] text-gray-600":""}`}>{v}</div></div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">Release Actions</div>
              <div className="space-y-2">
                <button onClick={releaseImmediately} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059]"><Rocket size={12}/>Release Immediately</button>
                <button onClick={openEffectiveDate} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><Clock size={12}/>Set Effective Date</button>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><Eye size={12}/>Preview Release Notes</button>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><History size={12}/>Rollback Same Instance</button>
                <button onClick={()=>go("trace")} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><Eye size={12}/>View Decision Trace</button>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3"><div className="flex items-start gap-2"><Clock size={12} className="text-amber-600 flex-shrink-0 mt-0.5"/><div><div className="text-xs font-semibold text-amber-700">Effective date mode</div><div className="text-xs text-amber-600 mt-0.5">Activation occurs only within the selected {env} instance.</div></div></div></div>
          </div>
        </div>
      </div>
      {showEffectiveDate&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(13,27,62,0.5)"}}>
          <div className="bg-white rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Set Effective Date</div>
                <div className="text-xs text-gray-500 mt-0.5">{selectedRelease.name} · {selectedRelease.ver} · {env}</div>
              </div>
              <button onClick={()=>setShowEffectiveDate(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Effective Date</label>
                  <input type="date" value={effectiveDate} onChange={e=>setEffectiveDate(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B]"/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Effective Time</label>
                  <input type="time" value={effectiveTime} onChange={e=>setEffectiveTime(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B]"/>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                Activation will be scheduled only in the selected {env} instance. This does not deploy from UAT to Production.
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Release Operator Note</label>
                <textarea value={scheduleNote} onChange={e=>setScheduleNote(e.target.value)} rows={3}
                  placeholder="Optional schedule rationale or change ticket reference"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs outline-none focus:border-[#1E3A6B] resize-none"/>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={()=>setShowEffectiveDate(false)} className="px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={applyEffectiveDate} disabled={!effectiveDate||!effectiveTime} className="px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059] disabled:opacity-40 flex items-center gap-1.5">
                <Clock size={12}/>Set Effective Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Decision Trace ───────────────────────────────────────────────────────────

function DecisionTrace() {
  const [masked,setMasked]=useState(true);
  const families=[
    {name:"Cash",computed:"12.4%",rating:2,weight:"8%",state:"Computed",reason:"PS-CASH-002",note:"Within conservative band"},
    {name:"CIP / Portfolio Risk",computed:"Moderate",rating:3,weight:"15%",state:"Computed",reason:"PS-CIP-003",note:"Moderate deviation"},
    {name:"Income Return",computed:"3.2%",rating:3,weight:"10%",state:"Computed",reason:"PS-INCOME-003",note:"Meets target range"},
    {name:"Growth Return",computed:"5.1%",rating:3,weight:"10%",state:"Computed",reason:"PS-GROWTH-003",note:"Acceptable range"},
    {name:"Tenor",computed:"—",rating:null,weight:"5%",state:"Skipped",reason:"PS-TENOR-SKIP-001",note:"CIP tenor missing"},
    {name:"SAA Number",computed:"7 of 9",rating:3,weight:"7%",state:"Computed",reason:"PS-SAANUM-003",note:"Adequately represented"},
    {name:"SAA Allocation",computed:"Gap: +14.2%",rating:5,weight:"18%",state:"Computed",reason:"PS-SAA-GAP-004",note:"Exceeds v4.8 Moderate threshold"},
    {name:"House View",computed:"UW -9.1%",rating:4,weight:"12%",state:"Computed",reason:"PS-HV-UW-002",note:"Underweight to OW assets"},
    {name:"Thematic",computed:"3 flags",rating:3,weight:"5%",state:"Computed",reason:"PS-THEME-003",note:"Within guidelines"},
    {name:"ESG",computed:"68",rating:2,weight:"5%",state:"Computed",reason:"PS-ESG-002",note:"Meets threshold"},
    {name:"Overall Weighted Rating",computed:"3.72",rating:4,weight:"100%",state:"Computed",reason:"PS-OVERALL",note:"Score 3.72 → Rating 4",overall:true},
  ];
  const rCls=(r:number|null)=>!r?"text-gray-400":r<=2?"text-green-600":r===3?"text-amber-600":"text-red-600";
  const sensitive=new Set(["SAA Allocation","House View"]);
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1"><Lock size={12} className="text-blue-600"/><span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">Client-Sensitive Trace · Authorized Access</span></div>
            <h1 className="text-base font-semibold text-gray-900">Decision Trace</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <code className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">DTR-20260703-009281</code>
              <span className="text-xs text-gray-500">Portfolio Strength Rating</span>
              <code className="font-mono text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">Production v4.8</code>
              <span className="text-xs text-gray-500">3 Jul 2026 · 10:42:18 SGT</span>
            </div>
          </div>
          <div className="text-right"><div className="text-xs text-gray-500 mb-0.5">Outcome</div><div className="text-3xl font-bold text-red-600 leading-none">4</div><div className="text-xs text-gray-500 mt-0.5">High Misalignment · Score 3.72</div></div>
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Active weight: <strong className="text-blue-700">92% → renormalised to 100%</strong> (Tenor skipped)</span>
          <div className="flex items-center gap-1.5 ml-4 text-xs"><span className="text-gray-500">Primary drivers:</span><span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-xs font-medium">SAA Allocation R5</span><span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-xs font-medium">House View R4</span></div>
          <div className="ml-auto"><label className="flex items-center gap-2 cursor-pointer"><div onClick={()=>setMasked(!masked)} className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${masked?"bg-[#1E3A6B]":"bg-gray-300"}`}><div className={`absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all ${masked?"left-[18px]":"left-[3px]"}`}/></div><span className="text-xs text-gray-600 select-none">Mask client values</span></label></div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden p-4 gap-4 bg-[#F1F4F8]">
        <div className="flex-1 bg-white border border-gray-200 rounded overflow-auto">
          <div className="px-4 py-3 border-b border-gray-200"><div className="text-sm font-semibold text-gray-900">Rule-Family Execution Trace</div><div className="text-xs text-gray-500 mt-0.5">Client {masked?"C-•••••":"C-10482"} · Production v4.8</div></div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0"><tr>{["Rule Family","Computed","Rating","Weight","State","Reason Code","Note"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {families.map(f=>(
                <tr key={f.name} className={`${"overall" in f&&f.overall?"bg-gray-50 font-semibold":"hover:bg-gray-50"}`}>
                  <td className="px-3 py-2.5 text-gray-800">{f.name}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">{f.state==="Skipped"?"—":masked&&sensitive.has(f.name)?"• • •":f.computed}</td>
                  <td className="px-3 py-2.5"><span className={`text-base font-bold ${rCls(f.rating)}`}>{f.rating??'—'}</span></td>
                  <td className="px-3 py-2.5 font-mono text-gray-500">{f.weight}</td>
                  <td className="px-3 py-2.5"><span className={`text-xs font-medium ${f.state==="Skipped"?"text-orange-600":"text-green-700"}`}>{f.state}</span></td>
                  <td className="px-3 py-2.5 font-mono text-gray-500">{f.reason}</td>
                  <td className="px-3 py-2.5 text-gray-500">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="w-[240px] flex-shrink-0 bg-white border border-gray-200 rounded overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-200 text-xs font-semibold text-gray-900">Decision Lineage</div>
          <div className="p-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-2.5"><div className="flex items-center gap-1.5 mb-1"><Shield size={11} className="text-green-600"/><span className="text-xs font-semibold text-green-700">Immutable Snapshot</span></div><code className="font-mono text-[10px] text-green-600 break-all">sha256:a4b2c1d3e9f87a…</code></div>
            {[["Production Release","v4.8 · Active"],["Decision Key","PS · PORTFOLIO-STRENGTH-001"],["Evaluated","3 Jul 2026 10:42:18 SGT"]].map(([k,v])=>(
              <div key={k} className="text-xs"><div className="text-gray-500">{k}</div><div className="font-medium text-gray-900 mt-0.5">{v}</div></div>
            ))}
            <div className="border-t border-gray-100 pt-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Governance Chain</div>
              <div className="space-y-2 text-xs">
                {[[Bot,"text-[#0D7A8A]","Draft: myWealth Decision Assistant"],[CheckCircle2,"text-gray-500","Maker: Jennifer Wong · Attested"],[CheckCircle2,"text-green-600","Checker: David Lim · Approved"],[Rocket,"text-[#1E3A6B]","Activated: 16 Jun 2026"]].map(([Icon,cls,text],i)=>{
                  const I=Icon as React.ElementType;
                  return <div key={i} className="flex items-start gap-2"><I size={11} className={`${cls} flex-shrink-0 mt-0.5`}/><span className="text-gray-700">{text as string}</span></div>;
                })}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-2.5"><div className="flex items-start gap-1.5"><Info size={11} className="text-blue-600 flex-shrink-0 mt-0.5"/><p className="text-[10px] text-blue-600 leading-relaxed">Access logged. Client-sensitive values masked by default.</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── My Drafts ────────────────────────────────────────────────────────────────

function MyDrafts({ go, setStudioFn }:{ go:(s:Screen)=>void; setStudioFn:(k:string)=>void }) {
  const drafts=[
    {name:"SAA Allocation threshold update",fnKey:"PS",ver:"v4.8",status:"AI Draft Pending Maker Review",mod:"13 Jun 2026",checker:"David Lim"},
    {name:"House View threshold update",fnKey:"PS",ver:"v4.8",status:"AI Draft Pending Maker Review",mod:"13 Jun 2026",checker:"David Lim"},
    {name:"Income Return band update",fnKey:"PS",ver:"v4.2",status:"Draft - Maker Review Required",mod:"11 Jun 2026",checker:"—"},
    {name:"Soft Suitability concentration rule",fnKey:"II",ver:"v2.10",status:"Draft - Maker Review Required",mod:"04 Jun 2026",checker:"—"},
  ];
  return (
    <div className="flex flex-col h-full bg-[#F1F4F8]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
        <div><h1 className="text-lg font-semibold text-gray-900">My Drafts</h1><p className="text-xs text-gray-500 mt-0.5">{drafts.length} drafts requiring your review.</p></div>
        <Btn icon={Sparkles} label="Create with AI" primary onClick={()=>go("studio")}/>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50"><tr>{["Draft / Rule","Function","Version","Status","Modified","Checker",""].map(h=><th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {drafts.map((d,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><button onClick={()=>{setStudioFn(d.fnKey);go("studio");}} className="text-[#1E3A6B] font-medium hover:underline">{d.name}</button></td>
                  <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{d.fnKey}</td>
                  <td className="px-4 py-3 font-mono">{d.ver}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} size="xs"/></td>
                  <td className="px-4 py-3 text-gray-500">{d.mod}</td>
                  <td className="px-4 py-3 text-gray-600">{d.checker}</td>
                  <td className="px-4 py-3"><button onClick={()=>{setStudioFn(d.fnKey);go("studio");}} className="text-[#1E3A6B] hover:underline text-xs">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlatformSettings() {
  const sections=[
    {title:"Environment Instances",items:["Development instance · Isolated rules and reference data","UAT instance · Isolated approval and test evidence","Production instance · Separate maker-checker release lane"]},
    {title:"User Access & Roles",items:["Jennifer Wong · Maker","David Lim · Checker","Sarah Chen · Checker","Release Operator · Production activation"]},
    {title:"Maker-Checker Policy",items:["Tier 1 decisions require maker attestation","Checker approval required per environment","Production cannot reuse UAT approval as release approval"]},
    {title:"AI Workspace Configuration",items:["Draft Decision API · Enabled","Backend AI conversion · Enabled","Approval and release APIs · Disabled for AI"]},
    {title:"Regression Test Library",items:["Historical test case repository","Boundary case suite ownership","Expected-result re-baseline approvals"]},
    {title:"Release Governance",items:["Immediate release allowed after checker approval","Effective-date release allowed with date and time","Rollback limited to selected environment instance"]},
    {title:"Audit & Trace Settings",items:["Immutable approval evidence retention","Decision trace masking defaults","Exportable evidence pack configuration"]},
    {title:"Reference Data Controls",items:["CIP bands and house view source mapping","Reason-code registry","Rule input/output contract registry"]},
  ];
  return (
    <div className="flex flex-col h-full bg-[#F1F4F8]">
      <div className="bg-white border-b border-gray-200 px-6 py-4"><h1 className="text-lg font-semibold text-gray-900">Platform Settings</h1><p className="text-xs text-gray-500 mt-0.5">Configuration areas required for controlled authoring, testing, release and audit.</p></div>
      <div className="flex-1 overflow-y-auto p-6"><div className="grid grid-cols-2 gap-4 max-w-5xl">
        {sections.map(s=>(
          <div key={s.title} className="bg-white border border-gray-200 rounded">
            <div className="px-5 py-3.5 border-b border-gray-200 text-sm font-semibold text-gray-900">{s.title}</div>
            <div className="px-5 py-3">{s.items.map(item=>(
              <div key={item} className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-xs"><span className="text-gray-700">{item}</span><button className="text-[#1E3A6B] hover:underline">Configure</button></div>
            ))}</div>
          </div>
        ))}
      </div></div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,   setScreen]   = useState<Screen>("studio");
  const [studioFn, setStudioFn] = useState("PS");
  const [assistantContext, setAssistantContext] = useState<AssistantContext|null>(null);

  const go = (s:Screen) => {
    if (s !== "ai-works") setAssistantContext(null);
    setScreen(s);
  };

  const askRuleAssistant = (rule: Rule) => {
    setAssistantContext({
      source: "rule",
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      prompt: [
        `Review the ${rule.name} rule (${rule.id}) in Decision Studio.`,
        "Explain the current logic, identify the input and output contract, and prepare maker-editable draft notes.",
        "Do not approve, activate, deploy, or call a backend service.",
      ].join(" "),
    });
    setScreen("ai-works");
  };

  const askFunctionAssistant = (fn: RuleFunctionDef) => {
    setAssistantContext({
      source: "function",
      ruleId: fn.key,
      ruleName: fn.name,
      ruleType: "RuleFunction",
      prompt: [
        `Review the ${fn.name} rule function (${fn.key}) in Decision Studio.`,
        `Active release is ${fn.activeRelease}${fn.draftRelease ? ` with draft ${fn.draftRelease}` : ""}.`,
        "Explain the current rule flow, I/O contract, test coverage, simulation evidence, and release readiness.",
        "Prepare maker-editable improvement notes. Do not approve, activate, deploy, or call a backend service.",
      ].join(" "),
    });
    setScreen("ai-works");
  };

  const render = () => {
    switch (screen) {
      case "studio":       return <DecisionStudio   fnKey={studioFn} setFnKey={setStudioFn} go={go} onAskRuleAssistant={askRuleAssistant} onAskFunctionAssistant={askFunctionAssistant}/>;
      case "ai-works":     return <AIWorksScreen    go={go} assistantContext={assistantContext}/>;
      case "drafts":       return <MyDrafts         go={go} setStudioFn={setStudioFn}/>;
      case "review-queue": return <CheckerReview    go={go}/>;
      case "release":      return <ReleaseCenter    go={go}/>;
      case "trace":        return <DecisionTrace/>;
      case "settings":     return <PlatformSettings/>;
      case "maker-submit": return <MakerSubmit      go={go}/>;
      default:             return <DecisionStudio   fnKey={studioFn} setFnKey={setStudioFn} go={go} onAskRuleAssistant={askRuleAssistant} onAskFunctionAssistant={askFunctionAssistant}/>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{fontFamily:"'Inter', system-ui, sans-serif"}}>
      <LeftNav current={screen} go={go} studioFn={studioFn} setStudioFn={setStudioFn}/>
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar/>
        <main className="flex-1 overflow-hidden">{render()}</main>
      </div>
    </div>
  );
}
