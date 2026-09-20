export function ankiSchedule(srs,createdSeconds){
  if(!srs||!srs.reps)return null;
  const learning=srs.state===1||srs.state===3;
  return {
    type:learning?(srs.state===3?3:1):2,
    queue:learning?1:2,
    due:learning?Math.floor(Date.parse(srs.due)/1000):Math.max(0,Math.floor(Date.parse(srs.due)/86400000)-Math.floor(createdSeconds/86400)),
    interval:Math.max(1,Number(srs.scheduled_days)||1),
    factor:2500,
    reps:Number(srs.reps)||0,
    lapses:Number(srs.lapses)||0,
    left:learning?1001:0
  };
}
