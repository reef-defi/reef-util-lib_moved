import {selectedSigner$} from "./selectedSigner";
import {filter} from "rxjs/operators";
import {ReefSigner} from "../../account/ReefAccount";
import {distinctUntilChanged, Observable} from "rxjs";

export const selectedSignerAddressUpdate$ = selectedSigner$.pipe(
    filter((v): v is ReefSigner => !!v),
    distinctUntilChanged((s1, s2) => s1?.address === s2?.address),
) as Observable<ReefSigner>;
