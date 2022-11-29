import {selectedAccount$} from "./selectedAccount";
import {filter} from "rxjs/operators";
import {ReefAccount, ReefSigner} from "../../account/accountModel";
import {distinctUntilChanged, Observable, shareReplay, startWith} from "rxjs";
import {FeedbackDataModel} from "../model/feedbackDataModel";
import {selectedAddressSubj} from "./setAccounts";

export const selectedAccountAddressChange$ = selectedAccount$.pipe(
    filter((v): v is FeedbackDataModel<ReefAccount> => !!v),
    distinctUntilChanged((s1, s2) => s1.data.address === s2.data.address),
    shareReplay(1)
);
