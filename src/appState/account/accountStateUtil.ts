import {UpdateAction, UpdateDataType} from '../model/updateStateModel';
import {ReefAccount} from '../../account/ReefAccount';
import {getReefAccountSigner} from "../../account/accounts";
import {Provider} from "@reef-defi/evm-provider";
import {FeedbackDataModel, FeedbackStatusCode, isFeedbackDM, toFeedbackDM} from "../model/feedbackDataModel";

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
  existingSigners: FeedbackDataModel<ReefAccount>[] = [],
  updatedSigners?: FeedbackDataModel<ReefAccount>[],
  appendNew?: boolean,
): FeedbackDataModel<ReefAccount>[] => {
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
  signers: FeedbackDataModel<ReefAccount>[] = [],
): Promise<FeedbackDataModel<ReefAccount>[]> => {
  if (!signers.length) {
    return Promise.resolve([]);
  }
  const updSigners = getSignersToUpdate(
    UpdateDataType.ACCOUNT_EVM_BINDING,
    updateActions,
    signers.map((s)=> s.data),
  );

  return Promise.all(
    updSigners.map(async (sig: ReefAccount): Promise<(FeedbackDataModel<ReefAccount>|boolean)> => {
      let signer = await getReefAccountSigner(sig, provider);
      if (!signer) {
        return toFeedbackDM(sig as ReefAccount, FeedbackStatusCode.MISSING_INPUT_VALUES, 'ERROR: Can not get account signer.');
      }
      return signer.isClaimed();
    }),
  ).then((claimed: (FeedbackDataModel<ReefAccount>|boolean)[]): FeedbackDataModel<ReefAccount>[] => claimed.map((isEvmClaimed: boolean|FeedbackDataModel<ReefAccount>, i: number) => {
    if(isFeedbackDM(claimed)){
      return claimed as FeedbackDataModel<ReefAccount>;
    }
    const sig = updSigners[i] as ReefAccount;
    return  toFeedbackDM({ ...sig, isEvmClaimed } as ReefAccount, FeedbackStatusCode.COMPLETE_DATA);
  }));
};
