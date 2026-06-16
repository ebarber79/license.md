---
name: summarize-anything
description: Summarize any long PDF, article, email thread, transcript, or report into the key point plus what to do about it. Use when the user pastes or attaches something long and wants the gist, a TLDR, key bullets, takeaways, or action items, or says summarize this, TLDR, key points, what does this say, too long, give me the gist. Asks what they need it for and how long, pulls the most important passages first, and flags anything it could not confirm.
---

# Summarize Anything

Turn something long into the point plus what to do about it. This skill reads what the user gives it and does not pad or invent.

## When to use this
Use when the user pastes or attaches something long: a PDF, an article, an email thread, a meeting transcript, a report. Common triggers: summarize this, TLDR, key points, what does this say, too long to read, give me the gist, what should I take from this.

## Step 1: Ask before you summarize
Ask two short questions first. Skip any the user already answered.
1. What do you need this for? (make a decision, write a reply, brief someone, just understand it)
2. How long should the summary be? (one line, a short list, a half page)

If the user just says summarize it, give a one-line takeaway, five key points, and three actions, and keep going.

## Step 2: Find what matters before you summarize
- Put the source at the top of your reading and the user's goal at the bottom, then pull the three to five passages that matter most before writing anything.
- Summarize for the user's purpose. A summary to decide is different from a summary to reply.
- Do not drop the one detail that changes the meaning just to make it shorter.

## Step 3: Give it in tiers
Return the summary in this shape so the user can stop at any level:
1. One-line takeaway.
2. Three to five key points.
3. What to do next (the concrete actions).

## Step 4: Self-check before you finish
Note anything in the source that was unclear, and any figure or quote you could not confirm. End with: "Verify the numbers and any quote against the original before you forward this."

## Example
The user pastes or attaches a long document and writes:
> Here is a long document. First pull the five passages that matter most, then give me a one-line summary, five key bullets, and three concrete actions I should take. Tell me if anything important is unclear or missing.

Good output:
> Takeaway: The contract renews automatically unless you cancel 60 days before the end date.
>
> Key points: [five tight bullets].
>
> Do next: 1) Mark the cancellation deadline. 2) Confirm the renewal price in writing. 3) Ask about the early-exit clause.
>
> Verify the dates and the renewal figure against the original before you forward this.

## Keep in mind
- For a long document, the user should paste or attach it before the question, so nothing gets cut from memory.
- This skill will flag numbers and quotes to check rather than presenting them as certain.
- For anything that drives a real decision, treat the summary as a map, not the territory, and confirm the key facts.

## Effort
Medium is right for most things, raise to high for a dense or very long document. Pairs with Claude's built-in PDF reading, and can export the brief as a Word or PDF file on request.
