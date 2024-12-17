import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';

export interface WhatsappMessageCommand {
    phoneNumbers: string[];
    message: string;
    attachmentPath?: string;
}

export interface WhatsappSendResult {
    phoneNumber: string;
    success: boolean;
    error?: string;
}

export class WhatsappService {
    private client: Client | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private MAX_RECONNECT_ATTEMPTS: number = 3;

    constructor() {
        this.initializeClient();
    }

    private initializeClient() {
        try {
            // Initialize the WhatsApp client with Puppeteer options
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './whatsapp-auth', // Adjust the path if needed
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-gpu',
                    ]
                }
            });

            this.client.on('qr', (qr) => {
                console.log('QR Code Generated', qr);
            });

            this.client.on('ready', () => {
                console.log('WhatsApp client is ready');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.client.on('authenticated', () => {
                console.log('Authenticated successfully');
            });

            this.client.on('auth_failure', (msg) => {
                console.error('Authentication failed:', msg);
            });

            this.client.on('disconnected', (reason) => {
                console.log('Client was logged out', reason);
                this.isConnected = false;
                this.reconnect();
            });

            this.client.initialize();
        } catch (error) {
            console.error('Failed to initialize WhatsApp client:', error);
        }
    }

    private reconnect() {
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.initializeClient();
            }, 5000 * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    public async sendMessages(command: WhatsappMessageCommand): Promise<WhatsappSendResult[]> {
        if (!this.client || !this.isConnected) {
            throw new Error('WhatsApp client is not connected');
        }

        const results = await Promise.all(command.phoneNumbers.map(async (phoneNumber) => {
            try {
                const formattedNumber = this.formatPhoneNumber(phoneNumber);
                const chatId = await this.client!.getNumberId(formattedNumber);

                if (!chatId) {
                    return {
                        phoneNumber,
                        success: false,
                        error: 'Invalid phone number'
                    };
                }

                // Send message
                await this.client!.sendMessage(chatId._serialized, command.message);

                // Send attachment if exists
                if (command.attachmentPath) {
                    const media = MessageMedia.fromFilePath(command.attachmentPath);
                    await this.client!.sendMessage(chatId._serialized, media);
                }

                return {
                    phoneNumber,
                    success: true
                };
            } catch (error) {
                return {
                    phoneNumber,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }));

        return results;
    }

    public isWhatsappConnected(): boolean {
        return this.isConnected;
    }

    private formatPhoneNumber(phoneNumber: string): string {
        // Format number for WhatsApp (add country code if necessary)
        const cleanedNumber = phoneNumber.replace(/\s+/g, '').replace(/^0/, '+33'); // Modify country code if needed
        return cleanedNumber;
    }

    public disconnect() {
        if (this.client) {
            this.client.destroy();
            this.isConnected = false;
        }
    }
}