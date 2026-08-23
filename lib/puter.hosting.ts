import {
    createHostingSlug,
    fetchBlobFromUrl, getHostedUrl,
    getImageExtension,
    HOSTING_CONFIG_KEY,
    imageUrlToPngBlob,
    isHostedUrl
} from "./utils";
import puter from "@heyputer/puter.js";
import type {HostedAsset, HostingConfig, StoreHostedImageParams} from "../type";


export const getOrCreateHostingConfig = async (): Promise<HostingConfig | null> => {
    const existing = (await puter.kv.get(HOSTING_CONFIG_KEY)) as HostingConfig | null;

    if (existing?.subdomain) return { subdomain: existing.subdomain };

    const subdomain = createHostingSlug();

    const created = await createHostingWithRetry(subdomain);

    if (!created) {
        console.warn('Failed to create hosting subdomain after retries.');
        return null;
    }

    try {
        await puter.kv.set(HOSTING_CONFIG_KEY, { subdomain: created.subdomain });
    } catch (e) {
        // Non-fatal — we still got a working subdomain, just won't be cached for next time
        console.warn(`Failed to cache hosting config: ${e}`);
    }

    return created;
}

const createHostingWithRetry = async (
    subdomain: string,
    retries = 2
): Promise<{ subdomain: string } | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const created = await puter.hosting.create(subdomain, '.');

            // Puter can resolve() with an error payload instead of throwing —
            // guard against that explicitly.
            if (created && !(created as any).error && created.subdomain) {
                return { subdomain: created.subdomain };
            }

            console.warn(`[hosting] attempt ${attempt} returned error payload:`, created);
        } catch (e) {
            console.warn(`[hosting] attempt ${attempt} threw:`, e);
        }

        if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
    }

    return null;
}

export const uploadImagetoHosting = async ({ hosting, url, projectId, label}: StoreHostedImageParams): Promise<HostedAsset| null> => {
    console.log(`[upload:${label}] hosting=`, hosting, "url present:", !!url);
    if (!hosting || !url) {
        console.warn(`[upload:${label}] bailing early — missing hosting or url`);
        return null;
    }
    if (isHostedUrl(url)) return { url};

    try {
        console.log(`[upload:${label}] resolving blob for url starting with: ${url.substring(0, 30)}...`);
        let resolved;
        if (label === "rendered") {
            try {
                const pngBlob = await imageUrlToPngBlob(url);
                if (pngBlob) {
                    resolved = { blob: pngBlob, contentType: "image/png" };
                } else {
                    console.warn(`[upload:${label}] imageUrlToPngBlob returned null, falling back to fetchBlobFromUrl`);
                }
            } catch (err) {
                console.warn(`[upload:${label}] imageUrlToPngBlob failed, falling back to fetchBlobFromUrl:`, err);
            }
        }

        if (!resolved) {
            resolved = await fetchBlobFromUrl(url);
        }

        if (!resolved) {
            console.error(`[upload:${label}] failed to resolve blob from url`);
            return null;
        }

        const contentType = resolved.contentType || resolved.blob.type || 'image/png';
        const ext = getImageExtension(contentType, url);
        const dir = `projects/${projectId}`;
        const filePath = `${dir}/${label}.${ext}`;

        console.log(`[upload:${label}] writing to Puter FS: ${filePath} (type: ${contentType}, size: ${resolved.blob.size})`);

        const uploadFile = new File([resolved.blob], `${label}.${ext}`, {
            type: contentType,
        });

        await puter.fs.mkdir(dir, { createMissingParents: true });
        const writeResult = await puter.fs.write(filePath, uploadFile);
        console.log(`[upload:${label}] write result:`, writeResult);

        const hostedUrl = getHostedUrl({subdomain: hosting.subdomain}, filePath);
        console.log(`[upload:${label}] generated hosted url: ${hostedUrl}`);

        return hostedUrl ? { url: hostedUrl } : null;
    } catch (e) {
        console.warn(`Failed to store hosted image: ${e}`);
        console.error(`[upload:${label}] failed:`, e);
        return null;
    }
}