import {
    catchError,
    combineLatest,
    distinctUntilChanged,
    map, merge,
    mergeScan, NEVER,
    Observable,
    of,
    ReplaySubject,
    shareReplay,
    startWith,
    Subject,
    switchMap, tap
} from "rxjs";
import {selectedProvider$, instantProvider$} from "../providerState";
import {Provider} from "@reef-defi/evm-provider";
import {ReefAccount} from "../../account/accountModel";
import {BigNumber} from "ethers";
import {availableAddresses$} from "./availableAddresses";
import {StatusDataObject, FeedbackStatusCode, isFeedbackDM, toFeedbackDM} from "../model/statusDataObject";
import {getAddressesErrorFallback} from "./errorUtil";


const getUpdatedAccountChainBalances$ = (providerAndSigners: [Provider | undefined, ReefAccount[]]): Observable<StatusDataObject<StatusDataObject<ReefAccount>[]> | { balances: any; signers: ReefAccount[] }> => {
    const signers: ReefAccount[] = providerAndSigners[1];

    return of(providerAndSigners).pipe(
        switchMap((provAndSigs: [Provider|undefined, ReefAccount[]]) => {
            let provider = provAndSigs[0];
            if (!provider) {
                let signers = provAndSigs[1];
                return merge(of(signers), NEVER).pipe(
                    map((sgs) => toFeedbackDM(sgs.map(s => toFeedbackDM(s, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Connecting to chain.', 'balance')), FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Connecting to chain and loading balances.')),
                );
            }
            return of(provAndSigs).pipe(
                mergeScan(
                    (
                        state: { unsub: any; balancesByAddressSubj: ReplaySubject<any> },
                        [prov, sigs]: [Provider|undefined, ReefAccount[]],
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
                        return prov!.api.query.system.account
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
            );
        })
    );
};

export const accountsWithUpdatedChainDataBalances$: Observable<StatusDataObject<StatusDataObject<ReefAccount>[]>> = combineLatest([
    instantProvider$,
    availableAddresses$,
])
    .pipe(
        switchMap(getUpdatedAccountChainBalances$),
        map((balancesAndSigners: StatusDataObject<StatusDataObject<ReefAccount>[]> | { balances: any; signers: ReefAccount[] }) => {
                if (isFeedbackDM(balancesAndSigners)) {
                    return balancesAndSigners as StatusDataObject<StatusDataObject<ReefAccount>[]>;
                }
                const balAndSig = balancesAndSigners as { balances: any[], signers: ReefAccount[] };
                const balances_sdo: StatusDataObject<ReefAccount>[] = balAndSig.signers
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
                return toFeedbackDM(balances_sdo, FeedbackStatusCode.COMPLETE_DATA, 'Balance set');
            }
        ),
        catchError((err) => getAddressesErrorFallback(err, 'Error chain balance=', 'balance')),
        shareReplay(1)
    );
