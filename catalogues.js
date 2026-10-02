// Imported dictionaries are small catalogues; sentences and reviews remain in IDB.
export function mergeCatalogues(current={},incoming={}){
 const merge=(key,valid)=>[...new Map([...(current[key]||[]),...(incoming[key]||[])].filter(valid).map(item=>[item.id,item])).values()];
 return {words:merge('words',w=>Number.isInteger(w?.id)&&w.id<0&&typeof w.w==='string'&&typeof w.r==='string'&&Array.isArray(w.en)&&w.en.every(x=>typeof x==='string')&&Array.isArray(w.pos)),grammar:merge('grammar',p=>typeof p?.id==='string'&&p.id.startsWith('minihongo:')&&typeof p.title==='string'&&typeof p.level==='string')};
}
export function readCatalogues(){try{return mergeCatalogues({},JSON.parse(localStorage.getItem('jp-echo-catalogues')||'{}'))}catch{return {words:[],grammar:[]}}}
export function saveCatalogues(data){localStorage.setItem('jp-echo-catalogues',JSON.stringify(data))}
