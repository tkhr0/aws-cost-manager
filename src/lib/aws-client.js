"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsCostClient = void 0;
const client_cost_explorer_1 = require("@aws-sdk/client-cost-explorer");
const credential_providers_1 = require("@aws-sdk/credential-providers");
class AwsCostClient {
    constructor(profileName, region = 'us-east-1') {
        this.client = new client_cost_explorer_1.CostExplorerClient({
            region,
            credentials: profileName ? (0, credential_providers_1.fromIni)({ profile: profileName }) : undefined,
        });
    }
    async getCostAndUsage(start, end, granularity, filter) {
        const params = {
            TimePeriod: { Start: start, End: end },
            Granularity: granularity,
            Metrics: ['UnblendedCost', 'AmortizedCost', 'UsageQuantity'],
            Filter: filter,
        };
        try {
            const command = new client_cost_explorer_1.GetCostAndUsageCommand(params);
            const data = await this.client.send(command);
            return data.ResultsByTime || [];
        }
        catch (error) {
            console.error('Error fetching cost data:', error);
            throw error;
        }
    }
}
exports.AwsCostClient = AwsCostClient;
