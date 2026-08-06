// alloc-helpers.js - helper functions for allocation module
window.AllocLib = window.AllocLib || {};

window.AllocLib.toNumber = function toNumber(v){
    if(v===null||v===undefined||v==='') return null;
    const n=Number(String(v).replace(/,/g,'').replace(/\s/g,''));
    return Number.isFinite(n)?n:null;
};

window.AllocLib.convertCurrency = function convertCurrency(amount,currency,lotInfo){
    const a=window.AllocLib.toNumber(amount);
    if(a===null) return null;
    const cur=(currency||'VND').toString().toUpperCase();
    if(cur==='VND') return a;
    const er=window.AllocLib.toNumber(lotInfo&&lotInfo.exchangeRate);
    if(er===null||er<=0) throw new Error('Missing or invalid exchangeRate');
    return a*er;
};
