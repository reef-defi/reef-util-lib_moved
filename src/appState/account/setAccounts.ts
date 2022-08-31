import {UpdateDataCtx} from "../model/updateStateModel";
import {ReefSigner} from "../../account/ReefAccount";
import {map, merge, Observable, ReplaySubject, shareReplay, Subject} from "rxjs";
import type {Signer as InjectedSigningKey} from '@polkadot/api/types';
import type {InjectedAccountWithMeta} from '@polkadot/extension-inject/types';
import {AccountJson} from '@reef-defi/extension-base/background/types';
import {signersFromJson$} from "./signersFromJson";
import {InjectedAccountWithMeta as InjectedAccountWithMetaReef} from "@reef-defi/extension-inject/types";

export const accountsSubj = new ReplaySubject<ReefSigner[] | null>(1);
export const accountsJsonSubj = new ReplaySubject<AccountJson[]| InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[] | null>(1);
export const accountsJsonSigningKeySubj = new ReplaySubject<InjectedSigningKey>(1);
export const reloadSignersSubj = new Subject<UpdateDataCtx<ReefSigner[]>>();

export const currentAddressSubj: Subject<string | undefined> = new Subject<string | undefined>();
export const setCurrentAddress = (address: string|undefined) => currentAddressSubj.next(address);

export const signersRegistered$: Observable<ReefSigner[]> = merge(accountsSubj, signersFromJson$).pipe(
    map((signrs) => (signrs && signrs.length ? signrs : [])),
    shareReplay(1),
);

signersRegistered$.subscribe(v=>console.log('rrresss',v))
