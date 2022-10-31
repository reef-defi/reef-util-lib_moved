import {catchError, combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, startWith, take} from "rxjs";
import {ReefSigner} from "../../account/ReefAccount";
import {signers$} from "./signers";
import {currentAddressSubj, setCurrentAddress} from "./setAccounts";

if(!currentAddressSubj){
    debugger
}
export const currentAddress$: Observable<string | undefined> = currentAddressSubj.asObservable()
    .pipe(
        startWith(''),
        distinctUntilChanged(),
        shareReplay(1),
    );

// setting default signer (when signers exist) if no selected address exists
combineLatest([signers$, currentAddress$])
    .pipe(take(1))
    .subscribe(([signers, address]: [ReefSigner[] | null, string | undefined]) => {
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

export const selectedSigner$: Observable<ReefSigner | undefined> = combineLatest([
    currentAddress$,
    signers$,
])
    .pipe(
        map(([selectedAddress, signers]: [string | undefined, ReefSigner[] | null]) => {
            if (!selectedAddress || !signers || !signers.length) {
                return undefined;
            }

            let foundSigner = signers.find(
                (signer: ReefSigner) => signer?.address === selectedAddress,
            );
            if (!foundSigner) {
                foundSigner = signers ? signers[0] as ReefSigner : undefined;
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
            return foundSigner ? {...foundSigner} as ReefSigner : undefined;
        }),
        catchError((err) => {
            console.log('selectedSigner$ ERROR=', err.message);
            return of(undefined);
        }),
        shareReplay(1),
    );
