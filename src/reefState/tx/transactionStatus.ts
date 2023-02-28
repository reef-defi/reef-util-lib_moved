import {mergeMap, Observable, scan, shareReplay, Subject} from "rxjs";
import {TransactionStatusEvent} from "../../transaction";
import {merge} from "rxjs/internal/operators/merge";

export const addTransactionStatusSubj = new Subject<TransactionStatusEvent>()
export const attachTxStatusObservableSubj = new Subject<Observable<TransactionStatusEvent>>();
export const txStatusList$ = attachTxStatusObservableSubj.pipe(
    mergeMap(status$=>status$),
    merge(addTransactionStatusSubj),
    scan((statById:Map<string, TransactionStatusEvent>, newEvent: TransactionStatusEvent)=>{
        statById.set(newEvent.txIdent, newEvent);
        return statById;
    }, new Map()),
    shareReplay(1)
);

