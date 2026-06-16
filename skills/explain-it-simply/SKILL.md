---
name: explain-it-simply
description: Explain any topic, term, or document in plain language at the user's level, then check they actually understood it. Use when the user wants something made clear and says explain this, what is X, ELI5, I do not understand, break this down, teach me, help me get this. Asks their current level and why they need it, uses one everyday analogy and one real example, quizzes them to confirm understanding, and flags anything it simplified that has important exceptions.
---

# Explain It Simply

Help the user understand any topic, term, or document like it was finally explained right, and confirm they got it. This skill teaches, then checks, instead of dumping a wall of text.

## When to use this
Use when the user wants to understand something: a concept, a piece of jargon, a clause in a document, a news topic. Common triggers: explain this, what is X, ELI5, I do not understand, break this down, teach me, what does this mean.

## Step 1: Ask before you explain
Ask two short questions first. Skip any the user already answered.
1. What is your starting point? (total beginner, or you know a little)
2. Why do you need it? (a decision, an exam, work, plain curiosity)

If the user just says explain it, assume a smart beginner and explain at that level.

## Step 2: Explain at their level
- Set a tutor role and a target level, for example explain to a smart 15-year-old.
- Lead with one everyday analogy, then one real example with concrete details or numbers.
- Use plain words. When a technical term is unavoidable, define it in the same sentence.

## Step 3: Check they understood
This is the part most explanations skip. After explaining, ask the user two or three short questions, wait for their answers, then tell them what they got right and gently correct the rest.

## Step 4: Self-check before you finish
Flag where you simplified something that has important exceptions in real life. End with: "For anything that affects money, health, or law, verify this with an official source or a professional."

## Example
The user writes:
> Explain what an APR is like I am 15, using one everyday analogy and one real example with numbers. Then quiz me with three short questions, wait for my answers, and tell me what I got right or wrong. At the end, flag anything you simplified that I should know is more complicated in real life.

Good output:
> Analogy: APR is the yearly price tag on borrowing money, like a rental fee for cash.
>
> Example: Borrow 1,000 dollars at 20 percent APR for a year and the borrowing costs about 200 dollars.
>
> Quick check: 1) In one line, what does APR measure? 2) If two cards offer the same thing, is a lower or higher APR better for you? 3) ...
>
> [waits for answers, then corrects] At the end: I simplified how interest compounds. Verify exact costs with the lender for anything that affects your money.

## Keep in mind
- This skill can explain an uploaded document section by section, not just a single term.
- It will tell the user when it simplified something rather than pretend the simple version is the whole truth.
- For high-stakes topics, it points the user to an official source or a professional.

## Effort
Medium for everyday topics, raise to high for technical, medical, or legal subjects. Pairs with Claude's built-in PDF reading when explaining a document.
