import {
    getEvmTransactionStatus$,
    getNativeTransactionStatusHandler$,
    TransactionStatusEvent
} from "../utils/transactionStatus";
import {Observable, of, switchMap} from "rxjs";
import {Provider} from "@reef-defi/evm-provider";
import Signer from "@reef-defi/extension-base/page/Signer";
import {ReefAccount} from "../account";
import {Contract} from "ethers";
import {getEvmAddress} from "../account/addressUtil";

export function nativeTransfer$ (amount: string, destinationAddress: string, provider: Provider, signer: ReefAccount, signingKey: Signer): Observable<TransactionStatusEvent> {
    const {status$, handler} = getNativeTransactionStatusHandler$();
        provider.api.tx.balances
            .transfer(destinationAddress, amount)
            .signAndSend(signer.address, {signer: signingKey}, handler /*(result) => {
                // console.log(`Current status is ${result.status}`);
                if (result.status.isBroadcast) {
                    observer.next({status: 'broadcast'});
                } else if (result.status.isInBlock) {
                    // console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                    observer.next({status: 'included-in-block', blockHash: result.status.asInBlock.toString()});
                    // transferSubj.next(result.status.asInBlock.toString());
                } else if (result.status.isFinalized) {
                    // console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                    observer.next({status: 'finalized', blockHash: result.status.asFinalized.toString()});
                    // transferSubj.next(result.status.asInBlock.toString());
                    setTimeout(() => {
                        // unsub();
                        observer.complete();
                    });
                }
            }*/).then((unsub)=>{
                status$.subscribe(null, null, ()=>unsub());
            }).catch((err) => {
            status$.error(err)
        });

       return status$.asObservable();
};

export function reef20Transfer$(to: string, provider, tokenAmount: string, tokenContract: Contract): Observable<TransactionStatusEvent> {
    const STORAGE_LIMIT = 2000;

    return of(to).pipe(
        switchMap(async (toAddress: string)=>{
            // TODO use method to check if evm
            const toAddr = toAddress.length === 48
                ? await getEvmAddress(toAddress, provider)
                : toAddress;
            return [toAddr, tokenAmount];
        }),
        switchMap((ARGS)=>{
            const txPromise = tokenContract.transfer(...ARGS, {
                customData: {
                    storageLimit: STORAGE_LIMIT
                }
            });
            return getEvmTransactionStatus$(txPromise, provider.api);
        })
    )




                /*.then((tx) => {
                observer.next({status: 'broadcast', transactionResponse: tx});
                console.log('tx in progress =', tx.hash);
                tx.wait().then(async (receipt) => {
                    console.log("transfer included in block=", receipt.blockHash);
                    observer.next({status: 'included-in-block', transactionReceipt: receipt});
                    let count=10;
                    const finalizedCount=-111;
                    const unsubHeads = await provider.api.rpc.chain.subscribeFinalizedHeads((lastHeader) => {
                        if(receipt.blockHash.toString() === lastHeader.hash.toString()){
                            observer.next({status: 'finalized', transactionReceipt: receipt});
                            count=finalizedCount;
                        }

                        if (--count < 0) {
                            if(count>finalizedCount){
                                observer.next({status: 'not-finalized', transactionReceipt: receipt});
                            }
                            unsubHeads();
                            observer.complete();
                        }
                    });
                }).catch((err)=>{
                    console.log('transfer tx.wait ERROR=',err.message)
                    observer.error(err)});
            }).catch((err)=>{
                console.log('transfer ERROR=',err.message)
                observer.error(err)})*/;

}