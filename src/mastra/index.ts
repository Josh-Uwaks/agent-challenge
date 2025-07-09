import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent/weather-agent"; // This can be deleted later
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow"; // This can be deleted later
import { travelAgent } from "./agents/travel-agent/agent/travel-agent";
import { travelWorkflow } from "./agents/travel-agent/workflow/travelworkflow";

export const mastra = new Mastra({
	workflows: { weatherWorkflow, travelWorkflow }, // can be deleted later
	agents: { weatherAgent, travelAgent },
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});
