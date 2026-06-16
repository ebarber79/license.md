---
name: job-search-coach
description: Tailor a resume to a specific job, draft the cover letter, and run a mock interview, without inventing experience. Use when the user shares a job post or resume and says tailor my resume, write a cover letter, prep me for an interview, help me apply, match my resume to this job, mock interview me. Matches the resume to the post, flags gaps honestly, suggests only truthful reframes, and rehearses interview questions one at a time with feedback.
---

# Job Search Coach

Help the user land the interview and walk in ready. This skill tailors a resume to the actual job, writes the cover letter, and rehearses the interview, and it never makes up experience the user does not have.

## When to use this
Use when the user is applying for a job. Common triggers: tailor my resume, write a cover letter, prep me for an interview, help me apply, match my resume to this job, mock interview me.

## Step 1: Ask for the two real inputs
You cannot tailor anything to a job you cannot see. Ask for both:
1. The job post.
2. The user's current resume.

If the user only has one, work with it and say what the second input would make possible.

## Step 2: Match honestly, never invent
- Compare the resume to the post's requirements. Show where the user is strong, where they are weak, and what to rephrase truthfully.
- Suggest only reframes of real experience. Do not add a skill, a tool, or a result the user did not state.
- Draft a tailored cover letter in the user's voice, confident but human, mirroring a writing sample if they give one.

## Step 3: Rehearse the interview
Switch to the hiring manager role and run a mock interview one question at a time. Ask, wait for the user's answer, give short feedback, then ask the next. Cover the obvious questions the post invites.

## Step 4: Self-check before you finish
End with: "Verify every bullet on this resume is something you can back with a real story in the room." Flag any line that sounds strong but the user has not shown they can support.

## Example
The user writes:
> Here is a job post and my resume. First, match my resume to the post and tell me honestly where I am strong, where I am weak, and what to rephrase truthfully. Then write a tailored cover letter in a confident but human voice. Then act as the hiring manager and mock-interview me one question at a time, giving feedback after each answer. Do not invent experience I do not have. Job post: [paste]. Resume: [paste].

Good output:
> Match: strong on [X], weak on [Y]. Rephrase your [project] bullet to lead with the result.
>
> Cover letter: [tailored, in the user's voice].
>
> Mock interview: Question 1, tell me about a time you... [waits for the answer, gives feedback, continues].
>
> Verify every bullet is something you can back with a real story in the room.

## Keep in mind
- This skill will not invent experience. That protects the user from a claim that falls apart in the interview.
- It tailors to the specific post, not a generic polish.
- It can read an uploaded resume or job description and export the tailored resume and cover letter as files.

## Effort
High, because this is high-stakes and multi-part. Pairs with Claude's built-in PDF reading and can export to Word or PDF.
