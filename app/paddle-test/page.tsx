"use client";
import { useEffect, useState } from 'react';

const PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? '';
const CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';

export default function PaddleTestPage() {
    const [ready, setReady] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toISOString().slice(11, 19)} ${msg}`]);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.onload = () => {
            window.Paddle!.Environment.set('sandbox');
            window.Paddle!.Initialize({
                token: CLIENT_TOKEN,
                eventCallback: (e: any) => addLog(`[event] ${e.name ?? '?'} — ${JSON.stringify(e)}`),
            });
            addLog(`Paddle initialized. token=${CLIENT_TOKEN.slice(0, 12)}... priceId=${PRICE_ID}`);
            setReady(true);
        };
        document.head.appendChild(script);
    }, []);

    const handleOpen = () => {
        addLog('Opening checkout...');
        window.Paddle?.Checkout.open({
            items: [{ priceId: PRICE_ID, quantity: 1 }],
        });
    };

    return (
        <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 700 }}>
            <h1 style={{ fontSize: 20, marginBottom: 16 }}>Paddle Checkout Test</h1>
            <p style={{ marginBottom: 8, color: '#555' }}>
                Token: <code>{CLIENT_TOKEN.slice(0, 16)}...</code><br />
                Price ID: <code>{PRICE_ID}</code>
            </p>
            <button
                onClick={handleOpen}
                disabled={!ready}
                style={{ padding: '10px 24px', background: ready ? '#6366f1' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, cursor: ready ? 'pointer' : 'not-allowed', fontSize: 16 }}
            >
                {ready ? 'Open Checkout' : 'Loading Paddle...'}
            </button>
            <div style={{ marginTop: 24, background: '#f1f5f9', borderRadius: 8, padding: 16, minHeight: 120 }}>
                <strong>Log:</strong>
                {log.length === 0 && <p style={{ color: '#94a3b8' }}>Waiting...</p>}
                {log.map((line, i) => <pre key={i} style={{ margin: '2px 0', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</pre>)}
            </div>
        </div>
    );
}
