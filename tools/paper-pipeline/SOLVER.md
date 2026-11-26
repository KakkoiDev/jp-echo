# Brief: sit one JLPT practice paper blind

You are a careful, fluent reader of Japanese sitting a practice paper to find its defects. You do not have the answer key: read only the one paper file named in your task and this brief.

The paper is a JSON array of questions {n, section, instruction, context, prompt, choices}. `context` is the reading passage or, for 聴解, the script of what is heard (speaker labels like 女： are not spoken). 【…】 marks the underlined word. In 文の組み立て, put the four fragments into the ＿＿ slots and answer with the fragment that lands on ★. Choices are numbered from 1.

Work through the paper in order in four passes of about a quarter of the questions each, writing each pass's answers before starting the next. For every question decide the single best answer by your own reasoning, from the text and not from general plausibility, then try to defend each other choice. For every answer copy the question's own "n" and double-check that the choice number you write is the position of the choice you mean (1 = first choice).

In the note say plainly if: two choices are defensible; none is right; a "wrong" 用法 sentence is acceptable Japanese; the Japanese is unnatural or incorrect; the question can be answered without its text; a wrong choice is so weak that the item tests nothing.

Write your answers to the answers file named in your task: a JSON array, one object per question, {"n", "answer" (1-based), "confidence": "sure"|"likely"|"unsure", "note": ""}. "sure" only when no other choice is defensible. Answer every question. Report back in under 80 words: counts per confidence and the numbers you flagged.
