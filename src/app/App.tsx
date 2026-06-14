import { useState, useEffect, useRef } from "react";
import {
  Search, Bell, ChevronDown, Sparkles, PenLine,
  FlaskConical, FolderOpen, ClipboardCheck, Rocket,
  Settings, CheckCircle2, Clock, AlertTriangle,
  Download, Play, GitCompare, History, Eye, MessageSquare,
  Shield, Check, X, FileText, AlertCircle, Info, Lock,
  ChevronRight, MoreHorizontal, Bot, Send, Home, Database,
  Plus, Layers, Code2, ArrowDown, Trash2, Edit3,
  Hash, Type, List, ToggleLeft, Package, ChevronUp,
  RefreshCw, Save, TestTube, Zap, ArrowRight, Copy,
  GitBranch, Wand2, CornerDownRight, Minus
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "catalog"|"studio"|"ai-works"|"simulation"|"drafts"|"review-queue"|"release"|"trace"|"settings"|"maker-submit";
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

// ─── Left Navigation ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id:"catalog",      label:"Decision Catalog",   icon:Home,          badge:null as string|null, badgeCls:"" },
  { id:"studio",       label:"Decision Studio",    icon:Layers,        badge:null,                badgeCls:"" },
  { id:"ai-works",     label:"AI Works",           icon:Wand2,         badge:null,                badgeCls:"" },
  { id:"simulation",   label:"Simulation Lab",     icon:FlaskConical,  badge:null,                badgeCls:"" },
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

function TopBar() {
  return (
    <div className="h-11 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
      <div className="flex items-center gap-2 flex-1 max-w-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
        <Search size={12} className="text-gray-400"/>
        <input className="flex-1 text-xs bg-transparent outline-none placeholder-gray-400" placeholder="Search rules, functions, decisions…"/>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-xs text-gray-700 cursor-pointer select-none hover:bg-gray-50">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"/><span>Development</span><ChevronDown size={11} className="text-gray-400"/>
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

// ─── Rule Quick-Test Panel ────────────────────────────────────────────────────

function RuleQuickTest({ rule }: { rule: Rule }) {
  const [vals, setVals] = useState<Record<string,string>>({});
  const [result, setResult] = useState<Record<string,string>|null>(null);

  const handleRun = () => {
    // Mock single-rule test
    const mockOut: Record<string,string> = {};
    rule.outputs.forEach(o => { mockOut[o.name] = o.sample; });
    setResult(mockOut);
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
            <div className="flex-1 flex items-center gap-3">
              {Object.entries(result).map(([k,v])=>(
                <div key={k} className="text-xs"><span className="text-gray-500">{k}:</span> <span className="font-mono font-semibold text-[#1E3A6B]">{v}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rule Editor View ─────────────────────────────────────────────────────────

function RuleEditorView({ rule }: { rule: Rule }) {
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
            <Btn icon={PenLine}  label="Edit Logic"/>
            <Btn icon={Sparkles} label="Ask Assistant"/>
            <Btn icon={Copy}     label="Clone Rule"/>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
          <span>Last modified: {rule.lastModified}</span>
          <span>·</span>
          <span>Used by: {rule.usedBy.map(k=>RULE_FUNCTIONS.find(f=>f.key===k)?.name??k).join(", ")||"—"}</span>
          <span>·</span>
          <span className="text-gray-400">Category: {rule.category}</span>
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
        <div className="bg-white border border-gray-200 rounded p-4">
          <RuleLogicDisplay rule={rule}/>
        </div>

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

/** Portfolio Strength — parallel scoring tree */
function PSDecisionTree({ fn, rules }: { fn: RuleFunctionDef; rules: Rule[] }) {
  const scoring = rules.filter(r => r.type !== "WeightedAggregation");

  return (
    <div className="flex-1 overflow-auto p-6 bg-[#F1F4F8]">
      <div className="min-w-[700px] max-w-5xl mx-auto flex flex-col items-center">

        {/* Input */}
        <TreeBox variant="root" tag="Input" label="Client Portfolio Data"
          sublabel="cip · totalAUM · saaAllocation · houseViewAlignment · esgScore…" />

        <TreeConnector label="Parallel evaluation — all rule families run independently" width="wide" />

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
    { ruleId:"R-PRESTR-001", failLabel:"Not Recommended", failCode:"IDEA-RESTRICTED",         failType:"fail" as const, passNote:"No restrictions apply" },
    { ruleId:"R-HELIG-001",  failLabel:"Ineligible",      failCode:"IDEA-CIP-BLOCK",           failType:"fail" as const, passNote:"All eligibility checks pass" },
    { ruleId:"R-SSUIT-001",  failLabel:"Suitable with Warnings", failCode:"IDEA-CONCENTRATION-WARN", failType:"warn" as const, passNote:"No suitability warnings" },
    { ruleId:"R-HVII-001",   failLabel:"Rank adjusted",   failCode:"IDEA-HV-ADJ",              failType:"warn" as const, passNote:"Rank applied" },
  ];
  const rankRule = rules.find(r => r.id === "R-RANK-001");

  return (
    <div className="flex-1 overflow-auto p-6 bg-[#F1F4F8]">
      <div className="max-w-xl mx-auto flex flex-col items-center">
        <TreeBox variant="root" tag="Input" label="Client Profile + Product Attributes"
          sublabel="cip · productRiskRating · holdingConcentration · houseView…" />

        {steps.map(step => {
          const rule = rules.find(r => r.id === step.ruleId);
          if (!rule) return null;
          return (
            <div key={step.ruleId} className="w-full flex flex-col items-center">
              <TreeConnector />
              {/* Decision node + branch */}
              <div className="w-full flex items-center gap-0">
                {/* Main node */}
                <div className="flex-1">
                  <div className={`border-2 rounded-lg p-3 text-center shadow-sm ${rule.type === "ExclusionList" ? "border-red-300 bg-red-50/50" : "border-gray-200 bg-white"}`}>
                    <div className="mb-1">
                      <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${ruleTypeCls[rule.type] ?? ""}`}>{rule.type}</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{rule.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{rule.inputs.map(f => f.name).slice(0, 3).join(" · ")}</div>
                  </div>
                </div>

                {/* Branch arrow right */}
                <div className="flex items-center flex-shrink-0 ml-2">
                  <div className="h-px w-8 bg-gray-400" />
                  <CornerDownRight size={12} className="text-gray-400 -ml-1" />
                  <div className={`border rounded-lg px-3 py-2 text-center ml-1 ${step.failType === "fail" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                    <div className={`text-[9px] font-bold uppercase tracking-wide ${step.failType === "fail" ? "text-red-500" : "text-amber-500"}`}>
                      {step.failType === "fail" ? "FAIL / BLOCK" : "WARN"}
                    </div>
                    <div className={`text-xs font-semibold mt-0.5 ${step.failType === "fail" ? "text-red-800" : "text-amber-800"}`}>{step.failLabel}</div>
                    <div className={`text-[9px] font-mono mt-0.5 ${step.failType === "fail" ? "text-red-400" : "text-amber-400"}`}>{step.failCode}</div>
                  </div>
                </div>
              </div>

              {/* PASS label */}
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-px h-2 bg-gray-300" />
              </div>
              <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                ✓ {step.passNote}
              </span>
            </div>
          );
        })}

        {/* Ranking */}
        <TreeConnector />
        <div className="bg-white border-2 border-indigo-300 rounded-lg px-5 py-3 text-center shadow-sm w-72">
          <div className="mb-1">
            <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${ruleTypeCls["RankingMatrix"]}`}>RankingMatrix</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">{rankRule?.name}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">CIP + houseView + objective → Rank 1–5</div>
        </div>

        <TreeConnector />
        <TreeBox variant="output" tag="Output" label="Eligible · Rank · Advisor Message"
          sublabel="eligible · recommendationRank · reasonCodes · advisorMessage" />
      </div>
    </div>
  );
}

/** Dispatcher: picks the right tree view for the function */
function DecisionTreeView({ fn, allRules }: { fn: RuleFunctionDef; allRules: Rule[] }) {
  const fnRules = fn.ruleIds.map(id => allRules.find(r => r.id === id)).filter(Boolean) as Rule[];
  if (fn.key === "PS") return <PSDecisionTree fn={fn} rules={fnRules} />;
  return <IIDecisionTree rules={fnRules} />;
}

// ─── Function Flow Builder ────────────────────────────────────────────────────

function FlowBuilderTab({ fn, allRules, onAddRule, onRemoveRule, onMoveRule }:{
  fn: RuleFunctionDef; allRules: Rule[];
  onAddRule:(ruleId:string)=>void; onRemoveRule:(ruleId:string)=>void; onMoveRule:(ruleId:string,dir:"up"|"down")=>void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const fnRules = fn.ruleIds.map(id=>allRules.find(r=>r.id===id)).filter(Boolean) as Rule[];
  const available = allRules.filter(r=>!fn.ruleIds.includes(r.id)&&r.id!=="R-OVERALL-001");
  const filtered = available.filter(r=>r.name.toLowerCase().includes(pickerSearch.toLowerCase()));

  const isPS = fn.key === "PS";

  return (
    <div className="flex-1 overflow-auto p-4 bg-[#F1F4F8]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Rule Flow</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isPS ? "Rules execute in parallel → Overall Weighted Rating aggregates results." : "Rules execute sequentially — each can block or pass to the next step."}
          </div>
        </div>
        <button onClick={()=>setShowPicker(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059]">
          <Plus size={12}/>Add Rule from Library
        </button>
      </div>

      {/* Flow visualization */}
      {isPS ? (
        <div className="flex gap-4">
          {/* Parallel rules */}
          <div className="flex-1 space-y-2">
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
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
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
        /* Sequential flow for Investment Ideas */
        <div className="max-w-xl space-y-0">
          {fnRules.map((rule,i)=>(
            <div key={rule.id} className="flex flex-col items-stretch">
              <div className={`bg-white border rounded p-3 flex items-center gap-3 ${rule.modified?"border-amber-300":"border-gray-200"}`}>
                <div className="w-6 h-6 rounded-full bg-[#1E3A6B]/10 text-[#1E3A6B] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">{rule.name}</span>
                    <RuleTypeBadge type={rule.type}/>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {rule.inputs.map(f=>f.name).slice(0,3).join(", ")} → {rule.outputs[0]?.name}
                    {rule.type==="ExclusionList"&&<span className="ml-2 text-red-500">Any match → BLOCKED</span>}
                    {rule.type==="DecisionTable"&&<span className="ml-2 text-amber-600">First FAIL → blocked</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button disabled={i===0} onClick={()=>onMoveRule(rule.id,"up")} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={12}/></button>
                  <button disabled={i===fnRules.length-1} onClick={()=>onMoveRule(rule.id,"down")} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={12}/></button>
                  <button onClick={()=>onRemoveRule(rule.id)} className="p-1 text-gray-300 hover:text-red-500 ml-1"><Trash2 size={12}/></button>
                </div>
              </div>
              {i<fnRules.length-1&&<div className="flex flex-col items-center my-0.5"><div className="w-px h-3 bg-gray-300"/><ArrowDown size={11} className="text-gray-400"/></div>}
            </div>
          ))}
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

// ─── Rule Function Workspace ──────────────────────────────────────────────────

function RuleFunctionView({ fn, setFn, allRules, testCases, onSaveTestCase, onDeleteTestCase, go }:{
  fn:RuleFunctionDef; setFn:(f:RuleFunctionDef)=>void; allRules:Rule[];
  testCases:TestCase[]; onSaveTestCase:(tc:TestCase)=>void; onDeleteTestCase:(id:string)=>void;
  go:(s:Screen)=>void;
}) {
  const [tab, setTab] = useState("Rule Flow");
  const tabs = ["Rule Flow","Decision Tree","I/O Contract","Test Cases","Simulation","Change History"];

  const addRule = (ruleId:string) => setFn({...fn, ruleIds:[...fn.ruleIds, ruleId]});
  const removeRule = (ruleId:string) => setFn({...fn, ruleIds:fn.ruleIds.filter(id=>id!==ruleId)});
  const moveRule = (ruleId:string, dir:"up"|"down") => {
    const ids = [...fn.ruleIds]; const i = ids.indexOf(ruleId); if (i<0) return;
    const j = dir==="up"?i-1:i+1; if (j<0||j>=ids.length) return;
    [ids[i],ids[j]]=[ids[j],ids[i]]; setFn({...fn, ruleIds:ids});
  };

  const passCount = testCases.filter(tc=>tc.fnKey===fn.key&&tc.status==="pass").length;
  const failCount = testCases.filter(tc=>tc.fnKey===fn.key&&tc.status==="fail").length;
  const totalCases = testCases.filter(tc=>tc.fnKey===fn.key).length;

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
            <Btn icon={Sparkles}     label="Ask Assistant"/>
            <Btn icon={AlertCircle}  label="Validate"/>
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

      <TabBar tabs={tabs} active={tab} onChange={setTab}/>

      <div className="flex-1 overflow-hidden">
        {tab==="Rule Flow"     && <FlowBuilderTab fn={fn} allRules={allRules} onAddRule={addRule} onRemoveRule={removeRule} onMoveRule={moveRule}/>}
        {tab==="Decision Tree" && <DecisionTreeView fn={fn} allRules={allRules}/>}
        {tab==="I/O Contract"  && <IOContractTab fn={fn} allRules={allRules}/>}
        {tab==="Test Cases"    && <TestCasesTab fnKey={fn.key} testCases={testCases} onRun={id=>{}} onDelete={onDeleteTestCase}/>}
        {tab==="Simulation"    && <SimulationTab fn={fn} allRules={allRules} onSaveTestCase={onSaveTestCase}/>}
        {tab==="Change History"&& <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-[#F1F4F8]">Change History</div>}
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

const STEP_CLS: Record<string, string> = {
  read:     "bg-blue-50 text-blue-700 border border-blue-200",
  analyze:  "bg-purple-50 text-purple-700 border border-purple-200",
  create:   "bg-amber-50 text-amber-700 border border-amber-200",
  validate: "bg-green-50 text-green-700 border border-green-200",
  write:    "bg-orange-100 text-orange-800 border border-orange-300",
};

function AIWorksScreen({ go }: { go: (s: Screen) => void }) {
  const [input, setInput]     = useState("");
  const [phase, setPhase]     = useState<AIWorksPhase>("idle");
  const [steps, setSteps]     = useState<AIWorksStep[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SAMPLE_REQUEST = "Create a Sustainability Suitability Check function for wealth advisory. It should evaluate ESG score, green investment allocation percentage, and controversial sector exposure to determine if a portfolio meets our sustainability policy.";

  const runCreation = (userMsg: string) => {
    if (phase === "running") return;
    setPhase("running");
    setDraftReady(false);
    const fresh = CREATION_STEPS.map(s => ({ ...s, status: "pending" as const }));
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

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [steps, draftReady]);

  const hasConversation = phase !== "idle";

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
              <p className="text-[10px] text-gray-400">Describe a rule function in plain language. AI Works creates a draft for your review.</p>
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

          {/* If no conversation yet, show capability cards */}
          {!hasConversation && (
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
                <p className="text-xs text-gray-800 leading-relaxed">{SAMPLE_REQUEST}</p>
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
                    Understood. I identified three rule families for a Sustainability Suitability Check: ESG Score evaluation, Green Allocation threshold check, and Controversial Sector screening. Creating the draft rule function now.
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
                        Draft <code className="font-mono">SUSTAIN-CHECK-003</code> created via Draft Function API. Production is unchanged. Maker review and checker approval required before release.
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
              placeholder="Describe the rule function you need in plain language…"
              rows={2}
              className="flex-1 text-xs border border-gray-200 rounded px-3 py-2 resize-none focus:outline-none focus:border-[#1E3A6B] placeholder-gray-400"
            />
            <button
              onClick={() => runCreation(input || SAMPLE_REQUEST)}
              disabled={phase === "running"}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1E3A6B] text-white rounded text-xs font-semibold hover:bg-[#163059] disabled:opacity-50 self-end">
              {phase === "running" ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {phase === "running" ? "Creating…" : "Generate"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 ml-1">AI Works will create all rules, the I/O contract and test cases as a draft for your review.</p>
        </div>
      </div>

      {/* Right: draft preview */}
      <div className="overflow-y-auto bg-[#F1F4F8] p-4" style={{ flex: "0 0 38%" }}>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900">Draft Preview</span>
            {draftReady
              ? <StatusBadge status="AI-Assisted Draft" size="xs" />
              : <span className="text-[10px] text-gray-400">{phase === "running" ? "Building…" : "Awaiting generation"}</span>
            }
          </div>
          <div className="p-4 space-y-4">

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
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Decision Studio ──────────────────────────────────────────────────────────

function DecisionStudio({ fnKey, setFnKey, go }:{ fnKey:string; setFnKey:(k:string)=>void; go:(s:Screen)=>void }) {
  const [view,      setView]      = useState<StudioView>("function");
  const [selRuleId, setSelRuleId] = useState<string|null>(null);
  const [rulesOpen, setRulesOpen] = useState(true);
  const [fnsOpen,   setFnsOpen]   = useState(true);
  const [ruleSearch,setRuleSearch]= useState("");
  const [testCases, setTestCases] = useState<TestCase[]>(INITIAL_TEST_CASES);
  // Local copies of functions (so we can mutate rule lists)
  const [localFns,  setLocalFns]  = useState<RuleFunctionDef[]>(RULE_FUNCTIONS);

  const selRule = RULES.find(r=>r.id===selRuleId);
  const selFn   = localFns.find(f=>f.key===fnKey)??localFns[0];

  const filteredRules = RULES.filter(r=>r.name.toLowerCase().includes(ruleSearch.toLowerCase()));

  const updateFn = (fn:RuleFunctionDef) => setLocalFns(prev=>prev.map(f=>f.key===fn.key?fn:f));

  const openFn = (key:string) => { setFnKey(key); setView("function"); };
  const openRule = (id:string) => { setSelRuleId(id); setView("rule"); };

  const handleSaveTestCase = (tc:TestCase) => setTestCases(p=>[...p, tc]);
  const handleDeleteTestCase = (id:string) => setTestCases(p=>p.filter(tc=>tc.id!==id));

  return (
    <div className="flex h-full overflow-hidden">
      {/* Studio left panel */}
      <div className="w-[228px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-900">Decision Studio</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Rules &amp; rule functions</div>
        </div>
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5">
            <Search size={11} className="text-gray-400"/>
            <input value={ruleSearch} onChange={e=>setRuleSearch(e.target.value)} placeholder="Search rules…" className="flex-1 text-[11px] bg-transparent outline-none"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Rules Library */}
          <div>
            <button onClick={()=>setRulesOpen(p=>!p)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors">
              <ChevronDown size={11} className={`text-gray-400 transition-transform ${rulesOpen?"":"-rotate-90"}`}/>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-1 text-left">Rules Library</span>
              <span className="text-[10px] text-gray-400">{RULES.length}</span>
              <button onClick={e=>{e.stopPropagation();}} className="text-gray-300 hover:text-[#1E3A6B] ml-1"><Plus size={11}/></button>
            </button>
            {rulesOpen && filteredRules.map(rule=>(
              <button key={rule.id} onClick={()=>openRule(rule.id)}
                className={`w-full flex items-start gap-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors border-l-2 ${view==="rule"&&selRuleId===rule.id?"bg-blue-50 border-l-[#1E3A6B]":"border-l-transparent"}`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${rule.modified?"bg-amber-400":"bg-gray-300"}`}/>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-gray-800 leading-tight truncate">{rule.name}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{rule.type}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Rule Functions */}
          <div className="border-t border-gray-100">
            <button onClick={()=>setFnsOpen(p=>!p)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors">
              <ChevronDown size={11} className={`text-gray-400 transition-transform ${fnsOpen?"":"-rotate-90"}`}/>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-1 text-left">Rule Functions</span>
              <span className="text-[10px] text-gray-400">{localFns.length}</span>
              <button onClick={e=>{e.stopPropagation();}} className="text-gray-300 hover:text-[#1E3A6B] ml-1"><Plus size={11}/></button>
            </button>
            {fnsOpen && (
              <>
                {localFns.map(fn=>(
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
                <button onClick={()=>{}} className="w-full flex items-center gap-2 px-4 py-2 text-[11px] text-[#1E3A6B] hover:bg-blue-50 transition-colors">
                  <Plus size={11}/><span className="font-medium">Create Rule Function</span>
                </button>
              </>
            )}
          </div>
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
        {view==="rule"&&selRule&&<RuleEditorView rule={selRule}/>}
        {view==="function"&&selFn&&(
          <RuleFunctionView fn={selFn} setFn={updateFn} allRules={RULES}
            testCases={testCases} onSaveTestCase={handleSaveTestCase} onDeleteTestCase={handleDeleteTestCase} go={go}/>
        )}
      </div>
    </div>
  );
}

// ─── Decision Catalog ─────────────────────────────────────────────────────────

function DecisionCatalog({ go, setStudioFn }:{ go:(s:Screen)=>void; setStudioFn:(k:string)=>void }) {
  const goFn=(key:string)=>{setStudioFn(key);go("studio");};
  const metrics=[
    {label:"Active Decisions",value:"126",accent:""},
    {label:"Portfolio Rule Families",value:"10",accent:""},
    {label:"My Drafts Requiring Review",value:"4",accent:"text-amber-600"},
    {label:"Pending Checker Approval",value:"12",accent:"text-blue-600"},
    {label:"Simulation Runs This Week",value:"38",accent:""},
    {label:"Validation Issues",value:"2",accent:"text-red-600"},
  ];
  const rows=[
    {name:"Portfolio Strength Rating",fnKey:"PS",bc:"Portfolio Strength",domain:"Wealth Advisory Portfolio Health",release:"v4.7",draft:"AI Draft Pending Maker Review",owner:"Advisory Solutions",mod:"13 Jun 2026"},
    {name:"Investment Idea Suitability and Recommendation",fnKey:"II",bc:"Investment Idea",domain:"Advisory Recommendations",release:"v2.9",draft:"No Active Draft",owner:"Investment Advisory",mod:"08 Jun 2026"},
    {name:"Portfolio Impact Simulation Policy",fnKey:"SIM",bc:"Simulation",domain:"Testing and Impact Analysis",release:"v1.6",draft:"Checker Review Required",owner:"Advisory Technology",mod:"11 Jun 2026"},
  ];
  const tasks=[
    {text:"Review AI-assisted draft for Portfolio Strength Rating v4.8",type:"fn",fnKey:"PS",hi:true},
    {text:"Inspect Simulation Lab result for 312 weakened portfolios",type:"screen",screen:"simulation" as Screen,hi:true},
    {text:"Submit validation evidence for Investment Idea update",type:"fn",fnKey:"II",hi:false},
  ];
  const bcColor:Record<string,string>={"Portfolio Strength":"bg-[#1E3A6B]/10 text-[#1E3A6B]","Investment Idea":"bg-teal-50 text-teal-700","Simulation":"bg-purple-50 text-purple-700"};
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div><h1 className="text-lg font-semibold text-gray-900">Decision Catalog</h1><p className="text-xs text-gray-500 mt-0.5">Governed advisory decisions, simulations and runtime rule assets.</p></div>
            <div className="flex items-center gap-2"><Btn icon={PenLine} label="Create Manually" onClick={()=>go("studio")}/><Btn icon={Sparkles} label="Create with AI" primary onClick={()=>go("studio")}/></div>
          </div>
          <div className="grid grid-cols-6 gap-2.5 mt-4">
            {metrics.map(m=>(
              <div key={m.label} className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className={`text-2xl font-bold leading-none ${m.accent||"text-gray-900"}`}>{m.value}</div>
                <div className="text-[10px] text-gray-500 mt-1 leading-tight">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 w-52">
            <Search size={11} className="text-gray-400"/>
            <input className="flex-1 text-xs bg-transparent outline-none placeholder-gray-400" placeholder="Search name or key…"/>
          </div>
          {["Business Case","Domain","Status"].map(f=>(
            <button key={f} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-50">{f}<ChevronDown size={10} className="text-gray-400"/></button>
          ))}
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-gray-50"><tr>
              {["Decision Name","Business Case","Domain","Active","Draft Status","Owner","Modified",""].map(h=>(
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map(r=>(
                <tr key={r.fnKey} className="hover:bg-blue-50/40 cursor-pointer" onClick={()=>goFn(r.fnKey)}>
                  <td className="px-3 py-2.5"><span className="text-[#1E3A6B] font-medium hover:underline">{r.name}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded font-medium ${bcColor[r.bc]}`}>{r.bc}</span></td>
                  <td className="px-3 py-2.5 text-gray-500">{r.domain}</td>
                  <td className="px-3 py-2.5"><code className="font-mono text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{r.release}</code></td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.draft} size="xs"/></td>
                  <td className="px-3 py-2.5 text-gray-500">{r.owner}</td>
                  <td className="px-3 py-2.5 text-gray-400">{r.mod}</td>
                  <td className="px-3 py-2.5"><button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={13}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="w-[256px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200"><div className="text-sm font-semibold text-gray-900">My Tasks</div><div className="text-[10px] text-gray-500 mt-0.5">Actions requiring your attention</div></div>
        <div className="flex-1 overflow-auto">
          {tasks.map((t,i)=>(
            <div key={i} onClick={()=>t.type==="fn"?goFn((t as any).fnKey):go((t as any).screen)}
              className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
              <div className="flex items-start gap-2"><div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.hi?"bg-amber-500":"bg-blue-400"}`}/><p className="text-xs text-gray-700 leading-relaxed">{t.text}</p></div>
              <div className="flex items-center gap-1 mt-1.5 ml-3.5"><span className="text-[10px] text-gray-400">Due today</span><ChevronRight size={9} className="text-gray-400"/></div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100"><GovernanceBanner/></div>
      </div>
    </div>
  );
}

// ─── Simulation Lab ───────────────────────────────────────────────────────────

const ratingData=[
  {rating:"R1 Strong",v47:2100,v48:2141},{rating:"R2 Good",v47:5820,v48:5779},
  {rating:"R3 Moderate",v47:6890,v48:6578},{rating:"R4 Weak",v47:2890,v48:3202},{rating:"R5 Critical",v47:540,v48:540},
];
const driverData=[{family:"SAA Allocation",count:218},{family:"House View",count:94}];

function SimulationLab({ go }:{ go:(s:Screen)=>void }) {
  const [tab,setTab]=useState("Summary");
  const scenarios=[
    {seg:"Moderate-Balanced",cip:"Moderate",aum:"$500K–$2M",ar:3,dr:4,driver:"SAA Allocation",rc:"PS-SAA-GAP-004"},
    {seg:"Moderate-Balanced",cip:"Moderate",aum:"$2M–$5M",ar:3,dr:4,driver:"SAA Allocation",rc:"PS-SAA-GAP-004"},
    {seg:"Moderate-Growth",cip:"Moderate",aum:"$1M–$5M",ar:3,dr:4,driver:"House View",rc:"PS-HV-UW-002"},
    {seg:"Moderate-Balanced",cip:"Moderate",aum:">$5M",ar:2,dr:3,driver:"SAA Allocation",rc:"PS-SAA-GAP-004"},
    {seg:"Moderate-Income",cip:"Moderate",aum:"$200K–$500K",ar:3,dr:4,driver:"House View",rc:"PS-HV-UW-002"},
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Simulation Lab · Portfolio Strength Rating</div>
            <h1 className="text-base font-semibold text-gray-900">Draft v4.8 vs Active v4.7</h1>
            <div className="flex items-center gap-2 mt-1"><StatusBadge status="AI-Assisted" size="xs"/><span className="text-xs text-gray-500">Q2 Advisory Portfolio Cohort · 18,240 portfolios</span></div>
          </div>
          <div className="flex items-center gap-2">
            <Btn icon={Play} label="Run Tests"/>
            <Btn icon={Download} label="Export Evidence"/>
            <Btn icon={PenLine} label="Return to Studio" primary onClick={()=>go("studio")}/>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 flex-wrap">
          {[["Model Validation","Passed",true],["Regression Scenarios","118/118",true],["Boundary Scenarios","34",true],["Changed Outcomes","27",true],["Warnings","1",false]].map(([l,v,ok])=>(
            <div key={l as string} className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs border ${ok?"bg-green-50 border-green-200 text-green-700":"bg-amber-50 border-amber-200 text-amber-700"}`}>
              {ok?<CheckCircle2 size={10}/>:<AlertTriangle size={10}/>}<span className="font-medium">{l}:</span><span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <TabBar tabs={["Summary","Changed Scenarios","Rule Contribution"]} active={tab} onChange={setTab}/>
      <div className="flex-1 overflow-y-auto p-4 bg-[#F1F4F8]">
        {tab==="Summary"&&(
          <>
            <div className="grid grid-cols-6 gap-2.5 mb-4">
              {[["Total","18,240","text-gray-900",""],["Unchanged","17,887","text-green-700","bg-green-50 border-green-200"],["Stronger","41","text-blue-700","bg-blue-50 border-blue-200"],["Weaker","312","text-red-600","bg-red-50 border-red-200"],["Advisor Review","41","text-amber-700","bg-amber-50 border-amber-200"],["Exceptions","0","text-green-700","bg-green-50 border-green-200"]].map(([l,v,c,bg])=>(
                <div key={l} className={`bg-white border rounded p-3 text-center ${bg||"border-gray-200"}`}>
                  <div className={`text-2xl font-bold leading-none ${c}`}>{v}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-white border border-gray-200 rounded p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Rating Distribution: v4.7 vs v4.8</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ratingData} barSize={18} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="rating" tick={{fontSize:10,fill:"#6b7280"}}/>
                    <YAxis tick={{fontSize:10,fill:"#6b7280"}}/>
                    <Tooltip contentStyle={{fontSize:11,padding:"4px 10px",border:"1px solid #e5e7eb",borderRadius:"4px"}}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="v47" name="Active v4.7" fill="#1E3A6B" radius={[2,2,0,0]}/>
                    <Bar dataKey="v48" name="Draft v4.8" fill="#0D7A8A" radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 rounded p-4">
                  <div className="text-xs font-semibold text-gray-900 mb-3">Primary Change Drivers</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={driverData} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis type="number" tick={{fontSize:10,fill:"#6b7280"}}/>
                      <YAxis dataKey="family" type="category" width={90} tick={{fontSize:10,fill:"#6b7280"}}/>
                      <Tooltip contentStyle={{fontSize:11,padding:"4px 10px",border:"1px solid #e5e7eb",borderRadius:"4px"}}/>
                      <Bar dataKey="count" fill="#D97706" radius={[0,2,2,0]} name="Portfolios"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white border border-gray-200 rounded p-3">
                  <div className="flex items-center gap-2 mb-2"><Bot size={12} className="text-[#0D7A8A]"/><span className="text-xs font-semibold text-[#0D7A8A]">AI analysis</span><span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1 py-px rounded ml-auto">Human review required</span></div>
                  <p className="text-xs text-gray-700 leading-relaxed">Draft primarily weakens Moderate CIP portfolios with allocation gaps above revised SAA threshold or underweight to house-view OW classes.</p>
                  <button onClick={()=>go("maker-submit")} className="mt-3 w-full text-xs bg-[#1E3A6B] text-white rounded py-1.5 hover:bg-[#163059]">Submit for Review →</button>
                </div>
              </div>
            </div>
          </>
        )}
        {tab==="Changed Scenarios"&&(
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3"><span className="text-sm font-semibold text-gray-900">Changed Scenarios</span><span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded">312 portfolios</span></div>
            <table className="w-full text-xs"><thead className="bg-gray-50"><tr>{["Segment","CIP","AUM Band","Active","Draft","Driving Rule","Reason Code","Status"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {scenarios.map((s,i)=>(
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{s.seg}</td><td className="px-3 py-2">{s.cip}</td><td className="px-3 py-2">{s.aum}</td>
                    <td className="px-3 py-2 font-bold text-amber-600">{s.ar}</td><td className="px-3 py-2 font-bold text-red-600">{s.dr} ↑</td>
                    <td className="px-3 py-2">{s.driver}</td><td className="px-3 py-2 font-mono text-gray-500">{s.rc}</td>
                    <td className="px-3 py-2"><StatusBadge status="Pending Checker Approval" size="xs"/></td>
                  </tr>
                ))}
                <tr className="bg-gray-50"><td colSpan={8} className="px-3 py-2 text-gray-400 text-center italic">+ 307 more rows</td></tr>
              </tbody>
            </table>
          </div>
        )}
        {tab==="Rule Contribution"&&<div className="flex items-center justify-center h-48 text-gray-400 text-sm">Rule Contribution analysis</div>}
      </div>
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
  const releases=[
    {name:"Portfolio Strength Rating",ver:"v4.8",status:"Approved - Awaiting Scheduled Activation",env:"Production",activation:"16 Jun 2026 02:00 SGT",by:"David Lim",src:"AI-Assisted, Human Approved",sel:true},
    {name:"Investment Idea Suitability",ver:"v3.0",status:"Deployed",env:"UAT",activation:"10 Jun 2026",by:"Sarah Chen",src:"Manual",sel:false},
  ];
  const lifecycle=["Draft","Pending Approval","Approved","Scheduled","Active","Retired"];
  return (
    <div className="flex flex-col h-full bg-[#F1F4F8]">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between mb-3">
          <div><h1 className="text-lg font-semibold text-gray-900">Release Center</h1><p className="text-xs text-gray-500 mt-0.5">Schedule, activate, monitor and roll back approved rule versions.</p></div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
              {["Development","UAT","Production"].map(e=><button key={e} onClick={()=>setEnv(e)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${env===e?"bg-white shadow-sm text-gray-900":"text-gray-500 hover:text-gray-700"}`}>{e}</button>)}
            </div>
            <Btn icon={Rocket} label="Schedule Approved Release" primary/>
          </div>
        </div>
        <GovernanceBanner text="myWealth Decision Assistant cannot activate or deploy decisions. Release actions require authorized operational users and approved evidence."/>
      </div>
      <div className="bg-white border-b border-gray-200 overflow-auto" style={{maxHeight:"160px"}}>
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-gray-50 sticky top-0"><tr>{["Decision","Version","Status","Environment","Activation","Approved By","Source",""].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {releases.map((r,i)=>(
              <tr key={i} className={`cursor-pointer ${r.sel?"bg-blue-50":"hover:bg-gray-50"}`}>
                <td className="px-3 py-2.5 font-medium text-[#1E3A6B]">{r.name}</td>
                <td className="px-3 py-2.5 font-mono">{r.ver}</td>
                <td className="px-3 py-2.5"><StatusBadge status={r.status} size="xs"/></td>
                <td className="px-3 py-2.5 text-gray-600">{r.env}</td><td className="px-3 py-2.5 text-gray-600">{r.activation}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.by}</td><td className="px-3 py-2.5 text-gray-500">{r.src}</td>
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
              <div><div className="text-sm font-semibold text-gray-900">Portfolio Strength Rating</div><code className="font-mono text-xs text-gray-500">PS · Approved candidate</code></div>
              <div className="flex items-center gap-2"><code className="font-mono text-base font-bold text-amber-700">v4.8</code><StatusBadge status="Approved - Awaiting Scheduled Activation" size="xs"/></div>
            </div>
            <div className="flex gap-0 mb-5">
              {lifecycle.map((stage,i)=>(
                <div key={stage} className="flex-1 flex flex-col items-center">
                  <div className={`w-full h-1.5 ${i===0?"rounded-l":""} ${i===lifecycle.length-1?"rounded-r":""} ${i<=2?"bg-[#1E3A6B]":"bg-gray-200"}`}/>
                  <div className={`text-[9px] mt-1.5 font-medium text-center ${i===2?"text-[#1E3A6B]":i<2?"text-gray-400":"text-gray-300"}`}>{stage}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
              {[["Artifact Checksum","sha256:a4b2c1…"],["Maker","Jennifer Wong"],["Checker","David Lim · Advisory Compliance"],["Origin","AI-Assisted, Human Approved"],["Activation","Scheduled"],["Rollback Target","v4.7 (currently active)"]].map(([k,v])=>(
                <div key={k}><div className="text-gray-500">{k}</div><div className={`font-medium text-gray-900 mt-0.5 ${k==="Artifact Checksum"?"font-mono text-[10px] text-gray-600":""}`}>{v}</div></div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">Release Actions</div>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1E3A6B] text-white rounded text-xs font-medium hover:bg-[#163059]"><Rocket size={12}/>Schedule Activation</button>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><Eye size={12}/>Preview Release Notes</button>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><History size={12}/>Rollback to v4.7</button>
                <button onClick={()=>go("trace")} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50"><Eye size={12}/>View Decision Trace</button>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3"><div className="flex items-start gap-2"><Clock size={12} className="text-amber-600 flex-shrink-0 mt-0.5"/><div><div className="text-xs font-semibold text-amber-700">Scheduled</div><div className="text-xs text-amber-600 mt-0.5">16 Jun 2026 · 02:00 SGT</div></div></div></div>
          </div>
        </div>
      </div>
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
  return (
    <div className="flex flex-col h-full bg-[#F1F4F8]">
      <div className="bg-white border-b border-gray-200 px-6 py-4"><h1 className="text-lg font-semibold text-gray-900">Platform Settings</h1></div>
      <div className="flex-1 overflow-y-auto p-6"><div className="max-w-xl space-y-4">
        {[{title:"Environments",items:["Development · Active","UAT · Active","Production · Active"]},{title:"User Access & Roles",items:["Jennifer Wong · Maker","David Lim · Checker","Sarah Chen · Checker"]},{title:"AI Workspace Configuration",items:["Draft Decision API · Enabled","Approval API · Disabled (by policy)"]},{title:"Release Governance",items:["Tier 1 decisions require Checker approval","Auto-rollback on health failure · Enabled"]}].map(s=>(
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
  const [screen,   setScreen]   = useState<Screen>("catalog");
  const [studioFn, setStudioFn] = useState("PS");

  const go = (s:Screen) => setScreen(s);

  const render = () => {
    switch (screen) {
      case "catalog":      return <DecisionCatalog  go={go} setStudioFn={setStudioFn}/>;
      case "studio":       return <DecisionStudio   fnKey={studioFn} setFnKey={setStudioFn} go={go}/>;
      case "ai-works":     return <AIWorksScreen    go={go}/>;
      case "simulation":   return <SimulationLab    go={go}/>;
      case "drafts":       return <MyDrafts         go={go} setStudioFn={setStudioFn}/>;
      case "review-queue": return <CheckerReview    go={go}/>;
      case "release":      return <ReleaseCenter    go={go}/>;
      case "trace":        return <DecisionTrace/>;
      case "settings":     return <PlatformSettings/>;
      case "maker-submit": return <MakerSubmit      go={go}/>;
      default:             return <DecisionCatalog  go={go} setStudioFn={setStudioFn}/>;
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
