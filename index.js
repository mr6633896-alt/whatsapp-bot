const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const BOT_NUMBER = '201027502088';

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(BOT_NUMBER);
                console.log('YOUR PAIRING CODE IS:', code);
            } catch (e) { console.log('Pairing error:', e); }
        }, 3000);
    }

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('BOT READY!');
        if (u.connection === 'close') {
            const shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) start();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        console.log('NEW MSG:', text, 'Group:', isGroup);
        if (text === '!ping') { await sock.sendMessage(from, { text: 'pong' }); return; }
        if (!isGroup) return;
        const hasLink = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|discord\.gg\/|instagram\.com\/|facebook\.com\/|youtube\.com\/|youtu\.be\/)/i.test(text);
        if (!hasLink) return;
        try {
            const metadata = await sock.groupMetadata(from);
            const sender = metadata.participants.find(p => p.id === msg.key.participant);
            if (sender?.admin) return;
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, { text: 'ممنوع اللينكات هنا يا نجم 🚫' });
        } catch (e) { console.log('ERROR:', e.message); }
    });
}
start();