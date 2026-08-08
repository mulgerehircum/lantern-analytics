import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as path from "node:path";

/**
 * Free-tier-pinned by design. PROVISIONED billing at exactly 25 RCU/25 WCU is
 * AWS's perpetual (not 12-month) always-free DynamoDB allotment. On-demand
 * billing has no equivalent free tier — switching to it would quietly break
 * the "this costs nothing at demo scale" claim the whole project is built
 * around, so this is a deliberate constraint, not an oversight if it ever
 * looks like an odd choice for a table that might want to scale later.
 */
const FREE_TIER_CAPACITY = 25;

// Both Lambdas ship as pre-built JS from the package's own esbuild step
// (see package.json's `build` script) — infra never re-bundles application
// code, it only wires together what already exists in dist/.
const LAMBDA_DIST_DIR = path.join(__dirname, "../../dist");

export class LanternStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, "EventsTable", {
      tableName: "lantern-events",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: FREE_TIER_CAPACITY,
      writeCapacity: FREE_TIER_CAPACITY,
      timeToLiveAttribute: "ttl",
      // Analytics data must never be deleted just because the stack is torn
      // down (e.g. during infra iteration) — the table survives independently.
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const ingestionFn = new lambda.Function(this, "IngestionFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(LAMBDA_DIST_DIR),
      environment: { EVENTS_TABLE_NAME: table.tableName },
      memorySize: 128,
      timeout: Duration.seconds(5),
    });
    table.grantWriteData(ingestionFn);

    const rollupFn = new lambda.Function(this, "RollupFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "rollup-handler.handler",
      code: lambda.Code.fromAsset(LAMBDA_DIST_DIR),
      environment: {
        EVENTS_TABLE_NAME: table.tableName,
        // Empty until real sites exist — see rollup-handler.ts's doc comment
        // on why this env-var-as-registry is a Phase 1 simplification.
        SITE_IDS: "",
      },
      memorySize: 128,
      timeout: Duration.seconds(30),
    });
    table.grantReadWriteData(rollupFn);

    // corsPreflight handles OPTIONS at the gateway itself — no Lambda
    // invocation (and no cost) per preflight. The Lambda's own OPTIONS
    // branch (handler.ts) stays as a defensive fallback, not the primary path.
    const httpApi = new apigwv2.HttpApi(this, "IngestApi", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ["Content-Type"],
      },
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwIntegrations.HttpLambdaIntegration(
        "IngestIntegration",
        ingestionFn,
      ),
    });

    new events.Rule(this, "RollupSchedule", {
      schedule: events.Schedule.rate(Duration.hours(1)),
      targets: [new targets.LambdaFunction(rollupFn)],
    });

    // CloudFront in front of the HTTP API — the only reason this exists is
    // to get the CloudFront-Viewer-Country header for free geo resolution
    // at the edge (see geo.ts). Caching is fully disabled: every request is
    // a real POST that has to reach the Lambda, nothing here is cacheable.
    const viewerCountryPolicy = new cloudfront.OriginRequestPolicy(this, "ViewerCountryPolicy", {
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("CloudFront-Viewer-Country"),
    });
    const cdn = new cloudfront.Distribution(this, "IngestCdn", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
        ),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: viewerCountryPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });

    new CfnOutput(this, "IngestEndpoint", {
      value: `${httpApi.apiEndpoint}/events`,
      description: "Raw API Gateway endpoint (bypasses CloudFront — no country resolution)",
    });
    new CfnOutput(this, "CdnIngestEndpoint", {
      value: `https://${cdn.distributionDomainName}/events`,
      description: "data-endpoint value for the tracker script's script tag (via CloudFront, resolves country)",
    });
  }
}
