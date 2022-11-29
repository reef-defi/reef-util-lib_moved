import {accountsJsonSubj} from "./setAccounts";
import {AccountJson} from "@reef-defi/extension-base/background/types";
import {
    InjectedAccountWithMeta as InjectedAccountWithMetaReef,
    InjectedAccountWithMeta
} from "@reef-defi/extension-inject/types";
import {ReefAccount, ReefSigner} from "../../account/accountModel";
import {map, Observable, shareReplay} from "rxjs";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {filter} from "rxjs/operators";

// export const availableAddresses$: Observable<ReefAccount[]> = merge(accountsJsonSubj, accountsSubj).pipe(
export const availableAddresses$: Observable<ReefAccount[]> = accountsJsonSubj.pipe(
    filter((v: any) => !!v),
    map((acc:(ReefSigner  | AccountJson | InjectedAccountWithMeta | InjectedAccountWithMetaReef)[]  ) => acc!.map(a => {
        let source = (a as InjectedAccountWithMeta).meta?.source || (a as ReefAccount).source;
        if (!source) {
            source = REEF_EXTENSION_IDENT;
            console.log("No extension source set for account=", a);
        }
        let meta = (a as InjectedAccountWithMeta).meta ? (a as InjectedAccountWithMeta).meta : {source};

        return {address: a.address, ...meta} as ReefAccount;
    })),
    shareReplay(1)
);
