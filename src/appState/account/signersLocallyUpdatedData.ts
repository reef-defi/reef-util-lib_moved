import {catchError, map, mergeScan, Observable, of, shareReplay, startWith, switchMap, withLatestFrom} from "rxjs";
import {ReefAccount} from "../../account/ReefAccount";
import {filter} from "rxjs/operators";
import {replaceUpdatedSigners, updateSignersEvmBindings} from "./accountStateUtil";
import {reloadSignersSubj} from "./accountStateUpdateProps";
import {signersRegistered$} from "./setAccounts";

export const signersLocallyUpdatedData$: Observable<ReefAccount[]> = reloadSignersSubj.pipe(
    filter((reloadCtx: any) => !!reloadCtx.updateActions.length),
    withLatestFrom(signersRegistered$),
    mergeScan(
        (
            state: {
                all: ReefAccount[];
                allUpdated: ReefAccount[];
                lastUpdated: ReefAccount[];
            },
            [updateCtx, signersInjected]: [any, ReefAccount[]],
        ): any => {
            const allSignersLatestUpdates = replaceUpdatedSigners(
                signersInjected,
                state.allUpdated,
            );
            return of(updateCtx.updateActions || [])
                .pipe(
                    switchMap((updateActions) => updateSignersEvmBindings(
                        updateActions,
                        allSignersLatestUpdates,
                    )
                        .then((lastUpdated) => ({
                            all: replaceUpdatedSigners(
                                allSignersLatestUpdates,
                                lastUpdated,
                                true,
                            ),
                            allUpdated: replaceUpdatedSigners(
                                state.allUpdated,
                                lastUpdated,
                                true,
                            ),
                            lastUpdated,
                        }))),
                );
        },
        {
            all: [],
            allUpdated: [],
            lastUpdated: [],
        },
    ),
    filter((val: any) => !!val.lastUpdated.length),
    map((val: any): any => val.all),
    startWith([]),
    catchError((err) => {
        console.log('signersLocallyUpdatedData$ ERROR=', err.message);
        return of([]);
    }),
    shareReplay(1),
);
