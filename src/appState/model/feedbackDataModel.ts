export enum FeedbackStatusCode {
    ERROR = 'ERROR_STATUS',
    LOADING = 'LOADING_STATUS',
    PARTIAL_DATA = 'PARTIAL_DATA',
    COMPLETE_DATA = 'COMPLETE_DATA'
}

export interface FeedbackStatus {
    code: FeedbackStatusCode;
    message?: string;
    oldData?: any;
}

export interface FeedbackDataModel<T> {
    data: T;
    status?: FeedbackStatus;
}

export const toFeedbackDM = <T>(data: T, code?: FeedbackStatusCode, message?: string): FeedbackDataModel<T> => ({data, status: {code:code?code:FeedbackStatusCode.COMPLETE_DATA, message}});
export const isFeedbackDM = (value: any): boolean => !!value?.data && value.code!=null;
export const unwrapFeedbackDM = (value: FeedbackDataModel<T>): T => value.data;
