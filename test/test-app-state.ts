import {initReefState} from '../src/appState/util/util'
import {availableNetworks} from "../lib";
import {web3Enable, web3FromSource} from "@reef-defi/extension-dapp";
import {InjectedExtension} from "@reef-defi/extension-inject/types";

async function initTest () {

    const extensions: InjectedExtension[] = await web3Enable('Test lib');
    const reefExt = await web3FromSource('reef');
    const accounts = await reefExt.accounts.get();
    await initReefState({
        network: availableNetworks.testnet,
        jsonAccounts: {accounts, injectedSigner: reefExt.signer}
    });


}


window.addEventListener('load',initTest);
