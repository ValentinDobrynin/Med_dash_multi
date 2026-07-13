// Sanity: adapters + mock data produce sensible structures (no DOM needed).
import { mockData } from '../src/mockData.js';
import { buildMarkers, buildPanels, statusTotals, nearestWeight, pearson, quantitativeMarkers, computeStatus } from '../src/adapters.js';

const d = mockData();
console.log('labs rows:', d.labs.length, '| weight pts:', d.weight.length, '| dict:', d.dictionary.length);
const mm = buildMarkers(d.labs, d.dictionary);
console.log('markers:', Object.keys(mm).length);
const panels = buildPanels(mm);
console.log('panels:', panels.map(p => `${p.id}(${p.kind},${p.markers.length})`).join(', '));
console.log('totals:', JSON.stringify(statusTotals(mm)));
// dual seq check on potassium
const k = mm['potassium'];
console.log('potassium points:', k.points.length, '| last seq0 status:', k.status, '| last value:', k.last.value);
// status rules
console.log('status higher_worse 5.2>3.0:', computeStatus('higher_worse',5.2,null,3.0));
console.log('status window 6.5 in [3.5,5.1]:', computeStatus('window',6.5,3.5,5.1));
console.log('status window border 5.0:', computeStatus('window',5.0,3.5,5.1));
// nearest join + pearson
const w = d.weight.map(x=>({measure_date:x.measure_date, weight_kg:x.weight_kg}));
const ldl = mm['ldl_c'];
const pairs = ldl.points.filter(p=>p.value!=null).map(p=>{const nw=nearestWeight(p.date,w); return nw?[nw.weight,p.value]:null;}).filter(Boolean);
console.log('ldl pairs:', pairs.length, '| r=', pearson(pairs).toFixed(3));
console.log('quant markers for dropdown:', quantitativeMarkers(mm).length);
console.log('SMOKE OK');
