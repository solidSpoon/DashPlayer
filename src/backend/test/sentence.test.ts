// sum.test.js
import { expect, test } from 'vitest'
import { processSentence } from '@/backend/controllers/SubtitleProcesser';
test("i'm a boy", () => {
    let sentenceStruct = processSentence("I think that's a good idea.");
    console.log(JSON.stringify(sentenceStruct, null, 2));
})
