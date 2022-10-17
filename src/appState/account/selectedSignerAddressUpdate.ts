import {selectedSigner$} from "./selectedSigner";
import {filter} from "rxjs/operators";
import {ReefSigner} from "../../account/ReefAccount";
import {distinctUntilChanged, Observable, shareReplay} from "rxjs";

export const selectedSignerAddressChange$ = selectedSigner$.pipe(
    filter((v): v is ReefSigner => !!v),
    distinctUntilChanged((s1, s2) => s1?.address === s2?.address),
    shareReplay(1)
) as Observable<ReefSigner>;
