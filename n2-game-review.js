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
  "g:甲斐がある": "to be worth doing, to pay off",
  // Content review of 27 Nov 2026 (tools/grammar-blocks/reviews/2026-11-27.json): meanings corrected.
  "g:得る-得る": "It can happen or be done, is possible",
  "g:ざるを得ない": "have no choice but to, be forced to",
  "g:おおよそ": "approximately, roughly",
  "g:中を": "through the midst of, passing through",
  "g:かねない": "there is a risk that something bad may happen",
  "g:次第だ-次第で": "depends on, depending on",
  "g:-てこそ": "only by doing, only when or if that happens",
  "g:を除いて": "except for, excluding",
  "g:にかかわる": "concern, be related to",
  "g:にもかかわらず": "despite, even though",
  "g:に限って": "precisely on that occasion, of all people or times",
  "g:なくはない": "not entirely untrue or impossible, a qualified yes",
  "g:ないことには-ない": "unless X happens, Y cannot happen or be determined",
  "g:つつある": "in the process of, gradually becoming or doing",
  "g:～ところに・～ところへ": "just as, at that point something occurs",
  "g:ては": "if things are like this, a negative result follows",
  "g:ては-ては": "repeatedly do one thing and then another",
  "g:に先立ち": "before, prior to",
  "g:あげく": "after a long process, ended up (often negatively)",
  "g:いつの間にか": "before one knew it, without one noticing",
  "g:抜きで": "without, leaving out",
  "g:としても": "even if we suppose that",
  "g:かと思ったら-かと思うと": "just when it seemed that X, Y immediately followed",
  "g:というものでもない": "it is not necessarily true that, X does not always imply Y",
  "g:て頂戴": "please do (familiar request)",
  "g:ことになっている": "is arranged, scheduled, or prescribed to",
  "g:ことだから": "knowing what this person is like, one can expect that",
  "g:ものがある": "there is something about it that, it has a noticeable quality",
  "g:てしょうがない": "extremely, so much that one cannot help feeling it",
  "g:手前": "given what one has said or done, one feels obliged to follow through",
  "g:はもとより": "not only X, but also Y, with X taken as a given",
  "g:っこない": "there's no way it will happen (emphatic, casual)",
  "g:それとも": "or (introducing the alternative in a question)",
  "g:ようでは-ようじゃ": "if things are such that X, the outlook is poor",
  "g:だけましだ": "at least X, that makes it better than it could be",
  "g:に値する": "is worthy of, merits",
  "g:おそらく": "probably, most likely",
  "g:といった": "such as, of the kind exemplified by",
  "g:何といっても": "above all, the standout point is",
  "g:だけのことはある": "lives up to X, proves worth the price, effort, or reputation",
  "g:てでも": "even if it means doing X, even by resorting to X",
  "g:ないわけにはいかない": "cannot reasonably refrain from doing, have to do",
  "g:たって": "even if (colloquial)"
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

