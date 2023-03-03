import {
    getEvmTransactionStatus$,
    getNativeTransactionStatusHandler$,
    parseAndRethrowErrorFromObserver
} from "./transaction-status-util";
import {from, Observable, of, switchMap} from "rxjs";
import {Provider, Signer} from "@reef-defi/evm-provider";
import type {Signer as SignerInterface} from '@polkadot/api/types';
import {BigNumber, Contract} from "ethers";
import {getEvmAddress} from "../account/addressUtil";
import {TX_STATUS_ERROR_CODE} from "./txErrorUtil";
import {addPendingTransactionSubj, attachPendingTxObservableSubj} from "../reefState/tx/pendingTx.rx";
import {TransactionStatusEvent, TxStage} from "./transaction-model";

export function nativeTransferSigner$(amount: string, signer: Signer, toAddress: string): Observable<TransactionStatusEvent> {
    return from(signer.getSubstrateAddress()).pipe(
        switchMap((fromAddr: string) => nativeTransfer$(amount, fromAddr , toAddress, signer.provider, signer.signingKey))
    );
}

export function nativeTransfer$(amount: string, fromAddress: string, toAddress: string, provider: Provider, signingKey: SignerInterface, txIdent:string = Math.random().toString()): Observable<TransactionStatusEvent> {
    const {status$, handler} = getNativeTransactionStatusHandler$(txIdent);

    addPendingTransactionSubj.next({txIdent, txStage: TxStage.SIGNATURE_REQUEST});
    provider.api.query.system.account(fromAddress).then((res)=>{
        let fromBalance = res.data.free.toString();
        if(BigNumber.from(amount).gte(fromBalance)){
            let error = new Error(TX_STATUS_ERROR_CODE.ERROR_BALANCE_TOO_LOW);
            status$.error({error, txIdent});
            return;
        }

        provider.api.tx.balances
            .transfer(toAddress, amount)
            .signAndSend(fromAddress, {signer: signingKey}, handler).then((unsub) => {
            status$.subscribe(null, null, () => unsub());
        }).catch(parseAndRethrowErrorFromObserver(status$, txIdent));

    });
    attachPendingTxObservableSubj.next(status$);
    return status$.asObservable();
}

export function reef20Transfer$(to: string, provider, tokenAmount: string, tokenContract: Contract, txIdent:string = Math.random().toString()): Observable<TransactionStatusEvent> {
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
            addPendingTransactionSubj.next({txIdent, txStage: TxStage.SIGNATURE_REQUEST});
            const txPromise = tokenContract.transfer(...ARGS, {
                customData: {
                    storageLimit: STORAGE_LIMIT,
                    txIdent
                }
            });
            return getEvmTransactionStatus$(txPromise, provider.api, txIdent);
        }),
    )
}