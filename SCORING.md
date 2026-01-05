Claude Task Prompt: PPG Scoring & Heat Bar Math

You are a senior software engineer and applied data modeller.

Your task is to convert the existing paramotor (PPG) weather thresholds into a formal, weighted scoring system and to define the exact colour interpolation math for the heat bars used in the UI.

You must strictly follow the project specification and safety thresholds already defined.
Do not invent new weather thresholds or reinterpret safety limits.

1️⃣ Scoring Function Requirements

Design a deterministic hourly suitability scoring function that outputs a value from 0 to 100 for each hour between sunrise and sunset.

Inputs (per hour)
* Wind speed (km/h)
* Gust speed (km/h)
* Gust spread = gust − wind (km/h)
* Rain (mm/hr)

Mandatory Rules
* Any hour with rain > 0.5 mm/hr must score 0
* Any hour with wind ≥ 25 km/h must score 0
* Any hour with gust ≥ 29 km/h must score 0
* Any hour with gust spread ≥ 11 km/h must score ≤ 20

2️⃣ Weighted Component Scoring

Break the score into independent components, each normalised to 0–100:
* Wind speed score
* Gust score
* Gust spread (turbulence) score
* Rain score

Define:
* Exact mathematical functions (piecewise or linear)
* Explicit inflection points using the known thresholds

Required Weighting

Provide a final weighted score using:
* Wind speed: 40%
* Gust speed: 30%
* Gust spread: 20%
* Rain: 10%

The final score must be:
* final_score = sum(component_score × weight)

Clamp the output strictly to 0–100.

3️⃣ Colour Mapping Rules (Heat Bars)

Define exact colour interpolation math to convert the final score into a heat bar colour.

Required Colour Stops
Score	Colour
0	#B00020 (deep red)
25	#E53935 (red)
50	#FDD835 (yellow)
75	#43A047 (green)
100	#1B5E20 (deep green)

Requirements
* Use linear interpolation in RGB or HSL space (state which one)
* Provide the interpolation formula
* Provide a reusable function signature (TypeScript-style preferred)

4️⃣ Output Format

Your response must include:
1. A clear explanation of the scoring logic
2. Mathematical definitions (formulas or piecewise functions)
3. A TypeScript-style pseudocode implementation:
    function calculateHourlyPPGScore(input): number
    function scoreToHeatColor(score: number): string
4. One worked example using realistic weather values

5️⃣ Safety & Discipline Rules
* Never soften unsafe conditions
* Never “average away” rain or gusts
* Prefer conservative scoring over optimistic scoring
* If a condition is unsafe, the score must clearly reflect it

Treat this as aviation-safety-critical logic.
Precision, determinism, and clarity are mandatory.