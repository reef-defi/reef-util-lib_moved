import {catchError, combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, startWith, take} from "rxjs";
import {ReefAccount} from "../../account/ReefAccount";
import {signers$} from "./signers";
import {currentAddressSubj, setCurrentAddress} from "./setAccounts";

export const currentAddress$: Observable<string | undefined> = currentAddressSubj.asObservable()
    .pipe(
        startWith(''),
        distinctUntilChanged(),
        shareReplay(1),
    );

// setting default signer (when signers exist) if no selected address exists
combineLatest([signers$, currentAddress$])
    .pipe(take(1))
    .subscribe(([signers, address]: [ReefAccount[] | null, string]): any => {
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
            const firstSigner = signers && signers[0] ? signers[0].address : undefined;
            setCurrentAddress(
                saved || firstSigner,
            );
        }
    });

export const selectedSigner$ = combineLatest([
    currentAddress$,
    signers$,
])
    .pipe(
        map(([selectedAddress, signers]: [string | undefined, ReefAccount[]|null]) => {
            if (!selectedAddress || !signers || !signers.length) {
                return undefined;
            }

            let foundSigner = signers.find(
                (signer: ReefAccount) => signer?.address === selectedAddress,
            );
            if (!foundSigner) {
                foundSigner = signers ? signers[0] as ReefAccount : undefined;
            }
            try {
                if (foundSigner) {
                    localStorage.setItem(
                        'selected_address_reef',
                        foundSigner.address || '',
                    );
                }
            } catch (e) {
                // getting error in Flutter: 'The operation is insecure'
                // console.log('Flutter error=',e.message);
            }
            return foundSigner ? { ...foundSigner } as ReefAccount : undefined;
        }),
        catchError((err) => {
            console.log('selectedSigner$ ERROR=', err.message);
            return of(null);
        }),
        shareReplay(1),
    ) as Observable<ReefAccount | undefined | null>;
