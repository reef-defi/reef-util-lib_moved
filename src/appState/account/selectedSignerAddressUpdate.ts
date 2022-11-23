import {selectedSigner$} from "./selectedSigner";
import {filter} from "rxjs/operators";
import {ReefAccount, ReefSigner} from "../../account/ReefAccount";
import {distinctUntilChanged, Observable, shareReplay} from "rxjs";
import {FeedbackDataModel} from "../model/feedbackDataModel";

export const selectedSignerAddressChange$ = selectedSigner$.pipe(
    filter((v): v is FeedbackDataModel<ReefAccount> => !!v),
    distinctUntilChanged((s1, s2) => s1.data.address === s2.data.address),
    shareReplay(1)
);
