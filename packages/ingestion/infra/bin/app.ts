#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { LanternStack } from "../lib/lantern-stack";

const app = new App();
new LanternStack(app, "LanternStack");
