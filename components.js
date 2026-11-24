// Echo UI component library.
//
// Contract: one interaction behavior has one implementation. Screens provide
// data and callbacks; components own their DOM/event wiring.

export const micSvg=`<svg class="mic-glyph" width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="5" y="1" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 9.2a6 6 0 0 0 12 0M8 15.4V19M5.2 19h5.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
// The flag is a drawn line icon (Icons/flag), never the ⚑ character. Pressed,
// it fills: `[aria-pressed="true"] .flag-glyph` in styles.css.
export const flagSvg=`<svg class="flag-glyph" width="13" height="15" viewBox="0 0 13 15" fill="none" aria-hidden="true"><path d="M1.5 14V1.5M1.5 2h8.6l-1.8 3.2 1.8 3.2H1.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
// One flag control, three forms: icon-only in a session bar (.icon-button,
// named by aria-label), a row in a menu sheet (.settings-row), or a labelled
// text button on the sentence page.
export function renderFlagButton(button,sentence){const flagged=sentence?.flagged===true;button.setAttribute("aria-pressed",String(flagged));
  if(button.classList.contains("settings-row")){const title=button.querySelector(".settings-row-title"),status=button.querySelector(".settings-row-status");if(title)title.textContent=flagged?"Flagged — remove the flag":"Flag for later";if(status)status.textContent=flagged?"It shows in Library under Flagged":"Something to check — it shows in Library under Flagged";return}
  if(button.classList.contains("icon-button")){button.innerHTML=flagSvg;button.setAttribute("aria-label",flagged?"Flagged — remove the flag":"Flag for later")}
  else{button.innerHTML=flagSvg;button.append(document.createTextNode(flagged?" Flagged — remove flag":" Flag sentence"))}}
const swapSvg=`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M2 6h12M11 3l3 3-3 3M16 12H4M7 9l-3 3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const sendSvg=`<svg width="14" height="11" viewBox="0 0 16 12" fill="none" aria-hidden="true"><path d="M1 6h13M9.5 1.5 14 6l-4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function languageSwitchButton({className="mic swap",label="Swap the languages",role="swap"}={}){const button=document.createElement("button");button.type="button";button.className=className;button.dataset.role=role;button.setAttribute("aria-label",label);button.innerHTML=swapSvg;return button}

export function hydrateLanguageSwitchButtons(root=document){for(const button of root.querySelectorAll('button[data-language-switch]'))button.innerHTML=swapSvg;return root}

export function recordButton({className="mic",label="Speak",role="mic"}={}){const button=document.createElement("button");button.type="button";button.className=className;button.dataset.role=role;button.setAttribute("aria-label",label);button.innerHTML=micSvg;return button}

export function hydrateRecordButtons(root=document){for(const button of root.querySelectorAll('button[data-record-button]')){button.innerHTML=micSvg;button.classList.add("mic");if(!button.type)button.type="button"}return root}

export function learnerComposer({id,placeholder="",label="",submitLabel="Send",rows=2}={}){
  const root=document.createElement("div");root.className="composer learner-composer";root.dataset.component="learner-composer";
  root.innerHTML=`${label?`<label class="overline" for="${id}">${label}</label>`:""}<div class="input-row"><textarea id="${id}" rows="${rows}" placeholder="${placeholder}"></textarea><span data-role="swap-slot"></span><span data-role="mic-slot"></span><button class="primary" data-role="submit" type="button"><span class="label">${submitLabel}</span>${sendSvg}</button></div><p data-role="dictation-status" class="hint" aria-live="polite"></p><p data-role="status" aria-live="polite"></p>`;
  return root;
}

export function wireLearnerComposer(root,{onSubmit,onSwap,bindDictation}={}){
  const slot=root.querySelector('[data-role="mic-slot"]'),swapSlot=root.querySelector('[data-role="swap-slot"]');slot.replaceWith(recordButton());swapSlot.replaceWith(languageSwitchButton());const field=root.querySelector("textarea"),submit=root.querySelector('[data-role="submit"]'),swap=root.querySelector('[data-role="swap"]'),mic=root.querySelector('[data-role="mic"]'),dictationStatus=root.querySelector('[data-role="dictation-status"]');
  submit.onclick=()=>onSubmit?.(field.value,root);
  swap.onclick=()=>{onSwap?.();field.focus()};
  field.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter")onSubmit?.(field.value,root)};
  if(bindDictation)bindDictation(mic,field,dictationStatus);
  return {field,submit,swap,mic,status:root.querySelector('[data-role="status"]'),dictationStatus};
}

