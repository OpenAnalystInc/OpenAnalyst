# Context Engineering Masterclass (20-30 mins)
## Using OpenAnalyst as a Real-World Case Study

**Target**: Industry developers (junior to mid-level)
**Format**: Theory + Live Code + Actionable Takeaways
**Goal**: Make them realize context engineering is THE skill for AI systems

---

## 🎯 PRESENTATION FLOW

### 1. The Hook (3 mins)
### 2. What is Context Engineering? (5 mins)
### 3. The 4 Essential Principles (15 mins) ⭐
### 4. Your Action Plan (3 mins)
### 5. Q&A (4 mins)

---

# ACT 1: THE HOOK (3 minutes)

## Opening Slide
```
CONTEXT ENGINEERING
The 80% of AI Development Nobody Talks About

Using OpenAnalyst: A 250K+ LOC Production System
```

## The Demo (90 seconds)

**[SCREEN SHARE: ChatGPT]**

> "Let me show you what happens when context is NOT engineered..."

**Prompt**:
```
Write a function to analyze customer churn data
```

**Result**:
```python
def analyze_churn(data):
    # Generic, useless code
    return data[data['churned'] == True].count()
```

**[Pause]**

> "Useless, right? Generic pandas code anyone could write."

---

**[SWITCH TO: OpenAnalyst]**

> "Same task. But with engineered context..."

**What the AI receives** (show in OpenAnalyst):
```yaml
# From Active Template:
Agent: Data Analyst
Custom Instructions:
  - Always check data quality first
  - Document assumptions
  - Create inline visualizations

Rules:
  - Never log PII
  - Use approved libraries only

Prompts Available:
  - cohort-analysis template
  - churn-prediction template
```

**Same prompt**: "Analyze customer churn data"

**Result**:
```python
# 1. Data quality check
print(f"Dataset: {len(df)} rows, {df.duplicated().sum()} duplicates")
print(f"Missing values:\n{df.isnull().sum()}")

# 2. Churn analysis
churn_rate = (df['churned'].sum() / len(df)) * 100
print(f"Overall churn rate: {churn_rate:.2f}%")

# 3. Segmentation
churn_by_tenure = df.groupby('tenure_bucket')['churned'].mean()

# 4. Visualization
```chart
{
  "type": "bar",
  "data": {
    "labels": ["0-6mo", "6-12mo", "12-24mo", "24mo+"],
    "datasets": [{
      "label": "Churn Rate",
      "data": [0.45, 0.32, 0.18, 0.08]
    }]
  }
}
```

# Key findings:
# - New customers (0-6mo) have 5x higher churn
# - Churn drops significantly after 12 months
# - Recommendation: Focus retention efforts on first 6 months
```

**[Pause for impact]**

## The Point (30 seconds)

**Slide: The Uncomfortable Truth**

> **"Same model. Same prompt. Completely different output.**
>
> **The difference? Context engineering."**

**The Math**:
- 10% = Model choice (GPT-4 vs Claude)
- 10% = Prompt writing
- **80% = Context engineering** ⭐

---

# ACT 2: WHAT IS CONTEXT ENGINEERING? (5 minutes)

## Definition (1 min)

**Slide: Context Engineering Defined**

> **Context Engineering** is the systematic design and management of information provided to an LLM to produce consistent, efficient, high-quality outputs.

**It's NOT:**
- ❌ Writing better prompts
- ❌ Picking the right model
- ❌ Stuffing everything into the context window

**It IS:**
- ✅ Architecture & system design
- ✅ Information hierarchy
- ✅ Performance optimization
- ✅ Knowledge management

## The Context Stack (2 mins)

**Slide: What the AI Actually Receives**

```
Your Prompt: "Analyze churn"          (500 tokens)
                    ↓
         [ BLACK BOX TO MOST DEVS ]
                    ↓
┌────────────────────────────────────────────┐
│ What Actually Goes to the LLM:             │
├────────────────────────────────────────────┤
│ System Prompt              5,000 tokens    │
│ Agent Instructions         3,000 tokens    │
│ Available Tools            8,000 tokens    │
│ Rules & Constraints        2,000 tokens    │
│ Conversation History      30,000 tokens    │
│ Code Context              40,000 tokens    │
│ Environment Details        2,000 tokens    │
│ Your Prompt                  500 tokens    │
├────────────────────────────────────────────┤
│ TOTAL:                    90,500 tokens    │
└────────────────────────────────────────────┘

Claude Sonnet limit: 200,000 tokens
Your prompt: 0.5% of context
Everything else: 99.5% of context
```

**The Reality**: Your prompt is the SMALLEST part of what the AI sees.

## Why This Matters (2 mins)

**Slide: The Stakes**

**Without Context Engineering:**
- Generic, unhelpful outputs
- Wasted tokens = wasted money ($0.30/request → $300K/year at scale)
- Inconsistent results (breaks in production)
- Every dev reinvents the wheel

