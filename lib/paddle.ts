import { Paddle, Environment } from '@paddle/paddle-node-sdk';

export const paddle = new Paddle(process.env.PADDLE_API_KEY ?? '', {
    environment: process.env.PADDLE_ENVIRONMENT === 'production'
        ? Environment.production
        : Environment.sandbox,
});

export async function paddleVerifyWebhook(rawBody: string, signature: string): Promise<boolean> {
    try {
        const secret = process.env.PADDLE_WEBHOOK_SECRET ?? '';
        if (!secret || !signature) return false;
        const event = paddle.webhooks.unmarshal(rawBody, secret, signature);
        return !!event;
    } catch {
        return false;
    }
}