export function wireAIAdjuster(block,{bindDictation,onRewrite,onManualSave,onDelete,onRegenerate}={}){
  const panel=block.querySelector(".adjust-panel"),instruction=panel?.querySelector("input"),status=panel?.querySelector(".adjust-status"),mic=panel?.querySelector(".note-adjust-mic"),rewrite=panel?.querySelector(".rewrite");
  if(mic&&instruction&&bindDictation)bindDictation(mic,instruction,status);
  if(rewrite)rewrite.onclick=()=>onRewrite?.(instruction.value.trim(),{panel,instruction,status,rewrite});
  const bind=(selector,fn)=>{const el=panel?.querySelector(selector);if(el&&fn)el.onclick=()=>fn({panel,instruction,status,element:el})};
  bind(".note-save",onManualSave);bind(".note-delete",onDelete);bind(".note-regenerate",onRegenerate);
  return {panel,instruction,status,mic,rewrite};
}


// Primitive controls. Screens declare semantic data-ui attributes; this module
// is the only place that maps those semantics to reusable visual behavior.
export function button({label="",variant="default",icon="",ariaLabel="",type="button"}={}){const el=document.createElement("button");el.type=type;el.dataset.ui="button";el.dataset.variant=variant;if(ariaLabel)el.setAttribute("aria-label",ariaLabel);if(icon)el.dataset.icon=icon;if(label)el.textContent=label;return el}
export function iconButton({icon,label,variant="icon"}={}){return button({icon,ariaLabel:label,variant})}
export function languageSwitchControl({target=""}={}){const el=iconButton({icon:"swap",label:"Swap the languages",variant:"input"});el.dataset.inputSwap=target;return el}
export function submitButton({label="Send"}={}){const el=button({label,variant:"primary",ariaLabel:label});el.dataset.icon="send";return el}
export function textInput({type="text",placeholder="",label=""}={}){const el=document.createElement("input");el.type=type;el.placeholder=placeholder;el.dataset.ui="input";if(label)el.setAttribute("aria-label",label);return el}
export function textArea({placeholder="",rows=2,label=""}={}){const el=document.createElement("textarea");el.rows=rows;el.placeholder=placeholder;el.dataset.ui="textarea";if(label)el.setAttribute("aria-label",label);return el}
export function status({className="hint"}={}){const el=document.createElement("p");el.className=className;el.dataset.ui="status";el.setAttribute("aria-live","polite");return el}

const icons={mic:micSvg,swap:swapSvg,send:sendSvg};
export function hydrateUI(root=document){hydrateRecordButtons(root);for(const el of root.querySelectorAll("[data-ui]")){const kind=el.dataset.ui;if(kind==="button"){el.classList.add("ui-button");const v=el.dataset.variant;if(v&&v!=="default")el.classList.add("ui-"+v);const icon=icons[el.dataset.icon];if(icon&&!el.querySelector("svg"))el.insertAdjacentHTML(el.textContent.trim()?"beforeend":"afterbegin",icon)}else if(kind==="input"||kind==="textarea")el.classList.add("ui-field");else if(kind==="status")el.classList.add("ui-status")}return root}

// SkillGlyph — the one mark for a review skill: 聴 listen, 読 read, 書 write.
// States: "default", "current" (today's or the next skill), "inactive" (the
// others in a card's trio) and "filled" (a seal mark in a figure: the skill
// mix, the stats tiles, a skill already done). The tile is decorative; callers
// label the group, so assistive tech hears "Listening card", not three kanji.
const SKILL_GLYPH={listening:"聴",reading:"読",writing:"書"};
export function skillGlyph(mode,{state="default",size=28}={}){const el=document.createElement("span");el.className="skill-glyph";el.lang="ja";el.dataset.skill=mode;el.dataset.state=state;el.style.setProperty("--skill-size",size+"px");el.textContent=SKILL_GLYPH[mode]||"";el.setAttribute("aria-hidden","true");return el}
export function skillTrio(current,{size=28,label=""}={}){const el=document.createElement("span");el.className="skill-trio";el.setAttribute("role","img");if(label)el.setAttribute("aria-label",label);for(const mode of Object.keys(SKILL_GLYPH))el.append(skillGlyph(mode,{state:mode===current?"current":"inactive",size}));return el}

