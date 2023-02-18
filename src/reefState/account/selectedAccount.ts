import {catchError, combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, startWith, take} from "rxjs";
import {ReefAccount} from "../../account/accountModel";
import {accounts_status$} from "./accounts";
import {selectedAddressSubj, setSelectedAddress} from "./setAccounts";
import {StatusDataObject, toFeedbackDM} from "../model/statusDataObject";

export const selectedAddress$: Observable<string | undefined> = selectedAddressSubj.asObservable()
    .pipe(
        startWith(undefined),
        distinctUntilChanged(),
        shareReplay(1),
    );

// setting default signer (when signers exist) if no selected address exists
combineLatest([accounts_status$, selectedAddress$])
    .pipe(take(1))
    .subscribe(([signers, address]: [StatusDataObject<StatusDataObject<ReefAccount>[]>, string|undefined]) => {
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

export const selectedAccount_status$: Observable<StatusDataObject<ReefAccount> | undefined> = combineLatest([
    selectedAddress$,
    accounts_status$,
])
    .pipe(
        map((selectedAddressAndSigners: [string | undefined, StatusDataObject<StatusDataObject<ReefAccount>[]>]): StatusDataObject<ReefAccount>|undefined => {
            const [selectedAddress, signers] = selectedAddressAndSigners
            if (!selectedAddress || !signers || !signers.data?.length ) {
                return undefined;
            }

            let foundSigner: StatusDataObject<ReefAccount>|undefined = signers.data.find(
                (signer: StatusDataObject<ReefAccount>) => signer.data.address === selectedAddress,
            );
            if (!foundSigner) {
                foundSigner = signers && signers.data ? signers.data[0] as StatusDataObject<ReefAccount> : undefined;
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
            console.log('selectedAccount_status$ ERROR=', err.message);
            return of(undefined);
        }),
        shareReplay(1)
    );