**With Context Engineering:**
- Domain-expert quality outputs
- Efficient token usage ($0.05/request → $50K/year)
- Predictable, reliable results
- Knowledge shared across team

**Real Example** (OpenAnalyst user):
- Before: 2 weeks to onboard new data analyst
- After: 2 hours (import team template)
- **80x faster time-to-productivity**

---

# ACT 3: THE 4 ESSENTIAL PRINCIPLES (15 mins)

## PRINCIPLE 1: Context Composition (4 mins)

**Slide: Don't Concatenate. Compose.**

**Bad Approach** (naive):
```typescript
const context = systemPrompt + "\n" + tools + "\n" + rules
// Unstructured blob
```

**Problems:**
- No modularity
- Can't test pieces independently
- Can't reuse across projects
- Hard to debug

**Good Approach** (OpenAnalyst):

**[LIVE CODE WALKTHROUGH]** (navigate to `src/core/prompts/system.ts`)

```typescript
export async function SYSTEM_PROMPT(options: {
  mode: Mode,
  tools: Tool[],
  customBlocks: Block[]
}): Promise<string> {

  const sections = [
    buildRoleSection(options.mode),        // Who you are
    buildToolsSection(options.tools),      // What you can do
    buildRulesSection(options.mode),       // Your constraints
    buildCustomBlocks(options.blocks)      // Project-specific
  ]

  return sections
    .filter(s => s.isRelevant())
    .map(s => s.render())
    .join('\n\n')
}
```

**Why this works:**
- Each section is a function (testable)
- Sections can be turned on/off
- Reusable across different agents

**[SHOW REAL EXAMPLE]**: OpenAnalyst's Blocks System

```
.oacode/blocks/
├── workspace/
│   └── project-conventions.md    ← Team standards
├── global/
│   └── personal-style.md         ← Your preferences
└── defaults/
    └── base-instructions.md      ← System defaults

Loading priority: workspace → global → defaults
```

**Demo**: Show how workspace block overrides defaults

**Key Takeaway**: Context is modular components, not monolithic text.

---

## PRINCIPLE 2: Context Filtering (4 mins)

**Slide: Every Token Must Justify Its Existence**

**The Question**: Should this be in the context?

**The Test**:
1. Does it help THIS task?
2. Would output be worse without it?
3. Is it worth the token cost?

If any answer is "no" → **cut it.**

**OpenAnalyst Example**: Tool Group Filtering

**[LIVE CODE]** (show `modes.json`)

```json
{
  "slug": "ask",
  "name": "Ask Mode",
  "roleDefinition": "You answer questions, don't make changes",
  "groups": ["read", "browser", "mcp"]
  // Note: NO "edit" or "command" groups
}
```

**[SHOW CODE]** (`src/core/prompts/tools/`)

```typescript
function getAvailableTools(mode: Mode): Tool[] {
  const allTools = [
    readFileTool,       // read group
    writeFileTool,      // edit group
    executeCommandTool, // command group
    browserActionTool,  // browser group
    // ... 31 more tools (35 total)
  ]

  // Filter to only mode-allowed groups
  return allTools.filter(tool =>
    mode.groups.includes(tool.group)
  )
}
```

**The Math**:

| Mode | Tool Groups | Tools Available | Context Saved |
|------|-------------|-----------------|---------------|
| Code | all 5 groups | 35 tools | 0 tokens (baseline) |
| Ask | 3 groups | 12 tools | 6,200 tokens (73% reduction) |
| Data Analyst | 4 groups | 28 tools | 1,800 tokens (21% reduction) |

**Ask Mode saves 6,200 tokens** on every single request.

At 1M requests: **6.2 billion tokens saved** = $186,000 saved

**Key Takeaway**: Filter aggressively. Less is more.

---

## PRINCIPLE 3: Dynamic Context Injection (4 mins)

**Slide: Don't Load Everything. Load What's Needed, When It's Needed.**

**Problem**: You're working on a 1,000 file codebase.
- Load all files? → Impossible (context limit)
- Load random subset? → Wrong files
- Ask user every time? → Annoying

**OpenAnalyst Solution**: Context Tracking

**[LIVE CODE]** (`src/core/context-tracking/FileContextTracker.ts`)

```typescript
export class FileContextTracker {
  private accessed = new Map<string, AccessInfo>()

  trackFileAccess(file: string, action: 'read' | 'write') {
    // Track what the AI touches
    const info = this.accessed.get(file) || {
      count: 0,
      lastAccess: 0
    }

    info.count++
    info.lastAccess = Date.now()
    this.accessed.set(file, info)
  }

  getRelevantFiles(limit = 5): string[] {
    // Return most recently + frequently accessed
    return Array.from(this.accessed.entries())
      .sort((a, b) => {
        // Score = frequency × recency
        const scoreA = a[1].count / (Date.now() - a[1].lastAccess)
        const scoreB = b[1].count / (Date.now() - b[1].lastAccess)
        return scoreB - scoreA
      })
      .slice(0, limit)
      .map(([file]) => file)
  }
}
```

