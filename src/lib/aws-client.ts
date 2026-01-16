import {
    CostExplorerClient,
    GetCostAndUsageCommand,
    GetCostAndUsageCommandInput,
    ResultByTime,
} from '@aws-sdk/client-cost-explorer';
import { fromIni } from '@aws-sdk/credential-providers';

export class AwsCostClient {
    private client: CostExplorerClient;

    constructor(profileName?: string, region: string = 'us-east-1') {
        this.client = new CostExplorerClient({
            region,
            credentials: profileName ? fromIni({ profile: profileName }) : undefined,
        });
    }

    async getCostAndUsage(
        start: string,
        end: string,
        granularity: 'DAILY' | 'MONTHLY',
        filter?: any
    ): Promise<ResultByTime[]> {
        const params: GetCostAndUsageCommandInput = {
            TimePeriod: { Start: start, End: end },
            Granularity: granularity,
            Metrics: ['UnblendedCost', 'AmortizedCost', 'UsageQuantity'],
            Filter: filter,
        };

        try {
            const command = new GetCostAndUsageCommand(params);
            const data = await this.client.send(command);
            return data.ResultsByTime || [];
        } catch (error) {
            console.error('Error fetching cost data:', error);
            throw error;
        }
    }
}
