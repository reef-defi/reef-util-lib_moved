export enum TX_STATUS_ERROR_CODE {
    ERROR_MIN_BALANCE_AFTER_TX='ERROR_MIN_BALANCE_AFTER_TX',
    ERROR_BALANCE_TOO_LOW='ERROR_BALANCE_TOO_LOW',
    ERROR_UNDEFINED='ERROR_UNDEFINED',
    CANCELED='CANCELED',
}

export function toTxErrorCodeValue(e: { message: string } | string) {
    let message = (e as any).message || e;
    let code = TX_STATUS_ERROR_CODE.ERROR_UNDEFINED;
    if (
        message
        && (message.indexOf('-32603: execution revert: 0x') > -1
            || message?.indexOf('InsufficientBalance') > -1)
    ) {
        message = 'You must allow minimum 60 REEF on account for Ethereum VM transaction even if transaction fees will be much lower.';
        code = TX_STATUS_ERROR_CODE.ERROR_MIN_BALANCE_AFTER_TX;
    }
    if (message && message?.startsWith('1010')) {
        message = 'Balance too low.';
        code = TX_STATUS_ERROR_CODE.ERROR_BALANCE_TOO_LOW;
    }
    if (message && (message==='_canceled' || message==='canceled')) {
        message = 'Canceled';
        code = TX_STATUS_ERROR_CODE.CANCELED;
    }
    if (message && message?.startsWith('balances.InsufficientBalance')) {
        message = 'Balance too low for transfer and fees.';
        code = TX_STATUS_ERROR_CODE.ERROR_BALANCE_TOO_LOW;
    }
    if (code === TX_STATUS_ERROR_CODE.ERROR_UNDEFINED) {
        message = `Transaction error: ${message}`;
    }
    return {message, code};
}