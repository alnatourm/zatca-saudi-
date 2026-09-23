import { ZatcaProductionDispatcher } from './zatcaApi';

export interface QueuedInvoice {
  id: string;
  uuid: string;
  signedXmlBase64: string;
  invoiceHash: string;
  pcsidToken: string;
  secret: string;
  attempts: number;
  status: 'PENDING' | 'REPORTED' | 'FAILED';
  queuedAt: string;
  lastError?: string;
}

export class ZatcaReportingQueue {
  private queue: QueuedInvoice[] = [];
  private dispatcher: ZatcaProductionDispatcher;
  private isProcessing = false;

  constructor(env: 'simulation' | 'production' = 'simulation') {
    this.dispatcher = new ZatcaProductionDispatcher(env);
  }

  enqueue(invoice: {
    id: string;
    uuid: string;
    signedXmlBase64: string;
    invoiceHash: string;
    pcsidToken: string;
    secret: string;
  }) {
    const item: QueuedInvoice = {
      ...invoice,
      attempts: 0,
      status: 'PENDING',
      queuedAt: new Date().toISOString(),
    };
    this.queue.push(item);
    this.processQueue();
    return item;
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.some((i) => i.status === 'PENDING')) {
      const item = this.queue.find((i) => i.status === 'PENDING');
      if (!item) break;

      item.attempts += 1;
      try {
        const res = await this.dispatcher.reportSimplifiedInvoice({
          signedXmlBase64: item.signedXmlBase64,
          invoiceHash: item.invoiceHash,
          uuid: item.uuid,
          pcsidToken: item.pcsidToken,
          secret: item.secret,
        });

        if (res.reportingStatus === 'REPORTED' || res.status === 'REPORTED' || res.status === 'REPORTED_SIMULATED') {
          item.status = 'REPORTED';
        } else {
          item.lastError = JSON.stringify(res);
          if (item.attempts >= 3) {
            item.status = 'FAILED';
          }
        }
      } catch (err: any) {
        item.lastError = err.message || String(err);
        if (item.attempts >= 3) {
          item.status = 'FAILED';
        }
      }
    }

    this.isProcessing = false;
  }

  getQueueStatus() {
    return {
      pendingCount: this.queue.filter((i) => i.status === 'PENDING').length,
      reportedCount: this.queue.filter((i) => i.status === 'REPORTED').length,
      failedCount: this.queue.filter((i) => i.status === 'FAILED').length,
      total: this.queue.length,
      items: [...this.queue],
    };
  }
}

export const reportingQueue = new ZatcaReportingQueue(
  (process.env.ZATCA_ENV as 'simulation' | 'production') || 'simulation'
);
