// alloc-main.js - combine helpers, allocators, rounding into AllocModule
window.AllocLib = window.AllocLib || {};

(function(ns){
    function calculateTotals(lotInfo,items){
        const processed=items.map(it=>{
            const quantity=ns.toNumber(it.quantity)||0;
            const weight=ns.toNumber(it.weight)||0;
            const basePrice=ns.toNumber(it.basePrice)||0;
            const currency=(it.currency||'VND').toString().toUpperCase();
            const basePriceVND=currency==='VND'?basePrice:ns.convertCurrency(basePrice,currency,lotInfo);
            const lineValue=basePriceVND*quantity;
            return Object.assign({},it,{quantity,weight,basePrice,basePriceVND,lineValue});
        });
        const totals=processed.reduce((acc,it)=>{ acc.totalQuantity+=it.quantity; acc.totalWeight+=it.weight; acc.totalValue+=it.lineValue; return acc; },{totalQuantity:0,totalWeight:0,totalValue:0});
        return {items:processed,totals};
    }

    function calculateImportCostAllocation({lotInfo,items,costs,options={}}){
        const opts=Object.assign({ defaultAllocationMethod:'value', roundingMethod:2, handleRoundingDiff:'distribute' },options||{});
        let converted;
        try{ converted=calculateTotals(lotInfo,items); }catch(e){ return { valid:false, errors:[{message:e.message}] }; }
        const procItems=converted.items; const totals=converted.totals; procItems.forEach(it=>{ it.allocatedCosts=[]; it.totalImportCost=0; }); let totalCost=0;
        for(let ci=0;ci<costs.length;ci++){
            const cost=Object.assign({},costs[ci]);
            const costAmtOriginal=ns.toNumber(cost.amount);
            if(costAmtOriginal===null) continue;
            const costVND=ns.convertCurrency(costAmtOriginal,cost.currency||'VND',lotInfo);
            totalCost+=costVND;
            const method=cost.allocationMethod||opts.defaultAllocationMethod;
            let rawAlloc=[];
            switch(method){
                case 'quantity': rawAlloc=ns.allocateCostByQuantity(costVND,procItems,totals); break;
                case 'weight': rawAlloc=ns.allocateCostByWeight(costVND,procItems,totals); break;
                case 'value': rawAlloc=ns.allocateCostByValue(costVND,procItems,totals); break;
                case 'custom': rawAlloc=ns.allocateCostByCustom(costVND,procItems,cost); break;
                case 'equal': rawAlloc=ns.allocateCostEqual(costVND,procItems); break;
                default: if(opts.defaultAllocationMethod==='quantity') rawAlloc=ns.allocateCostByQuantity(costVND,procItems,totals); else if(opts.defaultAllocationMethod==='weight') rawAlloc=ns.allocateCostByWeight(costVND,procItems,totals); else rawAlloc=ns.allocateCostByValue(costVND,procItems,totals);
            }
            const rr = ns.applyRounding(rawAlloc,Number(opts.roundingMethod)||2,opts.handleRoundingDiff);
            const rounded = rr.rounded;
            rounded.forEach((amt,idx)=>{
                const entry={ costId: cost.costId||`cost_${ci}`, costType: cost.costType||'', allocatedAmount: amt };
                procItems[idx].allocatedCosts.push(entry);
                procItems[idx].totalImportCost = Number((procItems[idx].totalImportCost + amt).toFixed(8));
            });
        }
        procItems.forEach(it=>{ it.totalImportCost=Number((it.totalImportCost||0).toFixed(8)); it.unitImportCost=it.quantity?Number((it.totalImportCost/it.quantity).toFixed(8)):0; });
        const totalAllocated=procItems.reduce((s,it)=>s+(it.totalImportCost||0),0);
        const roundingDiff=Number((totalCost-totalAllocated).toFixed(Number(opts.roundingMethod)||2));
        const result={ valid:true, items:procItems.map(it=>({ itemId:it.itemId, itemName:it.itemName, quantity:it.quantity, basePriceVND:it.basePriceVND, allocatedCosts:it.allocatedCosts.map(ac=>({costId:ac.costId,costType:ac.costType,allocatedAmount:ac.allocatedAmount})), totalImportCost:Number(it.totalImportCost.toFixed(Number(opts.roundingMethod)||2)), unitImportCost:Number(it.unitImportCost.toFixed(Number(opts.roundingMethod)||2)) })), summary:{ totalCost:Number(totalCost.toFixed(Number(opts.roundingMethod)||2)), totalAllocated:Number(totalAllocated.toFixed(Number(opts.roundingMethod)||2)), roundingDiff:roundingDiff } };
        return result;
    }

    window.AllocModule = { calculateImportCostAllocation };
})(window.AllocLib);
