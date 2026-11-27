// Fixed edition. Changing its contents requires a new edition ID so saved answers
// always refer to the same prompts, choices and answer keys.
export const EDITION = "2026.11-v1";
// Sets 02–20 from the realistic edition (n2-sets.json). A new edition gets new
// paper IDs, so attempts saved on the old forms keep their own questions.
export const SETS_EDITION = "2026.11-r3";

// The JLPT N2 paper, part by part. One definition for the app, the validator
// (tools/n2-validate-set.mjs) and the authors of n2-sets.json.
export const BLUEPRINT = [
  {skill:"Vocabulary",mondai:1,kind:"漢字読み",count:5,options:4,targeted:true,instruction:"＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Vocabulary",mondai:2,kind:"表記",count:5,options:4,targeted:true,instruction:"＿＿の言葉を漢字で書くとき、最もよいものを1・2・3・4から一つ選びなさい。"},
  {skill:"Vocabulary",mondai:3,kind:"語形成",count:3,options:4,targeted:true,instruction:"（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Vocabulary",mondai:4,kind:"文脈規定",count:7,options:4,targeted:true,instruction:"（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Vocabulary",mondai:5,kind:"言い換え類義",count:5,options:4,targeted:true,instruction:"＿＿の言葉に意味が最も近いものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Vocabulary",mondai:6,kind:"用法",count:5,options:4,targeted:true,instruction:"次の言葉の使い方として最もよいものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Grammar",mondai:7,kind:"文法形式の判断",count:12,options:4,targeted:true,instruction:"次の文の（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Grammar",mondai:8,kind:"文の組み立て",count:5,options:4,instruction:"次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。"},
  {skill:"Grammar",mondai:9,kind:"文章の文法",count:5,options:4,needsContext:true,instruction:"次の文章を読んで、文章全体の内容を考えて、（１）から（５）の中に入る最もよいものを選びなさい。"},
  {skill:"Reading",mondai:10,kind:"内容理解（短文）",count:5,options:4,needsContext:true,instruction:"次の文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。"},
  {skill:"Reading",mondai:11,kind:"内容理解（中文）",count:9,options:4,needsContext:true,instruction:"次の文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。"},
  {skill:"Reading",mondai:12,kind:"統合理解",count:2,options:4,needsContext:true,instruction:"次のＡとＢの文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。"},
  {skill:"Reading",mondai:13,kind:"主張理解（長文）",count:3,options:4,needsContext:true,instruction:"次の文章を読んで、後の問いに対する答えとして最もよいものを選びなさい。"},
  {skill:"Reading",mondai:14,kind:"情報検索",count:2,options:4,needsContext:true,instruction:"右のページの情報を読んで、後の問いに対する答えとして最もよいものを選びなさい。"},
  {skill:"Listening",mondai:1,kind:"課題理解",count:5,options:4,needsContext:true,instruction:"まず質問を聞いてください。それから話を聞いて、最もよいものを一つ選んでください。"},
  {skill:"Listening",mondai:2,kind:"ポイント理解",count:6,options:4,needsContext:true,instruction:"まず質問を聞いてください。そのあと、選択肢を読んでください。話を聞いて、最もよいものを一つ選んでください。"},
  {skill:"Listening",mondai:3,kind:"概要理解",count:5,options:4,needsContext:true,instruction:"話の前に質問はありません。話を聞いて、質問と選択肢を聞いて、最もよいものを一つ選んでください。"},
  {skill:"Listening",mondai:4,kind:"即時応答",count:12,options:3,needsContext:true,instruction:"文を聞いて、その返事を聞いて、最もよいものを一つ選んでください。"},
  {skill:"Listening",mondai:5,kind:"統合理解",count:4,options:4,needsContext:true,instruction:"長めの話を聞きます。質問と選択肢を聞いて、最もよいものを一つ選んでください。"},
];
export const blueprintFor = q => BLUEPRINT.find(b => b.skill === q.skill && b.mondai === q.mondai);
// The Japanese instruction for a question: its own, its 問題's, or — for the
// November mock, whose rows carry no 問題 number — the 問題 its shape matches
// (report 2d7bbf8b: no instruction on screen). `skill` is the name.
export function instructionFor(q) {
  if (q.instruction) return q.instruction;
  const own = blueprintFor(q); if (own) return own.instruction;
  const p = String(q.prompt || ""), by = (skill, mondai) => BLUEPRINT.find(b => b.skill === skill && b.mondai === mondai).instruction;
  if (q.skill === "Vocabulary") return /読み方/.test(p) ? by("Vocabulary", 1) : /【[ぁ-ん]+】/.test(p) ? by("Vocabulary", 2) : /近い意味/.test(p) ? by("Vocabulary", 5) : /使い方/.test(p) ? by("Vocabulary", 6) : by("Vocabulary", 4);
  if (q.skill === "Grammar") return /★/.test(p) ? by("Grammar", 8) : by("Grammar", 7);
  if (q.skill === "Reading") return by("Reading", 10);
  if (q.skill === "Listening") return q.options === 3 || (q.choices || []).length === 3 ? by("Listening", 4) : by("Listening", 2);
  return "";
}
// A paper revised on its own carries its own edition, so that revising one does not detach every sitting of the
// others from its review lines (27 Nov: eight questions with a second natural answer, found by an outside review).
export const SET_EDITIONS = Object.freeze({"n2-set-4": "2026.11-r4", "n2-set-5": "2026.11-r4", "n2-set-8": "2026.11-r4", "n2-set-9": "2026.11-r4",
  "n2-set-10": "2026.11-r4", "n2-set-14": "2026.11-r4", "n2-set-20": "2026.11-r4"});
