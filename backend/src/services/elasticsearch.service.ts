import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { db } from '../db';
import { EmailJobRecord } from '../types';

class ElasticsearchService {
  private client: Client | null = null;
  private isConnected = false;
  private readonly indexName = env.ELASTICSEARCH_INDEX;

  async init(): Promise<void> {
    try {
      const client = new Client({
        node: env.ELASTICSEARCH_URL,
        requestTimeout: 2500,
        maxRetries: 1,
      });

      await client.ping();
      this.client = client;
      this.isConnected = true;

      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              senderEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        });
      }

      console.log(
        `✅ [Elasticsearch] Connected to ${env.ELASTICSEARCH_URL} (index: ${this.indexName})`
      );
    } catch {
      this.isConnected = false;
      console.log(
        'ℹ️  [Elasticsearch] Cluster not reachable on localhost:9200 — using relational full-text search fallback'
      );
    }
  }

  public getStatus(): { connected: boolean; index: string } {
    return { connected: this.isConnected, index: this.indexName };
  }

  /**
   * Indexes or updates an email document in Elasticsearch whenever an email is scheduled,
   * rate-limited, sent, or failed.
   */
  async indexEmailJob(job: EmailJobRecord): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      await this.client.index({
        index: this.indexName,
        id: job.id,
        document: {
          id: job.id,
          userId: job.userId,
          senderId: job.senderId,
          senderEmail: job.senderEmail,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          body: job.body,
          status: job.status,
          scheduledAt: job.scheduledAt,
          sentAt: job.sentAt || null,
          etherealPreviewUrl: job.etherealPreviewUrl || null,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
        refresh: true,
      });
    } catch (err) {
      console.warn(
        `⚠️ [Elasticsearch] Failed to index email job ${job.id}:`,
        (err as Error).message
      );
    }
  }

  /**
   * Searches scheduled and sent emails via Elasticsearch multi_match + wildcard query,
   * falling back to relational DB search if Elasticsearch is offline.
   */
  async searchEmails(
    userId: string,
    query: string,
    tab?: 'scheduled' | 'sent'
  ): Promise<{ results: EmailJobRecord[]; engine: 'elasticsearch' | 'database' }> {
    if (this.isConnected && this.client && query.trim()) {
      try {
        const statusFilter =
          tab === 'scheduled'
            ? ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED']
            : tab === 'sent'
            ? ['SENT', 'FAILED']
            : undefined;

        const mustFilters: any[] = [{ term: { userId } }];
        if (statusFilter) {
          mustFilters.push({ terms: { status: statusFilter } });
        }

        const response = await this.client.search({
          index: this.indexName,
          size: 200,
          query: {
            bool: {
              filter: mustFilters,
              must: [
                {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query: query.trim(),
                          fields: [
                            'recipientEmail^3',
                            'subject^2',
                            'body',
                            'senderEmail',
                          ],
                          fuzziness: 'AUTO',
                        },
                      },
                      {
                        wildcard: {
                          'recipientEmail.keyword': {
                            value: `*${query.trim().toLowerCase()}*`,
                            case_insensitive: true,
                          },
                        },
                      },
                    ],
                    minimum_should_match: 1,
                  },
                },
              ],
            },
          },
        });

        const ids = response.hits.hits
          .map((hit: any) => hit._source?.id || hit._id)
          .filter(Boolean);

        const records: EmailJobRecord[] = [];
        for (const id of ids) {
          const item = await db.getEmailJobById(id);
          if (item) records.push(item);
        }

        return { results: records, engine: 'elasticsearch' };
      } catch (err) {
        console.warn(
          '⚠️ [Elasticsearch] Search error, falling back to DB search:',
          (err as Error).message
        );
      }
    }

    const fallbackResults = await db.searchEmailJobsInDb(userId, query, tab);
    return { results: fallbackResults, engine: 'database' };
  }
}

export const elasticsearchService = new ElasticsearchService();

