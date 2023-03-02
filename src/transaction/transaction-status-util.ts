import {Observable, Observer, Subject} from "rxjs";
import {shareReplay} from "rxjs/operators";
import {ApiPromise} from "@polkadot/api";
import {toTxErrorCodeValue, TX_STATUS_ERROR_CODE} from "./txErrorUtil";
import {attachPendingTxObservableSubj} from "../reefState/tx/currentTx.rx";
import {TransactionStatusEvent, TxStage} from "./transaction-model";


export function parseAndRethrowErrorFromObserver(observer: Observer<TransactionStatusEvent>, txIdent: string) {
    return (err) => {
        const parsedErr = toTxErrorCodeValue(err);
        let reError = !!parsedErr.code && parsedErr.code != TX_STATUS_ERROR_CODE.ERROR_UNDEFINED ? new Error(parsedErr.code) : err;
        observer.error(new TxStatusError(reError.message, txIdent));
    };
}

export function getEvmTransactionStatus$(evmTxPromise: Promise<any>, rpcApi: ApiPromise, txIdent: string): Observable<TransactionStatusEvent>{
    const status$= new Observable((observer) => {
            evmTxPromise.then((tx) => {
                observer.next({txStage: TxStage.BROADCAST, txData: tx, txIdent} as TransactionStatusEvent);
                // console.log('tx in progress =', tx.hash);
                tx.wait().then(async (receipt) => {
                    // console.log("transfer included in block=", receipt.blockHash);
                    observer.next({txStage: TxStage.INCLUDED_IN_BLOCK, txData: receipt, txIdent});
                    let count = 10;
                    const finalizedCount = -111;
                    const unsubHeads = await rpcApi.rpc.chain.subscribeFinalizedHeads((lastHeader) => {
                        if (receipt.blockHash.toString() === lastHeader.hash.toString()) {
                            observer.next({txIdent, txStage: TxStage.BLOCK_FINALIZED, txData: receipt});
                            count = finalizedCount;
                        }

                        if (--count < 0) {
                            if (count > finalizedCount) {
                                observer.next({txIdent, txStage: TxStage.BLOCK_NOT_FINALIZED, txData: receipt});
                            }
                            unsubHeads();
                            observer.complete();
                        }
                    });
                }).catch((err) => {
                    console.log('transfer tx.wait ERROR=', err.message)

                    observer.error(new TxStatusError(err.message, txIdent));
                });
            }).catch(parseAndRethrowErrorFromObserver(observer, txIdent));
        }).pipe(
        // @ts-ignore
        shareReplay(1)
    ) as Observable<TransactionStatusEvent>;
    attachPendingTxObservableSubj.next(status$);
    return status$;
}

export function getNativeTransactionStatusHandler$(txIdent: string): {handler:(result: any) => void, status$: Subject<TransactionStatusEvent> }{
    const observer = new Subject<TransactionStatusEvent>();
    return {
        handler:(result) => {
            // console.log(`Current status is ${result.status}`);
            if (result.status.isBroadcast) {
                observer.next({txStage: TxStage.BROADCAST, txIdent});
            } else if (result.status.isInBlock) {
                console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                observer.next({txStage: TxStage.INCLUDED_IN_BLOCK, txData: {blockHash:result.status.asInBlock.toString()}, txIdent});
            } else if (result.status.isFinalized) {
                console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                observer.next({txStage: TxStage.BLOCK_FINALIZED, txData: {blockHash:result.status.asFinalized.toString()}, txIdent});
                setTimeout(() => {
                    observer.complete();
                });
            }
        },
        status$: observer
    }
}

export class TxStatusError extends Error{
    txIdent: string;
    constructor(message: string, txIdent: string) {
        super();
        this.txIdent=txIdent;
        this.message=message;
    }
}