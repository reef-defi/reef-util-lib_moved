import {Observable, Subject} from "rxjs";
import {ApiPromise} from "@polkadot/api";

export enum TxStage{
    BROADCAST = 'BCST',
    INCLUDED_IN_BLOCK = 'INCLUDED',
    BLOCK_FINALIZED = 'FINALIZED',
    BLOCK_NOT_FINALIZED = 'NOT_FINALIZED',
}

export enum TxErrorCode {
    BALANCE_TOO_LOW= 'BALANCE_LOW'
}

export interface TransactionStatusEvent {
    txStage: TxStage;
    txData?: any;
    //error: {message:string, code:}
}

function getTxObserverHandler(evmTxPromise: Promise<any>, rpcApi: ApiPromise) {
    return (observer) => {
        evmTxPromise.then((tx) => {
            observer.next({txStage: TxStage.BROADCAST, txData: tx});
            // console.log('tx in progress =', tx.hash);
            tx.wait().then(async (receipt) => {
                // console.log("transfer included in block=", receipt.blockHash);
                observer.next({txStage: TxStage.INCLUDED_IN_BLOCK, txData: receipt});
                let count = 50;
                const finalizedCount = -111;
                const unsubHeads = await rpcApi.rpc.chain.subscribeFinalizedHeads((lastHeader) => {
                    if (receipt.blockHash.toString() === lastHeader.hash.toString()) {
                        observer.next({txStage: TxStage.BLOCK_FINALIZED, txData: receipt});
                        count = finalizedCount;
                    }

                    if (--count < 0) {
                        if (count > finalizedCount) {
                            // TODO check tx how long is valid
                            observer.next({txStage: TxStage.BLOCK_NOT_FINALIZED, txData: receipt});
                        }
                        unsubHeads();
                        observer.complete();
                    }
                });
            }).catch((err) => {
                console.log('transfer tx.wait ERROR=', err.message)
                observer.error(err)
            });
        }).catch((err) => {
            console.log('transfer ERROR=', err.message)
            observer.error(err)
        });
    };
}

export function getEvmTransactionStatus$(evmTxPromise: Promise<any>, rpcApi: ApiPromise): Observable<TransactionStatusEvent>{
    return new Observable(getTxObserverHandler(evmTxPromise, rpcApi))
}

export function getNativeTransactionStatusHandler$(): {handler:(result: any) => void, status$: Subject<TransactionStatusEvent> }{
    const observer = new Subject<TransactionStatusEvent>();
    return {
        handler:(result) => {
            // console.log(`Current status is ${result.status}`);
            if (result.status.isBroadcast) {
                observer.next({txStage: TxStage.BROADCAST});
            } else if (result.status.isInBlock) {
                // console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                observer.next({txStage: TxStage.INCLUDED_IN_BLOCK, txData: result.status.asInBlock.toString()});
                // transferSubj.next(result.status.asInBlock.toString());
            } else if (result.status.isFinalized) {
                // console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                observer.next({txStage: TxStage.BLOCK_FINALIZED, txData: result.status.asFinalized.toString()});
                // transferSubj.next(result.status.asInBlock.toString());
                setTimeout(() => {
                    observer.complete();
                });
            }
        },
        status$: observer
    }
}