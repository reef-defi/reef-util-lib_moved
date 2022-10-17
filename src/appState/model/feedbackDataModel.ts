export enum FeedbackStatusCode {
    _,
    LOADING,
    PARTIAL_DATA,
    RESOLVING_NFT_URL,
    RESOLVING_NFT_URL_ERROR,
    ERROR,
    COMPLETE_DATA,
}

export interface FeedbackStatus {
    code: FeedbackStatusCode;
    message?: string;
    propName?: string;
    oldData?: any;
}

export class FeedbackDataModel<T> {
    data: T;
    private _status: FeedbackStatus | FeedbackStatus[];

    constructor(data: T, status: FeedbackStatus | FeedbackStatus[]) {
        this.data = data;
        this._status = status;
    }

    getStatus(propName?: string): FeedbackStatus | undefined {
        if (Array.isArray(this._status)) {
            return this._status.find(s => s.propName === propName);
        }
        if (propName) {
            return undefined;
        }
        return this._status;
    }

    isStatus(status: FeedbackStatusCode, propName?: string): boolean {
        const stat = this.getStatus(propName);
        return stat === status;
    }

    toJson(){
        return JSON.stringify({data: this.data, status: this._status});
    }
}

export const toFeedbackDM = <T>(data: T, statCode?: FeedbackStatusCode|FeedbackStatus[], message?: string, propName?: string): FeedbackDataModel<T> => {
    let status;
    if ((statCode as FeedbackStatus)?.code == null) {
        const code = statCode ? statCode as FeedbackStatusCode : FeedbackStatusCode.COMPLETE_DATA;
        const stat: FeedbackStatus = {code, message, propName};
        status = propName ? [stat] : stat;
    }
    return new FeedbackDataModel<T>(data, status || statCode as FeedbackStatus[]);
};

export const isFeedbackDM = (value: any): boolean => {
    return value?.data && value.getStatus() != null && value.getStatus().code != null;
}

// export const unwrapFeedbackDM = (value: FeedbackDataModel<T>): T => value.data;

// export const getStatus = (status: FeedbackStatus | FeedbackStatus[], propName?: string): FeedbackStatus | undefined => {
//     if (Array.isArray(status)) {
//         return status.find(s => s.propName === propName);
//     }
//     if (propName) {
//         return undefined;
//     }
//     return status;
// }
