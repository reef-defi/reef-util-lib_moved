import {catchError, map, mergeMap, Observable, of, scan, shareReplay, Subject, tap} from "rxjs";
import {TransactionStatusEvent, TxStage} from "../../transaction";
import {merge} from "rxjs/internal/operators/merge";
import {filter} from "rxjs/operators";

export const addTransactionStatusSubj = new Subject<TransactionStatusEvent>()
export const attachTxStatusObservableSubj = new Subject<Observable<TransactionStatusEvent>>();
export const txStatusList$ = attachTxStatusObservableSubj.pipe(
    mergeMap(status$ => status$),
    merge(addTransactionStatusSubj),
    catchError((err) => {
        console.log('ERRRRRR', err);
        return of({txIdent: err.txIdent, txStage: TxStage.ENDED} as TransactionStatusEvent);
    }),
    scan((statById: Map<string, TransactionStatusEvent>, newState: TransactionStatusEvent) => {
        if (newState.txStage == TxStage.BLOCK_NOT_FINALIZED || newState.txStage == TxStage.BLOCK_FINALIZED || newState.txStage == TxStage.ENDED) {
            statById.delete(newState.txIdent);
            return statById;
        }
        statById.set(newState.txIdent, newState);
        return statById;
    }, new Map()),
    tap((v)=>console.log('new list', Array.from(v.keys()).length)),
    shareReplay(1)
);

