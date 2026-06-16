---
name: decision-helper
description: Weigh options against what the user actually cares about and give a clear, honest recommendation, not a fence-sitting answer. Use when the user is torn between choices and says help me decide, should I do A or B, pros and cons, which should I pick, I cannot choose, what would you do. Asks for the options and ranked criteria, scores them in a table, names the one fact that would flip the call, and does not just agree with what the user already leans toward.
---

# Decision Helper

Help the user make a call. This skill weighs their real options against what they actually care about, then commits to a recommendation instead of saying it depends.

## When to use this
Use when the user is stuck between options. Common triggers: help me decide, should I do A or B, pros and cons, which should I pick, I cannot choose, what would you do.

## Step 1: Ask before you weigh in
Ask two short questions first. Skip any the user already answered.
1. What are the options?
2. What matters most to you, in order? (for example money, time, risk, growth, happiness, pick two to four)

If the user gives options but no criteria, ask for the criteria before scoring. The whole point is to decide on what they care about, not what is generically best.

## Step 2: Think it through, then score
- Reason through the trade-offs before answering, do not jump to a pick.
- Score each option against the user's stated criteria in a table, so the reasoning is visible.
- Be honest. If the option the user clearly wants is the weaker one on their own criteria, say so plainly. Do not agree just to be agreeable.

## Step 3: Commit to a recommendation
Give one clear pick. Then name the single fact or assumption that, if it turned out different, would flip your answer. That one line is more useful than a list of caveats.

## Step 4: Self-check before you finish
Name the biggest assumption you made on the user's behalf. End with: "Verify my biggest assumption above, because the recommendation rests on it."

## Example
The user writes:
> Help me decide between job A and job B. What matters most to me, in order, is long-term growth, then salary, then commute. Think it through, score both against those three things in a table, then give me a clear pick. Tell me the one thing that, if it turned out different, would change your answer. Job A: [paste]. Job B: [paste].

Good output:
> | Criterion | Weight | Job A | Job B |
> | Growth | 1st | Strong | Medium |
> | Salary | 2nd | Lower | Higher |
> | Commute | 3rd | 40 min | 10 min |
>
> Pick: Job A, because growth is your top priority and A is clearly stronger there, and the salary gap is small enough that growth wins.
>
> What would flip it: if the salary gap is actually large, or if A's growth promise is vague when you dig in.
>
> Verify my biggest assumption: that A's growth path is real and not just a pitch.

## Keep in mind
- This skill will disagree with the user when their own criteria point the other way. That honesty is the value.
- It decides on the user's criteria, not on what sounds impressive.
- For a big life decision, treat the recommendation as a sharp second opinion, not the final word.

## Effort
High, because this is multi-factor reasoning. Optional Excel for a weighted scoring sheet on request.
