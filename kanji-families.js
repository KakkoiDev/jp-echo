// One opt-in kanji-family curriculum, used by the existing Kanji screen.
// Sentences remain Echo's only scheduled learning objects.
import {stripFurigana} from "./core.js";

export const CURRICULUM_URL = "./decks/kanji-families-curriculum.json";
let curriculumPromise = null;
const valid = data => {
  if (data?.schemaVersion !== 2 || !Array.isArray(data.kanjiFamilies) || !Array.isArray(data.sentences)) {
    throw new Error("The kanji family curriculum is not a valid Echo deck.");
  }
  return data;
};
export async function loadKanjiCurriculum(fetchImpl = fetch) {
  // Use the single offline-cached file. Tests can supply a fake fetch without
  // poisoning the production cache.
  if (fetchImpl !== fetch) {
    const response = await fetchImpl(CURRICULUM_URL);
    if (!response.ok) throw new Error("Cannot load the kanji curriculum.");
    return valid(await response.json());
  }
  if (!curriculumPromise) {
    curriculumPromise = fetchImpl(CURRICULUM_URL)
      .then(response => {
        if (!response.ok) throw new Error("Cannot load the kanji curriculum.");
        return response.json();
      }).then(valid)
      .catch(error => {curriculumPromise = null;throw error;});
  }
  return curriculumPromise;
}
export const familyFor = (curriculum, kanji) =>
  curriculum.kanjiFamilies.find(family => family.kanji === kanji) || null;
export const cardsById = curriculum => new Map(curriculum.sentences.map(sentence => [sentence.id, sentence]));
export function normalizeExample(text = "") {
  return stripFurigana(text).normalize("NFC").replace(/[\s\u3000]+/gu, "");
}
export function sentenceIndex(sentences = []) {
  return {
    ids: new Map(sentences.map(sentence => [sentence.id, sentence])),
    targets: new Map(sentences.map(sentence => [normalizeExample(sentence.target), sentence]))
  };
}
export function exampleInLibrary(card, index) {
  return index.ids.get(card.id) || index.targets.get(normalizeExample(card.target)) || null;
}
export function familyProgress(family, cards, index) {
  let added = 0, learned = 0;
  const unique = new Set(family.words.map(word => word.exampleSentenceId));
  for (const id of unique) {
    const card = cards.get(id);
    const yours = card && exampleInLibrary(card, index);
    if (yours) {added++;if (yours.srs?.state === 2) learned++;}
  }
  return {added, learned, total:unique.size};
}
