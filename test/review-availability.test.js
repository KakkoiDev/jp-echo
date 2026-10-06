import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewAvailabilityMessage} from '../review-modes.js';
const now=Date.parse('2026-10-06T12:00:00Z'),week=now+7*86400000;
test('future card cannot hide the backlog excluded by session limits',()=>{
 const message=reviewAvailabilityMessage(892,40,week,now);
 assert.match(message,/852 more cards are due now/);assert.doesNotMatch(message,/scheduled|unlocks|seven/);
});
test('completion announces all remaining due cards including zero-limit buckets',()=>{
 assert.match(reviewAvailabilityMessage(852,0,week,now),/852 more cards are due now/);
 assert.match(reviewAvailabilityMessage(1,0,week,now),/1 more card is due now/);
});
test('an active queue does not promise its next date before grading',()=>{
 assert.match(reviewAvailabilityMessage(40,40,week,now),/Grading them will set/);
});
test('future due date refers to a single scheduled card with date and time',()=>{
 const message=reviewAvailabilityMessage(0,0,week,now);
 assert.match(message,/next scheduled card is due/);assert.doesNotMatch(message,/batch|unlocks/);
 assert.equal(reviewAvailabilityMessage(0,0,undefined,now),'No cards are due now.');
});
