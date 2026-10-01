import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSpokenAmount} from '../src/shared/lib/spokenAmount.js';
test('spoken amounts and cents in supported languages',()=>{
 for(const [phrase,result] of [
 ['125,50','125.5'],['1 250,50','1250.5'],['сто двадцать пять рублей','125'],
 ['две тысячи пятьсот','2500'],['сто двадцать пять рублей пятьдесят копеек','125.5'],
 ['one hundred twenty five dollars and fifty cents','125.5'],['one thousand two hundred thirty four','1234'],
 ['o sută douăzeci și cinci lei','125'],['două mii trei sute','2300'],
 ['сумма пятьдесят','50'],['zero point zero five','0.05'],['пять запятая двадцать пять','5.25'],['0','0'],
 ])assert.equal(parseSpokenAmount(phrase),result,phrase);
});
test('unrelated speech, dates, signs and ambiguous amounts do not change money',()=>{
 for(const phrase of ['','and','de','привет','я купил 5 яблок','запиши 100 завтра в 5','24 октября 2026','100 и 200','one two','minus fifty','-125','125/50','1.234','пять рублей двести копеек','1000000000000'])assert.equal(parseSpokenAmount(phrase),null,phrase);
});