// Grammar blocks have a separate review gate from rank-level word cards.
// Owner, 27 Nov: "every card in a round counts for points, plus when success, minus when fail." Until then, content
// no reviewer had read (the other levels' words, the grammar pieces, the word parts, the connectives) was practice and
// paid nothing; a round with unpaid cards did not read as a game. The REVIEWED_ flags below are kept as the record of
// what has been reviewed, and decide again if this is ever set to false.
export const SCORE_ALL = true;
// ---- Word parts (前～, ～気味): what the review of 27 Nov changed ----
// AFFIX_GLOSS: the meaning a part has as a part, where the word list's (a dictionary's word entry) was wrong or odd.
// Keyed by the part as the list writes it, with its reading after a slash where two entries share a spelling.
export const AFFIX_GLOSS = Object.freeze({
 "女～": "female ~",
 "～女": "~th daughter (birth order)",
 "省～": "saving ~, conserving ~",
 "～省": "~ Ministry (government)",
 "～商": "dealer, trader in ~",
 "～勝": "~ wins (victories)",
 "～条": "article no. ~ (of a law)",
 "～場": "venue, ground for ~",
 "～色": "~ colour, colouring",
 "～船": "ship, boat (type of ~)",
 "～戦": "match, contest, battle",
 "～足": "counter for pairs of footwear",
 "総～": "total ~, whole ~",
 "第～": "ordinal prefix (~th)",
 "～科": "department, course; family (biology)",
 "～化": "-ization, turning into ~",
 "～刊": "edition, published ~",
 "～期": "period, term, stage",
 "～口": "entrance, exit, opening",
 "～系": "~ group, field, or lineage",
 "～圏": "sphere, zone, area",
 "重～": "heavy ~, serious ~",
 "～号": "No. ~, issue ~; ship name",
 "～料": "fee, charge for ~",
 "～園": "park, garden; place for ~",
 "～頭": "counter for large animals",
 "～等/～とう": "class, grade, prize rank",
 "～島": "~ island",
 "～道": "way, art of ~",
 "非～": "non-~, un-~",
 "～等/～ら": "plural marker (they, we ~)",
 "再～": "again, re-~",
 "～病": "~ disease, ~ illness",
 "～山": "Mt. ~, mountain",
 "～寺": "~ Temple",
 "～ぽい": "-ish; prone to ~",
 "防～": "~proof; protection against ~",
 "～丁目": "-chome (block number)",
 "室～": "room, indoor ~",
 "～庁": "government agency",
 "～発": "counter for shots; departing from ~",
 "～遍": "times (repetitions)",
 "古～": "old ~, used ~",
 "～所/～しょ": "place, office (facility)",
 "～済": "already ~ed, done",
 "～きる": "do ~ completely, to the end",
 "～歌": "song, anthem",
 "〜(日本) 式": "style, method; ceremony",
 "～ほう (ひかく)": "the ~ one, the side that ~ (comparing)",
 "～続く": "keep ~ing, go on ~ing",
 "～切れ": "expired, run out of ~",
 "各～": "each ~ (separately)",
 "～毎": "every ~ (each time)",
 "～流": "way, school of ~",
 "～難い": "hard to ~; difficult to ~",
 "～辛い": "awkward, painful to ~",
 "～通り": "as ~, in accordance with ~",
 "前～": "former; previous",
 "～形": "~ shaped; ~ form",
 "～室": "room for ~",
 "～年生": "student in year ~; ~ grader",
 "～論": "theory or study of ~",
 "～番目": "~th in a sequence",
 "～館": "hall, museum, dedicated facility",
 "～産": "produced or grown in ~"
});
// AFFIX_CONFUSABLE: parts close enough in meaning that one's meaning would be a fair answer on another's card
// (～器 and ～機, ～風 and ～式). No two of a group are ever each other's wrong choice.
export const AFFIX_CONFUSABLE = Object.freeze([["～所", "～場"], ["～所", "～館", "～園", "～港", "～室", "～庁", "～口"], ["～器", "～機"], ["～外", "～切れ"], ["各～", "毎～", "～毎"], ["各～", "諸～"], ["現～", "今～"], ["明くる～", "翌～"], ["反～", "非～"], ["～風", "～流", "和～"], ["～位", "～着", "～等", "～番目", "第～", "～時間目", "～女"], ["～泊", "～夜", "～日"], ["～難い", "～辛い"], ["～がち", "～ぽい", "～気味"], ["～料", "～費"], ["～刊", "～紙", "～号", "～巻"], ["～団", "～科", "～系"], ["～羽", "～頭"], ["～手", "～者", "～家"], ["～通り", "～沿い"], ["～商", "～業"], ["～勝", "～戦"], ["～室", "室～"], ["～船", "～艘"], ["～園", "～場"], ["不～", "無～", "非～", "反～"], ["前～", "元～", "旧～", "古～"], ["全～", "総～", "各～", "諸～"], ["～員", "～者", "～手", "～家"], ["～用", "～向き"], ["～中", "～間", "～期"], ["～学", "～論", "～科"], ["～め", "～気味", "～がち", "～ぽい", "～げ"], ["～制", "～系"], ["～直す", "再～"], ["～率", "～等"], ["超～", "大～", "重～"], ["新～", "現～", "今～"], ["～的", "～性", "～風"], ["～上", "～別"], ["～おき", "～毎", "毎～"]]);
// The connective cards: a meaning that is also fair for the word is never offered against it, a word shown in the
// form it is met in, and a job line of its own where the table's would mislead.
export const LINK_NOT_WRONG = Object.freeze({"それなら": ["now, well then"],
  // Outside review, 27 Nov: on its own the word does not show which side of a contrast it leads.
  "もっとも": ["of course", "certainly, it is true that"], "確かに": ["though, admittedly (a qualification after the point)"]});
