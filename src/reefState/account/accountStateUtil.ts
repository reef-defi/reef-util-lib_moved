import {UpdateAction, UpdateDataType} from '../model/updateStateModel';
import {ReefAccount} from '../../account/accountModel';
import {getReefAccountSigner} from "../../account/accountSignerUtils";
import {Provider} from "@reef-defi/evm-provider";
import {StatusDataObject, FeedbackStatusCode, isFeedbackDM, toFeedbackDM} from "../model/statusDataObject";

const getUpdAddresses = (
  updateType: UpdateDataType,
  updateActions: UpdateAction[],
): string[] | null => {
  const typeUpdateActions = updateActions.filter(
    (ua) => ua.type === updateType,
  );
  if (typeUpdateActions.length === 0) {
    return null;
  }
  if (typeUpdateActions.some((tua) => !tua.address)) {
    return [];
  }

  return typeUpdateActions.map((ua) => ua.address as string);
};

export const isUpdateAll = (addresses: string[] | null): boolean => addresses?.length === 0;

export const getSignersToUpdate = (
  updateType: UpdateDataType,
  updateActions: UpdateAction[],
  signers: ReefAccount[],
): ReefAccount[] => {
  const updAddresses = getUpdAddresses(updateType, updateActions);
  return isUpdateAll(updAddresses)
    ? signers
    : signers.filter((sig) => updAddresses?.some((addr) => addr === sig.address));
};

export const replaceUpdatedSigners = <T>(
  existingSigners: StatusDataObject<ReefAccount>[] = [],
  updatedSigners?: StatusDataObject<ReefAccount>[],
  appendNew?: boolean,
): StatusDataObject<ReefAccount>[] => {
  if (!appendNew && !existingSigners.length) {
    return existingSigners;
  }
  if (!updatedSigners || !updatedSigners.length) {
    return existingSigners;
  }
  const signers = existingSigners.map(
    (existingSig) => updatedSigners.find((updSig) => updSig.data.address === existingSig.data.address)
      || existingSig,
  );
  if (!appendNew) {
    return signers;
  }
  updatedSigners.forEach((updS) => {
    if (!signers.some((s) => s.data.address === updS.data.address)) {
      signers.push(updS);
    }
  });
  return signers;
};

export const updateSignersEvmBindings = (
  updateActions: UpdateAction[],
  provider: Provider,
  signers: StatusDataObject<ReefAccount>[] = [],
): Promise<StatusDataObject<ReefAccount>[]> => {
  if (!signers.length) {
    return Promise.resolve([]);
  }
  const updSigners = getSignersToUpdate(
    UpdateDataType.ACCOUNT_EVM_BINDING,
    updateActions,
    signers.map((s)=> s.data),
  );

  return Promise.all(
    updSigners.map(async (sig: ReefAccount): Promise<(StatusDataObject<ReefAccount>|boolean)> => {
      let signer = await getReefAccountSigner(sig, provider);
      if (!signer) {
        return toFeedbackDM(sig as ReefAccount, FeedbackStatusCode.MISSING_INPUT_VALUES, 'ERROR: Can not get account signer.');
      }
      return signer.isClaimed();
    }),
  ).then((claimed: (StatusDataObject<ReefAccount>|boolean)[]): StatusDataObject<ReefAccount>[] => claimed.map((isEvmClaimed: boolean|StatusDataObject<ReefAccount>, i: number) => {
    if(isFeedbackDM(isEvmClaimed)){
      return isEvmClaimed as StatusDataObject<ReefAccount>;
    }
    const sig = updSigners[i] as ReefAccount;
    return  toFeedbackDM({ ...sig, isEvmClaimed } as ReefAccount, FeedbackStatusCode.COMPLETE_DATA);
  }));
};
