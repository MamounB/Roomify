import puter from "@heyputer/puter.js";
import type {User} from "@heyputer/puter.js/types/modules/auth";
import type {CreateProjectParams, DesignItem} from "../type";
import {getOrCreateHostingConfig, uploadImagetoHosting} from "./puter.hosting";
import {isHostedUrl} from "./utils";

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

export const createProject = async ({item}: CreateProjectParams): Promise<DesignItem| null | undefined> => {
    const projectId = item.id;

    const hosting = await getOrCreateHostingConfig();
    console.log("[createProject] hosting config:", hosting);
    const hostedSource = projectId ?
        await uploadImagetoHosting({hosting, url: item.sourceImage, projectId, label: 'source', }) : null;
    console.log("[createProject] hostedSource:", hostedSource);
    const hostedRender = projectId && item.renderedImage ?
        await uploadImagetoHosting({hosting, url: item.renderedImage, projectId, label: 'rendered', }) : null;

    const resolvedSource = hostedSource?.url || (isHostedUrl(item.sourceImage)
        ? item.sourceImage
        : ''
    );
    console.log("[createProject] resolvedSource:", resolvedSource);
    if (!resolvedSource) {
        console.warn('Failed to host source image, skipping save.')
        return null;
    }

    const resolvedRender = hostedRender?.url
        ? hostedRender?.url
        : item.renderedImage && isHostedUrl(item.renderedImage)
            ? item.renderedImage
            : undefined;

    const {
        sourcePath: _sourcePath,
        renderedPath: _renderedPath,
        publicPath: _publicPath,
        ...rest
    } = item;

    const payload = {
        ...rest,
        sourceImage: resolvedSource,
        renderedImage: resolvedRender,
    }

    try {
        //Call the Puter worker to store project in key-value db

        return payload;
    } catch (e) {
        console.log('Failed to save project', e);
    }

}