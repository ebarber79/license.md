---
name: notes-to-action-plan
description: Turn a brain-dump or messy meeting notes into a clear plan with tasks, owners, due dates, and next steps. Use when the user pastes raw notes and wants them organized, or says organize these notes, action items, who does what, turn this into tasks, make a plan from this, what are my next steps. Marks gaps instead of inventing owners or dates, and ends with the top three things to do first.
---

# Notes to Action Plan

Turn a brain-dump or messy meeting notes into a who-does-what-by-when the user can act on. This skill organizes what is there and refuses to invent the parts that are missing.

## When to use this
Use when the user pastes raw notes and wants a real plan, not a tidier list. Common triggers: organize these notes, action items, who does what, turn this into tasks, make a plan from this, what are my next steps.

## Step 1: Ask before you organize
Ask two short questions first. Skip any the user already answered.
1. Is this just for you, or a team? (so owners make sense)
2. Is there a deadline the whole plan hangs off?

If the user just says organize this, build the plan for a single person with no fixed deadline and note where one is needed.

## Step 2: Turn notes into a plan, do not just tidy them
- Read the pasted notes as the input to transform.
- Pull out the real tasks. For each, capture who owns it, when it is due, and how urgent it is.
- Where the notes do not say who owns something or when it is due, mark it as a gap. Do not invent an owner or a date.

## Step 3: Lay it out so it is usable
Return a table with columns: Task, Owner, Due, Priority. Below the table, list the open questions and anything missing an owner or a date. Then give the top three things to do first.

## Step 4: Self-check before you finish
End with: "Verify the owners and dates with the people involved before treating this as final." Call out any task where the owner or date was your best guess.

## Example
The user writes:
> Turn these messy meeting notes into a who-does-what-by-when. Give me a table with Task, Owner, Due date, and Priority, then list anything that is unclear or missing an owner instead of guessing. End with the top three things to do first. Notes: "talked about launch, Sam will do the landing page maybe by next week, need pricing decided, someone has to email the list, design not done, Priya mentioned legal review, push date if not ready."

Good output:
> | Task | Owner | Due | Priority |
> | Landing page | Sam | Next week (confirm) | High |
> | Decide pricing | Unassigned | Before launch | High |
> | Email the list | Unassigned | Before launch | Medium |
> ...
>
> Gaps: pricing has no owner. The list email has no owner. Launch date depends on design and legal, both unconfirmed.
>
> Do first: 1) Assign pricing. 2) Confirm Sam's landing-page date. 3) Decide the launch date with design and legal.
>
> Verify the owners and dates with the people involved before treating this as final.

## Keep in mind
- This skill marks gaps instead of guessing, which is what makes the plan safe to act on.
- It can export the action table as a tracker on request.
- It organizes what the user gives it. If a whole topic is missing, it will say so rather than fill it in.

## Effort
Medium. Pairs with Claude's built-in Excel handling to export the plan as a tracker.
