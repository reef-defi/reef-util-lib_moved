import {availableAddresses$} from "./signersFromJson";
import {map, Observable} from "rxjs";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../model/feedbackDataModel";
import {ReefAccount} from "../../account/ReefAccount";

export function getAddressesErrorFallback(err: { message: string }, message: string, propName?: string):Observable<FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>> {
    return availableAddresses$.pipe(
        map((addrList: ReefAccount[]): FeedbackDataModel<FeedbackDataModel<ReefAccount>[]> => toFeedbackDM(
            addrList.map(a => toFeedbackDM(a, FeedbackStatusCode.ERROR, message + err.message, 'balance')),
            FeedbackStatusCode.ERROR, message + err.message, propName)
        )
    ) as Observable<FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>>;
}
