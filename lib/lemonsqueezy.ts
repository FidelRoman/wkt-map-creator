const LS_API_BASE = 'https://api.lemonsqueezy.com/v1';

function lsHeaders() {
    return {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY ?? ''}`,
    };
}

export async function lsCreateCheckout(params: {
    storeId: string;
    variantId: string;
    email: string;
    firebaseUid: string;
    successUrl: string;
    cancelUrl: string;
}) {
    const res = await fetch(`${LS_API_BASE}/checkouts`, {
        method: 'POST',
        headers: lsHeaders(),
        body: JSON.stringify({
            data: {
                type: 'checkouts',
                attributes: {
                    checkout_options: { embed: false, media: false },
                    checkout_data: {
                        email: params.email,
                        custom: { firebase_uid: params.firebaseUid },
                    },
                    product_options: {
                        redirect_url: params.successUrl,
                        receipt_button_text: 'Ir al Dashboard',
                        receipt_thank_you_note: 'Thank you for subscribing to WKT Studio!',
                    },
                    expires_at: null,
                },
                relationships: {
                    store: { data: { type: 'stores', id: params.storeId } },
                    variant: { data: { type: 'variants', id: params.variantId } },
                },
            },
        }),
    });
    if (!res.ok) throw new Error(`LS checkout error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.data?.attributes?.url as string;
}

export function lsVerifyWebhook(body: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(body).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
        return false;
    }
}
