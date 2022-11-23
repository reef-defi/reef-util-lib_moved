import {availableAddresses$} from "./signersFromJson";
import {map} from "rxjs";
import {FeedbackStatusCode, toFeedbackDM} from "../model/feedbackDataModel";

export function getAddressesErrorFallback(err: { message: string }, message: string, propName?: string) {
    return availableAddresses$.pipe(
        map((addrList) => toFeedbackDM(
            addrList.map(a => toFeedbackDM(a, FeedbackStatusCode.ERROR, message + err.message, 'balance')),
            FeedbackStatusCode.ERROR, message + err.message, propName)
        )
    );
}
