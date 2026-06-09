# System Vision

**Purpose**: Align the human's mental model of the system with what the code actually does. Discrepancies between the two are the most valuable output of this document — they reveal hallucinations, stale assumptions, and hidden risk before agents act on them.

**How this document is produced**:
1. Agent interviews the human (questions below) — record their answers verbatim
2. Agent audits the codebase to verify each answer
3. Discrepancies are flagged explicitly in the Reconciliation section
4. Human reviews and confirms or corrects

**Rule**: No agent writes production code until VISION.md has a completed Reconciliation section signed off by the human.

---

## Part 1 — Human Interview

Ask the human each question. Record their answer exactly as given. Do not paraphrase or interpret yet — that happens in Part 3.

### Q1: How many distinct systems make up this project?
> *Human answer*: 

### Q2: Where does each system run? (device, browser, cloud server, local network, embedded hardware, etc.)
> *Human answer*: 

### Q3: Who uses each system? (end users, operators, admins, automated processes)
> *Human answer*: 

### Q4: How do the systems communicate with each other? (REST, shared database, events, file system, message queue, etc.)
> *Human answer*: 

### Q5: What are the hard constraints — things that must never be violated, no matter what?
> *Human answer*: 

### Q6: What would I get wrong if I assumed this was a typical [framework] project?
> *Human answer*: 

### Q7: Is there anything about this system that has surprised past developers or caused unexpected bugs?
> *Human answer*: 

### Q8: What does the system currently do well? What is broken or incomplete?
> *Human answer*: 

---

## Part 2 — Codebase Verification

For each human answer above, what does the code actually show? Run the codebase audit (see BROWNFIELD_BOOTSTRAP.md Step 3) and record findings here.

### System count and topology (Q1/Q2)
> *Code says*: 

### Users and entry points (Q3)
> *Code says*: 

### Integration points (Q4)
> *Code says*: 

### Hard constraints in code (Q5)
> *Code says* (enforced): 
> *Code says* (not enforced / unenforced assumption): 

### Framework-specific surprises (Q6)
> *Code says*: 

### Known bugs / stubs in code (Q8)
> *Code says* (confirmed working): 
> *Code says* (confirmed broken or stub): 

---

## Part 3 — Reconciliation

**This is the most important section.** Where does the human's mental model differ from the code?

| # | Human believes | Code shows | Type | Action |
|---|---|---|---|---|
| 1 | | | | |

**Type key**:
- `Aligned` — human and code agree
- `Human ahead` — human knows something not yet in code (planned feature, planned constraint)
- `Code ahead` — code does something the human didn't mention (undocumented behaviour)
- `Conflict` — human belief directly contradicts code (highest risk — resolve before any work)

**Action key**:
- `None` — no action needed
- `Update DECISIONS.md` — this should be a recorded decision
- `Update BACKLOG.md` — this gap should be a task
- `Fix code` — code contradicts an established constraint
- `Clarify with human` — ambiguous, needs follow-up

---

## Part 4 — Confirmed System Topology

*(Fill this after reconciliation is complete and human has reviewed.)*

**Systems**:
- **[System name]**: [What it is, where it runs, who uses it]

**This system is NOT**:
- [Common misconception — write what agents would assume wrong]

**Integration contracts**:

| From | To | Method | Auth | Notes |
|---|---|---|---|---|
| | | | | |

**Deployment targets**:

| System | Dev | Production |
|---|---|---|
| | | |

**Hard constraints** (confirmed enforced in code):
- 

**Hard constraints** (human-stated but not yet enforced in code — see BACKLOG):
- 

---

## Sign-off

Human reviewed reconciliation: [ ] Yes — proceed | [ ] No — corrections needed

Corrections: 

Date: 

<!--
INSTRUCTIONS:

Run the interview first. Do not read the codebase before completing Part 1.
Your job in the interview is to listen, not to correct — capture what the human believes.
Then audit the code. Then compare. The gaps are what matter.

A conflict row in Part 3 is not a problem — it is the system doing its job.
Surface every conflict, no matter how small. Unresolved conflicts become Stop Reports later.

Keep Part 4 under 60 lines. It is the distilled truth, not the full audit.

Part 3 rows can also come from external reviews (see workflows/external-review-intake.md) — but only
before this document is signed off. After sign-off, topology corrections from external reviews become
DECISIONS.md entries (status: Needs Human), not new reconciliation rows.
-->
