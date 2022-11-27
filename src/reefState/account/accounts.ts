import {accountsWithUpdatedIndexedData$} from "./accountsIndexedData";
import {InjectedAccount, InjectedAccountWithMeta} from "@polkadot/extension-inject/types";
import {
    InjectedAccount as InjectedAccountReef,
    InjectedAccountWithMeta as InjectedAccountWithMetaReef
} from "@reef-defi/extension-inject/types";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";

export const accounts$ = accountsWithUpdatedIndexedData$;

export const toInjectedAccountsWithMeta = (injAccounts: InjectedAccount[] | InjectedAccountReef[], extensionSourceName: string = REEF_EXTENSION_IDENT   ): InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[]=>{
    return injAccounts.map(acc => ({
        address: acc.address,
        meta: {
            name: acc.name,
            source: extensionSourceName
        }
    } as InjectedAccountWithMeta | InjectedAccountWithMetaReef));
}
