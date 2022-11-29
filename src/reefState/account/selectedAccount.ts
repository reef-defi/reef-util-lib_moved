import {catchError, combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, startWith, take} from "rxjs";
import {ReefAccount} from "../../account/accountModel";
import {accounts$} from "./accounts";
import {selectedAddressSubj, setSelectedAddress} from "./setAccounts";
import {FeedbackDataModel, toFeedbackDM} from "../model/feedbackDataModel";

export const selectedAddress$: Observable<string | undefined> = selectedAddressSubj.asObservable()
    .pipe(
        startWith(undefined),
        distinctUntilChanged(),
        shareReplay(1),
    );

// setting default signer (when signers exist) if no selected address exists
combineLatest([accounts$, selectedAddress$])
    .pipe(take(1))
    .subscribe(([signers, address]: [FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>, string|undefined]) => {
        let saved: string | undefined = address;
        try {
            if (!saved) {
                saved = localStorage?.getItem('selected_address_reef') || undefined;
            }
        } catch (e) {
            // getting error in Flutter: 'The operation is insecure'
            // console.log('Flutter error=', e.message);
        }

        if (!saved) {
            const firstSigner = signers && signers.data && signers.data[0] ? signers.data[0].data : undefined;
            setSelectedAddress(
                saved || firstSigner?.address,
            );
        }
    });

export const selectedAccount$: Observable<FeedbackDataModel<ReefAccount> | undefined> = combineLatest([
    selectedAddress$,
    accounts$,
])
    .pipe(
        map((selectedAddressAndSigners: [string | undefined, FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>]): FeedbackDataModel<ReefAccount>|undefined => {
            const [selectedAddress, signers] = selectedAddressAndSigners
            if (!selectedAddress || !signers || !signers.data?.length ) {
                return undefined;
            }

            let foundSigner: FeedbackDataModel<ReefAccount>|undefined = signers.data.find(
                (signer: FeedbackDataModel<ReefAccount>) => signer.data.address === selectedAddress,
            );
            if (!foundSigner) {
                foundSigner = signers && signers.data ? signers.data[0] as FeedbackDataModel<ReefAccount> : undefined;
            }
            try {
                if (foundSigner) {
                    localStorage.setItem(
                        'selected_address_reef',
                        foundSigner.data.address || '',
                    );
                }
            } catch (e) {
                // getting error in Flutter: 'The operation is insecure'
                // console.log('Flutter error=',e.message);
            }
            return foundSigner ? toFeedbackDM({...foundSigner.data} as ReefAccount, foundSigner.getStatusList()) : undefined;
        }),
        catchError((err) => {
            console.log('selectedSigner$ ERROR=', err.message);
            return of(undefined);
        }),
        shareReplay(1)
    );
