import {Observable,} from 'rxjs';
import {ReefAccount} from "../../account/ReefAccount";
import {signersWithUpdatedIndexedData$} from "./signersIndexedData";

export const signers$: Observable<ReefAccount[] | null> = signersWithUpdatedIndexedData$;

