import {
    catchError,
    combineLatest,
    distinctUntilChanged,
    map,
    mergeScan,
    Observable,
    of,
    ReplaySubject,
    shareReplay,
    startWith,
    Subject,
    switchMap
} from "rxjs";
import {currentProvider$} from "../providerState";
import {Provider} from "@reef-defi/evm-provider";
import {ReefAccount} from "../../account/ReefAccount";
import {BigNumber} from "ethers";
import {availableAddresses$} from "./signersFromJson";
import {FeedbackDataModel, FeedbackStatusCode, isFeedbackDM, toFeedbackDM} from "../model/feedbackDataModel";

const getUpdatedSignerChainBalances$ = (providerAndSigners: [Provider, ReefAccount[]]): Observable<FeedbackDataModel<FeedbackDataModel<ReefAccount>[]> | { balances: any; signers: ReefAccount[] }> => {
    const signers: ReefAccount[] = providerAndSigners[1];
    return of(providerAndSigners).pipe(
        mergeScan(
            (
                state: { unsub: any; balancesByAddressSubj: ReplaySubject<any> },
                [prov, sigs]: [Provider, ReefAccount[]],
            ) => {
                if (state.unsub) {
                    state.unsub();
                }
                const distinctSignerAddresses = sigs
                    .map((s) => s.address)
                    .reduce((distinctAddrList: string[], curr: string) => {
                        if (distinctAddrList.indexOf(curr) < 0) {
                            distinctAddrList.push(curr);
                        }
                        return distinctAddrList;
                    }, []);
                // eslint-disable-next-line no-param-reassign
                return prov.api.query.system.account
                    .multi(distinctSignerAddresses, (balances: any[]) => {
                        const balancesByAddr = balances.map(({data}, index) => ({
                            address: distinctSignerAddresses[index],
                            balance: data.free.toString(),
                        }));
                        state.balancesByAddressSubj.next({
                            balances: balancesByAddr,
                            signers: sigs,
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
                balancesByAddressSubj: Subject<{ balances: any; signers: ReefAccount[] }>;
            }) => v.balancesByAddressSubj.pipe(
                startWith(toFeedbackDM(signers.map(s => toFeedbackDM(s, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Loading balace', 'balance')), FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Loading chain balances.')),
                catchError(err => of(toFeedbackDM(signers.map(s => toFeedbackDM(s, FeedbackStatusCode.ERROR, 'ERROR loading chain balance = ' + err.message, 'balance')), FeedbackStatusCode.ERROR, 'Error loading balance from chain = ' + err.message, 'balance')))
            ),
        )
    )
};

function getAddressesErrorFallback(err) {
    ... pass in the message
    return availableAddresses$.pipe(
        map((addrList) => toFeedbackDM(
            addrList.map(a => toFeedbackDM(a, FeedbackStatusCode.ERROR, 'Error chain balance=' + err.message, 'balance')),
            FeedbackStatusCode.ERROR, 'ERROR loading chain balances = ' + err.message, 'balance')
        )
    );
}

export const signersWithUpdatedChainDataBalances$: Observable<FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>> = combineLatest([
    currentProvider$,
    availableAddresses$,
])
    .pipe(
        switchMap(getUpdatedSignerChainBalances$),
        map((balancesAndSigners: FeedbackDataModel<FeedbackDataModel<ReefAccount>[]> | { balances: any; signers: ReefAccount[] }) => {
                if (isFeedbackDM(balancesAndSigners)) {
                    return balancesAndSigners;
                }
                const balAndSig = balancesAndSigners as { balances: any[], signers: ReefAccount[] };
                const balances_fdm: FeedbackDataModel<ReefAccount>[] = balAndSig.signers
                    .map((sig) => {
                        const bal = balAndSig.balances.find(
                            (b: { address: string; balance: string }) => b.address === sig.address,
                        );
                        if (bal && (!sig.balance || !BigNumber.from(bal.balance)
                            .eq(sig.balance))) {
                            return {
                                ...sig,
                                balance: BigNumber.from(bal.balance),
                            };
                        }
                        return sig;
                    })
                    .map(acc => toFeedbackDM(acc, FeedbackStatusCode.COMPLETE_DATA, 'Balance set', 'balance'));
                return toFeedbackDM(balances_fdm, FeedbackStatusCode.COMPLETE_DATA, 'balance');
            }
        ),
        catchError(err => getAddressesErrorFallback(err)),
        shareReplay(1)
    );
