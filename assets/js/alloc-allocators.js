// alloc-allocators.js - allocation strategies
window.AllocLib = window.AllocLib || {};

window.AllocLib.allocateCostByQuantity = function(costAmount,items,totals){
    const totalQ=totals.totalQuantity||0; if(!totalQ) return items.map(()=>costAmount/items.length);
    return items.map(it=> (it.quantity/totalQ)*costAmount);
};

window.AllocLib.allocateCostByWeight = function(costAmount,items,totals){
    const totalW=totals.totalWeight||0; if(!totalW) return items.map(()=>costAmount/items.length);
    return items.map(it=> (it.weight/totalW)*costAmount);
};

window.AllocLib.allocateCostByValue = function(costAmount,items,totals){
    const totalV=totals.totalValue||0; if(!totalV) return items.map(()=>costAmount/items.length);
    return items.map(it=> (it.lineValue/totalV)*costAmount);
};

window.AllocLib.allocateCostByCustom = function(costAmount,items,cost){
    if(Array.isArray(cost.allocationRatios)){
        const ratios=cost.allocationRatios.map(r=>Number(r)||0);
        const sum=ratios.reduce((s,x)=>s+x,0);
        if(sum<=0) return items.map(()=>0);
        return items.map((_,i)=> (ratios[i]/sum)*costAmount);
    }
    if(typeof cost.allocationCallback==='function'){
        const res=cost.allocationCallback(items,costAmount);
        if(!Array.isArray(res)||res.length!==items.length) throw new Error('allocationCallback must return array same length as items');
        return res.map(x=>Number(x)||0);
    }
    return items.map(()=>costAmount/items.length);
};

window.AllocLib.allocateCostEqual = function(costAmount,items){ return items.map(()=>costAmount/items.length); };