// The line shown after the answer, where the job's general line would say too much for this word (outside review,
// 27 Nov): 確かに need not be followed by a turn, それなら may bring a proposal, not a conclusion.
export const LINK_WHY = Object.freeze({
  "確かに": "Confirms or acknowledges a point; it can set up a contrast, but need not",
  "もちろん": "Presents a point as obvious or expected; sometimes concedes it before a qualification",
  "このように": "Refers to the manner just shown; can recap the preceding points",
  "とすれば": "Takes the preceding point as a premise, then asks or says what follows",
  "それなら": "Responds to the preceding situation with an inference, proposal, or decision",
  "とはいえ": "Acknowledges the previous point and adds a reservation",
  "ところが": "Introduces what happened contrary to the preceding expectation",
  "さて": "Moves the discussion forward or opens a new topic"});
// A part's card where the sentence writes more than the list's spelling (支払い済み, 朝食付き, 忘れっぽい, 我が社): what
// is underlined, and the reading shown where the part is voiced in compounds (川沿い ぞい, 北口 ぐち).
export const AFFIX_SHOWN = Object.freeze({"～済": "済み", "～付": "付き", "～ぽい": "っぽい", "我～": "我が"});
export const AFFIX_READING = Object.freeze({"～沿い": "～ぞい", "～切れ": "～ぎれ", "～口": "～ぐち"});
export const LINK_SHOWN = Object.freeze({"にもかかわらず": "それにもかかわらず", "とすれば": "だとすれば"});
// The word-part cards (前～, ～気味): their meanings are the word list's and their sentences the deck's, neither read by
// a reviewer as affix content. False: practice, no points. True only after that review.
export const REVIEWED_AFFIXES = false;
export const REVIEWED_GRAMMAR_BLOCKS = false;

// Pairs of N2 patterns whose meanings a blind solver could not separate
// (two independent Sonnet solves of the block index, 27 Nov 2026: one with
// the Japanese parts, one with their glosses alone). On the grammar-block
// cards (`gb:`, `gi:`) neither is ever offered as the other's wrong choice.
// The scored `g:` cards are not changed here: their pool is audited as it is.
export const GRAMMAR_CONFUSABLE = Object.freeze([
  // Near-synonyms named by the second review (27 Nov): never each other's wrong choice.
  ["つつ", "つつ-も"], ["ものだから", "ものですから-もので"], ["にしても-にしても", "にしろ-にしろ"],
  ["からすると-からすれば", "から見ると"],
  ["からすると-からすれば", "にしたら"],
  ["からすると-からすれば", "からには"],
  ["からして", "にしたら"],
  ["からして", "という点から考えると"],
  ["だけあって", "だけに"],
  ["それなら", "ならともかく"],
  ["て当然だ", "のももっともだ"],
  ["というものだ", "のももっともだ"],
  ["つつ", "つつある"],
  ["から見ると", "という点から考えると"],
  ["から見ると", "ところを見ると"],
  ["としても", "と考えられる"],
  ["ことにはならない", "だけのことはある"],
  ["も-ば-も", "も又"],
  ["ては", "に越したことはない"],
  ["ことだから", "だけのことはある"],
  ["ことだから", "のももっともだ"],
  ["ならともかく", "ものなら①"],
  ["ていては", "て当然だ"],
  ["ということは", "というものだ"],
  ["ないことには-ない", "ないではいられない"],
  ["には", "際に"],
  ["にしたら", "には"],
  ["ざるを得ない", "よりほかない"],
  ["ざるを得ない", "よりしかたがない"],
  ["よりほかない", "よりしかたがない"],
  ["ざるを得ない", "ないわけにはいかない"],
  ["ないではいられない", "てならない"],
  ["てならない", "てしょうがない"],
  ["てならない", "てたまらない"],
  ["てしょうがない", "てたまらない"],
  ["にかかわらず", "を問わず"],
  ["にもかかわらず", "ものの"],
  ["上に", "その上"],
  ["おまけに", "しかも"],
  ["て当然だ", "のも当然だ"],
  ["にすぎない", "でしかない"],
  ["に相違ない", "に決まっている"],
  ["ないことには-ない", "てからでないと"],
  ["際に", "に際して"],
  ["に際して", "にあたり-にあたって"],
]);
