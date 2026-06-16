---
name: plan-my-life
description: Turn goals and constraints into a concrete, realistic plan for a week, a trip, meals, or an event, plus the supporting list. Use when the user wants to plan something and says plan my week, plan a trip, meal plan, help me organize this event, make me a schedule, plan my workouts. Asks the goal, the hard constraints, and what already exists, starts from what the user has rather than inventing from scratch, and flags where the plan is tight.
---

# Plan My Life

Turn a goal plus real constraints into a plan the user can actually follow. This skill builds around the user's real life instead of an ideal one that falls apart on day one.

## When to use this
Use when the user wants a concrete plan: a week, a trip, meals, a workout block, an event. Common triggers: plan my week, plan a trip, meal plan, help me organize this event, make me a schedule, plan my workouts.

## Step 1: Ask before you plan
Ask three or four short questions. Skip any the user already answered.
1. What is the goal?
2. What are the hard constraints? (time, budget, dates, anything fixed)
3. What already exists to work with? (what is in the fridge, commitments already on the calendar)
4. Any strong preferences or things to avoid?

## Step 2: Build from what they already have
- Start from the user's real materials and constraints, do not generate an ideal plan from scratch.
- Lay out a concrete plan with realistic timing: day by day, or step by step.
- Keep it honest about effort. A plan the user cannot keep is not a plan.

## Step 3: Add the supporting piece
Most plans need one practical artifact: a grocery list for only the missing items, a packing list, a checklist, a simple budget. Include it.

## Step 4: Self-check before you finish
Point out where the plan is tight or where a constraint might break it. End with: "Verify the plan against your real calendar and budget before you commit to it."

## Example
The user writes:
> Plan five weeknight dinners using mostly what is already in my fridge, then give me a short grocery list for only the missing items. Keep each dinner under 30 minutes and assume two people. Tell me which night is the riskiest if I run short on time. In my fridge: eggs, spinach, half an onion, chicken thighs, rice, cheddar, two tomatoes, tortillas, yogurt.

Good output:
> Mon: chicken and rice bowl. Tue: spinach and cheese omelette. Wed: chicken tortilla wraps. Thu: tomato and egg fried rice. Fri: quesadillas.
>
> Grocery list (only what is missing): bell pepper, salsa, garlic, a second onion.
>
> Riskiest night: Wednesday, since wraps need the chicken prepped ahead. Cook extra chicken Monday.
>
> Verify the plan against your real week before you commit to it.

## Keep in mind
- This skill starts from what the user already has, which is what keeps the plan realistic.
- It flags the weak point in the plan instead of pretending every day is easy.
- It can export the plan, itinerary, or budget as a file on request.

## Effort
Medium, low is fine for a simple single-day list. Pairs with Claude's built-in Excel or PDF handling to export a planner, itinerary, or budget.
