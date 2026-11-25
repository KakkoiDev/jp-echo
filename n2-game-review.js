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

// Items left out of the scored pool until their source is fixed.
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
});
