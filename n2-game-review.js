// Quick round's reviewed exceptions (audit of 26 Nov 2026,
// docs: audit/quick-round). Each entry says why, so a later reviewer can
// restore an item once it is fixed at its source. Pure data.

// Readings accepted for the tested sense that the near-miss generator must
// never offer as wrong, and the key to use when the source disagrees with
// the sentence the learner studied.
export const ACCEPTED_READINGS = Object.freeze({
  的確: ["てっかく"], 適確: ["てっかく"],          // both readings are accepted
  湿気: ["しっき"],                                // しっけ in everyday speech; しっき also exists
  境界: ["きょうがい"],                            // a real reading in another sense
});
export const READING_KEY = Object.freeze({
  湿気: "しっけ",  // the deck sentence teaches しっけ (humidity); the inventory says しっき
});

// Meanings corrected for the game (re-audit, 26 Nov): keyed "word/reading",
// "word", or "g:pattern". The inventory keeps its JMdict text.
export const GLOSS_FIX = Object.freeze({
  "白髪/しらが": "white or grey hair",
  "ご苦労様": "thank you for your hard work",
  "宛名": "addressee's name",
  "留まる/とどまる": "to stay, to remain",
  "留まる/とまる": "to perch (on a branch), to stop",
  "鈍い/にぶい": "dull (e.g., a knife), thickheaded",
  "鈍い/のろい": "slow, sluggish",
  "発売": "release (of a product), going on sale",
  "g:手前": "because of having said or done (and so must keep face); in front of",
  "g:甲斐がある": "to be worth doing, to pay off",
});

// Items left out of the scored pool until their source is fixed.
// Grammar patterns that sit in their example sentence in pieces or in another
// form, so the name alone finds nothing to underline (owner's flags on
// g:ていては, 26 Nov: "no underline and I don't know what I'm supposed to
// answer"). Each entry is the piece or pieces to underline, in sentence order.
// Only patterns that are in pieces by nature stay here: where a natural
// sentence can show the named form whole, the deck sentence was rewritten
// to do so (deck audit, v287).
export const GRAMMAR_SPANS = Object.freeze({
  "g:を-に任せる": ["を", "に任せ"],
  "g:か-ないかのうちに": ["か", "ないかのうちに"],
  "g:にしても-にしても": ["にしても", "にしても"],
  "g:お-願う": ["お書き願います"],
  "g:も-ば-も": ["も", "ば", "も"],
});
export const EXCLUDED = Object.freeze({
  // Homophones whose sentence does not pick one spelling or sense.
  "h:煎る": "炒る is an accepted spelling",
  "h:寝間着": "寝巻 is an accepted spelling", "h:寝巻": "寝間着 is an accepted spelling",
  "h:故郷": "古里 / ふるさと fit the same sentence", "h:古里": "故郷 fits the same sentence",
  "h:的確": "適確 is an accepted spelling", "h:適確": "的確 is an accepted spelling",
  "h:始めに": "初めに can fit", "h:初めに": "始めに can fit",
  "h:制作": "製作 can fit the sentence", "h:製作": "制作 can fit the sentence",
  "h:基準": "規準 can fit", "h:規準": "基準 can fit",
  "h:作成": "作製 can fit", "h:作製": "作成 can fit",
  "h:伯父さん": "叔父さん / 小父さん need family context", "h:叔父さん": "伯父さん need family context", "h:小父さん": "伯父さん / 叔父さん can fit",
  // Grammar patterns whose meaning overlaps another pattern's in the choices.
  "g:さすが": "overlaps other patterns' meanings", "g:それにしても": "overlaps other patterns' meanings",
  "g:しかしながら": "overlaps other patterns' meanings", "g:のも当然だ": "overlaps other patterns' meanings",
  "g:-てこそ": "overlaps other patterns' meanings", "g:かねない": "overlaps ないこともない and others",
  // Authored exam questions with a defensible distractor or a doubtful explanation.
  "e:n2-set-3#14": "色の割合: a distractor is defensible",
  "e:n2-set-3#36": "ことにしている with a company policy: stem needs strengthening",
  "e:n2-set-5#32": "何かにつけ: a distractor is defensible",
  "e:n2-set-6#35": "気になっていけない: explanation needs correction",
  "e:n2-set-8#38": "について: a distractor is defensible",
  "e:n2-set-9#2": "keys しっき while Echo teaches しっけ for this sense",
  "e:n2-set-10#1": "白髪: しらが / はくはつ variants",
  "e:n2-set-12#10": "小休み: distractor and explanation",
  "e:n2-set-12#17": "同一: a distractor is defensible",
  "e:n2-set-14#0": "大相撲: highlight",
  "e:n2-set-14#11": "本世紀: a distractor is defensible",
  "e:n2-set-16#13": "徐々に: the claim about 未だに is unsupported",
  // Re-audit (v276): authored prompts to review before they score again.
  "e:n2-set-7#16": "re-audit: prompt to review", "e:n2-set-8#9": "re-audit: prompt to review",
  "e:n2-set-17#18": "re-audit: prompt to review", "e:n2-set-17#20": "re-audit: prompt to review",
});

// The levels whose Quick round cards have been audited and may score. Cards of
// every other level are practice (exposure only) until theirs is done: add a
// level here only after its pool has passed the same audit as N2's
// (four distinct choices, no wrong choice that is also right; docs/REPORTS.md).
export const REVIEWED_LEVELS = new Set(["N2"]);
