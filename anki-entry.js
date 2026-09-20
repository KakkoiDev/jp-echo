import initSqlJs from "sql.js";
import {Deck,Model,Package} from "genanki-js";
import JSZip from "jszip";
import {ankiSchedule} from "./anki-schedule.js";

const DECK_ID=2059400110;
const MODEL_ID=2059400111;
let sqlPromise;

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function ankiRuby(value=""){
  return escapeHtml(value).replace(/([\u3400-\u4dbf\u4e00-\u9fff々]+)【([^】]+)】/g,"<ruby>$1<rt>$2</rt></ruby>");
}

function getSql(){
  sqlPromise??=initSqlJs({locateFile:()=>"./vendor/sql-wasm.wasm"});
  return sqlPromise;
}

export async function downloadAnkiDeck(sentences){
  if(!sentences.length)throw new Error("Translate at least one sentence before exporting.");
  const SQL=await getSql();
  const model=new Model({
    name:"JP Echo sentence",
    id:MODEL_ID,
    flds:[{name:"Japanese"},{name:"English"},{name:"Polite"},{name:"Echoes"}],
    req:[[0,"all",[0]]],
    css:".card{font-family:system-ui,sans-serif;text-align:center;font-size:22px;color:#20231f;background:#fffdf7}.jp{font-size:34px;line-height:1.8}rt{font-size:.45em;color:#5d655d}.meta{margin-top:18px;color:#687067;font-size:15px}",
    tmpls:[{name:"Japanese → English",qfmt:'<div class="jp">{{Japanese}}</div>',afmt:'{{FrontSide}}<hr id="answer"><div>{{English}}</div><div class="meta">Polite: {{Polite}} · {{Echoes}} echoes</div>'}]
  });
  const deck=new Deck(DECK_ID,"JP Echo");
  for(const sentence of sentences){
    const casual=sentence.casualJapanese||sentence.japanese;
    const polite=sentence.politeJapanese||sentence.japanese;
    deck.addNote(model.note([ankiRuby(casual),escapeHtml(sentence.english),ankiRuby(polite),String(Number(sentence.echoCount)||0)],null,sentence.id));
  }
  const pkg=new Package();
  pkg.setSqlJs(new SQL.Database());
  pkg.addDeck(deck);
  const initialBlob=await pkg.writeToFile("JP Echo.apkg");
  const zip=await JSZip.loadAsync(await initialBlob.arrayBuffer());
  const db=new SQL.Database(await zip.file("collection.anki2").async("uint8array"));
  const createdSeconds=db.exec("SELECT crt FROM col")[0].values[0][0];
  const cardRows=db.exec("SELECT n.guid, c.id FROM notes n JOIN cards c ON c.nid=n.id")[0]?.values||[];
  const cardIds=new Map(cardRows.map(([guid,id])=>[guid,id]));
  const update=db.prepare("UPDATE cards SET type=?, queue=?, due=?, ivl=?, factor=?, reps=?, lapses=?, left=? WHERE id=?");
  for(const sentence of sentences){
    const cardId=cardIds.get(sentence.id),schedule=ankiSchedule(sentence.srs,createdSeconds);
    if(cardId==null||!schedule)continue;
    update.run([schedule.type,schedule.queue,schedule.due,schedule.interval,schedule.factor,schedule.reps,schedule.lapses,schedule.left,cardId]);
  }
  update.free();
  zip.file("collection.anki2",db.export());
  db.close();
  const blob=await zip.generateAsync({type:"blob",mimeType:"application/apkg"});
  const url=URL.createObjectURL(blob);
  const link=Object.assign(document.createElement("a"),{href:url,download:"JP Echo.apkg"});
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
