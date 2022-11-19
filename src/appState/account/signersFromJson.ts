import {accountsJsonSigningKeySubj, accountsJsonSubj, accountsSubj} from "./setAccounts";
import {AccountJson} from "@reef-defi/extension-base/background/types";
import {InjectedAccountWithMeta} from "@reef-defi/extension-inject/types";
import {Provider} from "@reef-defi/evm-provider";
import {Signer as InjectedSigningKey} from "@polkadot/api/types";
import {ReefAccount, ReefSigner} from "../../account/ReefAccount";
import {combineLatest, map, merge, Observable, shareReplay, switchMap, tap} from "rxjs";
import {currentProvider$} from "../providerState";
import {accountJsonToMeta, metaAccountToSigner} from "../../account/accounts";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {filter} from "rxjs/operators";

let convertJsonAccountsToReefSigners = ([jsonAccounts, provider, signingKey]: [(AccountJson[] | InjectedAccountWithMeta[] | null), Provider, InjectedSigningKey]) => {
    let accounts = jsonAccounts || [];
    let accMeta: InjectedAccountWithMeta[] = [];
    if (accounts?.length && !accounts[0].meta) {
        accMeta = accounts.map((acc) => accountJsonToMeta(acc, REEF_EXTENSION_IDENT));
    } else {
        accMeta = accounts as InjectedAccountWithMeta[];
    }
    return Promise.all(
        accMeta.map((account) => metaAccountToSigner(account, provider as Provider, signingKey as InjectedSigningKey)),
    ).then((signers: (ReefSigner | undefined)[]) => signers.filter((s) => !!s)) as Promise<ReefSigner[]>;
};

export const signersFromJson$: Observable<ReefSigner[]> = combineLatest([accountsJsonSubj, currentProvider$, accountsJsonSigningKeySubj]).pipe(
    switchMap(convertJsonAccountsToReefSigners),
    shareReplay(1),
);

export const _signersRegistered$: Observable<ReefSigner[]> = merge(accountsSubj, signersFromJson$).pipe(
    map((signrs) => (signrs && signrs.length ? signrs : [])),
    shareReplay(1),
);

export const availableAddresses$: Observable<ReefAccount[]> = merge(accountsJsonSubj, accountsSubj).pipe(
    filter(v => !!v),
    map(acc => acc!.map(a => {
        let source = acc.meta?.source || acc.source;
        if (!source) {
            source = REEF_EXTENSION_IDENT;
            console.log("No extension source set for account=", acc);
        }
        let meta = acc.meta ? acc.meta : {source};

        return {address: a.address, ...meta} as ReefAccount;
    })),
    shareReplay(1)
);
