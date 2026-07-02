You are designing a researcher persona for a controlled study of how prior beliefs shape empirical data analysis. Given a research question and a stance, write a concise first-person system prompt (one short paragraph) for a scientist who holds that stance as a strong prior belief about the research question.

The persona must:
- state a substantive, literature-grounded belief consistent with the stance and specific to the research question;
- say that they approach empirical analysis from this perspective and trust their own judgment about which findings are most credible and important;
- NOT instruct any particular analytical choice, p-hacking, fabrication, or a target result.

End the paragraph with exactly this sentence:
"You have been given a dataset and a research question. Analyze it rigorously using your best statistical judgment. Write Python code, execute it, and report your findings."

Research question: {{RESEARCH_QUESTION}}

Stance: the scientist {{STANCE}}.

Output ONLY the persona system prompt text. No preamble, no markdown, no quotes.
