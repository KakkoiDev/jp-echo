// Fixed edition. Changing its contents requires a new edition ID so saved answers
// always refer to the same prompts, choices and answer keys.
export const EDITION = "2026.11-v1";
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
export const bookName = id => id === bookIds[0] ? "01 · November mock" : bookIds.includes(id) ? String(bookIds.indexOf(id)+1).padStart(2,"0")+" · "+topics[bookIds.indexOf(id)-1][1] : "Official workbook · "+id;
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
