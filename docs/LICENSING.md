# Copyright, AI, and commercial-use handling

Orchid culture and breeding knowledge comes from many sources — journals, books,
databases, encyclopedias, and personal experience — each with different rights. This
project is built so you can incorporate that knowledge **carefully**.

## Principles

1. **Store facts, not expression.** A `KnowledgeItem` (takeaway) is a *short, paraphrased
   factual point* plus a citation. Facts are not copyrightable; verbatim text is. Do not
   paste copyrighted passages into takeaways. An optional `shortQuote` field exists for a
   brief quotation and must be marked `fairUseFlag`.
2. **Every source carries explicit rights.** Each `Source` has:
   - `license` (e.g. `CC-BY-4.0`, `PUBLIC_DOMAIN`, `USER_OWNED`, `ALL_RIGHTS_RESERVED`),
   - `aiUseAllowed` — may its derived takeaways be sent to an LLM?
   - `redistributionAllowed`, `commercialUseAllowed`.
   Set these deliberately when you add a source.
3. **One gate controls AI exposure.** `packages/ai/licensing-gate.ts` decides eligibility:
   - a takeaway with **no** linked sources is eligible only if it is **user-authored**
     (your own observation/paraphrase);
   - a takeaway **with** sources is eligible only if **every** linked source is
     `aiUseAllowed`. One restrictive source blocks it.
   Ineligible takeaways are still fully used by the deterministic engine and shown in the
   UI — they are simply never placed in a prompt.
4. **Respect terms of use.** DontCrossMe does **not** scrape sites whose terms forbid it
   (e.g. RHS, IOSPE). The intended workflow is **assisted manual capture**: record the
   distilled takeaway and its citation. Sanctioned data-access paths (e.g. POWO/WCVP)
   are for a later phase.
5. **Your own material.** Academic PDFs / Google-Drive notes should be entered as
   takeaways with a `USER_OWNED` (or appropriate) source. Full texts are referenced by
   link, not ingested into AI context, unless you explicitly flag the source `aiUseAllowed`.

## Where it's enforced in code

- On creation (`createKnowledge` in `src/lib/actions.ts`), `computeAiEligibility()` sets
  the item's `aiEligible` from its author flag + linked sources' `aiUseAllowed`.
- Before any model call, `AnthropicProvider` runs `filterAiEligible()` and the defensive
  `assertAllEligible()` backstop, and only ever sends the paraphrased takeaway text —
  never `shortQuote`.
- With AI disabled (the default), none of this matters because nothing leaves the machine.

> This document describes the tool's safeguards; it is not legal advice. You are
> responsible for the rights to the material you enter.
