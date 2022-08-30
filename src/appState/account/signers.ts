import {Observable,} from 'rxjs';
import {ReefSigner} from "../../account/ReefAccount";
import {signersWithUpdatedIndexedData$} from "./signersIndexedData";

export const signers$: Observable<ReefSigner[] | null> = signersWithUpdatedIndexedData$;

