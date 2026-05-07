import puter from "@heyputer/puter.js";
import type {User} from "@heyputer/puter.js/types/modules/auth";

puter.setAppID('app-910a0c3e-7390-4b3f-aa2e-ed62e323671b');

export const  signIn = async () => await puter.auth.signIn();

export const  signOut = () => puter.auth.signOut();

export const getCurrentUser = async () => {
    try {
        return await puter.auth.getUser();
    } catch {
        return null;
    }
}