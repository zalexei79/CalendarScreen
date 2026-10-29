import model from './receiptFieldModel.js';
import {receiptFieldFeatures} from './receiptFieldFeatures.js';
// Advisory only. A classifier can group/rank a row; it cannot authorize an amount.
export function classifyReceiptField(line,document){
 const input=receiptFieldFeatures(line,document),scores=model.weights.map(row=>row.reduce((s,w,i)=>s+w*input[i],0)),max=Math.max(...scores),exp=scores.map(score=>Math.exp(score-max)),sum=exp.reduce((a,b)=>a+b,0),probabilities=exp.map(value=>value/sum),best=probabilities.indexOf(Math.max(...probabilities));
 return {role:model.roles[best],confidence:probabilities[best],probabilities:Object.fromEntries(model.roles.map((role,i)=>[role,probabilities[i]]))};
}
