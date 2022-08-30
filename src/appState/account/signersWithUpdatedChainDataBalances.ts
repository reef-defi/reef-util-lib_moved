import {
    catchError,
    combineLatest,
    distinctUntilChanged,
    map,
    mergeScan, Observable, of,
    ReplaySubject,
    shareReplay,
    Subject,
    switchMap
} from "rxjs";
import {currentProvider$} from "../providerState";
import {Provider} from "@reef-defi/evm-provider";
import {ReefSigner} from "../../account/ReefAccount";
import {BigNumber} from "ethers";
import {signersRegistered$} from "./setAccounts";

export const signersWithUpdatedChainDataBalances$ = combineLatest([
    currentProvider$,
    signersRegistered$,
])
    .pipe(
        mergeScan(
            (
                state: { unsub: any; balancesByAddressSubj: ReplaySubject<any> },
                [provider, signers]: [Provider, ReefSigner[]],
            ) => {
                if (state.unsub) {
                    state.unsub();
                }
                const distinctSignerAddresses = signers
                    .map((s) => s.address)
                    .reduce((distinctAddrList: string[], curr: string) => {
                        if (distinctAddrList.indexOf(curr) < 0) {
                            distinctAddrList.push(curr);
                        }
                        return distinctAddrList;
                    }, []);
                // eslint-disable-next-line no-param-reassign
                return provider.api.query.system.account
                    .multi(distinctSignerAddresses, (balances: any[]) => {
                        const balancesByAddr = balances.map(({ data }, index) => ({
                            address: distinctSignerAddresses[index],
                            balance: data.free.toString(),
                        }));
                        state.balancesByAddressSubj.next({
                            balances: balancesByAddr,
                            signers,
                        });
                    })
                    .then((unsub) => {
                        // eslint-disable-next-line no-param-reassign
                        state.unsub = unsub;
                        return state;
                    });
            },
            {
                unsub: null,
                balancesByAddressSubj: new ReplaySubject<any>(1),
            },
        ),
        distinctUntilChanged(
            (prev: any, curr: any): any => prev.balancesByAddressSubj !== curr.balancesByAddressSubj,
        ),
        switchMap(
            (v: {
                balancesByAddressSubj: Subject<{ balances: any; signers: ReefSigner[] }>;
            }) => v.balancesByAddressSubj,
        ),
        map((balancesAndSigners: { balances: any; signers: ReefSigner[] }) => (!balancesAndSigners.signers
            ? []
            : balancesAndSigners.signers.map((sig) => {
                const bal = balancesAndSigners.balances.find(
                    (b: { address: string; balance: string }) => b.address === sig.address,
                );
                if (bal && !BigNumber.from(bal.balance)
                    .eq(sig.balance)) {
                    return {
                        ...sig,
                        balance: BigNumber.from(bal.balance),
                    };
                }
                return sig;
            }))),
        shareReplay(1),
        catchError((err) => {
            console.log('signersWithUpdatedBalances$ ERROR=', err.message);
            return of([]);
        }),
    ) as Observable<ReefSigner[]>;