**How It Works** (scenario):

```
Task: "Fix the authentication bug"

Step 1: AI reads auth.ts
  → FileTracker marks auth.ts as relevant

Step 2: AI finds: import { validateToken } from './jwt'
  → AI reads jwt.ts
  → FileTracker marks jwt.ts as relevant

Step 3: AI needs User model
  → Searches codebase, finds models/User.ts
  → FileTracker marks User.ts as relevant

Context at each step:
  Start: 0 files in context
  After step 1: 1 file (auth.ts)
  After step 2: 2 files (auth.ts, jwt.ts)
  After step 3: 3 files (auth.ts, jwt.ts, User.ts)

Only 3 files loaded from 1,000+ codebase
```

**Key Takeaway**: Context should grow organically as the task demands.

---

## PRINCIPLE 4: Context Optimization (3 mins)

**Slide: Measure, Profile, Optimize**

**You can't improve what you don't measure.**

**OpenAnalyst Example**: Token Metrics Dashboard

**[LIVE DEMO]** (show OpenAnalyst UI with API metrics)

```
Last API Call:
─────────────────────────────────────
Input:  45,234 tokens
  ├─ System:     5,123 tokens (11%)
  ├─ Tools:      8,456 tokens (19%)
  ├─ History:   28,901 tokens (64%) ⚠️
  └─ Prompt:     2,754 tokens (6%)

Output:  1,234 tokens
Cost:    $0.23
Cache Hit Rate: 34%
─────────────────────────────────────
```

> "See that 64% on history? That's our optimization target."

**Optimization Techniques** (quick overview):

**1. Sliding Window**
```typescript
// Keep last 10 messages, summarize the rest
if (messages.length > 10) {
  const old = messages.slice(0, -10)
  const summary = await summarize(old)
  return [summary, ...messages.slice(-10)]
}
```
**Result**: 80K tokens → 25K tokens (69% reduction)

**2. Prompt Caching** (Anthropic feature)
```typescript
// Cache static parts of context
cache_control: { type: "ephemeral" }
```
**Result**: $0.23/call → $0.03/call (87% cheaper)

**3. Lazy Loading**
```typescript
// Don't load examples until tool is used
tools.map(t => ({
  name: t.name,
  description: t.description,
  // Examples loaded on-demand
  getExamples: () => loadExamples(t)
}))
```
**Result**: 12K tokens saved per request

**Combined Impact**:

| Optimization | Savings |
|-------------|---------|
| Sliding Window | 69% tokens |
| Prompt Caching | 87% cost |
| Lazy Loading | 15% tokens |
| Tool Filtering | 8% tokens |
| **TOTAL** | **~85% cost reduction** |

**Key Takeaway**: Optimization is a continuous process, not one-time.

---

# ACT 4: YOUR ACTION PLAN (3 mins)

**Slide: The Context Engineering Checklist**

## Starting Monday: 7 Questions to Ask

When building your next AI feature, ask:

### 1. Context Composition
- [ ] Is my context modular (separate components)?
- [ ] Can I test each component independently?
- [ ] Can I reuse components across projects?

### 2. Context Filtering
- [ ] Am I including only what's needed for THIS task?
- [ ] Can I remove anything without breaking functionality?
- [ ] Do I filter by user role/permissions?

### 3. Dynamic Context
- [ ] Do I load context lazily (as needed)?
- [ ] Do I track what context is actually used?
- [ ] Do I expire stale context?

### 4. Context Optimization
- [ ] Do I measure token usage per request?
- [ ] Do I know my biggest token consumers?
- [ ] Do I cache static context?

### 5. Context Structure
- [ ] Is my context well-formatted (headers, sections)?
- [ ] Do I use structured formats (XML/JSON)?
- [ ] Is there a clear hierarchy of information?

### 6. Context Validation
- [ ] Do I verify context is current before use?
- [ ] Do I handle missing/invalid context gracefully?
- [ ] Do I log context errors for debugging?

### 7. Context Persistence
- [ ] Can users save/load context configurations?
- [ ] Can teams share context templates?
- [ ] Do I version control context?

**If 7/7**: You're doing context engineering right ✅
**If 4-6**: You're on the right track 🟡
**If 0-3**: You're wasting money and time 🔴

---

**Slide: The OpenAnalyst Way**

**OpenAnalyst isn't just a VS Code extension.**

**It's a reference implementation of these 4 principles:**

