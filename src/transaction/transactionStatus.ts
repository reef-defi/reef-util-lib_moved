import {Observable, Observer, Subject} from "rxjs";
import {ApiPromise} from "@polkadot/api";
import {toTxErrorCodeValue, TX_STATUS_ERROR_CODE} from "./txErrorUtil";

export enum TxStage{
    BROADCAST = 'BROADCAST',
    INCLUDED_IN_BLOCK = 'INCLUDED_IN_BLOCK',
    BLOCK_FINALIZED = 'BLOCK_FINALIZED',
    BLOCK_NOT_FINALIZED = 'BLOCK_NOT_FINALIZED',
}

export interface TransactionStatusEvent {
    txStage: TxStage;
    txData?: any;
}


export function parseAndRethrowErrorFromObserver(observer: Observer<TransactionStatusEvent>) {
    return (err) => {
        const parsedErr = toTxErrorCodeValue(err);
        observer.error(!!parsedErr.code && parsedErr.code != TX_STATUS_ERROR_CODE.ERROR_UNDEFINED ? new Error(parsedErr.code) : err)
    };
}

export function getEvmTransactionStatus$(evmTxPromise: Promise<any>, rpcApi: ApiPromise): Observable<TransactionStatusEvent>{
    return new Observable((observer) => {
            evmTxPromise.then((tx) => {
                observer.next({txStage: TxStage.BROADCAST, txData: tx});
                // console.log('tx in progress =', tx.hash);
                tx.wait().then(async (receipt) => {
                    // console.log("transfer included in block=", receipt.blockHash);
                    observer.next({txStage: TxStage.INCLUDED_IN_BLOCK, txData: receipt});
                    let count = 10;
                    const finalizedCount = -111;
                    const unsubHeads = await rpcApi.rpc.chain.subscribeFinalizedHeads((lastHeader) => {
                        if (receipt.blockHash.toString() === lastHeader.hash.toString()) {
                            observer.next({txStage: TxStage.BLOCK_FINALIZED, txData: receipt});
                            count = finalizedCount;
                        }

                        if (--count < 0) {
                            if (count > finalizedCount) {
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
            }).catch(parseAndRethrowErrorFromObserver(observer));
        });
}

export function getNativeTransactionStatusHandler$(): {handler:(result: any) => void, status$: Subject<TransactionStatusEvent> }{
    const observer = new Subject<TransactionStatusEvent>();
    return {
        handler:(result) => {
            // console.log(`Current status is ${result.status}`);
            if (result.status.isBroadcast) {
                observer.next({txStage: TxStage.BROADCAST});
            } else if (result.status.isInBlock) {
                console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                observer.next({txStage: TxStage.INCLUDED_IN_BLOCK, txData: {blockHash:result.status.asInBlock.toString()}});
            } else if (result.status.isFinalized) {
                console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                observer.next({txStage: TxStage.BLOCK_FINALIZED, txData: {blockHash:result.status.asFinalized.toString()}});
                setTimeout(() => {
                    observer.complete();
                });
            }
        },
        status$: observer
    }
}