// GrammarList — the answered grammar of a sentence, read as an answer, not as
// controls: a numbered list (一 二 三, the .step-mark look) of the phrase as it
// appears over its one-line gloss, the JLPT level as a chip at the row end,
// and a chevron. A row opens the grammar sheet.
// Shown on the sentence page and the revealed review answer only.
const KANJI_DIGITS=["","一","二","三","四","五","六","七","八","九"];
export function kanjiNumeral(n){n=Math.floor(Number(n));if(!(n>0&&n<100))return String(n);const tens=Math.floor(n/10),ones=n%10;return (tens?(tens>1?KANJI_DIGITS[tens]:"")+"十":"")+KANJI_DIGITS[ones]}
export function grammarList(items,{onOpen}={}){
  const list=document.createElement("ol");list.className="grammar-list";
  items.forEach((item,index)=>{const li=document.createElement("li"),row=document.createElement("button");row.type="button";row.className="grammar-row";row.dataset.ui="button";
    row.setAttribute("aria-label",`${item.phrase}, ${item.level||""} — ${item.gloss||""}. Open the grammar sheet.`.replace(/ ,/,""));
    const mark=document.createElement("span");mark.className="step-mark";mark.setAttribute("aria-hidden","true");mark.textContent=kanjiNumeral(index+1);
    const body=document.createElement("span");body.className="grammar-row-body";
    const phrase=document.createElement("span");phrase.className="grammar-phrase";phrase.lang="ja";phrase.textContent=item.phrase;body.append(phrase);
    if(item.gloss){const gloss=document.createElement("span");gloss.className="grammar-gloss";gloss.textContent=item.gloss;body.append(gloss)}
    row.append(mark,body);
    if(item.level){const level=document.createElement("span");level.className="grammar-level";level.textContent=item.level;row.append(level)}
    row.insertAdjacentHTML("beforeend",'<svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    if(onOpen)row.onclick=()=>onOpen(item);li.append(row);list.append(li)});
  return list}

// Render only the initial items until the learner explicitly expands the list.
export function expandableList({host,items,render,limit=5,moreLabel="See more",lessLabel="See less"}){
  host.querySelector('[data-component="list-toggle"]')?.remove();
  let expanded=false;
  const control=button({label:moreLabel});control.className="show-more";control.dataset.component="list-toggle";
  control.setAttribute("aria-controls",host.id);
  const refresh=()=>{render(expanded?items:items.slice(0,limit));control.textContent=expanded?lessLabel:moreLabel;control.setAttribute("aria-expanded",String(expanded));if(items.length>limit)host.append(controlRow)};
  const controlRow=document.createElement("li");controlRow.dataset.component="list-toggle";controlRow.append(control);
  control.onclick=()=>{expanded=!expanded;refresh()};
  refresh();return control;
}

// A generated sentence and its meaning stay visible without scrolling inside fields.
export function fitTextArea(field){field.style.height="auto";field.style.height=Math.max(field.scrollHeight,96)+"px"}

// --- November primitives (docs/design/november) ------------------------------
// Each returns markup built from escaped text, so a caller may pass words,
// readings and labels from the library without them reaching markup raw.
const escapeText=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
const chevronSvg=`<svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const caretSvg=`<svg width="10" height="7" viewBox="0 0 10 7" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
export const searchSvg=`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.2" stroke="currentColor" stroke-width="1.4"/><path d="m11 11 3.4 3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
export {chevronSvg};

// ToolShelf: every tool Echo has beyond the practice loop, as a flat row of
// 52px glyph tiles with a label under each — the tool row's glyph tile, laid
// flat. One shelf, in Library (/library#tools); Practice links to it.
// tools: [{id, glyph, label, name}] — `name` is the accessible name when the
// label is a short form ("Kanji" for Kanji, words and grammar).
export function toolShelfHtml(tools=[],{label="Tools"}={}){
  return `<nav class="tool-shelf" aria-label="${escapeText(label)}">${tools.map(tool=>`<button type="button" data-ui="button" class="tool-shelf-tile" data-tool="${escapeText(tool.id)}"${tool.name?` aria-label="${escapeText(tool.name)}"`:""}><span class="tool-shelf-glyph" lang="ja" aria-hidden="true">${escapeText(tool.glyph)}</span><span class="tool-shelf-label">${escapeText(tool.label)}</span></button>`).join("")}</nav>`}
// The same tools as a list for the desktop sidebar (DesktopLibraryTools):
// a 22px glyph tile and the tool's full name. One list of tools, two forms.
export function toolListHtml(tools=[],{current=null}={}){
  return tools.map(tool=>`<button type="button" data-ui="button" class="nav-tool" data-tool="${escapeText(tool.id)}"${tool.id===current?' aria-current="page"':""}><span class="nav-tool-glyph" lang="ja" aria-hidden="true">${escapeText(tool.glyph)}</span><span>${escapeText(tool.name||tool.label)}</span></button>`).join("")}
export function toolList(host,tools,{onOpen,current}={}){host.innerHTML=toolListHtml(tools,{current});for(const row of host.querySelectorAll(".nav-tool"))row.onclick=()=>onOpen?.(row.dataset.tool)}
export function toolShelf(host,tools,{onOpen,label}={}){host.innerHTML=toolShelfHtml(tools,{label});
  for(const tile of host.querySelectorAll(".tool-shelf-tile"))tile.onclick=()=>onOpen?.(tile.dataset.tool);return host.firstElementChild}

// HeaderSearch: the magnifier in every tab header. It opens /search; the
// caller passes the navigation so routing stays in app.js.
export function headerSearchHtml({label="Search everything"}={}){return `<button type="button" data-ui="button" class="icon-button header-search" aria-label="${escapeText(label)}">${searchSvg}</button>`}
export function hydrateHeaderSearch(root,{onOpen}={}){for(const button of root.querySelectorAll(".header-search"))button.onclick=()=>onOpen?.();}

// FilterButton: one quiet control that names the current filter ("All ·
// Newest") and opens a sheet holding the real controls. The sheet is an
// existing <dialog class="sheet-dialog">; the button never owns the filters.
export function filterButtonHtml(summary){return `<span class="filter-button-label">${escapeText(summary)}</span>${caretSvg}`}
export function renderFilterButton(button,summary,{label="Filter and sort"}={}){button.innerHTML=filterButtonHtml(summary);button.classList.add("filter-button");button.setAttribute("aria-haspopup","dialog");button.setAttribute("aria-label",label+": "+summary)}
export function wireFilterButton(button,dialog,{onOpen}={}){button.onclick=()=>{onOpen?.();if(!dialog.open)dialog.showModal?.();button.setAttribute("aria-expanded","true")};
  dialog.addEventListener("close",()=>{button.setAttribute("aria-expanded","false");button.focus?.()})}

// ThemedPicture: a drawn picture with a light and a dark file. Both are in the
// markup and the theme (data-theme on <html>, or the system when "system")
// shows one, so a forced theme never shows the other theme's drawing.
export function themedPictureHtml({light,dark},{size=30,alt="",className=""}={}){
  return `<span class="themed-picture${className?" "+className:""}"><img class="picture-light" src="${escapeText(light)}" width="${size}" height="${size}" alt="${escapeText(alt)}" loading="lazy"><img class="picture-dark" src="${escapeText(dark)}" width="${size}" height="${size}" alt="${escapeText(alt)}" loading="lazy"></span>`}

// CornerMark: the one mark for a voiced (゛ giant, 巨) or p-sound (゜ balloon)
// anchor, in the top-right corner of a mora cell or a strip cell.
export function cornerMarkHtml(mark){if(mark==="giant")return `<span class="corner-mark giant" role="img" aria-label="giant" title="゛ giant">巨</span>`;
  if(mark==="balloon")return `<span class="corner-mark balloon" role="img" aria-label="balloon" title="゜ balloon"></span>`;return ""}

// AnchorStrip: the anchors of a reading, in order, each a link to its Mora
// cell. items: [{mora, image, mark, picture:{light, dark}|null, href}].
// `compact` is the chip form for lists (Echo's notes): kana and image only.
export function anchorStripHtml(items=[],{compact=false,label="Mora anchors"}={}){
  if(compact)return `<span class="anchor-strip compact" lang="ja" aria-label="${escapeText(label)}">${items.map(item=>`<span class="anchor-chip"><b>${escapeText(item.mora)}</b>${escapeText(item.image)}</span>`).join("")}</span>`;
  const image=item=>{const text=escapeText(item.image);if(item.mark==="giant"&&text.startsWith("巨大な"))return `<span class="anchor-modifier">巨大な</span>${text.slice(3)}`;if(item.mark==="balloon"&&text.startsWith("風船の"))return `<span class="anchor-modifier">風船の</span>${text.slice(3)}`;return text};
  const picture=item=>item.picture?themedPictureHtml(item.picture,{size:30,className:"anchor-picture"}):"";
  return `<div class="anchor-strip" lang="ja" role="list" aria-label="${escapeText(label)}">${items.map((item,i)=>`${i?`<span class="anchor-arrow" aria-hidden="true">→</span>`:""}<a role="listitem" class="anchor-cell" href="${escapeText(item.href||"#")}"><span class="anchor-kana">${escapeText(item.mora)}</span>${picture(item)}<span class="anchor-image">${image(item)}</span>${cornerMarkHtml(item.mark)}</a>`).join("")}</div>`}

// --- Learning-journey primitives (designer handoff, 24 Nov) -------------------
// PlanSteps — the day as a numbered list, GrammarList's shape: a kanji numeral,
// the title over one meta line, the minutes at the row end. One step may be
// "next" (seal-filled numeral, tinted row); finished steps are "done" (struck
// through). A step with href or onOpen is a row link; the screen's one filled
// button starts the next step, so rows stay quiet.
export function planSteps(steps=[],{label="Today's steps"}={}){
  const list=document.createElement("ol");list.className="plan-steps";list.setAttribute("aria-label",label);
  steps.forEach((step,index)=>{
    const li=document.createElement("li");li.className="plan-step";li.dataset.state=step.state||"";
    const row=document.createElement(step.href?"a":step.onOpen?"button":"span");row.className="plan-step-row";
    if(step.href)row.href=step.href;
    if(step.onOpen){if(row.tagName==="BUTTON")row.type="button";row.addEventListener("click",event=>{if(!step.href)event.preventDefault();step.onOpen(step)})}
    if(step.disabled)row.setAttribute("aria-disabled","true");
    if(step.state==="next")row.setAttribute("aria-current","step");
    const mark=document.createElement("span");mark.className="plan-step-mark";mark.lang="ja";mark.setAttribute("aria-hidden","true");mark.textContent=step.glyph||kanjiNumeral(index+1);
    const body=document.createElement("span");body.className="plan-step-body";
    const title=document.createElement("span");title.className="plan-step-title";title.textContent=step.title||"";body.append(title);
    if(step.line){const meta=document.createElement("span");meta.className="plan-step-meta";meta.textContent=step.line;body.append(meta)}
    row.append(mark,body);
    if(step.minutes){const min=document.createElement("span");min.className="plan-step-min";min.textContent=step.minutes+" min";row.append(min)}
    li.append(row);list.append(li)});
  return list}

// LoadMeter — the library meter line for a day's load, always labelled with
// its denominator ("6 h of 7 h 10 min fits today"). The part that does not fit
// is hatched; the caption and the accessible name say the same words.
export function loadMeter({fits,needs,caption}={}){
  const wrap=document.createElement("div");wrap.className="load-meter";
  const bar=document.createElement("span");bar.className="load-meter-bar";bar.setAttribute("role","img");bar.setAttribute("aria-label",caption);
  const total=Math.max(needs||0,fits||0,1),fill=document.createElement("span"),over=document.createElement("span");
  fill.className="load-meter-fill";fill.style.width=Math.min(100,(Math.min(fits,needs||fits)/total)*100)+"%";
  over.className="load-meter-over";over.style.width=Math.max(0,((needs-fits)/total)*100)+"%";
  bar.append(fill,over);
  const text=document.createElement("span");text.className="load-meter-caption";text.textContent=caption;text.setAttribute("aria-hidden","true");
  wrap.append(bar,text);return wrap}

// ExamLine — one quiet row naming the exam and the first-pass date, with a
// "Change" link to the one goal editor (n2-mock.html#training-goal).
export function examLine({text,href="./n2-mock.html#training-goal",action="Change"}={}){
  const a=document.createElement("a");a.className="exam-line";a.href=href;
  const t=document.createElement("span");t.className="exam-line-text";t.textContent=text;
  const c=document.createElement("span");c.className="exam-line-action";c.textContent=action;
  a.append(t,c);return a}

// EvidenceRow — one piece of evidence for one item and skill: a dimension mark
// (filled = done, outline = planned or missed), the kind in the copy contract
// (heard · checked once · recalled on another day · understood in a new
// passage), a source line and the date.
export function evidenceRow({done=false,title="",line="",date=""}={}){
  const li=document.createElement("li");li.className="evidence-row";
  const mark=document.createElement("span");mark.className="evidence-mark";mark.dataset.done=String(!!done);mark.setAttribute("aria-hidden","true");
  const body=document.createElement("span");body.className="evidence-body";
  const t=document.createElement("span");t.className="evidence-title";t.textContent=title;body.append(t);
  if(line){const l=document.createElement("span");l.className="evidence-line";l.textContent=line;body.append(l)}
  const d=document.createElement("span");d.className="evidence-date";d.textContent=date;
  li.append(mark,body,d);return li}

// PauseRing — Day Radio Recall's countdown: a seal arc over a hairline ring,
// the seconds in display type. set(left) redraws it; under reduced motion the
// arc stays whole and only the number changes.
export function pauseRing({total=5,left=total,label="seconds before the meaning plays"}={}){
  const NS="http://www.w3.org/2000/svg",R=42,C=2*Math.PI*R;
  const wrap=document.createElement("div");wrap.className="pause-ring";
  const svg=document.createElementNS(NS,"svg");svg.setAttribute("width","96");svg.setAttribute("height","96");svg.setAttribute("viewBox","0 0 96 96");svg.setAttribute("aria-hidden","true");
  const ring=document.createElementNS(NS,"circle"),arc=document.createElementNS(NS,"circle"),num=document.createElementNS(NS,"text");
  for(const c of [ring,arc]){c.setAttribute("cx","48");c.setAttribute("cy","48");c.setAttribute("r",String(R));c.setAttribute("fill","none");c.setAttribute("stroke-width","4")}
  ring.setAttribute("class","pause-ring-track");arc.setAttribute("class","pause-ring-arc");arc.setAttribute("stroke-linecap","round");arc.setAttribute("transform","rotate(-90 48 48)");arc.setAttribute("stroke-dasharray",String(C));
  num.setAttribute("x","48");num.setAttribute("y","57");num.setAttribute("text-anchor","middle");num.setAttribute("class","pause-ring-num");
  svg.append(ring,arc,num);
  const caption=document.createElement("p");caption.className="pause-ring-caption";caption.textContent=label;
  const live=document.createElement("span");live.className="sr-only";live.setAttribute("aria-live","polite");
  wrap.append(svg,caption,live);
  const reduced=()=>globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const set=n=>{n=Math.max(0,Math.ceil(n));num.textContent=String(n);arc.setAttribute("stroke-dashoffset",reduced()?"0":String(C*(1-n/Math.max(1,total))));if(n===total||n===0)live.textContent=n+" "+label};
  set(left);return {el:wrap,set}}

// SavedMark: the one mark for a saved word (specs/echo-reader SPEC §4.4,
// board SavedStates) — a drawn bookmark, viewBox 12×16, stroke 1.4. Saved is
// a mark beside the word's state, never a fourth state: met and learned keep
// their chips. Off is a --sumi outline, on is filled --seal (styles.css,
// "Saved words"). Two forms from one drawing:
// - savedMarkHtml(saved,{size,label}): the 12px mark in rows (Search results,
//   the Words map, Echo's notes, Saved words) and status lines; never a button.
// - renderSavedButton(button,saved): the word sheet's IconButton, aria-pressed,
//   whose ON state is the seal-tint one the flag uses.
const SAVED_PATH="M2 1.5h8v13l-4-3.2-4 3.2v-13Z";
export function savedMarkSvg({size=12}={}){const h=Number(size)||12,w=Math.round(h*.75);return `<svg class="saved-glyph" width="${w}" height="${h}" viewBox="0 0 12 16" fill="none" aria-hidden="true"><path d="${SAVED_PATH}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`}
export function savedMarkHtml(saved=true,{size=12,label=""}={}){
  return `<span class="saved-mark" data-saved="${saved?"true":"false"}"${label?` role="img" aria-label="${escapeText(label)}"`:` aria-hidden="true"`}>${savedMarkSvg({size})}</span>`}
export function renderSavedButton(button,saved,{saveLabel="Save word",savedLabel="Saved — remove from saved words"}={}){
  button.setAttribute("aria-pressed",String(!!saved));button.setAttribute("aria-label",saved?savedLabel:saveLabel);
  if(!button.querySelector(".saved-glyph"))button.innerHTML=savedMarkSvg({size:16});return button}
