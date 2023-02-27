import {
    getEvmTransactionStatus$,
    getNativeTransactionStatusHandler$,
    parseAndRethrowErrorFromObserver,
    TransactionStatusEvent
} from "./transactionStatus";
import {Observable, of, switchMap} from "rxjs";
import {Provider} from "@reef-defi/evm-provider";
import type {Signer as SignerInterface} from '@polkadot/api/types';
import {ReefAccount} from "../account";
import {BigNumber, Contract} from "ethers";
import {getEvmAddress} from "../account/addressUtil";
import {TX_STATUS_ERROR_CODE} from "./txErrorUtil";

export function nativeTransfer$(amount: string, destinationAddress: string, provider: Provider, signer: ReefAccount, signingKey: SignerInterface): Observable<TransactionStatusEvent> {
    const {status$, handler} = getNativeTransactionStatusHandler$();

    provider.api.query.system.account(signer.address).then((res)=>{
        let fromBalance = res.data.free.toString();
        if(BigNumber.from(amount).gte(fromBalance)){
            status$.error(new Error(TX_STATUS_ERROR_CODE.ERROR_BALANCE_TOO_LOW));
            return;
        }

        provider.api.tx.balances
            .transfer(destinationAddress, amount)
            .signAndSend(signer.address, {signer: signingKey}, handler).then((unsub) => {
            status$.subscribe(null, null, () => unsub());
        }).catch(parseAndRethrowErrorFromObserver(status$));

    });

    return status$.asObservable();
}

export function reef20Transfer$(to: string, provider, tokenAmount: string, tokenContract: Contract): Observable<TransactionStatusEvent> {
    const STORAGE_LIMIT = 2000;
    return of(to).pipe(
        switchMap(async (toAddress: string) => {
            // TODO use method to check if evm
            const toAddr = toAddress.length === 48
                ? await getEvmAddress(toAddress, provider)
                : toAddress;
            return [toAddr, tokenAmount];
        }),
        switchMap((ARGS) => {

            const txPromise = tokenContract.transfer(...ARGS, {
                customData: {
                    storageLimit: STORAGE_LIMIT
                }
            });
            return getEvmTransactionStatus$(txPromise, provider.api);
        }),
    )
}