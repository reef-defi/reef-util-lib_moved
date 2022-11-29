import {UpdateDataCtx} from "../model/updateStateModel";
import {ReefSigner} from "../../account/accountModel";
import {ReplaySubject, Subject} from "rxjs";
import type {Signer as InjectedSigningKey} from '@polkadot/api/types';
import type {InjectedAccountWithMeta} from '@polkadot/extension-inject/types';
import {AccountJson} from '@reef-defi/extension-base/background/types';
import {InjectedAccountWithMeta as InjectedAccountWithMetaReef} from "@reef-defi/extension-inject/types";

// export const accountsSubj = new ReplaySubject<ReefSigner[] | null>(1);
export const accountsJsonSubj = new ReplaySubject<AccountJson[]| InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[] | null>(1);
export const accountsJsonSigningKeySubj = new ReplaySubject<InjectedSigningKey>(1);
export const updateSignersSubj = new Subject<UpdateDataCtx<ReefSigner[]>>();
export const setAccounts = (accounts: AccountJson[]| InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[] | null) => accountsJsonSubj.next(accounts);

export const selectedAddressSubj: Subject<string | undefined> = new Subject<string | undefined>();
export const setSelectedAddress = (address: string|undefined) => selectedAddressSubj.next(address);

