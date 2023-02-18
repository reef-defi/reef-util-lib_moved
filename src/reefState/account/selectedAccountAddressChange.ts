import {selectedAccount_status$} from "./selectedAccount";
import {filter} from "rxjs/operators";
import {ReefAccount, ReefSigner} from "../../account/accountModel";
import {distinctUntilChanged, Observable, shareReplay, startWith} from "rxjs";
import {StatusDataObject} from "../model/statusDataObject";
import {selectedAddressSubj} from "./setAccounts";

export const selectedAccountAddressChange$ = selectedAccount_status$.pipe(
    filter((v): v is StatusDataObject<ReefAccount> => !!v),
    distinctUntilChanged((s1, s2) => s1.data.address === s2.data.address),
    shareReplay(1)
);