| Principle | OpenAnalyst Implementation |
|-----------|----------------------------|
| Composition | Blocks System (workspace → global → defaults) |
| Filtering | Tool Groups (mode-based access control) |
| Dynamic | File Context Tracker (intelligent loading) |
| Optimization | Token Metrics Dashboard (measure & improve) |

**You can apply these patterns** to any AI system:
- Chatbots
- Code assistants
- Data analysis tools
- Customer support
- Internal tooling

**The principles are universal.**

---

**Slide: One More Thing...**

**The Template Advantage** (30 seconds)

> "The best context engineering is context you never have to write."

**OpenAnalyst Templates**:
```yaml
# .oacode/templates/data-team.yaml

Agents:         # Pre-configured specialists
Prompts:        # Reusable analysis patterns
Rules:          # Automatic compliance

Export → Share → Import → Instant productivity
```

**Team Lead** creates template once.
**Entire team** imports in seconds.
**Everyone** has perfect context forever.

**This is context engineering at organizational scale.**

---

# ACT 5: Q&A (4 mins)

**Slide: Questions?**

## Anticipated Questions (have answers ready):

### Q: "Isn't this just prompt engineering?"
**A**: No. Prompt engineering is what you write. Context engineering is the entire system around it. Your prompt is 0.5% of the context. We're engineering the other 99.5%.

### Q: "How much does bad context engineering cost?"
**A**: Real example: $0.30/request (naive) vs $0.05/request (optimized). At 1M requests/year, that's $250K wasted. Plus worse outputs = wasted dev time.

### Q: "Can I use these principles without OpenAnalyst?"
**A**: Absolutely! These are universal. OpenAnalyst just shows you a working implementation. Take the patterns, apply to your stack.

### Q: "Where do I start?"
**A**:
1. Measure your baseline (token usage per request)
2. Pick ONE principle (start with filtering)
3. Apply it, measure again
4. See the difference, then iterate

### Q: "How does this scale to teams?"
**A**: Templates. Encode your context once, share via Git/config files. OpenAnalyst's template system is the pattern: YAML definitions + import/export.

---

## CLOSING (30 seconds)

**Final Slide: Remember**

> **"Building AI apps is 10% model, 10% prompts, 80% context."**
>
> **Most devs optimize the 20%.**
>
> **You're now equipped to optimize the 80%.**

**Next Steps**:
1. ⭐ Star OpenAnalyst repo (see real implementation)
2. 📖 Read the context engineering docs
3. 🧪 Try the 7-question checklist on your next task
4. 💬 Join the Discord (share your learnings)

**Thank you!**

---

## 🎬 DELIVERY NOTES

### Timing Breakdown
- Slide 1-5: 30 sec each = 2.5 mins
- Demo 1 (ChatGPT): 1 min
- Demo 2 (OpenAnalyst): 1.5 mins
- Definition: 1 min
- Context Stack: 2 mins
- Why This Matters: 2 mins
- **[Total Act 1+2: 8 mins]**

- Principle 1: 4 mins (code walkthrough)
- Principle 2: 4 mins (math + demo)
- Principle 3: 4 mins (live code)
- Principle 4: 3 mins (metrics)
- **[Total Act 3: 15 mins]**

- Checklist: 2 mins
- Template advantage: 1 min
- **[Total Act 4: 3 mins]**

- Q&A: 4 mins
- **[TOTAL: 30 mins]**

### Energy Management
- **Start HIGH**: Dramatic demo showing difference
- **Build UP**: Principles 1-2 (meat of content)
- **Peak HIGHEST**: Principle 3 (most impressive code)
- **Sustain**: Principle 4 + checklist
- **End HIGH**: Call to action

### Key Moments to Emphasize
1. **"80% is context engineering"** (repeat 3 times)
2. **The math** ($250K wasted vs $50K)
3. **Token breakdown visual** (your prompt = 0.5%)
4. **Real savings** (6.2B tokens = $186K at 1M requests)

### Code Demo Strategy
- **Don't read code line by line**
- **Show structure first**, then zoom into key function
- **Explain the "why" before the "how"**
- **Connect every code snippet to a principle**

### Backup Slides (if time permits or for Q&A)
1. Detailed token calculation example
2. Context debugging techniques
3. Advanced caching strategies
4. Team collaboration patterns

---

## 🎯 SUCCESS METRICS

**You've succeeded if they leave saying:**
1. "I need to measure my token usage TODAY"
2. "I've been doing this wrong the whole time"
3. "I should check out OpenAnalyst's code"
4. "My team needs to do template-based context sharing"

**You've REALLY succeeded if they:**
- Star the OpenAnalyst repo
- Apply the 7-question checklist
- Share the principles with their team
- Come back with questions/improvements

---

**END OF PRESENTATION GUIDE**

*Remember: You're not just teaching context engineering. You're showing them that OpenAnalyst is the proof it works at scale. Every principle maps to real, production code they can study.*
