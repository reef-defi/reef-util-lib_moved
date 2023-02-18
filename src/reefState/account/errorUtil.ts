import {availableAddresses$} from "./availableAddresses";
import {map, Observable} from "rxjs";
import {StatusDataObject, FeedbackStatusCode, toFeedbackDM} from "../model/statusDataObject";
import {ReefAccount} from "../../account/accountModel";

export function getAddressesErrorFallback(err: { message: string }, message: string, propName?: string):Observable<StatusDataObject<StatusDataObject<ReefAccount>[]>> {
    return availableAddresses$.pipe(
        map((addrList: ReefAccount[]): StatusDataObject<StatusDataObject<ReefAccount>[]> => toFeedbackDM(
            addrList.map(a => toFeedbackDM(a, FeedbackStatusCode.ERROR, message + err.message, 'balance')),
            FeedbackStatusCode.ERROR, message + err.message, propName)
        )
    ) as Observable<StatusDataObject<StatusDataObject<ReefAccount>[]>>;
}
