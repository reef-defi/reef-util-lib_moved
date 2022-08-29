import {AccountJson} from "@reef-defi/extension-base/background/types";
import {InjectedAccountWithMeta} from "@reef-defi/extension-inject/types";
import {Provider} from "@reef-defi/evm-provider";
import {Signer as InjectedSigningKey} from "@polkadot/api/types";
import {ReefAccount} from "../../account/ReefAccount";
import {combineLatest, Observable, shareReplay, switchMap} from "rxjs";
import {accountsJsonSigningKeySubj, accountsJsonSubj} from "./setAccounts";
import {currentProvider$} from "../providerState";
import {accountJsonToMeta} from "../../account/accounts";

let convertJsonAccountsToReefSigners = ([jsonAccounts, provider, signingKey]: [(AccountJson[] | InjectedAccountWithMeta[] | null), Provider, InjectedSigningKey]) => {
    let accounts = jsonAccounts || [];
    if (accounts?.length && !accounts[0].meta) {
        accounts = accounts.map((acc) => accountJsonToMeta(acc));
    }
    return Promise.all(
        accounts.map((account) => metaAccountToSigner(account, provider as Provider, signingKey as InjectedSigningKey)),
    ).then((signers:ReefAccount[]) => signers.filter((s) => !!s)) as Promise<ReefAccount[]>;
};
export const signersFromJson$: Observable<ReefAccount[]> = combineLatest([accountsJsonSubj, currentProvider$, accountsJsonSigningKeySubj]).pipe(
    switchMap(convertJsonAccountsToReefSigners),
    shareReplay(1),
);
