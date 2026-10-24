import test from 'node:test';
import assert from 'node:assert/strict';
import { performanceScore, plotGeometry } from '../src/features/bot-calendar/botAnalyticsModel.js';

test('score has an explicit sample floor, bounded components and no fabricated zero-loss PF',()=>{
  const good={total:40,active_days:6,positive_days:6,gross_profit:100,gross_loss:0,profit_factor:null,max_drawdown:0,pnl:100,win_rate:100};
  assert.equal(performanceScore({...good,total:29}),null);assert.equal(performanceScore({...good,active_days:4}),null);
  assert.equal(performanceScore(good).value,100);
  assert.equal(performanceScore({...good,gross_profit:0,gross_loss:100,profit_factor:0,pnl:-100,win_rate:0,positive_days:0,max_drawdown:100}).value,0);
  const result=performanceScore({...good,gross_loss:100,profit_factor:1,positive_days:3,pnl:0,max_drawdown:50,win_rate:50});
  assert.equal(result.value,38);assert.equal(result.parts.reduce((n,p)=>n+p.weight,0),100);
});
test('charts include the real zero baseline and preserve losses, flat data and negative results',()=>{
  for(const curve of [[],[{total:0}],[{total:-50},{total:-100}],[{total:100},{total:-20},{total:40}]]) {
    const g=plotGeometry(curve);assert.equal(g.points[0].value,0);
    assert.ok(g.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y>=0&&p.y<=g.height));
    assert.equal(g.points.at(-1).value,Number(curve.at(-1)?.total||0));
  }
  assert.ok(plotGeometry([{drawdown:50}],'drawdown').points[1].value===50);
});
