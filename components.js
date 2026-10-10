// Echo UI component library.
//
// Contract: one interaction behavior has one implementation. Screens provide
// data and callbacks; components own their DOM/event wiring.

export const micSvg=`<svg class="mic-glyph" width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="5" y="1" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 9.2a6 6 0 0 0 12 0M8 15.4V19M5.2 19h5.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
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
