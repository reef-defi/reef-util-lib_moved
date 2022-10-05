import {UpdateDataCtx} from "../model/updateStateModel";
import {ReefSigner} from "../../account/ReefAccount";
import {ReplaySubject, Subject} from "rxjs";
import type {Signer as InjectedSigningKey} from '@polkadot/api/types';
import type {InjectedAccountWithMeta} from '@polkadot/extension-inject/types';
import {AccountJson} from '@reef-defi/extension-base/background/types';
import {InjectedAccountWithMeta as InjectedAccountWithMetaReef} from "@reef-defi/extension-inject/types";

export const accountsSubj = new ReplaySubject<ReefSigner[] | null>(1);
export const accountsJsonSubj = new ReplaySubject<AccountJson[]| InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[] | null>(1);
export const accountsJsonSigningKeySubj = new ReplaySubject<InjectedSigningKey>(1);
export const reloadSignersSubj = new Subject<UpdateDataCtx<ReefSigner[]>>();

export const currentAddressSubj: Subject<string | undefined> = new Subject<string | undefined>();
export const setCurrentAddress = (address: string|undefined) => currentAddressSubj.next(address);

