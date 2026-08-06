// alloc-rounding.js - rounding and handling rounding diff
window.AllocLib = window.AllocLib || {};

window.AllocLib.applyRounding = function(allocationsRaw,decimals=2,handleRoundingDiff='distribute'){
    const unit=Math.pow(10,-decimals);
    const factor=Math.pow(10,decimals);
    const rounded=allocationsRaw.map(v=>{ if(v===null||v===undefined) return 0; return Math.round((Number(v)+0)*factor)/factor; });
    const rawSum=allocationsRaw.reduce((s,v)=>s+(Number(v)||0),0);
    const roundedSum=rounded.reduce((s,v)=>s+(Number(v)||0),0);
    let diff=Math.round((rawSum-roundedSum)/unit)*unit;
    if(Math.abs(diff)<1e-12) diff=0;
    if(diff===0||handleRoundingDiff==='none'){
        return { rounded, roundingDiff: rawSum-roundedSum };
    }
    const neededUnits=Math.round(diff/unit);
    if(handleRoundingDiff==='last'){
        const lastIdx=rounded.length-1;
        rounded[lastIdx]=Number((rounded[lastIdx]+diff).toFixed(decimals));
        return { rounded, roundingDiff: rawSum-rounded.reduce((s,v)=>s+v,0) };
    }
    const fractions=allocationsRaw.map((v,i)=>{ const absVal=Math.abs(Number(v)||0); const rawTimes=absVal*factor; const frac=rawTimes-Math.floor(rawTimes); return {idx:i,frac,abs:absVal}; });
    if(neededUnits>0){ fractions.sort((a,b)=>b.frac-a.frac); for(let k=0;k<neededUnits;k++){ const idx=fractions[k%fractions.length].idx; rounded[idx]=Number((rounded[idx]+unit).toFixed(decimals)); } }
    else if(neededUnits<0){ fractions.sort((a,b)=>a.frac-b.frac); for(let k=0;k<Math.abs(neededUnits);k++){ const idx=fractions[k%fractions.length].idx; rounded[idx]=Number((rounded[idx]-unit).toFixed(decimals)); } }
    const finalRoundedSum=rounded.reduce((s,v)=>s+(Number(v)||0),0);
    return { rounded, roundingDiff: rawSum-finalRoundedSum };
};
