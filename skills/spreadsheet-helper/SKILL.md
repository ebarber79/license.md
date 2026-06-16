---
name: spreadsheet-helper
description: Fix or build spreadsheet formulas and clean messy data, explained in plain English, for Excel or Google Sheets. Use when the user has a formula error or a data mess and says fix my formula, why does this not work, how do I, clean this data, Excel or Sheets help, what formula do I need. Asks what the formula should do and which tool, since their functions differ, states cleaning rules before applying them, and flags assumptions about the data.
---

# Spreadsheet Helper

Fix the formula, clean the data, and explain it in plain English. This skill helps the user who does not think of themselves as a spreadsheet person get a working sheet without guesswork.

## When to use this
Use when the user has a broken formula or messy data. Common triggers: fix my formula, why does this not work, how do I do X in a sheet, clean this data, Excel or Google Sheets help, what formula do I need.

## Step 1: Ask before you fix
Ask up to three short questions. Skip any the user already answered.
1. What should the formula do, in plain words?
2. Which columns or cells hold what? (a couple of sample rows helps)
3. Excel or Google Sheets? (their functions differ, so this matters)

## Step 2: Diagnose, then fix, then explain
- Have the user paste the formula and a few sample rows inside a clear block.
- Find what is actually wrong, give the corrected formula for their tool, and explain the fix in one plain sentence.
- For cleaning data, state the rules you will apply first (trim spaces, fix date formats, split a column) before doing it, so nothing changes silently.

## Step 3: Make it safe to use
Give the corrected formula ready to paste, and a one-line note on what to watch for, for example a column that must be sorted or a format that must match.

## Step 4: Self-check before you finish
End with: "Verify this formula on a copy of your sheet first, and check the date and number formats match." Flag any assumption you made about the data, such as the date format or the currency.

## Example
The user writes:
> This formula is giving me an error and I do not know why. Here is what I want it to do: add up column C only when column B says "Paid." Tell me what is wrong, give me the corrected formula for Google Sheets, and explain the fix in one plain sentence. Then here are five sample rows of my data, show me the cleaned version and list the rules you applied. Formula: =SUMIF(B:B,Paid,C:C). Rows: [paste].

Good output:
> What is wrong: Paid needs quotation marks, otherwise the sheet reads it as a named range, not the word.
>
> Fixed (Google Sheets): =SUMIF(B:B,"Paid",C:C)
>
> Why: the criterion is text, so it has to be in quotes.
>
> Cleaned rows + rules applied: trimmed spaces, standardized the date to YYYY-MM-DD.
>
> Verify this on a copy first, and check the date and number formats match.

## Keep in mind
- Excel and Google Sheets functions differ, so this skill asks which one before giving a formula.
- It states its cleaning rules before changing data, so nothing is altered behind the user's back.
- It can read an uploaded .xlsx, fix it, and return a working file with the formulas in place.

## Effort
Medium, raise to high for a multi-sheet model. Pairs with Claude's built-in Excel handling to read and return working files.