export const editionOf = id => SET_EDITIONS[id] || SETS_EDITION;
export const realisticPaperId = id => id + "@" + editionOf(id);
export const setFile = id => "./n2-sets/" + id + ".json";
// A realistic set (n2-sets/<id>.json) as exam rows: each question carries its
// 問題 number, kind and the official-style instruction.
export function realisticRows(set) {
  const skills = ["Vocabulary", "Grammar", "Reading", "Listening"];
  return set.questions.map((q, index) => {
    const b = blueprintFor(q);
    return {...q, index, skill: skills.indexOf(q.skill), kind: b?.kind, instruction: b?.instruction,
      label: (q.skill === "Listening" ? "聴解 " : "") + "問題" + q.mondai + " · " + (b?.kind || ""), options: q.choices.length};
  });
}
export const topics = [
  ["図書館","本の修理講座","傷んだ本を自分で直せるようにする","手順を覚えても道具の使い方に迷う","修理した本","司書"],
  ["商店街","共同配送の説明会","配達に出る車の数を減らす","集荷の時間が商品の焼き上がりと合わない","配送記録","店主"],
  ["美術館","音声案内の体験会","作品の前で解説を聞けるようにする","機械を操作している間に作品を見る時間が減る","録音した解説","学芸員"],
  ["市役所","窓口予約の相談会","手続きの待ち時間を短くする","予約する時間を決められない人がいる","予約の記録","窓口の担当者"],
  ["農園","野菜の直売会","形の不ぞろいな野菜も活用する","調理の仕方が分からず買うのをためらう人がいる","出荷記録","生産者"],
  ["公民館","防災地図の説明会","住民が近くの避難先を確認できるようにする","昼と夜では通れる道が異なる","地域の地図","防災委員"],
  ["駅","案内表示の見学会","初めての利用者も乗り換えやすくする","矢印が柱の陰になって見えにくい","案内板の写真","駅員"],
  ["病院","受付機の体験会","受付の行列を短くする","選択肢が多く操作に時間がかかる","操作の記録","受付担当者"],
  ["劇場","字幕付き公演の説明会","音声を聞き取りにくい人にも公演を楽しんでもらう","席によって字幕と舞台を同時に見にくい","座席表","舞台監督"],
  ["工場","道具の点検講習","故障の兆候を早く発見する","点検の基準が人によって違う","点検表","整備担当者"],
  ["大学","履修相談会","学生が自分に合う授業を選べるようにする","授業名からは課題の量が分からない","授業の資料","教務担当者"],
  ["運動施設","用具の貸出説明会","初心者でも運動を始めやすくする","貸出時間が短く練習を続けにくい","利用記録","指導員"],
  ["観光案内所","散策地図の体験会","徒歩で町を回りやすくする","坂道が多く到着時間に差が出る","道の写真","観光ガイド"],
  ["新聞社","記事の読み比べ講座","複数の視点から出来事を考える","見出しだけで内容を判断する人がいる","掲載記事","編集者"],
  ["学校","制服の交換会","まだ着られる制服を活用する","希望のサイズがあるか当日まで分からない","サイズ表","保護者代表"],
  ["博物館","展示ラベルの検討会","専門知識がなくても展示を理解できるようにする","説明が長いと最後まで読まれない","展示の写真","研究員"],
  ["郵便局","荷物の発送講座","送り状を間違えずに書けるようにする","記入例の文字が小さく読みづらい","送り状の見本","窓口職員"],
  ["水族館","観察記録の講座","生き物の変化に気づけるようにする","見る時間帯によって行動が違う","観察記録","飼育員"],
  ["文化センター","字幕制作の講座","話し言葉を読みやすい字幕にする","言葉を省くと発言の意図まで変わることがある","字幕の見本","翻訳者"]
];
export const bookIds = ["echo-2026-11", ...topics.map((_,i) => "n2-set-" + (i+2))];
export const bookName = id => id === bookIds[0] ? "01 · November mock" : bookIds.includes(id) ? String(bookIds.indexOf(id)+1).padStart(2,"0")+" · "+topics[bookIds.indexOf(id)-1][1] : id && id !== "undefined" ? "Official workbook · "+id : "Unknown paper";
function shuffled(list, seed) {
  const result = list.slice();
  for (let i=result.length-1; i>0; i--) {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    const j=seed%(i+1);
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
export function form(id, inventory, original) {
  const grammarForms = ["を機に","次第","に限り","とは限らない","以上","に伴って","ながら","どころか","に応えて","ものの","に限り","かのよう","に基づいて","わけではない","にもかかわらず","を問わず","に応じて","ないと","ために","もっとも","その結果"];
  const vocabForms = "承認 調整 妨げ 順調 率直 締め切り 補う 配慮 負担 把握 供給 反映 段階 中断 確保 軽減 念 上回る 集中 未定 省く 僅か 断る 当分 先方 見込み 余裕 見直す 一律 控える".split(" ");
  const normalize=s=>s.replace(/[〜～・()（） ]/g,"");
  let v=0,g=0;
  original=original.map(q=>{
    if(q.skill==="Vocabulary"){
      const spelling=vocabForms[v++], w=inventory.words.find(w=>w[0]===spelling);
      if(w)return {...q,target:["word",w[0],w[1]],dimension:v<=5?"reading":"meaning"};
    }
    if(q.skill==="Grammar"){
      const label=grammarForms[g++];
      const entry=inventory.grammar.find(r=>r[1].split("・").some(part=>normalize(part)===label));
      if(entry)return {...q,target:["grammar",entry[0]],dimension:"meaning"};
    }
    return q;
  });
  if (id === bookIds[0]) return original;
  const set=bookIds.indexOf(id)-1;
  if (set<0) throw new Error("Unknown practice set");
  const rows=[];
  const wordPool=shuffled(inventory.words.filter(w=>/[一-龯]/.test(w[0]) && w[1] && w[0]!==w[1]),891);
  const grammars=shuffled(inventory.grammar.filter(g=>g[2]),375);
  function item(skill,context,prompt,answer,others,why,meta={}) {
    const choices=shuffled([answer,...others],4391*(rows.length+1)+set*57);
    rows.push({skill,context,prompt,choices,key:choices.indexOf(answer)+1,why,...meta});
  }
  for(let i=0;i<30;i++) {
    const w=wordPool[set*30+i], field=i%2 ? 2 : 1;
    const candidates=wordPool.filter(x=>x[0]!==w[0] && x[field]!==w[field] && x[1]!==w[1]);
    const others=[...new Set(shuffled(candidates,153+set*31+i).map(x=>x[field]))].slice(0,3);
    item("Vocabulary","",w[0]+(field===1?" の読み方はどれか。":" の意味に最も近いものはどれか。"),w[field],others,w[0]+"（"+w[1]+"） · "+w[2],{target:["word",w[0],w[1]],dimension:field===1?"reading":"meaning"});
  }
  // Mix reference recall with sentence-level grammar from the authored mock.
  for(let i=0;i<11;i++) {
    const g=grammars[(set*11+i)%grammars.length];
    const gloss=g[2].toLowerCase().split(/[,;/]/).map(x=>x.trim());
    const candidates=shuffled(grammars.filter(x=>x[0]!==g[0] && !x[2].toLowerCase().split(/[,;/]/).some(h=>gloss.includes(h.trim()))),i+set*257);
    item("Grammar","",g[1]+" の代表的な意味はどれか。",g[2],[...new Set(candidates.map(x=>x[2]))].slice(0,3),g[1]+" · "+g[2],{target:["grammar",g[0]],dimension:"meaning"});
  }
  rows.push(...shuffled(original.filter(q=>q.skill==="Grammar"),91+set).slice(0,10));
  const [place,event,goal,issue,record,person]=topics[set];
  const next=topics[(set+1)%topics.length], other=topics[(set+6)%topics.length];
  const start=9+(set%5), price=600+100*set, cap=12+set, day=5+set;
  const room=["東館","西館","北館"][set%3], backup=["西館","北館","東館"][set%3];
  const passage1=place+"では「"+event+"」を始めた。目的は"+goal+"ことだ。しかし、参加者に話を聞くと、「"+issue+"」という声が出た。主催者は、参加人数だけでは取り組みの効果は分からないと考え、次回から一週間後にも参加者に連絡し、実際に何が変わったか尋ねることにした。";
  const passage2=event+"のご案内。開催は来月"+day+"日、"+room+"で"+start+"時から。定員"+cap+"人。料金は一人"+price+"円で、二人一緒に申し込むと合計から二百円引き。変更は前日正午まで。参加者は"+record+"を持参してください。申し込みが定員を超えた場合、先着順ではなく抽選とします。";
  const passage3="Ａ「"+event+"を続けるなら、まず参加者の声を集めたい。特に『"+issue+"』という人がどこで困ったかを確かめたい。」　Ｂ「声を聞くことには賛成だ。ただ、参加できた人だけに聞くと、来られなかった人の事情は見えない。申し込みを途中でやめた人にも短い質問を送ってみよう。」";
  const passage4="「"+record+"を残すだけで十分だろうか」と"+person+"は言う。最初は件数を毎月比べていたが、数字が増えても理由までは読めなかった。そこで、担当者が判断に迷った場面と、そのとき選ばなかった案も一行添えることにした。記入には少し時間がかかる。それでも、次に似た状況に出会う人が判断の根拠をたどれるなら、その時間には意味があるという。";
  function read(ctx,qs){for(const [p,a,b,c,d,w] of qs)item("Reading",ctx,p,a,[b,c,d],w);}
  read(passage1,[
    ["取り組みの当初の目的は何か。",goal,next[2],other[2],"参加者の順位を決める","目的は introduces the original aim."],
    ["参加者からどんな指摘があったか。",issue,next[3],other[3],"参加費が毎週変わる","The quoted comment identifies the obstacle."],
    ["主催者が一週間後にすることは何か。","参加後の変化を尋ねる","費用を払い戻す","次回の受付を終了する","人数だけを発表する","Follow-up checks whether the activity changed anything."],
    ["参加人数だけでは何が判断できないか。","当初の目的が実現したか","何人申し込んだか","場所がどこか","担当者が誰か","Attendance measures reach, while follow-up examines effect."],
    ["本文の内容に合うのはどれか。","活動を改善するために追跡調査をする","効果がないと判断して中止した","参加者全員が同じ意見だった","人数が減ったため費用を上げた","The follow-up supplements attendance figures."]]);
  read(passage2,[
    ["二人一緒に申し込むと合計はいくらか。",String(price*2-200)+"円",String(price*2-400)+"円",String(price*2)+"円",String(price-200)+"円","Subtract 200 yen once from the combined fee."],
    ["持参するものはどれか。",record,next[4],other[4],"参加証明書","Look for 持参してください."],
    ["参加希望者が多い場合、どうなるか。","抽選で参加者を決める","最初の人から参加できる","全員別の日に移る","二人組を優先する","先着順ではなく抽選 specifies the selection process."],
    ["変更できる最終時刻はいつか。","前日の正午","前日の閉館時","当日の正午","三日前の朝","The notice explicitly sets 前日正午."],
    ["開催場所と開始時刻の組み合わせはどれか。",room+"・"+start+"時",backup+"・"+start+"時",room+"・"+(start+1)+"時",backup+"・"+(start+1)+"時","Read the venue and start time together."]]);
  read(passage3,[
    ["二人に共通する考えはどれか。","利用者の意見を調べたい","参加条件を厳しくしたい","質問をなくしたい","人数だけで判断したい","B explicitly agrees with listening to feedback."],
    ["Ｂが加えたい調査対象は誰か。","申し込みを途中でやめた人","講師だけ","何度も参加した人だけ","当日最後に帰った人","B points out who a participant survey misses."],
    ["Ａが詳しく知りたいことは何か。","参加者が困った場面","不参加者の年齢","運営費の内訳","申込者の住所","Ａ wants to locate the difficulty within the experience."],
    ["Ｂの懸念に近いものはどれか。","参加者の声だけでは見えない事情がある","質問を短くすると回答者が増えすぎる","Ａは声を集めることに反対している","事情を尋ねることは禁止されている","B is concerned about selection bias."],
    ["両者の提案を生かす方法はどれか。","参加者と申し込みをやめた人に聞く","参加者だけに長い調査をする","全員に同じ参加費を課す","参加できなかった人だけを対象にする","Combining proposals requires both groups."]]);
  read(passage4,[
    ["新しく記録するのは何か。","迷った場面と選ばなかった案","毎日の参加費","担当者の勤務年数","成功した回数だけ","The new notes document alternatives and uncertainty."],
    ["以前の記録の問題は何か。","件数の変化の理由を読み取れない","数字が少なすぎて保存できない","記入に何日もかかる","担当者以外は読めない","Numbers showed change but not its cause."],
    ["「その時間」とは何の時間か。","判断の背景を書き添える時間","次の人が到着する時間","連絡を待つ時間","記録を消す時間","The reference points to the extra time required to write."],
    ["改善によって誰が助かるか。","次に似た状況に直面する人","出席者数だけを求める人","案内状を配る人だけ","申し込みを断られた人だけ","The intended reader can reconstruct the reasoning."],
    ["筆者の考えに合う見出しはどれか。","数字に判断の背景を添える","記録の件数を競う","記入をすべて自動化する","選ばなかった案を忘れる","The argument favors documenting reasoning alongside counts."]]);
  const clips=[
    [event+"は"+room+"で行う予定でしたが、空調の修理のため"+backup+"に変わりました。時間はそのままです。","変更されたのは何ですか。","会場","開始時刻","参加費","募集人数"],
    [person+"から連絡です。資料はもう配りましたが、"+record+"だけは当日お持ちください。","持ってくるものは何ですか。",record,next[4],other[4],"配布済みの資料"],
    ["二人分の料金ですが、一人"+price+"円で、二人一緒なら合計から二百円引きです。別々に申し込むと割引はありません。","二人一緒の支払額はいくらですか。",String(price*2-200)+"円",String(price*2)+"円",String(price*2-400)+"円",String(price)+"円"],
    [place+"までの送迎は"+start+"時発です。受付は出発の十五分前に終わります。乗る方はそれまでに来てください。","受付が終わるのはいつですか。",(start-1)+"時45分",start+"時15分",start+"時",(start-1)+"時30分"],
    [event+"の定員は"+cap+"人です。いま二人分のキャンセルが出たので、満員だったところから二人受け付けられます。","今、新しく何人申し込めますか。","二人",cap+"人","一人",(cap-2)+"人"],
    ["まず"+record+"を点検してください。結果の連絡は私がします。ポスターの交換は点検が終わってからで結構です。","頼まれた人はまず何をしますか。","記録や資料を点検する","結果を連絡する","ポスターを交換する","連絡先を調べる"],
    ["来月"+day+"日の催し、参加したいのですが。あいにくその日は満員で、翌日なら空いています。では翌日でお願いします。","予約したのは何日ですか。",(day+1)+"日",day+"日",(day-1)+"日",(day+2)+"日"],
    [event+"のあとで感想を聞いたら、「"+issue+"」という意見がありました。次回はそこを改善したいですね。","どの点が課題ですか。",issue,next[3],other[3],"会場費が去年より安いこと"],
    ["目的は"+goal+"ことです。参加する人数が増えるのはうれしいですが、それだけで達成できたとは判断しません。","何を重視していますか。",goal,"定員を増やす","開催回数を競う","料金を一律にする"],
    ["担当は"+person+"です。ただ、当日の受付だけは事務局が行います。内容のお問い合わせは担当者にお願いします。","内容を聞きたい人は誰に連絡しますか。",person,"受付だけをする事務局",other[5],"送迎の運転手"]
  ];
  for(const [speech,p,a,b,c,d] of clips) item("Listening",speech,p,a,[b,c,d],"The decisive wording is in the transcript: "+speech);
  // These listening drills check rapid recognition of additional, non-overlapping readings.
  for(let i=0;i<20;i++){
    const w=wordPool[570+set*20+i];
    const choices=shuffled(wordPool.filter(x=>x[1]!==w[1] && x[0]!==w[0]),317+set*63+i);
    item("Listening",w[1],"聞こえた言葉を選んでください。",w[0],[...new Set(choices.map(x=>x[0]))].slice(0,3),w[0]+"（"+w[1]+"） · "+w[2],{target:["word",w[0],w[1]],dimension:"listening"});
  }
  return rows;
}

// A vocabulary or grammar question's solution: its sentence with the answer
// in the blank (or the tested 【word】), furigana throughout, the answer
// underlined. Pure: the text and the word to mark, readings fixed where the
// question itself gives them (a 読み方 question's answer is the reading).
export function solutionOf(q) {
  if (!(q.skill === 0 || q.skill === 1 || q.skill === "Vocabulary" || q.skill === "Grammar")) return null;
  const answer = String(q.choices?.[q.key - 1] || "");
  let text = String(q.prompt || "").split("\n")[0].replace(/[^。？！]*(どれ|どの|誰|何)[^。？！]*か[。？]\s*$/, "").trim();
  if (!answer) return null;
  // The older short form: "消化 の読み方はどれか。" — the word and its answer.
  const bare = /^[〜～]?([^\s。、「」]+)\s+の(読み方|意味|代表的な意味)/.exec(String(q.prompt || ""));
  if (bare) {
    const word = bare[1], reading = answer.replace(/^[〜～]/, ""), kana = /^[ぁ-ゖー]+$/.test(reading);
    if (bare[2] === "読み方" && kana) return {text: word, mark: word, overrides: {[word]: reading}};
    return /[ぁ-ゖ㐀-鿿]/.test(answer) ? {text: word + " → " + answer, mark: word, overrides: {}} : {text: word, mark: word, overrides: {}};
  }
  const tested = /【([^】]+)】/.exec(text)?.[1] || "";
  text = text.replace(/[【】]/g, "").replace(/★/g, "");
  const blank = /（\s*）|（　+）|＿+|_{2,}/;
  if (blank.test(text)) {
    if (answer.length > 14 || /\s/.test(answer)) return null;
    return {text: text.replace(blank, answer), mark: answer, overrides: {}};
  }
  // 言い換え and 使い方 quote the word: the natural sentence, or the phrase
  // beside its paraphrase.
  // 用法 (問題6) gives the bare word: its natural sentence, the word marked
  // even when conjugated (its stem).
  if (q.mondai === 6 && !tested && /[。！？]$/.test(answer) && !/[。？]/.test(text)) return {text: answer, mark: [text, text.slice(0, -1)], overrides: {}};
  const quoted = /「([^」]+)」/.exec(String(q.prompt || ""))?.[1];
  if (!tested && quoted) {
    const word = quoted.replace(/[をがはにで].*$/, "") || quoted;
    return /[。！？]$/.test(answer) ? {text: answer, mark: [word, word.slice(0, -1)], overrides: {}} : {text: quoted + " → " + answer, mark: answer, overrides: {}};
  }
  if (!text || !tested || !text.includes(tested)) return null;
  const kana = /^[ぁ-ゖー]+$/.test(answer), kanji = /[㐀-鿿々]/.test(tested);
  // 読み方: the word in kanji, the answer its reading. 書き方: the word in kana,
  // the answer its kanji. Otherwise (言い換え, 使い方) the tested word stays.
  if (kana && kanji) return {text, mark: tested, overrides: {[tested]: answer}};
  if (!kanji && /[㐀-鿿々]/.test(answer)) return {text: text.replace(tested, answer), mark: answer, overrides: {[answer]: tested}};
  return {text, mark: tested, overrides: {}};
}

// An explanation that gives a reading in brackets, 辛い（づらい）, keeps that
// reading: the word becomes an override and the brackets go (the furigana
// says it). Returns the text and the overrides for the resolver.
export function whyReadings(why = "") {
  const overrides = {};
  const text = String(why).replace(/([㐀-鿿々][㐀-鿿々ぁ-ゖ]*)（([ぁ-ゖー]+)）/g, (all, word, reading) => { overrides[word] = reading; return word; });
  return {text, overrides};
}
