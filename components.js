// Echo UI component library.
//
// Contract: one interaction behavior has one implementation. Screens provide
// data and callbacks; components own their DOM/event wiring.

export const micSvg=`<svg class="mic-glyph" width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="5" y="1" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 9.2a6 6 0 0 0 12 0M8 15.4V19M5.2 19h5.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const swapSvg=`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M2 6h12M11 3l3 3-3 3M16 12H4M7 9l-3 3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const sendSvg=`<svg width="14" height="11" viewBox="0 0 16 12" fill="none" aria-hidden="true"><path d="M1 6h13M9.5 1.5 14 6l-4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function recordButton({className="mic",label="Speak",role="mic"}={}){const button=document.createElement("button");button.type="button";button.className=className;button.dataset.role=role;button.setAttribute("aria-label",label);button.innerHTML=micSvg;return button}

export function hydrateRecordButtons(root=document){for(const button of root.querySelectorAll('button[data-record-button]')){button.innerHTML=micSvg;button.classList.add("mic");if(!button.type)button.type="button"}return root}

export function learnerComposer({id,placeholder="",label="",submitLabel="Send",rows=2}={}){
  const root=document.createElement("div");root.className="composer learner-composer";root.dataset.component="learner-composer";
  root.innerHTML=`${label?`<label class="overline" for="${id}">${label}</label>`:""}<div class="input-row"><textarea id="${id}" rows="${rows}" placeholder="${placeholder}"></textarea><button class="mic swap" data-role="swap" type="button" aria-label="Swap the languages">${swapSvg}</button><span data-role="mic-slot"></span><button class="primary" data-role="submit" type="button"><span class="label">${submitLabel}</span>${sendSvg}</button></div><p data-role="dictation-status" class="hint" aria-live="polite"></p><p data-role="status" aria-live="polite"></p>`;
  return root;
}

export function wireLearnerComposer(root,{onSubmit,onSwap,bindDictation}={}){
  const slot=root.querySelector('[data-role="mic-slot"]');slot.replaceWith(recordButton());const field=root.querySelector("textarea"),submit=root.querySelector('[data-role="submit"]'),swap=root.querySelector('[data-role="swap"]'),mic=root.querySelector('[data-role="mic"]'),dictationStatus=root.querySelector('[data-role="dictation-status"]');
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
